from rest_framework import viewsets, status, permissions, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.contrib.contenttypes.models import ContentType
from django.db.models import Sum
import hashlib

from .models import Reservation, ReservationChangeLog, TimeSlot, WalkInSeating
from apps.stores.models import Store
from apps.orders.models import Notification
from apps.orders.serializers import NotificationSerializer
from .serializers import (
    ReservationSerializer,
    ReservationCreateSerializer,
    ReservationUpdateSerializer,
    ReservationCancelSerializer,
    GuestReservationVerifySerializer,
    ReservationChangeLogSerializer,
    TimeSlotSerializer,
    MerchantReservationSerializer,
    MerchantReservationUpdateSerializer,
    WalkInSeatingSerializer,
)


class ReservationViewSet(viewsets.ModelViewSet):
    """
    訂位 ViewSet - 顧客端
    
    提供訂位的 CRUD 操作
    - 會員和訪客都可以建立訂位
    - 會員可以查看自己的所有訂位
    - 訪客透過手機號碼驗證查看訂位
    """
    queryset = Reservation.objects.all()
    serializer_class = ReservationSerializer
    permission_classes = [permissions.AllowAny]  # 允許訪客訂位
    
    def get_serializer_class(self):
        if self.action == 'create':
            return ReservationCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return ReservationUpdateSerializer
        return ReservationSerializer
    
    def get_queryset(self):
        """
        會員：返回自己的訂位
        訪客：返回所有訂位（但會在 action 中驗證）
        """
        user = self.request.user
        
        if user.is_authenticated:
            # 會員查看自己的訂位
            return Reservation.objects.filter(user=user).select_related('store', 'user')
        
        # 訪客也可以訪問訂位（會在各個 action 中驗證手機號碼）
        return Reservation.objects.select_related('store', 'user')
    
    def create(self, request, *args, **kwargs):
        """建立訂位"""
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Received reservation data: {request.data}")
        
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # 驗證容量和單筆人數限制
        validated_data = serializer.validated_data
        time_slot_str = validated_data.get('time_slot')  # 字串格式如 "18:00-20:00"
        store = validated_data.get('store')
        reservation_date = validated_data.get('reservation_date')
        party_size = validated_data.get('party_size', 0)
        children_count = validated_data.get('children_count', 0)
        total_party_size = party_size + children_count
        
        # 從字串解析時間並找到對應的 TimeSlot 模型
        try:
            from datetime import datetime
            
            # 處理時段格式：可能是 "18:00-20:00" 或 "18:00"
            if '-' in time_slot_str:
                start_time_str, end_time_str = time_slot_str.split('-')
                start_time = datetime.strptime(start_time_str.strip(), '%H:%M').time()
                end_time = datetime.strptime(end_time_str.strip(), '%H:%M').time()
                
                day_of_week = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][reservation_date.weekday()]
                
                time_slot_obj = TimeSlot.objects.filter(
                    store=store,
                    day_of_week=day_of_week,
                    start_time=start_time,
                    end_time=end_time,
                    is_active=True
                ).first()
            else:
                # 只有開始時間
                start_time = datetime.strptime(time_slot_str.strip(), '%H:%M').time()
                
                day_of_week = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][reservation_date.weekday()]
                
                time_slot_obj = TimeSlot.objects.filter(
                    store=store,
                    day_of_week=day_of_week,
                    start_time=start_time,
                    is_active=True
                ).first()

                if not time_slot_obj:
                    time_slot_obj = TimeSlot.objects.filter(
                        store=store,
                        day_of_week=day_of_week,
                        start_time__lte=start_time,
                        end_time__gt=start_time,
                        is_active=True
                    ).order_by('-start_time').first()
            
            if not time_slot_obj:
                return Response(
                    {'error': '找不到對應的訂位時段'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except (ValueError, AttributeError) as e:
            return Response(
                {'error': f'時段格式錯誤: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 檢查單筆人數限制
        if total_party_size > time_slot_obj.max_party_size:
            return Response(
                {'error': f'訂位人數超過單筆限制（最多 {time_slot_obj.max_party_size} 人）'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 檢查時段容量
        time_slot_values = [time_slot_str]
        if time_slot_obj.end_time:
            start_time_value = time_slot_obj.start_time.strftime('%H:%M')
            legacy_range_value = f"{start_time_value}-{time_slot_obj.end_time.strftime('%H:%M')}"
            if time_slot_str == start_time_value:
                time_slot_values.append(legacy_range_value)

        reservations = Reservation.objects.filter(
            time_slot__in=time_slot_values,
            store=store,
            reservation_date=reservation_date,
            status__in=['pending', 'confirmed']
        )
        
        result = reservations.aggregate(
            total_adults=Sum('party_size'),
            total_children=Sum('children_count')
        )
        
        current_adults = result['total_adults'] or 0
        current_children = result['total_children'] or 0
        current_bookings = current_adults + current_children
        
        if current_bookings + total_party_size > time_slot_obj.max_capacity:
            return Response(
                {'error': f'此時段容量不足（剩餘 {time_slot_obj.max_capacity - current_bookings} 人）'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        reservation = serializer.save()
        
        # 返回完整訂位資訊
        response_serializer = ReservationSerializer(reservation)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)
    
    def update(self, request, *args, **kwargs):
        """更新訂位 - 僅允許修改部分欄位"""
        instance = self.get_object()
        
        # 檢查是否可編輯
        if not instance.can_edit:
            return Response(
                {'error': '此訂位狀態無法編輯'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 訪客訂位需驗證
        if instance.is_guest_reservation and not self._verify_guest_access(instance, request):
            return Response(
                {'error': '無權限修改此訂位'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        return Response(ReservationSerializer(instance).data)
    
    @action(detail=False, methods=['post'], url_path='verify-guest')
    def verify_guest(self, request):
        """
        訪客驗證 - 透過手機號碼查詢訂位
        
        POST /api/reservations/verify-guest/
        Body: {"phone_number": "0912345678"}
        """
        serializer = GuestReservationVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        phone_number = serializer.validated_data['phone_number']
        phone_hash = hashlib.sha256(phone_number.encode()).hexdigest()
        
        # 查詢訪客的訂位（最近 30 天內）
        from datetime import timedelta
        thirty_days_ago = timezone.now().date() - timedelta(days=30)
        
        reservations = Reservation.objects.filter(
            phone_hash=phone_hash,
            user__isnull=True,  # 僅訪客訂位
            reservation_date__gte=thirty_days_ago
        ).select_related('store', 'user').order_by('-created_at')
        
        if not reservations.exists():
            return Response(
                {'error': '找不到訂位記錄，請確認手機號碼是否正確'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # 生成臨時 token（實際應用應使用 JWT 或 session）
        token_data = {
            'phone_hash': phone_hash,
            'token': hashlib.sha256(f"{phone_hash}{timezone.now().timestamp()}".encode()).hexdigest()[:32],
            'expires_at': (timezone.now() + timedelta(hours=24)).isoformat(),
        }
        
        # 返回訂位列表和 token
        serializer = ReservationSerializer(reservations, many=True)
        return Response({
            'token': token_data,
            'reservations': serializer.data,
            'count': reservations.count()
        })
    
    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel_reservation(self, request, pk=None):
        """
        取消訂位
        
        POST /api/reservations/{id}/cancel/
        Body: {"cancel_reason": "行程變更"}
        """
        instance = self.get_object()
        
        # 檢查是否可取消
        if not instance.can_cancel:
            return Response(
                {'error': '此訂位狀態無法取消'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 訪客訂位需驗證
        if instance.is_guest_reservation and not self._verify_guest_access(instance, request):
            return Response(
                {'error': '無權限取消此訂位'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = ReservationCancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # 更新狀態
        instance.status = 'cancelled'
        instance.cancelled_at = timezone.now()
        instance.cancelled_by = 'customer'
        instance.cancel_reason = serializer.validated_data.get('cancel_reason', '')  # 使用 get 並設定預設值
        instance.save()
        
        # 記錄變更
        ReservationChangeLog.objects.create(
            reservation=instance,
            changed_by='customer',
            change_type='cancelled',
            old_values={'status': 'confirmed'},
            new_values={'status': 'cancelled', 'cancel_reason': instance.cancel_reason},
            note='顧客取消訂位'
        )
        
        return Response(ReservationSerializer(instance).data)
    
    @action(detail=True, methods=['get'], url_path='change-logs')
    def change_logs(self, request, pk=None):
        """查看訂位變更記錄"""
        instance = self.get_object()
        logs = instance.change_logs.all()
        serializer = ReservationChangeLogSerializer(logs, many=True)
        return Response(serializer.data)
    
    def _verify_guest_access(self, reservation, request):
        """驗證訪客是否有權限存取此訂位"""
        # 從 request 中取得 phone_number 或 token
        phone_number = request.data.get('phone_number') or request.query_params.get('phone_number')
        
        if not phone_number:
            return False
        
        phone_hash = hashlib.sha256(phone_number.encode()).hexdigest()
        return reservation.phone_hash == phone_hash


class MerchantReservationViewSet(viewsets.ModelViewSet):
    """
    商家端訂位管理 ViewSet
    
    商家可以：
    - 查看自己店家的所有訂位
    - 確認/取消訂位
    - 更改訂位狀態
    """
    queryset = Reservation.objects.all()
    serializer_class = MerchantReservationSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """僅返回商家自己店家的訂位"""
        user = self.request.user

        if getattr(user, 'user_type', None) != 'merchant':
            return Reservation.objects.none()

        store_id = Store.objects.filter(
            merchant__user_id=user.id
        ).values_list('id', flat=True).first()
        if not store_id:
            return Reservation.objects.none()

        queryset = Reservation.objects.filter(store_id=store_id)

        status_filter = self.request.query_params.get('status')
        if status_filter and status_filter != 'all':
            queryset = queryset.filter(status=status_filter)

        reservation_date = self.request.query_params.get('reservation_date')
        if reservation_date:
            queryset = queryset.filter(reservation_date=reservation_date)

        customer_name = self.request.query_params.get('customer_name')
        if customer_name:
            queryset = queryset.filter(customer_name__icontains=customer_name.strip())

        return queryset.only(
            'id',
            'reservation_number',
            'store_id',
            'user_id',
            'customer_name',
            'customer_phone',
            'customer_email',
            'customer_gender',
            'reservation_date',
            'time_slot',
            'party_size',
            'children_count',
            'special_requests',
            'table_label',
            'merchant_note',
            'status',
            'cancelled_at',
            'cancelled_by',
            'cancel_reason',
            'created_at',
            'updated_at',
            'confirmed_at',
        ).order_by('-reservation_date', '-created_at')
    
    def get_serializer_class(self):
        if self.action in ['update', 'partial_update', 'update_status']:
            return MerchantReservationUpdateSerializer
        return MerchantReservationSerializer
    
    @action(detail=True, methods=['post'], url_path='update-status')
    def update_status(self, request, pk=None):
        """
        更新訂位狀態
        
        POST /api/merchant/reservations/{id}/update-status/
        Body: {"status": "confirmed"}
        """
        instance = self.get_object()
        serializer = MerchantReservationUpdateSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        return Response(MerchantReservationSerializer(instance).data)
    
    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel_reservation(self, request, pk=None):
        """
        商家取消訂位
        
        POST /api/merchant/reservations/{id}/cancel/
        Body: {"cancel_reason": "客滿"}
        """
        instance = self.get_object()
        
        if not instance.can_cancel:
            return Response(
                {'error': '此訂位狀態無法取消'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = ReservationCancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        instance.status = 'cancelled'
        instance.cancelled_at = timezone.now()
        instance.cancelled_by = 'merchant'
        instance.cancel_reason = serializer.validated_data.get('cancel_reason', '')  # 使用 get 並設定預設值
        instance.save()
        
        # 記錄變更
        ReservationChangeLog.objects.create(
            reservation=instance,
            changed_by='merchant',
            change_type='cancelled',
            old_values={'status': instance.status},
            new_values={'status': 'cancelled', 'cancel_reason': instance.cancel_reason},
            note='商家取消訂位'
        )
        
        return Response(MerchantReservationSerializer(instance).data)
    
    def destroy(self, request, *args, **kwargs):
        """
        刪除訂位記錄（僅限商家）
        
        DELETE /api/merchant/reservations/{id}/
        """
        instance = self.get_object()
        
        # 記錄刪除前的資訊
        reservation_number = instance.reservation_number
        
        # 記錄刪除操作到變更日誌
        ReservationChangeLog.objects.create(
            reservation=instance,
            changed_by='merchant',
            change_type='deleted',
            old_values={
                'reservation_number': reservation_number,
                'status': instance.status,
                'customer_name': instance.customer_name,
                'reservation_date': instance.reservation_date.isoformat(),
                'time_slot': instance.time_slot,
            },
            new_values={},
            note='商家刪除訂位記錄'
        )
        
        # 執行刪除
        instance.delete()
        
        return Response(
            {'message': f'訂位 {reservation_number} 已刪除'},
            status=status.HTTP_204_NO_CONTENT
        )
    
    @action(detail=False, methods=['get'], url_path='stats')
    def statistics(self, request):
        """訂位統計資訊"""
        queryset = self.get_queryset()
        
        stats = {
            'total': queryset.count(),
            'pending': queryset.filter(status='pending').count(),
            'confirmed': queryset.filter(status='confirmed').count(),
            'completed': queryset.filter(status='completed').count(),
            'cancelled': queryset.filter(status='cancelled').count(),
            'no_show': queryset.filter(status='no_show').count(),
        }
        
        return Response(stats)


class WalkInSeatingViewSet(viewsets.ModelViewSet):
    """Merchant-managed walk-in table assignments."""

    serializer_class = WalkInSeatingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_store_id(self):
        user = self.request.user
        if getattr(user, 'user_type', None) != 'merchant':
            return None
        return Store.objects.filter(
            merchant__user_id=user.id
        ).values_list('id', flat=True).first()

    def get_queryset(self):
        store_id = self.get_store_id()
        if not store_id:
            return WalkInSeating.objects.none()

        queryset = WalkInSeating.objects.filter(store_id=store_id)

        seating_date = self.request.query_params.get('date')
        if seating_date:
            queryset = queryset.filter(seated_at__date=seating_date)

        seating_status = self.request.query_params.get('status')
        if seating_status and seating_status != 'all':
            queryset = queryset.filter(status=seating_status)

        return queryset.only(
            'id',
            'store_id',
            'waiting_number',
            'table_label',
            'party_name',
            'party_size',
            'notes',
            'status',
            'created_by_id',
            'seated_at',
            'released_at',
            'updated_at',
        ).order_by('seated_at')

    @action(detail=False, methods=['get'], url_path='overview')
    def overview(self, request):
        user = request.user
        if getattr(user, 'user_type', None) != 'merchant':
            raise permissions.PermissionDenied("Only merchants can view walk-in seating data.")

        store = Store.objects.filter(
            merchant__user_id=user.id
        ).only('id', 'dine_in_layout').first()
        if not store:
            return Response(
                {'detail': 'Store not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        seating_date = request.query_params.get('date')

        reservations = Reservation.objects.filter(store_id=store.id)
        if seating_date:
            reservations = reservations.filter(reservation_date=seating_date)
        reservations = reservations.only(
            'id',
            'reservation_number',
            'store_id',
            'user_id',
            'customer_name',
            'customer_phone',
            'customer_email',
            'customer_gender',
            'reservation_date',
            'time_slot',
            'party_size',
            'children_count',
            'special_requests',
            'table_label',
            'merchant_note',
            'status',
            'cancelled_at',
            'cancelled_by',
            'cancel_reason',
            'created_at',
            'updated_at',
            'confirmed_at',
        ).order_by('-reservation_date', '-created_at')

        walk_ins = WalkInSeating.objects.filter(store_id=store.id)
        if seating_date:
            walk_ins = walk_ins.filter(seated_at__date=seating_date)
        seating_status = request.query_params.get('status')
        if seating_status and seating_status != 'all':
            walk_ins = walk_ins.filter(status=seating_status)
        walk_ins = walk_ins.only(
            'id',
            'store_id',
            'waiting_number',
            'table_label',
            'party_name',
            'party_size',
            'notes',
            'status',
            'created_by_id',
            'seated_at',
            'released_at',
            'updated_at',
        ).order_by('seated_at')

        return Response({
            'store_id': store.id,
            'layout': store.dine_in_layout or [],
            'reservations': MerchantReservationSerializer(reservations, many=True).data,
            'walk_ins': WalkInSeatingSerializer(walk_ins, many=True).data,
        })

    def _split_table_labels(self, table_label):
        return [
            label.strip()
            for label in (table_label or '').split(',')
            if label.strip()
        ]

    def _normalize_table_labels(self, raw_labels):
        if isinstance(raw_labels, str):
            raw_labels = raw_labels.split(',')
        if not isinstance(raw_labels, list):
            raw_labels = []
        return list(dict.fromkeys(
            str(label).strip()
            for label in raw_labels
            if str(label).strip()
        ))

    def _get_configured_table_labels(self, store):
        layout = store.dine_in_layout or []
        labels = []

        def collect(tables):
            if not isinstance(tables, list):
                return
            for table in tables:
                if isinstance(table, dict):
                    label = (table.get('label') or '').strip()
                    if label:
                        labels.append(label)

        if isinstance(layout, list):
            has_floor_tables = any(
                isinstance(item, dict) and isinstance(item.get('tables'), list)
                for item in layout
            )
            if has_floor_tables:
                for floor in layout:
                    if isinstance(floor, dict):
                        collect(floor.get('tables'))
            else:
                collect(layout)

        if isinstance(layout, dict):
            floors = layout.get('floors')
            if isinstance(floors, list):
                for floor in floors:
                    if isinstance(floor, dict):
                        collect(floor.get('tables'))

        return set(labels)

    def _get_occupied_labels(self, store_id, exclude_pk=None):
        queryset = WalkInSeating.objects.filter(
            store_id=store_id,
            status='active',
        )
        if exclude_pk:
            queryset = queryset.exclude(pk=exclude_pk)

        occupied = set()
        for table_label in queryset.values_list('table_label', flat=True):
            occupied.update(self._split_table_labels(table_label))
        return occupied

    def _generate_waiting_number(self, store_id):
        today = timezone.localdate()
        used_numbers = WalkInSeating.objects.filter(
            store_id=store_id,
            seated_at__date=today,
        ).exclude(waiting_number='').values_list('waiting_number', flat=True)

        max_number = 0
        for number in used_numbers:
            if str(number).isdigit():
                max_number = max(max_number, int(number))

        return f'{max_number + 1:03d}'

    def perform_create(self, serializer):
        store_id = self.get_store_id()
        if not store_id:
            raise permissions.PermissionDenied("Only merchants with a store can assign seats.")

        serializer.save(
            store_id=store_id,
            created_by=self.request.user,
            waiting_number=self._generate_waiting_number(store_id),
            table_label='',
            status='waiting',
        )

    @action(detail=True, methods=['post'], url_path='assign')
    def assign(self, request, pk=None):
        seating = self.get_object()
        store = seating.store
        selected_labels = self._normalize_table_labels(
            request.data.get('table_labels', request.data.get('table_label', []))
        )
        if not selected_labels:
            return Response(
                {'table_labels': ['Select at least one table.']},
                status=status.HTTP_400_BAD_REQUEST
            )

        configured_labels = self._get_configured_table_labels(store)
        missing_labels = [label for label in selected_labels if label not in configured_labels]
        if missing_labels:
            return Response(
                {'table_labels': [f"These tables are not configured: {', '.join(missing_labels)}"]},
                status=status.HTTP_400_BAD_REQUEST
            )

        occupied_labels = self._get_occupied_labels(store.id, exclude_pk=seating.pk)
        conflicting_labels = [label for label in selected_labels if label in occupied_labels]
        if conflicting_labels:
            return Response(
                {'table_labels': [f"These tables are already occupied: {', '.join(conflicting_labels)}"]},
                status=status.HTTP_400_BAD_REQUEST
            )

        seating.table_label = ', '.join(selected_labels)
        seating.status = 'active'
        seating.save(update_fields=['table_label', 'status', 'updated_at'])
        return Response(WalkInSeatingSerializer(seating).data)

    @action(detail=True, methods=['post'], url_path='release')
    def release(self, request, pk=None):
        seating = self.get_object()
        if seating.status != 'released':
            seating.status = 'released'
            seating.released_at = timezone.now()
            seating.save(update_fields=['status', 'released_at', 'updated_at'])

        return Response(WalkInSeatingSerializer(seating).data)


class ReservationNotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        reservation_content_type = ContentType.objects.get_for_model(Reservation)
        return Notification.objects.filter(
            user=self.request.user,
            content_type=reservation_content_type,
        ).order_by('-created_at')

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        self.get_queryset().update(is_read=True)
        return Response({'status': 'success'})

    @action(detail=False, methods=['delete'])
    def delete_all(self, request):
        self.get_queryset().delete()
        return Response({'status': 'success'})


class TimeSlotViewSet(viewsets.ModelViewSet):
    """訂位時段 ViewSet"""
    queryset = TimeSlot.objects.all()
    serializer_class = TimeSlotSerializer
    permission_classes = [permissions.IsAuthenticated]
    DAY_OF_WEEK_TO_DJANGO_WEEKDAY = {
        'monday': 2,
        'tuesday': 3,
        'wednesday': 4,
        'thursday': 5,
        'friday': 6,
        'saturday': 7,
        'sunday': 1,
    }
    
    def get_queryset(self):
        """僅返回商家自己店家的時段"""
        user = self.request.user

        if getattr(user, 'user_type', None) != 'merchant':
            return TimeSlot.objects.none()

        return TimeSlot.objects.filter(
            store__merchant__user_id=user.id
        ).select_related('store')

    def _build_time_slot_string(self, instance):
        if instance.end_time:
            return f"{instance.start_time.strftime('%H:%M')}-{instance.end_time.strftime('%H:%M')}"
        return instance.start_time.strftime('%H:%M')

    def _has_future_reservations(self, instance):
        time_str = self._build_time_slot_string(instance)
        today = timezone.now().date()
        django_weekday = self.DAY_OF_WEEK_TO_DJANGO_WEEKDAY.get(instance.day_of_week)
        if django_weekday is None:
            return False

        return Reservation.objects.filter(
            time_slot=time_str,
            store_id=instance.store_id,
            reservation_date__gte=today,
            reservation_date__week_day=django_weekday,
            status__in=['pending', 'confirmed']
        ).exists()
    
    def perform_create(self, serializer):
        """新增時段時自動設定 store"""
        user = self.request.user

        if getattr(user, 'user_type', None) != 'merchant':
            raise permissions.PermissionDenied("您沒有商家權限")

        store_id = Store.objects.filter(
            merchant__user_id=user.id
        ).values_list('id', flat=True).first()
        if not store_id:
            raise permissions.PermissionDenied("無法取得店家資訊")

        serializer.save(store_id=store_id)
    
    def update(self, request, *args, **kwargs):
        """更新時段前檢查是否有訂位"""
        instance = self.get_object()

        if self._has_future_reservations(instance):
            return Response(
                {'error': '此時段已有訂位，無法編輯。若要修改，請先取消或完成所有相關訂位。'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        return super().update(request, *args, **kwargs)
    
    def destroy(self, request, *args, **kwargs):
        """刪除時段前檢查是否有訂位"""
        instance = self.get_object()

        if self._has_future_reservations(instance):
            return Response(
                {'error': '此時段已有訂位，無法刪除。若要刪除，請先取消或完成所有相關訂位。'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        return super().destroy(request, *args, **kwargs)


class PublicTimeSlotViewSet(viewsets.ReadOnlyModelViewSet):
    """公開的訂位時段查詢 ViewSet（供顧客查詢用）"""
    queryset = TimeSlot.objects.filter(is_active=True)
    serializer_class = TimeSlotSerializer
    permission_classes = [permissions.AllowAny]
    
    def get_queryset(self):
        """根據 store_id 篩選時段"""
        queryset = TimeSlot.objects.filter(is_active=True)
        store_id = self.request.query_params.get('store_id', None)
        
        if store_id and store_id != 'undefined':
            try:
                queryset = queryset.filter(store_id=int(store_id))
            except (ValueError, TypeError):
                # 如果 store_id 無效，返回空查詢集
                return TimeSlot.objects.none()
        
        return queryset.order_by('day_of_week', 'start_time')

    def list(self, request, *args, **kwargs):
        date_str = request.query_params.get('date')
        if not date_str:
            return super().list(request, *args, **kwargs)

        from datetime import datetime, timedelta

        try:
            date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response(
                {'error': 'Invalid date format. Expected YYYY-MM-DD.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        day_of_week = [
            'monday',
            'tuesday',
            'wednesday',
            'thursday',
            'friday',
            'saturday',
            'sunday',
        ][date_obj.weekday()]

        queryset = self.filter_queryset(self.get_queryset()).filter(day_of_week=day_of_week)
        booking_map = self._get_booking_map_for_date(
            request.query_params.get('store_id'),
            date_obj
        )

        expanded_slots = []
        for slot in queryset:
            expanded_slots.extend(self._expand_time_slot(slot, booking_map, timedelta(minutes=30)))

        return Response(expanded_slots)

    def _expand_time_slot(self, slot, booking_map, interval):
        from datetime import datetime

        slots = []
        current = datetime.combine(datetime.today(), slot.start_time)
        if slot.end_time:
            end = datetime.combine(datetime.today(), slot.end_time)
        else:
            end = current + interval

        while current < end:
            time_value = current.time().strftime('%H:%M')
            current_bookings = booking_map.get(time_value, 0)
            if slot.end_time and time_value == slot.start_time.strftime('%H:%M'):
                legacy_range_value = f"{time_value}-{slot.end_time.strftime('%H:%M')}"
                current_bookings += booking_map.get(legacy_range_value, 0)

            slots.append({
                'id': f'{slot.id}-{time_value}',
                'source_slot_id': slot.id,
                'store': slot.store_id,
                'day_of_week': slot.day_of_week,
                'start_time': current.time().strftime('%H:%M:%S'),
                'end_time': None,
                'range_start_time': slot.start_time.strftime('%H:%M:%S'),
                'range_end_time': slot.end_time.strftime('%H:%M:%S') if slot.end_time else None,
                'max_capacity': slot.max_capacity,
                'max_party_size': slot.max_party_size,
                'current_bookings': current_bookings,
                'available': current_bookings < slot.max_capacity,
                'is_active': slot.is_active,
            })
            current += interval

        return slots

    def _get_booking_map_for_date(self, store_id, date_obj):
        filters = {
            'reservation_date': date_obj,
            'status__in': ['pending', 'confirmed'],
        }
        if store_id and store_id != 'undefined':
            try:
                filters['store_id'] = int(store_id)
            except (ValueError, TypeError):
                return {}

        rows = Reservation.objects.filter(**filters).values('time_slot').annotate(
            total_adults=Sum('party_size'),
            total_children=Sum('children_count')
        )

        return {
            row['time_slot']: (row['total_adults'] or 0) + (row['total_children'] or 0)
            for row in rows
        }
    
    def get_serializer_class(self):
        """根據 query param 決定使用哪個 serializer"""
        if self.request.query_params.get('date'):
            from .serializers import TimeSlotWithAvailabilitySerializer
            return TimeSlotWithAvailabilitySerializer
        return TimeSlotSerializer
    
    def get_serializer_context(self):
        """傳遞日期給 serializer"""
        context = super().get_serializer_context()
        date_str = self.request.query_params.get('date')
        if date_str:
            from datetime import datetime
            try:
                context['date'] = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                pass
        return context
