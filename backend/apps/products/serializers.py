from rest_framework import serializers
from .models import Product, ProductCategory


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


