from rest_framework import serializers
from .models import SurplusTimeSlot, SurplusFood, SurplusFoodOrder


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
        if data.get('start_time') and data.get('end_time'):
            if data['start_time'] >= data['end_time']:
                raise serializers.ValidationError({
                    'end_time': '結束時間必須晚於開始時間'
                })
        
        return data


class SurplusFoodSerializer(serializers.ModelSerializer):
    """惜福食品序列化器"""
    condition_display = serializers.CharField(source='get_condition_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    discount_percent = serializers.ReadOnlyField()
    is_available = serializers.ReadOnlyField()
    is_near_sold_out = serializers.ReadOnlyField()
    time_slot_detail = SurplusTimeSlotSerializer(source='time_slot', read_only=True)
    
    class Meta:
        model = SurplusFood
        fields = [
            'id', 'store', 'product', 'title', 'description',
            'original_price', 'surplus_price', 'discount_percent',
            'quantity', 'remaining_quantity', 'condition', 'condition_display',
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
        # 驗證價格
        if data.get('surplus_price') and data.get('original_price'):
            if data['surplus_price'] >= data['original_price']:
                raise serializers.ValidationError({
                    'surplus_price': '惜福價必須低於原價'
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
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    discount_percent = serializers.ReadOnlyField()
    is_available = serializers.ReadOnlyField()
    store_name = serializers.CharField(source='store.name', read_only=True)
    
    class Meta:
        model = SurplusFood
        fields = [
            'id', 'code', 'title', 'store', 'store_name',
            'original_price', 'surplus_price', 'discount_percent',
            'quantity', 'remaining_quantity', 'condition', 'condition_display',
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
