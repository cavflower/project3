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
    
    class Meta:
        model = Product
        fields = '__all__'
        read_only_fields = ['merchant', 'store']
        extra_kwargs = {
            'is_available': {'default': True}
        }

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


class PublicProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True, allow_null=True)
    is_linked_to_surplus = serializers.SerializerMethodField()
    
    class Meta:
        model = Product
        fields = ['id', 'name', 'description', 'price', 'image', 'service_type', 'is_available', 'store', 'category', 'category_name', 'is_linked_to_surplus']
    
    def get_is_linked_to_surplus(self, obj):
        """檢查此產品是否被關聯為惜福品"""
        from apps.surplus_food.models import SurplusFood
        return SurplusFood.objects.filter(product=obj, status='active').exists()


