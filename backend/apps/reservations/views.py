from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Q
import hashlib

from .models import Reservation, ReservationChangeLog, TimeSlot
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
            return Reservation.objects.filter(user=user)
        
        # 訪客也可以訪問訂位（會在各個 action 中驗證手機號碼）
        return Reservation.objects.all()
    
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
                    end_time__isnull=True,
                    is_active=True
                ).first()
            
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
        from django.db.models import Sum
        reservations = Reservation.objects.filter(
            time_slot=time_slot_str,
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
        ).order_by('-created_at')
        
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
        
        # 確認用戶是商家
        if not hasattr(user, 'merchant_profile'):
            return Reservation.objects.none()
        
        # 取得商家的店家
        try:
            store = user.merchant_profile.store
            return Reservation.objects.filter(store=store)
        except:
            return Reservation.objects.none()
    
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


class TimeSlotViewSet(viewsets.ModelViewSet):
    """訂位時段 ViewSet"""
    queryset = TimeSlot.objects.all()
    serializer_class = TimeSlotSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """僅返回商家自己店家的時段"""
        user = self.request.user
        
        if not hasattr(user, 'merchant_profile'):
            return TimeSlot.objects.none()
        
        try:
            store = user.merchant_profile.store
            return TimeSlot.objects.filter(store=store)
        except:
            return TimeSlot.objects.none()
    
    def perform_create(self, serializer):
        """新增時段時自動設定 store"""
        user = self.request.user
        
        if not hasattr(user, 'merchant_profile'):
            raise permissions.PermissionDenied("您沒有商家權限")
        
        try:
            store = user.merchant_profile.store
            serializer.save(store=store)
        except Exception as e:
            raise permissions.PermissionDenied(f"無法取得店家資訊: {str(e)}")
    
    def update(self, request, *args, **kwargs):
        """更新時段前檢查是否有訂位"""
        instance = self.get_object()
        
        # 構造時間字串來檢查訂位
        if instance.end_time:
            time_str = f"{instance.start_time.strftime('%H:%M')}-{instance.end_time.strftime('%H:%M')}"
        else:
            time_str = instance.start_time.strftime('%H:%M')
        
        # 檢查該時段（相同星期幾）是否有訂位
        from django.utils import timezone
        from datetime import datetime, timedelta
        
        # 獲取該星期幾的所有未來日期的訂位
        day_of_week_map = {
            'monday': 0, 'tuesday': 1, 'wednesday': 2, 'thursday': 3,
            'friday': 4, 'saturday': 5, 'sunday': 6
        }
        target_weekday = day_of_week_map[instance.day_of_week]
        
        # 檢查未來的訂位日期是否符合該星期幾
        today = timezone.now().date()
        future_reservations = Reservation.objects.filter(
            time_slot=time_str,
            store=instance.store,
            reservation_date__gte=today,
            status__in=['pending', 'confirmed']
        )
        
        # 過濾出符合該星期幾的訂位
        has_reservations = False
        for reservation in future_reservations:
            if reservation.reservation_date.weekday() == target_weekday:
                has_reservations = True
                break
        
        if has_reservations:
            return Response(
                {'error': '此時段已有訂位，無法編輯。若要修改，請先取消或完成所有相關訂位。'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        return super().update(request, *args, **kwargs)
    
    def destroy(self, request, *args, **kwargs):
        """刪除時段前檢查是否有訂位"""
        instance = self.get_object()
        
        # 構造時間字串來檢查訂位
        if instance.end_time:
            time_str = f"{instance.start_time.strftime('%H:%M')}-{instance.end_time.strftime('%H:%M')}"
        else:
            time_str = instance.start_time.strftime('%H:%M')
        
        # 檢查該時段（相同星期幾）是否有訂位
        from django.utils import timezone
        
        # 獲取該星期幾的所有未來日期的訂位
        day_of_week_map = {
            'monday': 0, 'tuesday': 1, 'wednesday': 2, 'thursday': 3,
            'friday': 4, 'saturday': 5, 'sunday': 6
        }
        target_weekday = day_of_week_map[instance.day_of_week]
        
        # 檢查未來的訂位日期是否符合該星期幾
        today = timezone.now().date()
        future_reservations = Reservation.objects.filter(
            time_slot=time_str,
            store=instance.store,
            reservation_date__gte=today,
            status__in=['pending', 'confirmed']
        )
        
        # 過濾出符合該星期幾的訂位
        has_reservations = False
        for reservation in future_reservations:
            if reservation.reservation_date.weekday() == target_weekday:
                has_reservations = True
                break
        
        if has_reservations:
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
