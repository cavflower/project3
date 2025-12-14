from rest_framework import serializers
from .models import StoreReview, ProductReview
from apps.users.models import User
from apps.products.models import Product


class StoreReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.username', read_only=True)
    user_avatar = serializers.CharField(source='user.avatar_url', read_only=True)
    store_name = serializers.CharField(source='store.name', read_only=True)
    
    class Meta:
        model = StoreReview
        fields = [
            'id', 'user', 'user_name', 'user_avatar', 'store', 'store_name',
            'takeout_order', 'dinein_order', 'rating', 'tags',
            'comment', 'created_at', 'updated_at',
            'merchant_reply', 'replied_at'
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at', 'replied_at']


class ProductReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.username', read_only=True)
    user_avatar = serializers.CharField(source='user.avatar_url', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_image = serializers.ImageField(source='product.image', read_only=True)
    
    class Meta:
        model = ProductReview
        fields = [
            'id', 'user', 'user_name', 'user_avatar', 'product', 'product_name', 
            'product_image', 'store', 'takeout_order', 'dinein_order',
            'rating', 'comment', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']


class ReviewSubmissionSerializer(serializers.Serializer):
    """提交評論的序列化器"""
    order_id = serializers.IntegerField()
    order_type = serializers.ChoiceField(choices=['takeout', 'dinein'])
    
    # 店家評論
    store_rating = serializers.IntegerField(min_value=1, max_value=5)
    store_tags = serializers.ListField(child=serializers.CharField(), required=False, allow_empty=True)
    store_comment = serializers.CharField(required=False, allow_blank=True)
    
    # 菜品評論
    product_reviews = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        allow_empty=True
    )
    
    def validate_product_reviews(self, value):
        """驗證菜品評論格式"""
        for review in value:
            if 'product_id' not in review:
                raise serializers.ValidationError('每個菜品評論必須包含 product_id')
            if 'rating' not in review:
                raise serializers.ValidationError('每個菜品評論必須包含 rating')
            if not (1 <= review['rating'] <= 5):
                raise serializers.ValidationError('評分必須在 1-5 之間')
        return value
