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
from apps.surplus_food.models import SurplusFoodOrder
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
        
        # 查詢外帶訂單 - 使用 prefetch_related 優化 items 查詢
        takeout_orders = TakeoutOrder.objects.filter(store=store).select_related(
            'store'
        ).prefetch_related('items')
        # 查詢內用訂單 - 使用 prefetch_related 優化 items 查詢
        dinein_orders = DineInOrder.objects.filter(store=store).select_related(
            'store'
        ).prefetch_related('items')
        
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
                    {
                        'product_id': item.product_id,
                        'quantity': item.quantity,
                        'unit_price': float(item.unit_price) if item.unit_price else None,
                        'specifications': item.specifications or []
                    }
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
                    {
                        'product_id': item.product_id,
                        'quantity': item.quantity,
                        'unit_price': float(item.unit_price) if item.unit_price else None,
                        'specifications': item.specifications or []
                    }
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
            
            # 如果狀態變更為 completed 或 rejected，保持 Firestore 中的狀態更新
            # 不刪除，讓顧客端可以收到即時通知
            
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
        
        # 查詢外帶訂單 - 優化查詢效能
        takeout_orders = TakeoutOrder.objects.filter(user=user).select_related(
            'store'
        ).prefetch_related('items', 'items__product')
        # 查詢內用訂單 - 優化查詢效能
        dinein_orders = DineInOrder.objects.filter(user=user).select_related(
            'store'
        ).prefetch_related('items', 'items__product')
        # 查詢惜福品訂單 - 優化查詢效能
        surplus_orders = SurplusFoodOrder.objects.filter(user=user).select_related(
            'store'
        ).prefetch_related('items', 'items__surplus_food')
        
        # 合併訂單資料
        orders = []
        
        # 處理外帶訂單
        for order in takeout_orders:
            # 獲取訂單項目
            items = []
            for item in order.items.select_related('product').all():
                items.append({
                    'id': item.id,
                    'product_id': item.product.id,
                    'product_name': item.product.name,
                    'quantity': item.quantity,
                    'price': float(item.product.price),
                })
            
            orders.append({
                'id': order.id,
                'store_name': order.store.name,
                'store_id': order.store.id,
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
                'items': items,
            })
        
        # 處理內用訂單
        for order in dinein_orders:
            # 獲取訂單項目
            items = []
            for item in order.items.select_related('product').all():
                items.append({
                    'id': item.id,
                    'product_id': item.product.id,
                    'product_name': item.product.name,
                    'quantity': item.quantity,
                    'price': float(item.product.price),
                })
            
            orders.append({
                'id': order.id,
                'store_name': order.store.name,
                'store_id': order.store.id,
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
                'items': items,
            })

        # 處理惜福品訂單
        for order in surplus_orders:
            orders.append({
                'id': order.id,
                'store_name': order.store.name,
                'pickup_number': order.pickup_number,
                'order_number': order.order_number,
                'customer_name': order.customer_name,
                'customer_phone': order.customer_phone,
                'payment_method': order.get_payment_method_display(),
                'notes': order.notes,
                'status': order.status,
                'status_display': order.get_status_display(),
                'order_type_display': '惜福品',
                'pickup_at': order.pickup_time.isoformat() if order.pickup_time else None,
                'created_at': order.created_at.isoformat() if order.created_at else None,
                'total_price': order.total_price,
            })
        
        # 按建立時間排序（最新的在前）
        orders.sort(key=lambda x: x['created_at'] or '', reverse=True)
        
        return Response(orders)


class MerchantPendingOrdersView(APIView):
    """商家待確認訂單列表 API - 包含外帶、內用、惜福品訂單"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request, *args, **kwargs):
        user = request.user
        
        # 獲取商家的店家
        try:
            merchant = user.merchant_profile
            store = merchant.store
        except Exception:
            return Response({'detail': '找不到店家資料'}, status=http_status.HTTP_404_NOT_FOUND)
        
        pending_orders = []
        
        # 查詢待確認外帶訂單
        takeout_orders = TakeoutOrder.objects.filter(
            store=store, status='pending'
        ).select_related('store').order_by('-created_at')
        
        for order in takeout_orders:
            pending_orders.append({
                'id': order.id,
                'order_number': order.pickup_number,
                'customer_name': order.customer_name,
                'customer_phone': order.customer_phone,
                'order_type': 'takeout',
                'order_type_display': '外帶',
                'created_at': order.created_at.isoformat() if order.created_at else None,
                'pickup_at': order.pickup_at.isoformat() if order.pickup_at else None,
            })
        
        # 查詢待確認內用訂單
        dinein_orders = DineInOrder.objects.filter(
            store=store, status='pending'
        ).select_related('store').order_by('-created_at')
        
        for order in dinein_orders:
            pending_orders.append({
                'id': order.id,
                'order_number': order.order_number,
                'customer_name': order.customer_name,
                'customer_phone': order.customer_phone,
                'order_type': 'dine_in',
                'order_type_display': '內用',
                'table_label': order.table_label,
                'created_at': order.created_at.isoformat() if order.created_at else None,
            })
        
        # 查詢待確認惜福品訂單
        surplus_orders = SurplusFoodOrder.objects.filter(
            store=store, status='pending'
        ).select_related('store').order_by('-created_at')
        
        for order in surplus_orders:
            pending_orders.append({
                'id': order.id,
                'order_number': order.pickup_number,  # 使用 pickup_number 顯示取餐號碼
                'customer_name': order.customer_name,
                'customer_phone': order.customer_phone,
                'order_type': 'surplus',
                'order_type_display': '惜福品',
                'created_at': order.created_at.isoformat() if order.created_at else None,
                'pickup_time': order.pickup_time.isoformat() if order.pickup_time else None,
            })
        
        # 按建立時間排序（最新的在前）
        pending_orders.sort(key=lambda x: x['created_at'] or '', reverse=True)
        
        return Response({
            'pending_orders': pending_orders,
            'total_count': len(pending_orders)
        })


class NotificationViewSet(viewsets.ModelViewSet):
    """通知 ViewSet"""
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user).order_by('-created_at')
    
    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        self.get_queryset().update(is_read=True)
        return Response({'status': 'success'})
    
    @action(detail=False, methods=['delete'])
    def delete_all(self, request):
        """刪除所有通知"""
        self.get_queryset().delete()
        return Response({'status': 'success'})
    
    @action(detail=True, methods=['delete'])
    def delete_one(self, request, pk=None):
        """刪除單個通知"""
        try:
            notification = self.get_queryset().get(pk=pk)
            notification.delete()
            return Response({'status': 'success'})
        except Notification.DoesNotExist:
            return Response({'error': '通知不存在'}, status=404)


class GuestOrderLookupView(APIView):
    """訪客訂單查詢 API - 透過電話號碼查詢訂單"""
    permission_classes = [permissions.AllowAny]
    
    def post(self, request, *args, **kwargs):
        phone_number = request.data.get('phone_number')
        
        if not phone_number:
            return Response(
                {'error': '請提供手機號碼'},
                status=http_status.HTTP_400_BAD_REQUEST
            )
        
        # 驗證手機號碼格式
        import re
        if not re.match(r'^09\d{8}$', phone_number):
            return Response(
                {'error': '請輸入正確的手機號碼格式 (09xxxxxxxx)'},
                status=http_status.HTTP_400_BAD_REQUEST
            )
        
        # 查詢最近 30 天的訂單
        from datetime import timedelta
        from django.utils import timezone
        thirty_days_ago = timezone.now() - timedelta(days=30)
        
        orders = []
        
        # 查詢外帶訂單
        takeout_orders = TakeoutOrder.objects.filter(
            customer_phone=phone_number,
            created_at__gte=thirty_days_ago
        ).select_related('store').order_by('-created_at')
        
        for order in takeout_orders:
            orders.append({
                'id': order.id,
                'order_type': 'takeout',
                'order_type_display': '外帶',
                'store_name': order.store.name if order.store else '未知店家',
                'store_id': order.store.id if order.store else None,
                'order_number': order.pickup_number,
                'customer_name': order.customer_name,
                'status': order.status,
                'status_display': order.get_status_display(),
                'payment_method': order.get_payment_method_display(),
                'pickup_at': order.pickup_at.isoformat() if order.pickup_at else None,
                'created_at': order.created_at.isoformat() if order.created_at else None,
                'notes': order.notes,
            })
        
        # 查詢內用訂單
        dinein_orders = DineInOrder.objects.filter(
            customer_phone=phone_number,
            created_at__gte=thirty_days_ago
        ).select_related('store').order_by('-created_at')
        
        for order in dinein_orders:
            orders.append({
                'id': order.id,
                'order_type': 'dine_in',
                'order_type_display': '內用',
                'store_name': order.store.name if order.store else '未知店家',
                'store_id': order.store.id if order.store else None,
                'order_number': order.order_number,
                'customer_name': order.customer_name,
                'table_label': order.table_label,
                'status': order.status,
                'status_display': order.get_status_display(),
                'payment_method': order.get_payment_method_display(),
                'created_at': order.created_at.isoformat() if order.created_at else None,
                'notes': order.notes,
            })
        
        # 查詢惜福品訂單
        surplus_orders = SurplusFoodOrder.objects.filter(
            customer_phone=phone_number,
            created_at__gte=thirty_days_ago
        ).select_related('store').order_by('-created_at')
        
        for order in surplus_orders:
            orders.append({
                'id': order.id,
                'order_type': 'surplus',
                'order_type_display': '惜福品',
                'store_name': order.store.name if order.store else '未知店家',
                'store_id': order.store.id if order.store else None,
                'order_number': order.pickup_number,
                'customer_name': order.customer_name,
                'status': order.status,
                'status_display': order.get_status_display(),
                'payment_method': order.get_payment_method_display(),
                'pickup_time': order.pickup_time.isoformat() if order.pickup_time else None,
                'created_at': order.created_at.isoformat() if order.created_at else None,
                'notes': order.notes,
            })
        
        # 按建立時間排序
        orders.sort(key=lambda x: x['created_at'] or '', reverse=True)
        
        if not orders:
            return Response(
                {'error': '找不到訂單記錄，請確認手機號碼是否正確'},
                status=http_status.HTTP_404_NOT_FOUND
            )
        
        return Response({
            'orders': orders,
            'count': len(orders)
        })
