from rest_framework import serializers
from django.conf import settings
from .models import Store, StoreImage, MenuImage
from decimal import Decimal


class PublishedStoreSerializer(serializers.ModelSerializer):
    """輕量級序列化器，專門用於顧客瀏覽店家列表（只返回必要欄位）"""
    first_image = serializers.SerializerMethodField()
    surplus_order_count = serializers.IntegerField(read_only=True)  # 使用 annotate 的值
    plan = serializers.SerializerMethodField()
    surplus_donation_amount = serializers.SerializerMethodField()
    
    class Meta:
        model = Store
        fields = [
            'id',
            'name',
            'description',
            'address',
            'region',
            'phone',
            'cuisine_type',
            'opening_hours',
            'is_open',
            'enable_takeout',
            'enable_reservation',
            'enable_loyalty',
            'enable_surplus_food',
            'first_image',
            'surplus_order_count',
            'plan',
            'surplus_donation_amount',
            'budget_lunch',
            'budget_dinner',
        ]
    
    def get_first_image(self, obj):
        """只返回第一張圖片的 URL（從已 prefetch 的資料中取得）"""
        # 由於已經 prefetch，這裡不會產生額外查詢
        first_image = getattr(obj, 'first_image_path', None)
        if first_image:
            image_path = str(first_image)
            if image_path.startswith('http') or image_path.startswith('/'):
                return image_path
            return f"{settings.MEDIA_URL}{image_path}"

        images = obj.images.all()
        if images:
            return images[0].image.url
        return None
    
    def get_plan(self, obj):
        """獲取商家的付費方案"""
        return obj.merchant.plan if hasattr(obj, 'merchant') and obj.merchant.plan else None

    def get_surplus_donation_amount(self, obj):
        """惜福品收入 60% 作為公益點數"""
        if hasattr(obj, 'surplus_completed_revenue_total'):
            revenue = Decimal(str(obj.surplus_completed_revenue_total or 0))
        elif hasattr(obj, 'surplus_completed_revenue'):
            revenue = Decimal(str(obj.surplus_completed_revenue or 0))
        else:
            revenue = Decimal('0')
        return float((revenue * Decimal('0.6')).quantize(Decimal('0.01')))


class StoreImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = StoreImage
        fields = ['id', 'image', 'order']
        read_only_fields = ['id']


class MenuImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = MenuImage
        fields = ['id', 'image', 'order']
        read_only_fields = ['id']


class StoreSerializer(serializers.ModelSerializer):
    images = StoreImageSerializer(many=True, read_only=True)
    menu_images = MenuImageSerializer(many=True, read_only=True)
    # 優先讀取 annotate 的值，沒有 annotate 時回退為即時計算
    surplus_order_count = serializers.SerializerMethodField()
    surplus_completed_revenue = serializers.SerializerMethodField()
    surplus_donation_amount = serializers.SerializerMethodField()
    surplus_packaging_fee_amount = serializers.SerializerMethodField()
    plan = serializers.SerializerMethodField()
    
    class Meta:
        model = Store
        fields = [
            'id',
            'name',
            'description',
            'address',
            'region',
            'phone',
            'email',
            'line_friend_url',
            'website',
            'transportation',
            'opening_hours',
            'fixed_holidays',
            'is_open',
            'is_published',
            'budget_lunch',
            'budget_dinner',
            'budget_banquet',
            'credit_cards',
            'has_wifi',
            'parking_info',
            'has_english_menu',
            'smoking_policy',
            'suitable_for_children',
            'remarks',
            'menu_type',
            'menu_text',
            'dine_in_layout',
            'tags',
            'cuisine_type',
            'enable_takeout',
            'enable_reservation',
            'enable_loyalty',
            'enable_surplus_food',
            'images',
            'menu_images',
            'surplus_order_count',
            'surplus_completed_revenue',
            'surplus_donation_amount',
            'surplus_packaging_fee_amount',
            'plan',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'created_at',
            'updated_at',
            'images',
            'menu_images',
            'surplus_order_count',
            'surplus_completed_revenue',
            'surplus_donation_amount',
            'surplus_packaging_fee_amount',
            'plan',
        ]

    def get_plan(self, obj):
        """獲取商家的付費方案"""
        return obj.merchant.plan if hasattr(obj, 'merchant') and obj.merchant.plan else None

    def get_surplus_order_count(self, obj):
        """獲取該店家已完成的惜福品訂單數量"""
        if hasattr(obj, 'surplus_completed_order_count_total'):
            return obj.surplus_completed_order_count_total or 0

        # 如果已經通過 annotate 計算，直接返回
        if hasattr(obj, 'surplus_order_count'):
            return obj.surplus_order_count
        # 否則才執行查詢（向後相容）
        from apps.surplus_food.models import SurplusFoodOrder
        return SurplusFoodOrder.objects.filter(
            store=obj,
            status='completed'
        ).count()

    def get_surplus_completed_revenue(self, obj):
        """獲取惜福品已完成訂單總收入"""
        if hasattr(obj, 'surplus_completed_revenue_total'):
            return float(obj.surplus_completed_revenue_total or 0)

        if hasattr(obj, 'surplus_completed_revenue'):
            return float(obj.surplus_completed_revenue or 0)

        from apps.surplus_food.models import SurplusFoodOrder
        from django.db.models import Sum
        total = SurplusFoodOrder.objects.filter(
            store=obj,
            status='completed'
        ).aggregate(total=Sum('total_price'))['total'] or Decimal('0')
        return float(total)

    def get_surplus_donation_amount(self, obj):
        """惜福品收入 60% 作為公益捐款"""
        revenue = Decimal(str(self.get_surplus_completed_revenue(obj)))
        return float((revenue * Decimal('0.6')).quantize(Decimal('0.01')))

    def get_surplus_packaging_fee_amount(self, obj):
        """惜福品收入 40% 作為店家包材費"""
        revenue = Decimal(str(self.get_surplus_completed_revenue(obj)))
        return float((revenue * Decimal('0.4')).quantize(Decimal('0.01')))

    def create(self, validated_data):
        # merchant 會在 perform_create 中通過 serializer.save(merchant=...) 設定
        # 這裡直接使用 validated_data 中的 merchant（由 perform_create 提供）
        if 'merchant' not in validated_data:
            raise serializers.ValidationError("Merchant is required to create a store.")
        return super().create(validated_data)


class PublicStoreDetailSerializer(StoreSerializer):
    """Lightweight public store detail serializer for customer-facing pages."""
    images = serializers.SerializerMethodField()

    class Meta(StoreSerializer.Meta):
        fields = [field for field in StoreSerializer.Meta.fields if field != 'menu_images']
        read_only_fields = [field for field in StoreSerializer.Meta.read_only_fields if field != 'menu_images']

    def get_images(self, obj):
        first_image = getattr(obj, 'first_image_path', None)
        if not first_image:
            return []

        image_path = str(first_image)
        if image_path.startswith('http') or image_path.startswith('/'):
            image_url = image_path
        else:
            image_url = f"{settings.MEDIA_URL}{image_path}"

        return [{'id': None, 'image': image_url, 'order': 0}]

