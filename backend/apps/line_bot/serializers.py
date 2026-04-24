from rest_framework import serializers
from apps.loyalty.models import PlatformCoupon
from .models import LineUserBinding, StoreFAQ, ConversationLog, BroadcastMessage, StoreLineBotConfig, MerchantLineBinding, PlatformBroadcast


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
            'broadcast_default_tags', 'broadcast_default_days_inactive', 'broadcast_default_message',
            'use_platform_recommendation_frequency',
            'popular_recommendation_min_interval_minutes',
            'popular_recommendation_weekly_limit',
            'enable_popular_recommendation_push',
            'enable_new_product_recommendation_push',
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
    coupon_info = serializers.SerializerMethodField()
    
    class Meta:
        model = BroadcastMessage
        fields = [
            'id', 'store', 'store_name', 'broadcast_type', 'title',
            'message_content', 'image_url', 'coupon', 'coupon_info', 'target_users', 'status',
            'scheduled_at', 'sent_at', 'recipient_count',
            'success_count', 'failure_count', 'created_by',
            'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'sent_at', 'recipient_count', 'success_count',
            'failure_count', 'created_at', 'updated_at'
        ]

    def get_coupon_info(self, obj):
        if not obj.coupon_id:
            return None
        coupon = obj.coupon
        return {
            'id': coupon.id,
            'title': coupon.title,
            'code': coupon.code,
            'discount_type': coupon.discount_type,
            'discount_value': coupon.discount_value,
            'min_order_amount': coupon.min_order_amount,
            'max_discount_amount': coupon.max_discount_amount,
            'expires_at': coupon.expires_at,
            'is_active': coupon.is_active,
        }


class BroadcastMessageCreateSerializer(serializers.ModelSerializer):
    """用於建立推播訊息的序列化器"""
    create_coupon = serializers.BooleanField(write_only=True, required=False, default=False)
    coupon_title = serializers.CharField(write_only=True, required=False, allow_blank=True, default='')
    coupon_description = serializers.CharField(write_only=True, required=False, allow_blank=True, default='')
    coupon_code = serializers.CharField(write_only=True, required=False, allow_blank=True, default='')
    coupon_discount_type = serializers.ChoiceField(
        write_only=True,
        required=False,
        choices=PlatformCoupon.DISCOUNT_TYPE_CHOICES,
        default='fixed'
    )
    coupon_discount_value = serializers.DecimalField(
        write_only=True,
        required=False,
        max_digits=10,
        decimal_places=2,
        min_value=0
    )
    coupon_min_order_amount = serializers.DecimalField(
        write_only=True,
        required=False,
        max_digits=10,
        decimal_places=2,
        min_value=0,
        default=0
    )
    coupon_max_discount_amount = serializers.DecimalField(
        write_only=True,
        required=False,
        max_digits=10,
        decimal_places=2,
        min_value=0,
        allow_null=True
    )
    coupon_expires_at = serializers.DateTimeField(write_only=True, required=False)
    
    class Meta:
        model = BroadcastMessage
        fields = [
            'id', 'store', 'broadcast_type', 'title', 'message_content',
            'image_url', 'target_users', 'scheduled_at',
            'create_coupon', 'coupon_title', 'coupon_description', 'coupon_code',
            'coupon_discount_type', 'coupon_discount_value',
            'coupon_min_order_amount', 'coupon_max_discount_amount', 'coupon_expires_at'
        ]
        extra_kwargs = {
            'store': {'required': False},  # perform_create 會自動設定
        }
        read_only_fields = ['id']

    def validate_target_users(self, value):
        """驗證目標用戶列表"""
        if not isinstance(value, list):
            raise serializers.ValidationError("目標用戶必須是列表格式")
        if len(value) == 0:
            raise serializers.ValidationError("至少需要一個目標用戶")
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if attrs.get('create_coupon'):
            if not attrs.get('coupon_discount_value'):
                raise serializers.ValidationError({'coupon_discount_value': '請輸入優惠券折抵數值'})
            if not attrs.get('coupon_expires_at'):
                raise serializers.ValidationError({'coupon_expires_at': '請輸入優惠券到期時間'})
        return attrs

    def _create_coupon(self, validated_data, fallback_title):
        should_create_coupon = validated_data.pop('create_coupon', False)
        coupon_title = validated_data.pop('coupon_title', '').strip()
        coupon_description = validated_data.pop('coupon_description', '').strip()
        coupon_code = validated_data.pop('coupon_code', '').strip()
        coupon_discount_type = validated_data.pop('coupon_discount_type', 'fixed')
        coupon_discount_value = validated_data.pop('coupon_discount_value', None)
        coupon_min_order_amount = validated_data.pop('coupon_min_order_amount', 0)
        coupon_max_discount_amount = validated_data.pop('coupon_max_discount_amount', None)
        coupon_expires_at = validated_data.pop('coupon_expires_at', None)

        if not should_create_coupon:
            return None

        coupon = PlatformCoupon(
            title=coupon_title or fallback_title,
            description=coupon_description,
            discount_type=coupon_discount_type,
            discount_value=coupon_discount_value,
            min_order_amount=coupon_min_order_amount,
            max_discount_amount=coupon_max_discount_amount,
            expires_at=coupon_expires_at,
        )
        if coupon_code:
            coupon.code = coupon_code
        coupon.save()
        return coupon

    def create(self, validated_data):
        coupon = self._create_coupon(validated_data, validated_data.get('title', '會員優惠券'))
        if coupon:
            validated_data['coupon'] = coupon
        return super().create(validated_data)


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


class PersonalizedTargetFilterSerializer(serializers.Serializer):
    """個人化推播目標篩選條件序列化器"""
    food_tags = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=False,
        default=list,
        help_text='篩選擁有這些食物標籤偏好的用戶'
    )
    days_inactive = serializers.IntegerField(
        required=False,
        min_value=0,
        default=0,
        help_text='篩選超過此天數未下單的用戶（0 表示不篩選）'
    )


class PlatformBroadcastSerializer(serializers.ModelSerializer):
    """平台推播序列化器"""
    broadcast_type_display = serializers.CharField(source='get_broadcast_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    recommended_store_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        default=list
    )
    recommended_stores_info = serializers.SerializerMethodField()
    coupon_info = serializers.SerializerMethodField()
    create_coupon = serializers.BooleanField(write_only=True, required=False, default=False)
    coupon_title = serializers.CharField(write_only=True, required=False, allow_blank=True, default='')
    coupon_description = serializers.CharField(write_only=True, required=False, allow_blank=True, default='')
    coupon_code = serializers.CharField(write_only=True, required=False, allow_blank=True, default='')
    coupon_discount_type = serializers.ChoiceField(
        write_only=True,
        required=False,
        choices=PlatformCoupon.DISCOUNT_TYPE_CHOICES,
        default='fixed'
    )
    coupon_discount_value = serializers.DecimalField(
        write_only=True,
        required=False,
        max_digits=10,
        decimal_places=2,
        min_value=0
    )
    coupon_min_order_amount = serializers.DecimalField(
        write_only=True,
        required=False,
        max_digits=10,
        decimal_places=2,
        min_value=0,
        default=0
    )
    coupon_max_discount_amount = serializers.DecimalField(
        write_only=True,
        required=False,
        max_digits=10,
        decimal_places=2,
        min_value=0,
        allow_null=True
    )
    coupon_expires_at = serializers.DateTimeField(write_only=True, required=False)
    
    class Meta:
        model = PlatformBroadcast
        fields = [
            'id', 'broadcast_type', 'broadcast_type_display',
            'title', 'message_content', 'image_url',
            'recommended_store_ids', 'recommended_stores_info',
            'coupon', 'coupon_info',
            'create_coupon', 'coupon_title', 'coupon_description', 'coupon_code',
            'coupon_discount_type', 'coupon_discount_value',
            'coupon_min_order_amount', 'coupon_max_discount_amount', 'coupon_expires_at',
            'target_all', 'target_users',
            'status', 'status_display',
            'scheduled_at', 'sent_at',
            'recipient_count', 'success_count', 'failure_count',
            'created_by', 'created_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'status', 'sent_at', 
            'recipient_count', 'success_count', 'failure_count',
            'created_by', 'created_at', 'updated_at', 'coupon'
        ]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if attrs.get('create_coupon'):
            if not attrs.get('coupon_discount_value'):
                raise serializers.ValidationError({'coupon_discount_value': '請填寫優惠券折抵數值'})
            if not attrs.get('coupon_expires_at'):
                raise serializers.ValidationError({'coupon_expires_at': '請填寫優惠券到期時間'})
        return attrs

    def _create_coupon(self, validated_data, fallback_title):
        should_create_coupon = validated_data.pop('create_coupon', False)
        coupon_title = validated_data.pop('coupon_title', '').strip()
        coupon_description = validated_data.pop('coupon_description', '').strip()
        coupon_code = validated_data.pop('coupon_code', '').strip()
        coupon_discount_type = validated_data.pop('coupon_discount_type', 'fixed')
        coupon_discount_value = validated_data.pop('coupon_discount_value', None)
        coupon_min_order_amount = validated_data.pop('coupon_min_order_amount', 0)
        coupon_max_discount_amount = validated_data.pop('coupon_max_discount_amount', None)
        coupon_expires_at = validated_data.pop('coupon_expires_at', None)

        if not should_create_coupon:
            return None

        coupon = PlatformCoupon(
            title=coupon_title or fallback_title,
            description=coupon_description,
            discount_type=coupon_discount_type,
            discount_value=coupon_discount_value,
            min_order_amount=coupon_min_order_amount,
            max_discount_amount=coupon_max_discount_amount,
            expires_at=coupon_expires_at,
        )
        if coupon_code:
            coupon.code = coupon_code
        coupon.save()
        return coupon
    
    def create(self, validated_data):
        store_ids = validated_data.pop('recommended_store_ids', [])
        coupon = self._create_coupon(validated_data, validated_data.get('title', '平台優惠券'))
        if coupon:
            validated_data['coupon'] = coupon
        instance = super().create(validated_data)
        if store_ids:
            from apps.stores.models import Store
            stores = Store.objects.filter(id__in=store_ids, is_published=True)
            instance.recommended_stores.set(stores)
        return instance
    
    def update(self, instance, validated_data):
        store_ids = validated_data.pop('recommended_store_ids', None)
        coupon = self._create_coupon(validated_data, validated_data.get('title', instance.title))
        if coupon:
            validated_data['coupon'] = coupon
        instance = super().update(instance, validated_data)
        if store_ids is not None:
            from apps.stores.models import Store
            stores = Store.objects.filter(id__in=store_ids, is_published=True)
            instance.recommended_stores.set(stores)
        return instance
    
    def get_recommended_stores_info(self, obj):
        """取得推薦店家的基本資訊"""
        return [
            {
                'id': store.id,
                'name': store.name,
                'cuisine_type': store.get_cuisine_type_display() if hasattr(store, 'get_cuisine_type_display') else store.cuisine_type,
            }
            for store in obj.recommended_stores.all()
        ]

    def get_coupon_info(self, obj):
        if not obj.coupon_id:
            return None
        coupon = obj.coupon
        return {
            'id': coupon.id,
            'title': coupon.title,
            'code': coupon.code,
            'discount_type': coupon.discount_type,
            'discount_value': coupon.discount_value,
            'min_order_amount': coupon.min_order_amount,
            'max_discount_amount': coupon.max_discount_amount,
            'expires_at': coupon.expires_at,
            'is_active': coupon.is_active,
        }
