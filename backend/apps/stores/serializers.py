from rest_framework import serializers
from .models import Store, StoreImage, MenuImage


class PublishedStoreSerializer(serializers.ModelSerializer):
    """輕量級序列化器，專門用於顧客瀏覽店家列表（只返回必要欄位）"""
    first_image = serializers.SerializerMethodField()
    surplus_order_count = serializers.IntegerField(read_only=True)  # 使用 annotate 的值
    plan = serializers.SerializerMethodField()
    
    class Meta:
        model = Store
        fields = [
            'id',
            'name',
            'description',
            'address',
            'phone',
            'cuisine_type',
            'is_open',
            'enable_reservation',
            'enable_loyalty',
            'enable_surplus_food',
            'first_image',
            'surplus_order_count',
            'plan',
            'budget_lunch',
            'budget_dinner',
        ]
    
    def get_first_image(self, obj):
        """只返回第一張圖片的 URL（從已 prefetch 的資料中取得）"""
        # 由於已經 prefetch，這裡不會產生額外查詢
        images = obj.images.all()
        if images:
            return images[0].image.url
        return None
    
    def get_plan(self, obj):
        """獲取商家的付費方案"""
        return obj.merchant.plan if hasattr(obj, 'merchant') and obj.merchant.plan else None


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
    surplus_order_count = serializers.IntegerField(read_only=True, required=False)  # 允許從 annotate 讀取
    plan = serializers.SerializerMethodField()
    
    class Meta:
        model = Store
        fields = [
            'id',
            'name',
            'description',
            'address',
            'phone',
            'email',
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
            'enable_reservation',
            'enable_loyalty',
            'enable_surplus_food',
            'images',
            'menu_images',
            'surplus_order_count',
            'plan',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'images', 'menu_images', 'surplus_order_count', 'plan']

    def get_plan(self, obj):
        """獲取商家的付費方案"""
        return obj.merchant.plan if hasattr(obj, 'merchant') and obj.merchant.plan else None

    def get_surplus_order_count(self, obj):
        """獲取該店家已完成的惜福品訂單數量"""
        # 如果已經通過 annotate 計算，直接返回
        if hasattr(obj, 'surplus_order_count'):
            return obj.surplus_order_count
        # 否則才執行查詢（向後相容）
        from apps.surplus_food.models import SurplusFoodOrder
        return SurplusFoodOrder.objects.filter(
            store=obj,
            status='completed'
        ).count()

    def create(self, validated_data):
        # merchant 會在 perform_create 中通過 serializer.save(merchant=...) 設定
        # 這裡直接使用 validated_data 中的 merchant（由 perform_create 提供）
        if 'merchant' not in validated_data:
            raise serializers.ValidationError("Merchant is required to create a store.")
        return super().create(validated_data)

