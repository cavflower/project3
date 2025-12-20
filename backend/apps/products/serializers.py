from rest_framework import serializers
from .models import Product, ProductCategory, ProductSpecification, SpecificationGroup


class ProductCategorySerializer(serializers.ModelSerializer):
    """產品類別序列化器"""
    products_count = serializers.SerializerMethodField()
    
    class Meta:
        model = ProductCategory
        fields = ['id', 'name', 'description', 'display_order', 'is_active', 'created_at', 'updated_at', 'products_count']
        read_only_fields = ['created_at', 'updated_at']
    
    def get_products_count(self, obj):
        """獲取該類別下的產品數量"""
        return obj.products.count()
    
    def create(self, validated_data):
        request = self.context['request']
        merchant = getattr(request.user, 'merchant_profile', None)
        if not merchant or not hasattr(merchant, 'store'):
            raise serializers.ValidationError('Merchant store not found.')
        validated_data['store'] = merchant.store
        return super().create(validated_data)


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    food_tags = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=False,
        allow_empty=True,
        help_text='食物標籤陣列，例如：["辣", "素食", "健康"]'
    )
    
    class Meta:
        model = Product
        fields = '__all__'
        read_only_fields = ['merchant', 'store']
        extra_kwargs = {
            'is_available': {'default': True}
        }

    def to_internal_value(self, data):
        """處理 FormData 傳來的多個相同 key 的值"""
        # 如果 food_tags 是 QueryDict (FormData)，需要特別處理
        if hasattr(data, 'getlist'):
            food_tags = data.getlist('food_tags')
            # 創建一個可變的副本
            mutable_data = data.copy()
            # 移除舊的 food_tags
            if 'food_tags' in mutable_data:
                del mutable_data['food_tags']
            # 設置新的 food_tags（已經是 list）
            internal = super().to_internal_value(mutable_data)
            # 過濾空字符串並添加
            internal['food_tags'] = [tag for tag in food_tags if tag]
            return internal
        return super().to_internal_value(data)

    def create(self, validated_data):
        request = self.context['request']
        merchant = getattr(request.user, 'merchant_profile', None)
        if not merchant or not hasattr(merchant, 'store'):
            raise serializers.ValidationError('Merchant store not found.')
        
        validated_data['merchant'] = merchant
        validated_data['store'] = merchant.store
        if 'is_available' not in validated_data:
            validated_data['is_available'] = True
        
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        return super().update(instance, validated_data)


class PublicProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True, allow_null=True)
    food_tags = serializers.ListField(
        child=serializers.CharField(),
        read_only=True
    )
    is_linked_to_surplus = serializers.SerializerMethodField()
    
    class Meta:
        model = Product
        fields = ['id', 'name', 'description', 'price', 'image', 'service_type', 'is_available', 'store', 'category', 'category_name', 'food_tags', 'is_linked_to_surplus']
    
    def get_is_linked_to_surplus(self, obj):
        """檢查此產品是否被關聯為惜福品"""
        from apps.surplus_food.models import SurplusFood
        return SurplusFood.objects.filter(product=obj, status='active').exists()


class ProductSpecificationSerializer(serializers.ModelSerializer):
    """規格選項序列化器"""
    price_adjustment_display = serializers.SerializerMethodField()
    
    class Meta:
        model = ProductSpecification
        fields = [
            'id', 'group', 'name', 'price_adjustment', 
            'price_adjustment_display', 'is_active', 'display_order', 
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def get_price_adjustment_display(self, obj):
        """格式化價格調整顯示"""
        if obj.price_adjustment > 0:
            return f"+NT${obj.price_adjustment}"
        elif obj.price_adjustment < 0:
            return f"-NT${abs(obj.price_adjustment)}"
        return "NT$0"


class SpecificationGroupSerializer(serializers.ModelSerializer):
    """規格類別序列化器"""
    options = ProductSpecificationSerializer(many=True, read_only=True)
    selection_type_display = serializers.CharField(source='get_selection_type_display', read_only=True)
    options_count = serializers.SerializerMethodField()
    
    class Meta:
        model = SpecificationGroup
        fields = [
            'id', 'product', 'name', 'selection_type', 'selection_type_display',
            'is_required', 'display_order', 'is_active', 
            'options', 'options_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def get_options_count(self, obj):
        """取得該類別下的選項數量"""
        return obj.options.count()
    
    def validate_product(self, value):
        """驗證商品屬於當前商家"""
        request = self.context.get('request')
        if request:
            merchant = getattr(request.user, 'merchant_profile', None)
            if merchant and hasattr(merchant, 'store'):
                if value.store != merchant.store:
                    raise serializers.ValidationError('無權限操作此商品的規格類別')
        return value

