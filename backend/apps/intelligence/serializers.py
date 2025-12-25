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


class PlatformSettingsSerializer(serializers.Serializer):
    """平台設定序列化器（用於管理員 API）"""
    ai_provider = serializers.ChoiceField(
        choices=[('gemini', 'Google Gemini'), ('openai', 'OpenAI GPT'), ('groq', 'Groq')],
        required=False
    )
    ai_api_key = serializers.CharField(max_length=500, required=False, allow_blank=True)
    ai_model = serializers.CharField(max_length=100, required=False)
    ai_temperature = serializers.FloatField(min_value=0, max_value=2, required=False)
    ai_max_tokens = serializers.IntegerField(min_value=100, max_value=4000, required=False)
    is_ai_enabled = serializers.BooleanField(required=False)
    default_system_prompt = serializers.CharField(required=False, allow_blank=True)
    
    # 唯讀欄位
    updated_at = serializers.DateTimeField(read_only=True)
    updated_by = serializers.CharField(read_only=True)
    has_ai_config = serializers.SerializerMethodField()
    
    def get_has_ai_config(self, obj):
        """檢查是否已設定 AI"""
        if hasattr(obj, 'has_ai_config'):
            return obj.has_ai_config()
        return bool(obj.get('ai_api_key')) if isinstance(obj, dict) else False


class PlatformSettingsPublicSerializer(serializers.Serializer):
    """平台設定公開序列化器（隱藏敏感資料）"""
    ai_provider = serializers.CharField(read_only=True)
    ai_model = serializers.CharField(read_only=True)
    is_ai_enabled = serializers.BooleanField(read_only=True)
    has_ai_config = serializers.SerializerMethodField()
    
    def get_has_ai_config(self, obj):
        if hasattr(obj, 'has_ai_config'):
            return obj.has_ai_config()
        return False
