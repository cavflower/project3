from rest_framework import serializers
from .models import Store, StoreImage, MenuImage


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
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'images', 'menu_images']

    def create(self, validated_data):
        # merchant 會在 perform_create 中通過 serializer.save(merchant=...) 設定
        # 這裡直接使用 validated_data 中的 merchant（由 perform_create 提供）
        if 'merchant' not in validated_data:
            raise serializers.ValidationError("Merchant is required to create a store.")
        return super().create(validated_data)

