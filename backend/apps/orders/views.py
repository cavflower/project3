from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status as http_status
from django.shortcuts import get_object_or_404
from firebase_admin import firestore
from .serializers import TakeoutOrderSerializer
from apps.stores.models import Store


class TakeoutOrderCreateView(generics.CreateAPIView):
    serializer_class = TakeoutOrderSerializer
    permission_classes = [permissions.AllowAny]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        store = get_object_or_404(Store, pk=self.request.data.get('store'))
        context['store'] = store
        return context


class OrderStatusUpdateView(APIView):
    permission_classes = [permissions.AllowAny]
    VALID_STATUS = {'pending', 'accepted', 'ready_for_pickup', 'completed', 'rejected'}

    def patch(self, request, pickup_number):
        new_status = request.data.get('status')
        if new_status not in self.VALID_STATUS:
            return Response({'detail': 'Invalid status'}, status=http_status.HTTP_400_BAD_REQUEST)
        
        try:
            from .models import TakeoutOrder
            
            # 更新 Firestore 狀態
            firestore.client().collection('orders').document(pickup_number).update(
                {
                    'status': new_status,
                    'updated_at': firestore.SERVER_TIMESTAMP,
                }
            )
            
            # 如果狀態變更為 completed 或 rejected，從 Firestore 刪除（保留 PostgreSQL 資料）
            if new_status in ['completed', 'rejected']:
                try:
                    # 更新 PostgreSQL 狀態
                    order = TakeoutOrder.objects.get(pickup_number=pickup_number)
                    order.status = new_status
                    order.save()
                    
                    # 刪除 Firestore 中的即時通知資料
                    firestore.client().collection('orders').document(pickup_number).delete()
                except TakeoutOrder.DoesNotExist:
                    pass  # PostgreSQL 中沒有記錄，繼續
                except Exception as db_err:
                    print(f"Failed to update PostgreSQL: {db_err}")
            
            return Response({'pickup_number': pickup_number, 'status': new_status})
        except Exception as exc:  # noqa: BLE001
            return Response({'detail': str(exc)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def delete(self, request, pickup_number):
        """刪除已完成或已拒絕的訂單（只刪除 PostgreSQL，Firestore 已在狀態變更時刪除）"""
        try:
            from .models import TakeoutOrder
            
            # 1. 從 PostgreSQL 獲取訂單
            try:
                order = TakeoutOrder.objects.get(pickup_number=pickup_number)
            except TakeoutOrder.DoesNotExist:
                return Response({'detail': 'Order not found in database'}, status=http_status.HTTP_404_NOT_FOUND)
            
            # 2. 檢查狀態，只允許刪除已完成或已拒絕的訂單
            if order.status not in ['completed', 'rejected']:
                return Response(
                    {'detail': 'Only completed or rejected orders can be deleted'}, 
                    status=http_status.HTTP_400_BAD_REQUEST
                )
            
            # 3. 刪除 PostgreSQL 資料
            order.delete()
            
            # 4. 嘗試刪除 Firestore 資料（如果還存在的話）
            try:
                doc_ref = firestore.client().collection('orders').document(pickup_number)
                doc_ref.delete()
            except Exception as firestore_err:
                # Firestore 刪除失敗不影響主要流程（可能已經被刪除）
                print(f"Failed to delete from Firestore: {firestore_err}")
            
            return Response({'detail': 'Order deleted successfully'}, status=http_status.HTTP_204_NO_CONTENT)
        except Exception as exc:
            return Response({'detail': str(exc)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)
