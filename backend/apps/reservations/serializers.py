from rest_framework import serializers
from .models import Reservation, ReservationChangeLog, TimeSlot
from apps.stores.models import Store
from apps.users.models import User


class ReservationSerializer(serializers.ModelSerializer):
    """訂位序列化器 - 完整資訊"""
    store_name = serializers.CharField(source='store.name', read_only=True)
    store_address = serializers.CharField(source='store.address', read_only=True)
    store_phone = serializers.CharField(source='store.phone', read_only=True)
    is_guest_reservation = serializers.BooleanField(read_only=True)
    can_edit = serializers.BooleanField(read_only=True)
    can_cancel = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Reservation
        fields = [
            'id',
            'reservation_number',
            'store',
            'store_name',
            'store_address',
            'store_phone',
            'user',
            'customer_name',
            'customer_phone',
            'customer_email',
            'customer_gender',
            'reservation_date',
            'time_slot',
            'party_size',
            'children_count',
            'special_requests',
            'status',
            'cancelled_at',
            'cancelled_by',
            'cancel_reason',
            'created_at',
            'updated_at',
            'confirmed_at',
            'is_guest_reservation',
            'can_edit',
            'can_cancel',
        ]
        read_only_fields = [
            'id',
            'reservation_number',
            'cancelled_at',
            'created_at',
            'updated_at',
            'confirmed_at',
        ]


class ReservationCreateSerializer(serializers.ModelSerializer):
    """建立訂位序列化器"""
    
    # 讓這些欄位在 API 請求中為選填（會員可省略）
    customer_name = serializers.CharField(required=False, allow_blank=True)
    customer_phone = serializers.CharField(required=False, allow_blank=True)
    customer_email = serializers.EmailField(required=False, allow_blank=True)
    customer_gender = serializers.CharField(required=False, allow_blank=True)
    
    class Meta:
        model = Reservation
        fields = [
            'store',
            'customer_name',
            'customer_phone',
            'customer_email',
            'customer_gender',
            'reservation_date',
            'time_slot',
            'party_size',
            'children_count',
            'special_requests',
        ]
    
    def validate(self, data):
        """驗證訂位資料"""
        from django.utils import timezone
        from datetime import datetime, timedelta
        
        # 驗證日期不能是過去
        if data['reservation_date'] < timezone.now().date():
            raise serializers.ValidationError({
                'reservation_date': '訂位日期不能是過去的日期'
            })
        
        # 驗證人數
        if data['party_size'] < 1:
            raise serializers.ValidationError({
                'party_size': '訂位人數至少為 1 人'
            })
        
        # 驗證時段格式（可以是 "HH:MM" 或 "HH:MM-HH:MM"）
        time_slot = data.get('time_slot', '')
        if not time_slot:
            raise serializers.ValidationError({
                'time_slot': '請選擇訂位時段'
            })
        
        # 驗證時間格式
        import re
        if '-' in time_slot:
            # 格式：HH:MM-HH:MM
            if not re.match(r'^\d{2}:\d{2}-\d{2}:\d{2}$', time_slot):
                raise serializers.ValidationError({
                    'time_slot': '時段格式錯誤，應為 HH:MM-HH:MM'
                })
        else:
            # 格式：HH:MM
            if not re.match(r'^\d{2}:\d{2}$', time_slot):
                raise serializers.ValidationError({
                    'time_slot': '時段格式錯誤，應為 HH:MM'
                })
        
        return data
    
    def create(self, validated_data):
        """建立訂位"""
        request = self.context.get('request')
        
        # 如果是已登入會員，自動關聯 user 並填補缺失的顧客資訊
        if request and request.user.is_authenticated:
            validated_data['user'] = request.user
            
            # 如果會員沒有填寫姓名，使用會員的 username
            if not validated_data.get('customer_name'):
                validated_data['customer_name'] = request.user.username
            
            # 如果會員沒有填寫手機，使用會員的 phone_number（如果有的話）
            if not validated_data.get('customer_phone'):
                if request.user.phone_number:
                    validated_data['customer_phone'] = request.user.phone_number
                else:
                    # 如果會員也沒有手機號碼，使用預設值
                    validated_data['customer_phone'] = '未提供'
            
            # 如果會員沒有填寫 email，使用會員的 email
            if not validated_data.get('customer_email'):
                validated_data['customer_email'] = request.user.email
            
            # 如果會員沒有填寫性別，使用會員的 gender（如果有的話）
            if not validated_data.get('customer_gender') and request.user.gender:
                validated_data['customer_gender'] = request.user.gender
        else:
            # 訪客訂位必須提供完整資訊
            if not validated_data.get('customer_name'):
                raise serializers.ValidationError({'customer_name': '訪客訂位必須提供姓名'})
            if not validated_data.get('customer_phone'):
                raise serializers.ValidationError({'customer_phone': '訪客訂位必須提供手機號碼'})
        
        reservation = Reservation.objects.create(**validated_data)
        
        # 準備用於日誌的資料（將物件轉換為可序列化的格式）
        from datetime import date, datetime
        log_data = {}
        for key, value in validated_data.items():
            if hasattr(value, 'pk'):  # 如果是模型物件，只記錄 ID
                log_data[key] = value.pk
            elif isinstance(value, (date, datetime)):  # 日期/時間物件轉為字串
                log_data[key] = value.isoformat()
            elif value is None or isinstance(value, (str, int, float, bool)):  # 基本類型
                log_data[key] = value
            else:  # 其他類型轉為字串
                log_data[key] = str(value)
        
        # 記錄變更日誌
        ReservationChangeLog.objects.create(
            reservation=reservation,
            changed_by='customer',
            change_type='created',
            new_values=log_data,
            note='訂位建立'
        )
        
        return reservation


class ReservationUpdateSerializer(serializers.ModelSerializer):
    """更新訂位序列化器 - 僅允許修改部分欄位"""
    
    class Meta:
        model = Reservation
        fields = [
            'time_slot',
            'party_size',
            'children_count',
            'special_requests',
        ]
    
    def update(self, instance, validated_data):
        """更新訂位"""
        # 記錄舊值
        old_values = {
            'time_slot': instance.time_slot,
            'party_size': instance.party_size,
            'children_count': instance.children_count,
            'special_requests': instance.special_requests,
        }
        
        # 準備新值（將物件轉換為可序列化的格式）
        from datetime import date, datetime
        new_values = {}
        for key, value in validated_data.items():
            if hasattr(value, 'pk'):  # 如果是模型物件，只記錄 ID
                new_values[key] = value.pk
            elif isinstance(value, (date, datetime)):  # 日期/時間物件轉為字串
                new_values[key] = value.isoformat()
            elif value is None or isinstance(value, (str, int, float, bool)):  # 基本類型
                new_values[key] = value
            else:  # 其他類型轉為字串
                new_values[key] = str(value)
        
        # 更新
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # 記錄變更日誌
        request = self.context.get('request')
        changed_by = 'customer' if request and request.user.is_authenticated else 'guest'
        
        ReservationChangeLog.objects.create(
            reservation=instance,
            changed_by=changed_by,
            change_type='updated',
            old_values=old_values,
            new_values=new_values,
            note='訂位資訊更新'
        )
        
        return instance


class ReservationCancelSerializer(serializers.Serializer):
    """取消訂位序列化器"""
    cancel_reason = serializers.CharField(
        required=False,  # 改為非必填
        max_length=500,
        allow_blank=True,
        default=''
    )
    cancelled_by = serializers.ChoiceField(
        choices=['customer', 'merchant'],
        required=False  # 改為選填，由後端根據請求來源判斷
    )


class GuestReservationVerifySerializer(serializers.Serializer):
    """訪客訂位驗證序列化器"""
    phone_number = serializers.CharField(
        required=True,
        max_length=20,
        error_messages={'required': '請輸入手機號碼'}
    )
    
    def validate_phone_number(self, value):
        """驗證手機號碼格式"""
        import re
        # 台灣手機號碼格式: 09 開頭，10 碼
        pattern = r'^09\d{8}$'
        if not re.match(pattern, value):
            raise serializers.ValidationError('手機號碼格式錯誤，應為 09XXXXXXXX')
        return value


class ReservationChangeLogSerializer(serializers.ModelSerializer):
    """訂位變更記錄序列化器"""
    
    class Meta:
        model = ReservationChangeLog
        fields = [
            'id',
            'change_type',
            'changed_by',
            'old_values',
            'new_values',
            'note',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class TimeSlotSerializer(serializers.ModelSerializer):
    """訂位時段序列化器"""
    has_reservations = serializers.SerializerMethodField()
    
    class Meta:
        model = TimeSlot
        fields = [
            'id',
            'store',
            'day_of_week',
            'start_time',
            'end_time',
            'max_capacity',
            'max_party_size',
            'is_active',
            'has_reservations',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'store', 'has_reservations', 'created_at', 'updated_at']
    
    def get_has_reservations(self, obj):
        """檢查該時段（相同星期幾）是否有未來的訂位"""
        from django.utils import timezone
        
        # 構造時間字串
        if obj.end_time:
            time_str = f"{obj.start_time.strftime('%H:%M')}-{obj.end_time.strftime('%H:%M')}"
        else:
            time_str = obj.start_time.strftime('%H:%M')
        
        # 星期幾對應表
        day_of_week_map = {
            'monday': 0, 'tuesday': 1, 'wednesday': 2, 'thursday': 3,
            'friday': 4, 'saturday': 5, 'sunday': 6
        }
        target_weekday = day_of_week_map[obj.day_of_week]
        
        # 獲取未來的訂位
        today = timezone.now().date()
        future_reservations = Reservation.objects.filter(
            time_slot=time_str,
            store=obj.store,
            reservation_date__gte=today,
            status__in=['pending', 'confirmed']
        )
        
        # 只檢查符合該星期幾的訂位
        for reservation in future_reservations:
            if reservation.reservation_date.weekday() == target_weekday:
                return True
        
        return False
    
    def validate(self, data):
        """驗證時段時間和容量設定"""
        # 驗證時間順序（只在設定結束時間時檢查）
        start_time = data.get('start_time')
        end_time = data.get('end_time')
        
        # 如果更新時沒有提供 start_time，從 instance 取得
        if self.instance and not start_time:
            start_time = self.instance.start_time
        
        # 只有當結束時間存在時才驗證
        if end_time and start_time:
            if start_time >= end_time:
                raise serializers.ValidationError({
                    'end_time': '結束時間不得小於開始時間'
                })
        
        # 驗證單筆人數不超過總容量
        max_capacity = data.get('max_capacity') or (self.instance.max_capacity if self.instance else None)
        max_party_size = data.get('max_party_size') or (self.instance.max_party_size if self.instance else None)
        
        if max_capacity and max_party_size:
            if max_party_size > max_capacity:
                raise serializers.ValidationError({
                    'max_party_size': '單筆訂位最多人數不得超過人數上限'
                })
        
        return data


class TimeSlotWithAvailabilitySerializer(serializers.ModelSerializer):
    """帶有容量資訊的訂位時段序列化器"""
    current_bookings = serializers.SerializerMethodField()
    available = serializers.SerializerMethodField()
    
    class Meta:
        model = TimeSlot
        fields = [
            'id',
            'store',
            'day_of_week',
            'start_time',
            'end_time',
            'max_capacity',
            'max_party_size',
            'current_bookings',
            'available',
            'is_active',
        ]
    
    def get_current_bookings(self, obj):
        """獲取當前時段的訂位人數（根據日期）"""
        date = self.context.get('date')
        if not date:
            return 0
        
        from django.db.models import Sum
        # obj 是 TimeSlot 實例，需要構造時間字串來匹配 Reservation 的 time_slot CharField
        if obj.end_time:
            time_str = f"{obj.start_time.strftime('%H:%M')}-{obj.end_time.strftime('%H:%M')}"
        else:
            time_str = obj.start_time.strftime('%H:%M')
        
        reservations = Reservation.objects.filter(
            time_slot=time_str,
            store=obj.store,
            reservation_date=date,
            status__in=['pending', 'confirmed']
        )
        
        result = reservations.aggregate(
            total_adults=Sum('party_size'),
            total_children=Sum('children_count')
        )
        
        total_adults = result['total_adults'] or 0
        total_children = result['total_children'] or 0
        
        return total_adults + total_children
    
    def get_available(self, obj):
        """檢查時段是否還有空位"""
        current = self.get_current_bookings(obj)
        return current < obj.max_capacity
        
        if data.get('max_capacity') and data.get('max_capacity') < 1:
            raise serializers.ValidationError({
                'max_capacity': '人數上限必須大於 0'
            })
        
        return data


class MerchantReservationSerializer(serializers.ModelSerializer):
    """商家端訂位序列化器 - 包含更多管理資訊"""
    store_name = serializers.CharField(source='store.name', read_only=True)
    user_email = serializers.EmailField(source='user.email', read_only=True, allow_null=True)
    is_guest_reservation = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Reservation
        fields = [
            'id',
            'reservation_number',
            'store',
            'store_name',
            'user',
            'user_email',
            'customer_name',
            'customer_phone',
            'customer_email',
            'customer_gender',
            'reservation_date',
            'time_slot',
            'party_size',
            'children_count',
            'special_requests',
            'status',
            'cancelled_at',
            'cancelled_by',
            'cancel_reason',
            'created_at',
            'updated_at',
            'confirmed_at',
            'is_guest_reservation',
        ]
        read_only_fields = ['id', 'reservation_number', 'created_at', 'updated_at']


class MerchantReservationUpdateSerializer(serializers.ModelSerializer):
    """商家更新訂位狀態序列化器"""
    
    class Meta:
        model = Reservation
        fields = ['status', 'confirmed_at']
    
    def update(self, instance, validated_data):
        """更新訂位狀態"""
        from django.utils import timezone
        
        old_status = instance.status
        new_status = validated_data.get('status', instance.status)
        
        # 如果狀態變更為已確認，記錄確認時間
        if new_status == 'confirmed' and old_status != 'confirmed':
            validated_data['confirmed_at'] = timezone.now()
        
        # 更新
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # 記錄變更日誌
        ReservationChangeLog.objects.create(
            reservation=instance,
            changed_by='merchant',
            change_type='updated',
            old_values={'status': old_status},
            new_values={'status': new_status},
            note=f'狀態變更: {old_status} -> {new_status}'
        )
        
        return instance
