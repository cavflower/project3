from rest_framework import serializers
from apps.products.models import Product
from apps.products.serializers import PublicProductSerializer
from apps.stores.models import Store


class RecommendedProductSerializer(serializers.Serializer):
    """推薦商品序列化器"""
    product = PublicProductSerializer(read_only=True)
    score = serializers.IntegerField(read_only=True)
    matching_tags = serializers.ListField(
        child=serializers.CharField(),
        read_only=True
    )
    reason = serializers.SerializerMethodField()
    
    def get_reason(self, obj):
        """生成推薦理由"""
        if obj.get('matching_tags'):
            tags_str = '、'.join(obj['matching_tags'][:3])
            return f"因為您喜歡「{tags_str}」"
        return "熱門推薦"


class FavoriteTagSerializer(serializers.Serializer):
    """喜愛標籤序列化器"""
    tag = serializers.CharField()
    count = serializers.IntegerField()


class UserPreferenceSerializer(serializers.Serializer):
    """用戶偏好序列化器"""
    favorite_tags = FavoriteTagSerializer(many=True, read_only=True)
    total_orders = serializers.IntegerField(read_only=True)
    recommendation_available = serializers.BooleanField(read_only=True)
