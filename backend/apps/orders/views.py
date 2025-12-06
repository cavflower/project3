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
    VALID_STATUS = {'pending', 'accepted', 'in_progress', 'completed', 'rejected'}

    def patch(self, request, pickup_number):
        new_status = request.data.get('status')
        if new_status not in self.VALID_STATUS:
            return Response({'detail': 'Invalid status'}, status=http_status.HTTP_400_BAD_REQUEST)
        try:
            firestore.client().collection('orders').document(pickup_number).update(
                {
                    'status': new_status,
                    'updated_at': firestore.SERVER_TIMESTAMP,
                }
            )
            return Response({'pickup_number': pickup_number, 'status': new_status})
        except Exception as exc:  # noqa: BLE001
            return Response({'detail': str(exc)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def delete(self, request, pickup_number):
        """刪除已完成或已拒絕的訂單"""
        try:
            # 從 Firestore 獲取訂單檢查狀態
            doc_ref = firestore.client().collection('orders').document(pickup_number)
            doc = doc_ref.get()
            
            if not doc.exists:
                return Response({'detail': 'Order not found'}, status=http_status.HTTP_404_NOT_FOUND)
            
            order_data = doc.to_dict()
            order_status = order_data.get('status')
            
            # 只允許刪除已完成或已拒絕的訂單
            if order_status not in ['completed', 'rejected']:
                return Response(
                    {'detail': 'Only completed or rejected orders can be deleted'}, 
                    status=http_status.HTTP_400_BAD_REQUEST
                )
            
            # 刪除訂單
            doc_ref.delete()
            return Response({'detail': 'Order deleted successfully'}, status=http_status.HTTP_204_NO_CONTENT)
        except Exception as exc:
            return Response({'detail': str(exc)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)
