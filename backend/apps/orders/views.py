from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status as http_status
from django.shortcuts import get_object_or_404
from firebase_admin import firestore
from .serializers import TakeoutOrderSerializer, DineInOrderSerializer
from .models import TakeoutOrder, DineInOrder
from apps.stores.models import Store


class TakeoutOrderCreateView(generics.CreateAPIView):
    """外帶訂單創建 API"""
    serializer_class = TakeoutOrderSerializer
    permission_classes = [permissions.AllowAny]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        store = get_object_or_404(Store, pk=self.request.data.get('store'))
        context['store'] = store
        return context


class DineInOrderCreateView(generics.CreateAPIView):
    """內用訂單創建 API"""
    serializer_class = DineInOrderSerializer
    permission_classes = [permissions.AllowAny]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        store = get_object_or_404(Store, pk=self.request.data.get('store'))
        context['store'] = store
        return context


class OrderStatusUpdateView(APIView):
    """訂單狀態更新 API - 支援外帶和內用訂單"""
    permission_classes = [permissions.AllowAny]
    VALID_TAKEOUT_STATUS = {'pending', 'accepted', 'ready_for_pickup', 'completed', 'rejected'}
    VALID_DINEIN_STATUS = {'pending', 'accepted', 'preparing', 'ready', 'completed', 'rejected'}

    def patch(self, request, pickup_number):
        new_status = request.data.get('status')
        
        try:
            # 嘗試查找外帶訂單
            try:
                order = TakeoutOrder.objects.get(pickup_number=pickup_number)
                order_type = 'takeout'
                valid_status = self.VALID_TAKEOUT_STATUS
            except TakeoutOrder.DoesNotExist:
                # 嘗試查找內用訂單
                try:
                    order = DineInOrder.objects.get(order_number=pickup_number)
                    order_type = 'dinein'
                    valid_status = self.VALID_DINEIN_STATUS
                except DineInOrder.DoesNotExist:
                    return Response({'detail': 'Order not found'}, status=http_status.HTTP_404_NOT_FOUND)
            
            # 驗證狀態
            if new_status not in valid_status:
                return Response(
                    {'detail': f'Invalid status. Valid options: {valid_status}'}, 
                    status=http_status.HTTP_400_BAD_REQUEST
                )
            
            # 更新 Firestore 狀態
            firestore.client().collection('orders').document(pickup_number).update({
                'status': new_status,
                'updated_at': firestore.SERVER_TIMESTAMP,
            })
            
            # 更新 PostgreSQL 狀態
            order.status = new_status
            if new_status == 'completed':
                from django.utils import timezone
                order.completed_at = timezone.now()
            order.save()
            
            # 如果狀態變更為 completed 或 rejected，從 Firestore 刪除
            if new_status in ['completed', 'rejected']:
                firestore.client().collection('orders').document(pickup_number).delete()
            
            return Response({
                'pickup_number': pickup_number, 
                'status': new_status,
                'order_type': order_type
            })
            
        except Exception as exc:
            return Response({'detail': str(exc)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def delete(self, request, pickup_number):
        """刪除已完成或已拒絕的訂單"""
        try:
            # 嘗試查找並刪除外帶訂單
            try:
                order = TakeoutOrder.objects.get(pickup_number=pickup_number)
            except TakeoutOrder.DoesNotExist:
                # 嘗試查找內用訂單
                try:
                    order = DineInOrder.objects.get(order_number=pickup_number)
                except DineInOrder.DoesNotExist:
                    return Response({'detail': 'Order not found'}, status=http_status.HTTP_404_NOT_FOUND)
            
            # 檢查狀態
            if order.status not in ['completed', 'rejected']:
                return Response(
                    {'detail': 'Only completed or rejected orders can be deleted'}, 
                    status=http_status.HTTP_400_BAD_REQUEST
                )
            
            # 刪除 PostgreSQL 資料
            order.delete()
            
            # 嘗試刪除 Firestore 資料
            try:
                firestore.client().collection('orders').document(pickup_number).delete()
            except Exception:
                pass
            
            return Response({'detail': 'Order deleted successfully'}, status=http_status.HTTP_204_NO_CONTENT)
            
        except Exception as exc:
            return Response({'detail': str(exc)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)
