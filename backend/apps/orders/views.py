from rest_framework import generics, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status as http_status
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.core.cache import cache
from firebase_admin import firestore
from .serializers import TakeoutOrderSerializer, DineInOrderSerializer, NotificationSerializer
from .models import TakeoutOrder, DineInOrder, Notification
from apps.stores.models import Store
from apps.surplus_food.models import SurplusFoodOrder
from django.db.models import Q
from datetime import datetime
import threading
import logging


logger = logging.getLogger(__name__)
# 前端商家儀表板每 60 秒刷新一次，TTL 需高於刷新間隔才有實際命中效果。
ORDER_LIST_COUNT_CACHE_TTL_SECONDS = 75


def _parse_positive_int(value, default):
    try:
        parsed = int(value)
        return parsed if parsed > 0 else default
    except (TypeError, ValueError):
        return default


def _parse_month_range(month_value):
    """Parse YYYY-MM and return (start, end) datetime tuple."""
    if not month_value or month_value == 'all':
        return None, None

    try:
        month_start = datetime.strptime(month_value, '%Y-%m').replace(day=1)
    except ValueError:
        return None, None

    if timezone.is_naive(month_start):
        month_start = timezone.make_aware(month_start)

    if month_start.month == 12:
        month_end = month_start.replace(year=month_start.year + 1, month=1)
    else:
        month_end = month_start.replace(month=month_start.month + 1)

    return month_start, month_end


def _resolve_item_product_payload(item):
    product_id = item.snapshot_product_id or item.product_id
    product_name = item.snapshot_product_name or '已下架商品'

    unit_price = item.unit_price
    if unit_price is None and not item.snapshot_product_name and item.product_id:
        # 僅在舊資料缺快照時才回退讀取關聯商品，避免列表查詢額外成本。
        product = getattr(item, 'product', None)
        if product is not None:
            product_name = product.name
            unit_price = product.price

    return {
        'product_id': product_id,
        'product_name': product_name,
        'unit_price': unit_price,
        'snapshot_product_image': item.snapshot_product_image or None,
        'product_deleted': item.product_id is None,
    }


def _get_cached_count(cache_key, queryset):
    cached_count = cache.get(cache_key)
    if cached_count is not None:
        return cached_count

    count = queryset.count()
    cache.set(cache_key, count, ORDER_LIST_COUNT_CACHE_TTL_SECONDS)
    return count


def _async_update_firestore_order_status(document_id, status_value):
    def _task():
        try:
            firestore.client().collection('orders').document(document_id).update({
                'status': status_value,
                'updated_at': firestore.SERVER_TIMESTAMP,
            })
        except Exception:
            logger.exception('Failed to update Firestore order status for %s', document_id)

    threading.Thread(target=_task, daemon=True).start()


class OrderListView(generics.ListAPIView):
    """商家訂單列表 API - 從 PostgreSQL 讀取資料"""
    permission_classes = [permissions.AllowAny]

    @staticmethod
    def _serialize_takeout_order(order):
        items = []
        for item in order.items.all():
            item_payload = _resolve_item_product_payload(item)
            unit_price_value = float(item_payload['unit_price']) if item_payload['unit_price'] is not None else None
            subtotal_value = unit_price_value * item.quantity if unit_price_value is not None else None
            items.append({
                'product_id': item_payload['product_id'],
                'product_name': item_payload['product_name'],
                'quantity': item.quantity,
                'unit_price': unit_price_value,
                'subtotal': subtotal_value,
                'specifications': item.specifications or [],
                'snapshot_product_image': item_payload['snapshot_product_image'],
                'product_deleted': item_payload['product_deleted'],
            })

        if order.product_redemptions:
            for redemption in order.product_redemptions:
                items.append({
                    'product_id': None,
                    'product_name': f"【兌換】{redemption.get('name', '兌換商品')}",
                    'quantity': redemption.get('quantity', 1),
                    'unit_price': 0,
                    'subtotal': 0,
                    'is_redemption': True,
                    'specifications': []
                })

        total_amount = round(sum(float(item.get('subtotal') or 0) for item in items), 2)

        return {
            'id': order.pickup_number,
            'pickup_number': order.pickup_number,
            'order_number': order.pickup_number,
            'customer_name': order.customer_name,
            'customer_phone': order.customer_phone,
            'invoice_carrier': order.invoice_carrier,
            'payment_method': order.payment_method,
            'payment_method_display': order.get_payment_method_display(),
            'notes': order.notes,
            'status': order.status,
            'use_utensils': order.use_utensils,
            'use_eco_tableware': False,
            'service_channel': 'takeout',
            'channel': 'takeout',
            'table_label': '',
            'total_amount': total_amount,
            'pickup_at': order.pickup_at.isoformat() if order.pickup_at else None,
            'created_at': order.created_at.isoformat() if order.created_at else None,
            'items': items
        }

    @staticmethod
    def _serialize_dinein_order(order):
        items = []
        for item in order.items.all():
            item_payload = _resolve_item_product_payload(item)
            unit_price_value = float(item_payload['unit_price']) if item_payload['unit_price'] is not None else None
            subtotal_value = unit_price_value * item.quantity if unit_price_value is not None else None
            items.append({
                'product_id': item_payload['product_id'],
                'product_name': item_payload['product_name'],
                'quantity': item.quantity,
                'unit_price': unit_price_value,
                'subtotal': subtotal_value,
                'specifications': item.specifications or [],
                'snapshot_product_image': item_payload['snapshot_product_image'],
                'product_deleted': item_payload['product_deleted'],
            })

        if order.product_redemptions:
            for redemption in order.product_redemptions:
                items.append({
                    'product_id': None,
                    'product_name': f"【兌換】{redemption.get('name', '兌換商品')}",
                    'quantity': redemption.get('quantity', 1),
                    'unit_price': 0,
                    'subtotal': 0,
                    'is_redemption': True,
                    'specifications': []
                })

        total_amount = round(sum(float(item.get('subtotal') or 0) for item in items), 2)

        return {
            'id': order.order_number,
            'pickup_number': order.order_number,
            'order_number': order.order_number,
            'customer_name': order.customer_name,
            'customer_phone': order.customer_phone,
            'invoice_carrier': order.invoice_carrier,
            'payment_method': order.payment_method,
            'payment_method_display': order.get_payment_method_display(),
            'notes': order.notes,
            'status': order.status,
            'use_utensils': False,
            'use_eco_tableware': order.use_eco_tableware,
            'service_channel': 'dine_in',
            'channel': 'dine_in',
            'table_label': order.table_label,
            'total_amount': total_amount,
            'created_at': order.created_at.isoformat() if order.created_at else None,
            'items': items
        }
    
    def get(self, request, *args, **kwargs):
        # 獲取商家店家 ID
        store_id = request.query_params.get('store_id')
        if not store_id:
            return Response(
                {'detail': 'store_id is required'}, 
                status=http_status.HTTP_400_BAD_REQUEST
            )
        
        status_filter = request.query_params.get('status')
        channel_filter = request.query_params.get('channel', 'all')
        month_filter = request.query_params.get('month', 'all')
        paginated = str(request.query_params.get('paginated', '0')).lower() in {'1', 'true', 'yes'}
        page = _parse_positive_int(request.query_params.get('page'), 1)
        page_size = min(_parse_positive_int(request.query_params.get('page_size'), 9), 50)

        month_start, month_end = _parse_month_range(month_filter)
        count_cache_prefix = f"orders:list:store:{store_id}:status:{status_filter or 'all'}:month:{month_filter or 'all'}"

        # 查詢外帶訂單 - 使用 prefetch_related 優化 items 查詢
        takeout_base_qs = TakeoutOrder.objects.filter(store_id=store_id, is_hidden_from_merchant=False).select_related(
            'store'
        ).prefetch_related('items')

        # 查詢內用訂單 - 使用 prefetch_related 優化 items 查詢
        dinein_base_qs = DineInOrder.objects.filter(store_id=store_id, is_hidden_from_merchant=False).select_related(
            'store'
        ).prefetch_related('items')

        if status_filter and status_filter != 'all':
            takeout_base_qs = takeout_base_qs.filter(status=status_filter)
            dinein_base_qs = dinein_base_qs.filter(status=status_filter)

        if month_start and month_end:
            takeout_base_qs = takeout_base_qs.filter(created_at__gte=month_start, created_at__lt=month_end)
            dinein_base_qs = dinein_base_qs.filter(created_at__gte=month_start, created_at__lt=month_end)

        # 非法 channel fallback 到 all
        if channel_filter not in {'all', 'takeout', 'dine_in'}:
            channel_filter = 'all'
        
        if channel_filter == 'takeout':
            takeout_qs = takeout_base_qs.order_by('-created_at')
            total_count = _get_cached_count(f"{count_cache_prefix}:channel:takeout", takeout_qs)

            if paginated:
                start = (page - 1) * page_size
                end = start + page_size
                takeout_records = list(takeout_qs[start:end])
            else:
                takeout_records = list(takeout_qs)

            orders = [self._serialize_takeout_order(order) for order in takeout_records]

            if not paginated:
                return Response(orders)

            total_pages = max(1, (total_count + page_size - 1) // page_size)
            return Response({
                'results': orders,
                'total_count': total_count,
                'page': page,
                'page_size': page_size,
                'total_pages': total_pages,
            })

        if channel_filter == 'dine_in':
            dinein_qs = dinein_base_qs.order_by('-created_at')
            total_count = _get_cached_count(f"{count_cache_prefix}:channel:dine_in", dinein_qs)

            if paginated:
                start = (page - 1) * page_size
                end = start + page_size
                dinein_records = list(dinein_qs[start:end])
            else:
                dinein_records = list(dinein_qs)

            orders = [self._serialize_dinein_order(order) for order in dinein_records]

            if not paginated:
                return Response(orders)

            total_pages = max(1, (total_count + page_size - 1) // page_size)
            return Response({
                'results': orders,
                'total_count': total_count,
                'page': page,
                'page_size': page_size,
                'total_pages': total_pages,
            })

        # channel=all 時，僅在 paginated 模式下限制每個 queryset 讀取範圍，避免一次讀完整歷史資料
        takeout_qs = takeout_base_qs.order_by('-created_at')
        dinein_qs = dinein_base_qs.order_by('-created_at')

        takeout_count = _get_cached_count(f"{count_cache_prefix}:channel:takeout", takeout_qs)
        dinein_count = _get_cached_count(f"{count_cache_prefix}:channel:dine_in", dinein_qs)
        total_count = takeout_count + dinein_count

        if paginated:
            # 取 page*page_size 即可覆蓋該頁所需的全域排序資料，不需多抓一頁。
            fetch_limit = page * page_size
            takeout_records = list(takeout_qs[:fetch_limit])
            dinein_records = list(dinein_qs[:fetch_limit])
        else:
            takeout_records = list(takeout_qs)
            dinein_records = list(dinein_qs)

        orders = [self._serialize_takeout_order(order) for order in takeout_records]
        orders.extend(self._serialize_dinein_order(order) for order in dinein_records)
        orders.sort(key=lambda x: x['created_at'] or '', reverse=True)

        if not paginated:
            return Response(orders)

        start = (page - 1) * page_size
        end = start + page_size
        paged_orders = orders[start:end]
        total_pages = max(1, (total_count + page_size - 1) // page_size)

        return Response({
            'results': paged_orders,
            'total_count': total_count,
            'page': page,
            'page_size': page_size,
            'total_pages': total_pages,
        })


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

            # 更新 PostgreSQL 狀態
            order.status = new_status
            if new_status == 'completed':
                from django.utils import timezone
                order.completed_at = timezone.now()
            order.save()

            # Firestore 同步改為背景執行，避免阻塞 API 回應
            _async_update_firestore_order_status(pickup_number, new_status)
            
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
            
            # 只在商家端隱藏，保留顧客端歷史紀錄
            order.is_hidden_from_merchant = True
            order.save(update_fields=['is_hidden_from_merchant'])
            
            return Response(status=http_status.HTTP_204_NO_CONTENT)
            
        except Exception as exc:

            return Response({'detail': str(exc)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)

class CustomerOrderListView(APIView):
    """顧客訂單列表 API"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request, *args, **kwargs):
        user = request.user
        
        # 查詢外帶訂單 - 優化查詢效能
        takeout_orders = TakeoutOrder.objects.filter(user=user, is_hidden_from_customer=False).select_related(
            'store'
        ).prefetch_related('items')
        # 查詢內用訂單 - 優化查詢效能
        dinein_orders = DineInOrder.objects.filter(user=user, is_hidden_from_customer=False).select_related(
            'store'
        ).prefetch_related('items')
        # 查詢惜福品訂單 - 優化查詢效能
        surplus_orders = SurplusFoodOrder.objects.filter(user=user, is_hidden_from_customer=False).select_related(
            'store'
        ).prefetch_related('items', 'items__surplus_food')
        
        # 合併訂單資料
        orders = []
        
        # 處理外帶訂單
        for order in takeout_orders:
            # 獲取訂單項目
            items = []
            for item in order.items.all():
                item_payload = _resolve_item_product_payload(item)
                unit_price = item_payload['unit_price']
                unit_price_value = float(unit_price) if unit_price is not None else 0.0
                items.append({
                    'id': item.id,
                    'product_id': item_payload['product_id'],
                    'product_name': item_payload['product_name'],
                    'quantity': item.quantity,
                    'price': unit_price_value,
                    'unit_price': unit_price_value,
                    'subtotal': unit_price_value * item.quantity,
                    'specifications': item.specifications or [],
                    'snapshot_product_image': item_payload['snapshot_product_image'],
                    'product_deleted': item_payload['product_deleted'],
                })
            
            orders.append({
                'id': order.id,
                'store_name': order.store.name,
                'store_id': order.store.id,
                'pickup_number': order.pickup_number,
                'order_number': order.pickup_number,
                'customer_name': order.customer_name,
                'customer_phone': order.customer_phone,
                'invoice_carrier': order.invoice_carrier,
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
            for item in order.items.all():
                item_payload = _resolve_item_product_payload(item)
                unit_price = item_payload['unit_price']
                unit_price_value = float(unit_price) if unit_price is not None else 0.0
                items.append({
                    'id': item.id,
                    'product_id': item_payload['product_id'],
                    'product_name': item_payload['product_name'],
                    'quantity': item.quantity,
                    'price': unit_price_value,
                    'unit_price': unit_price_value,
                    'subtotal': unit_price_value * item.quantity,
                    'specifications': item.specifications or [],
                    'snapshot_product_image': item_payload['snapshot_product_image'],
                    'product_deleted': item_payload['product_deleted'],
                })
            
            orders.append({
                'id': order.id,
                'store_name': order.store.name,
                'store_id': order.store.id,
                'pickup_number': order.order_number,
                'order_number': order.order_number,
                'customer_name': order.customer_name,
                'customer_phone': order.customer_phone,
                'invoice_carrier': order.invoice_carrier,
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


class CustomerOrderDeleteView(APIView):
    """顧客端隱藏訂單紀錄 API"""
    permission_classes = [IsAuthenticated]

    ALLOWED_ORDER_TYPES = {'takeout', 'dinein', 'surplus'}
    TERMINAL_STATUSES = {'completed', 'rejected', 'cancelled'}

    def delete(self, request, order_type, order_id):
        if order_type not in self.ALLOWED_ORDER_TYPES:
            return Response({'detail': 'Invalid order type'}, status=http_status.HTTP_400_BAD_REQUEST)

        user = request.user

        if order_type == 'takeout':
            model = TakeoutOrder
        elif order_type == 'dinein':
            model = DineInOrder
        else:
            model = SurplusFoodOrder

        order = get_object_or_404(model, id=order_id, user=user)

        if order.status not in self.TERMINAL_STATUSES:
            return Response(
                {'detail': 'Only completed/rejected/cancelled orders can be hidden'},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        order.is_hidden_from_customer = True
        order.save(update_fields=['is_hidden_from_customer'])

        return Response(status=http_status.HTTP_204_NO_CONTENT)


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
            return Response({
                'pending_orders': [],
                'total_count': 0,
                'detail': '尚未建立店家資料'
            }, status=http_status.HTTP_200_OK)
        
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
                'invoice_carrier': order.invoice_carrier,
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
                'invoice_carrier': order.invoice_carrier,
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
