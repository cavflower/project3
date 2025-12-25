from rest_framework import serializers
from .models import LineUserBinding, StoreFAQ, ConversationLog, BroadcastMessage, StoreLineBotConfig, MerchantLineBinding


class StoreLineBotConfigSerializer(serializers.ModelSerializer):
    store_name = serializers.CharField(source='store.name', read_only=True)
    has_line_config = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = StoreLineBotConfig
        fields = [
            'id', 'store', 'store_name',
            'line_channel_access_token', 'line_channel_secret',
            'invitation_url',
            'custom_system_prompt', 'welcome_message',
            'enable_ai_reply', 'enable_conversation_history',
            'is_active', 'has_line_config',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'invitation_url']
        extra_kwargs = {
            'line_channel_access_token': {'write_only': True},
            'line_channel_secret': {'write_only': True},
        }


class LineUserBindingSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    
    class Meta:
        model = LineUserBinding
        fields = [
            'id', 'user', 'username', 'email', 'line_user_id',
            'display_name', 'picture_url', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class StoreFAQSerializer(serializers.ModelSerializer):
    store_name = serializers.CharField(source='store.name', read_only=True)
    
    class Meta:
        model = StoreFAQ
        fields = [
            'id', 'store', 'store_name', 'question', 'answer',
            'keywords', 'priority', 'is_active', 'usage_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['store', 'usage_count', 'created_at', 'updated_at']

    def validate_keywords(self, value):
        """確保 keywords 是列表"""
        if not isinstance(value, list):
            raise serializers.ValidationError("關鍵字必須是列表格式")
        return value


class ConversationLogSerializer(serializers.ModelSerializer):
    store_name = serializers.CharField(source='store.name', read_only=True, allow_null=True)
    faq_question = serializers.CharField(source='matched_faq.question', read_only=True, allow_null=True)
    
    class Meta:
        model = ConversationLog
        fields = [
            'id', 'store', 'store_name', 'line_user_id',
            'sender_type', 'message_type', 'message_content',
            'matched_faq', 'faq_question', 'used_ai', 'ai_model',
            'created_at'
        ]
        read_only_fields = ['created_at']


class BroadcastMessageSerializer(serializers.ModelSerializer):
    store_name = serializers.CharField(source='store.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True, allow_null=True)
    
    class Meta:
        model = BroadcastMessage
        fields = [
            'id', 'store', 'store_name', 'broadcast_type', 'title',
            'message_content', 'image_url', 'target_users', 'status',
            'scheduled_at', 'sent_at', 'recipient_count',
            'success_count', 'failure_count', 'created_by',
            'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'sent_at', 'recipient_count', 'success_count',
            'failure_count', 'created_at', 'updated_at'
        ]


class BroadcastMessageCreateSerializer(serializers.ModelSerializer):
    """用於建立推播訊息的序列化器"""
    
    class Meta:
        model = BroadcastMessage
        fields = [
            'store', 'broadcast_type', 'title', 'message_content',
            'image_url', 'target_users', 'scheduled_at'
        ]

    def validate_target_users(self, value):
        """驗證目標用戶列表"""
        if not isinstance(value, list):
            raise serializers.ValidationError("目標用戶必須是列表格式")
        if len(value) == 0:
            raise serializers.ValidationError("至少需要一個目標用戶")
        return value


class MerchantLineBindingSerializer(serializers.ModelSerializer):
    """店家 LINE 綁定序列化器"""
    merchant_name = serializers.CharField(source='merchant.user.username', read_only=True)
    
    class Meta:
        model = MerchantLineBinding
        fields = [
            'id', 'merchant', 'merchant_name', 'line_user_id',
            'display_name', 'picture_url',
            'notify_schedule', 'notify_analytics', 
            'notify_inventory', 'notify_order_alert',
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['merchant', 'line_user_id', 'display_name', 'picture_url', 'created_at', 'updated_at']


class MerchantLineBindingPreferencesSerializer(serializers.ModelSerializer):
    """店家 LINE 綁定通知偏好序列化器"""
    
    class Meta:
        model = MerchantLineBinding
        fields = [
            'notify_schedule', 'notify_analytics', 
            'notify_inventory', 'notify_order_alert'
        ]
