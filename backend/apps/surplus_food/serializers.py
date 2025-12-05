from rest_framework import serializers
from .models import SurplusTimeSlot, SurplusFood, SurplusFoodOrder, SurplusFoodCategory
from datetime import time
from decimal import Decimal


class SurplusFoodCategorySerializer(serializers.ModelSerializer):
    """惜福食品類別序列化器"""
    food_count = serializers.SerializerMethodField()
    
    class Meta:
        model = SurplusFoodCategory
        fields = [
            'id', 'store', 'name', 'description', 'display_order',
            'is_active', 'food_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'store', 'created_at', 'updated_at']
    
    def get_food_count(self, obj):
        """取得此類別下的惜福品數量"""
        return obj.foods.filter(status='active').count()
    
    def validate_name(self, value):
        """驗證類別名稱不能為空"""
        if not value or value.strip() == '':
            raise serializers.ValidationError('類別名稱不能為空')
        return value.strip()


class SurplusTimeSlotSerializer(serializers.ModelSerializer):
    """惜福時段序列化器"""
    day_of_week_display = serializers.CharField(source='get_day_of_week_display', read_only=True)
    
    class Meta:
        model = SurplusTimeSlot
        fields = [
            'id', 'store', 'name', 'day_of_week', 'day_of_week_display',
            'start_time', 'end_time', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'store', 'created_at', 'updated_at']
    
    def validate(self, data):
        """驗證時段時間的合理性"""
        start_time = data.get('start_time')
        end_time = data.get('end_time')
        day_of_week = data.get('day_of_week')
        
        # 驗證結束時間必須晚於開始時間（允許 00:00 表示跨日到午夜）
        if start_time and end_time:
            # 如果結束時間是 00:00，表示跨日營業到午夜，不需要驗證
            is_midnight = end_time == time(0, 0)
            if not is_midnight and start_time >= end_time:
                raise serializers.ValidationError({
                    'end_time': '結束時間必須晚於開始時間（或設為 00:00 表示營業至午夜）'
                })
        
        # 驗證不能在尖峰時段（8:00-13:00, 17:00-19:00）
        if start_time and end_time:
            # 如果結束時間是 00:00，表示跨日到午夜，只檢查開始時間
            is_midnight = end_time == time(0, 0)
            
            peak_hours = [
                (time(8, 0), time(13, 0)),   # 早午餐尖峰
                (time(17, 0), time(19, 0)),  # 晚餐尖峰
            ]
            
            for peak_start, peak_end in peak_hours:
                # 檢查時段是否與尖峰時段重疊
                if is_midnight:
                    # 跨日時段，只要開始時間不在尖峰時段內即可
                    if peak_start <= start_time < peak_end:
                        raise serializers.ValidationError({
                            'start_time': '惜福時段不能設在尖峰時段（08:00-13:00, 17:00-19:00）'
                        })
                else:
                    # 一般時段，檢查是否重疊
                    if not (end_time <= peak_start or start_time >= peak_end):
                        raise serializers.ValidationError({
                            'start_time': '惜福時段不能設在尖峰時段（08:00-13:00, 17:00-19:00）'
                        })
        
        # 驗證同一天不能有重複的時段（更新時排除自己）
        if start_time and day_of_week:
            # 取得 store （從 context 或 instance）
            store = None
            if self.instance:
                store = self.instance.store
            elif 'store' in self.context:
                store = self.context['store']
            
            if store:
                # 檢查是否已存在相同的時段
                existing_slots = SurplusTimeSlot.objects.filter(
                    store=store,
                    day_of_week=day_of_week,
                    start_time=start_time
                )
                
                # 如果是更新，排除自己
                if self.instance:
                    existing_slots = existing_slots.exclude(pk=self.instance.pk)
                
                if existing_slots.exists():
                    raise serializers.ValidationError({
                        'start_time': f'該天已經有相同的時段設定'
                    })
        
        return data


class SurplusFoodSerializer(serializers.ModelSerializer):
    """惜福食品序列化器"""
    condition_display = serializers.CharField(source='get_condition_display', read_only=True)
    dining_option_display = serializers.CharField(source='get_dining_option_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    discount_percent = serializers.ReadOnlyField()
    is_available = serializers.ReadOnlyField()
    is_near_sold_out = serializers.ReadOnlyField()
    time_slot_detail = SurplusTimeSlotSerializer(source='time_slot', read_only=True)
    category_detail = SurplusFoodCategorySerializer(source='category', read_only=True)
    
    class Meta:
        model = SurplusFood
        fields = [
            'id', 'store', 'category', 'category_detail', 'product', 'title', 'description',
            'original_price', 'surplus_price', 'discount_percent',
            'quantity', 'remaining_quantity', 'condition', 'condition_display',
            'dining_option', 'dining_option_display',
            'expiry_date', 'time_slot', 'time_slot_detail', 'image', 'status', 'status_display',
            'pickup_instructions', 'tags', 'code',
            'views_count', 'orders_count', 'is_available', 'is_near_sold_out',
            'created_at', 'updated_at', 'published_at'
        ]
        read_only_fields = [
            'id', 'store', 'code', 'views_count', 'orders_count',
            'remaining_quantity', 'created_at', 'updated_at', 'published_at'
        ]
    
    def validate(self, data):
        """驗證惜福食品資料"""
        original_price = data.get('original_price')
        surplus_price = data.get('surplus_price')
        
        # 驗證價格
        if surplus_price and original_price:
            # 惜福價必須低於原價
            if surplus_price >= original_price:
                raise serializers.ValidationError({
                    'surplus_price': '惜福價必須低於原價'
                })
            
            # 惜福價必須至少打8折（不能超過原價的80%）
            max_allowed_price = original_price * Decimal('0.8')  # 最多只能是原價的80%
            if surplus_price > max_allowed_price:
                raise serializers.ValidationError({
                    'surplus_price': '惜福價不能高於原價的80%'
                })
        
        # 驗證數量
        if data.get('quantity') and data['quantity'] <= 0:
            raise serializers.ValidationError({
                'quantity': '數量必須大於 0'
            })
        
        # 即期品必須填寫到期日
        if data.get('condition') == 'near_expiry' and not data.get('expiry_date'):
            raise serializers.ValidationError({
                'expiry_date': '即期品必須填寫到期日'
            })
        
        # 驗證必須選擇時段
        if not data.get('time_slot'):
            raise serializers.ValidationError({
                'time_slot': '必須選擇惜福時段'
            })
        
        return data


class SurplusFoodListSerializer(serializers.ModelSerializer):
    """惜福食品列表序列化器（簡化版）"""
    condition_display = serializers.CharField(source='get_condition_display', read_only=True)
    dining_option_display = serializers.CharField(source='get_dining_option_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    discount_percent = serializers.ReadOnlyField()
    is_available = serializers.ReadOnlyField()
    store_name = serializers.CharField(source='store.name', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True, allow_null=True)
    
    class Meta:
        model = SurplusFood
        fields = [
            'id', 'code', 'title', 'description', 'store', 'store_name', 'category', 'category_name',
            'original_price', 'surplus_price', 'discount_percent',
            'quantity', 'remaining_quantity', 'condition', 'condition_display',
            'dining_option', 'dining_option_display', 'expiry_date',
            'status', 'status_display', 'image', 'is_available',
            'time_slot', 'created_at'
        ]


class SurplusFoodOrderSerializer(serializers.ModelSerializer):
    """惜福食品訂單序列化器"""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    surplus_food_detail = SurplusFoodListSerializer(source='surplus_food', read_only=True)
    store_name = serializers.CharField(source='store.name', read_only=True)
    
    class Meta:
        model = SurplusFoodOrder
        fields = [
            'id', 'order_number', 'store', 'store_name',
            'surplus_food', 'surplus_food_detail',
            'customer_name', 'customer_phone', 'customer_email',
            'quantity', 'unit_price', 'total_price',
            'payment_method', 'payment_method_display',
            'status', 'status_display', 'pickup_time', 'notes',
            'created_at', 'confirmed_at', 'completed_at'
        ]
        read_only_fields = [
            'id', 'order_number', 'total_price',
            'created_at', 'confirmed_at', 'completed_at'
        ]
    
    def validate(self, data):
        """驗證訂單資料"""
        surplus_food = data.get('surplus_food')
        quantity = data.get('quantity', 1)
        
        # 檢查庫存
        if surplus_food and quantity > surplus_food.remaining_quantity:
            raise serializers.ValidationError({
                'quantity': f'庫存不足，目前剩餘 {surplus_food.remaining_quantity} 份'
            })
        
        # 檢查是否在可售時間內
        if surplus_food and not surplus_food.is_available:
            raise serializers.ValidationError({
                'surplus_food': '此惜福品目前無法訂購'
            })
        
        return data
