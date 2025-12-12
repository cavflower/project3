from rest_framework import generics, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status as http_status
from django.shortcuts import get_object_or_404
from firebase_admin import firestore
from .serializers import TakeoutOrderSerializer, DineInOrderSerializer, NotificationSerializer
from .models import TakeoutOrder, DineInOrder, Notification
from apps.stores.models import Store
from django.db.models import Q


class OrderListView(generics.ListAPIView):
    """商家訂單列表 API - 從 PostgreSQL 讀取資料"""
    permission_classes = [permissions.AllowAny]
    
    def get(self, request, *args, **kwargs):
        # 獲取商家店家 ID
        store_id = request.query_params.get('store_id')
        if not store_id:
            return Response(
                {'detail': 'store_id is required'}, 
                status=http_status.HTTP_400_BAD_REQUEST
            )
        
        try:
            store = Store.objects.get(pk=store_id)
        except Store.DoesNotExist:
            return Response(
                {'detail': 'Store not found'}, 
                status=http_status.HTTP_404_NOT_FOUND
            )
        
        # 查詢外帶訂單
        takeout_orders = TakeoutOrder.objects.filter(store=store).select_related('store')
        # 查詢內用訂單
        dinein_orders = DineInOrder.objects.filter(store=store).select_related('store')
        
        # 合併訂單資料
        orders = []
        
        # 處理外帶訂單
        for order in takeout_orders:
            orders.append({
                'id': order.pickup_number,
                'pickup_number': order.pickup_number,
                'order_number': order.pickup_number,
                'customer_name': order.customer_name,
                'customer_phone': order.customer_phone,
                'payment_method': order.payment_method,
                'notes': order.notes,
                'status': order.status,
                'use_utensils': order.use_utensils,
                'use_eco_tableware': False,
                'service_channel': 'takeout',
                'channel': 'takeout',
                'table_label': '',
                'pickup_at': order.pickup_at.isoformat() if order.pickup_at else None,
                'created_at': order.created_at.isoformat() if order.created_at else None,
                'items': [
                    {'product_id': item.product_id, 'quantity': item.quantity}
                    for item in order.items.all()
                ]
            })
        
        # 處理內用訂單
        for order in dinein_orders:
            orders.append({
                'id': order.order_number,
                'pickup_number': order.order_number,
                'order_number': order.order_number,
                'customer_name': order.customer_name,
                'customer_phone': order.customer_phone,
                'payment_method': order.payment_method,
                'notes': order.notes,
                'status': order.status,
                'use_utensils': False,
                'use_eco_tableware': order.use_eco_tableware,
                'service_channel': 'dine_in',
                'channel': 'dine_in',
                'table_label': order.table_label,
                'created_at': order.created_at.isoformat() if order.created_at else None,
                'items': [
                    {'product_id': item.product_id, 'quantity': item.quantity}
                    for item in order.items.all()
                ]
            })
        
        # 按建立時間排序（最新的在前）
        orders.sort(key=lambda x: x['created_at'] or '', reverse=True)
        
        return Response(orders)


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
    VALID_DINEIN_STATUS = {'pending', 'accepted', 'ready_for_pickup', 'completed', 'rejected'}

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

class CustomerOrderListView(APIView):
    """顧客訂單列表 API"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request, *args, **kwargs):
        user = request.user
        
        # 查詢外帶訂單
        takeout_orders = TakeoutOrder.objects.filter(user=user).select_related('store')
        # 查詢內用訂單
        dinein_orders = DineInOrder.objects.filter(user=user).select_related('store')
        
        # 合併訂單資料
        orders = []
        
        # 處理外帶訂單
        for order in takeout_orders:
            orders.append({
                'id': order.id,
                'store_name': order.store.name,
                'pickup_number': order.pickup_number,
                'order_number': order.pickup_number,
                'customer_name': order.customer_name,
                'customer_phone': order.customer_phone,
                'payment_method': order.get_payment_method_display(),
                'notes': order.notes,
                'status': order.status,
                'status_display': order.get_status_display(),
                'order_type_display': '外帶',
                'pickup_at': order.pickup_at.isoformat() if order.pickup_at else None,
                'created_at': order.created_at.isoformat() if order.created_at else None,
            })
        
        # 處理內用訂單
        for order in dinein_orders:
            orders.append({
                'id': order.id,
                'store_name': order.store.name,
                'pickup_number': order.order_number,
                'order_number': order.order_number,
                'customer_name': order.customer_name,
                'customer_phone': order.customer_phone,
                'payment_method': order.get_payment_method_display(),
                'notes': order.notes,
                'status': order.status,
                'status_display': order.get_status_display(),
                'order_type_display': '內用',
                'table_label': order.table_label,
                'created_at': order.created_at.isoformat() if order.created_at else None,
            })
        
        # 按建立時間排序（最新的在前）
        orders.sort(key=lambda x: x['created_at'] or '', reverse=True)
        
        return Response(orders)


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """通知 ViewSet"""
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)
    
    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        self.get_queryset().update(is_read=True)
        return Response({'status': 'success'})
