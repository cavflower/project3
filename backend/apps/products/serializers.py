from rest_framework import serializers
from .models import Product, ProductCategory, ProductSpecification, SpecificationGroup, ProductIngredient
import json


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


class ProductIngredientSerializer(serializers.ModelSerializer):
    ingredient_name = serializers.CharField(source='ingredient.name', read_only=True)
    ingredient_unit = serializers.CharField(source='ingredient.unit', read_only=True)
    ingredient_unit_display = serializers.CharField(source='ingredient.get_unit_display', read_only=True)

    class Meta:
        model = ProductIngredient
        fields = [
            'id', 'product', 'ingredient',
            'ingredient_name', 'ingredient_unit', 'ingredient_unit_display',
            'quantity_used', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    ingredient_links = serializers.SerializerMethodField(read_only=True)
    recipe_ingredients = serializers.JSONField(
        required=False,
        write_only=True,
        help_text='商品配方。格式: [{"ingredient": 1, "quantity_used": 0.5}]'
    )
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

    def get_ingredient_links(self, obj):
        return [
            {
                'id': link.id,
                'ingredient': link.ingredient_id,
                'ingredient_name': link.ingredient.name,
                'ingredient_unit': link.ingredient.unit,
                'ingredient_unit_display': link.ingredient.get_unit_display(),
                'ingredient_current_stock': link.ingredient.quantity,
                'quantity_used': link.quantity_used,
            }
            for link in obj.ingredient_links.select_related('ingredient').all()
        ]

    def to_internal_value(self, data):
        """處理 FormData 傳來的多個相同 key 的值"""
        mutable_data = data

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

        # 非 QueryDict 情境（例如 JSON body）也支援 recipe_ingredients 字串
        if isinstance(mutable_data, dict) and isinstance(mutable_data.get('recipe_ingredients'), str):
            mutable_data = mutable_data.copy()
            try:
                mutable_data['recipe_ingredients'] = json.loads(mutable_data['recipe_ingredients'])
            except json.JSONDecodeError:
                raise serializers.ValidationError({'recipe_ingredients': '配方格式錯誤，請提供合法 JSON'})

        return super().to_internal_value(mutable_data)

    def _sync_recipe_ingredients(self, product, recipe_ingredients):
        """同步商品配方。只要有帶入 recipe_ingredients 就視為完整覆蓋。"""
        from apps.inventory.models import Ingredient

        if isinstance(recipe_ingredients, str):
            try:
                recipe_ingredients = json.loads(recipe_ingredients)
            except json.JSONDecodeError:
                raise serializers.ValidationError({'recipe_ingredients': '配方格式錯誤，請提供合法 JSON'})

        if recipe_ingredients is None:
            recipe_ingredients = []

        if not isinstance(recipe_ingredients, list):
            raise serializers.ValidationError({'recipe_ingredients': '配方格式錯誤，必須為陣列'})

        ingredient_ids = []
        normalized_rows = []

        for row in recipe_ingredients:
            ingredient_id = row.get('ingredient')
            quantity_used = row.get('quantity_used')

            if ingredient_id in (None, ''):
                raise serializers.ValidationError({'recipe_ingredients': '每筆配方都必須指定 ingredient'})
            if quantity_used in (None, ''):
                raise serializers.ValidationError({'recipe_ingredients': '每筆配方都必須指定 quantity_used'})

            try:
                quantity_used = float(quantity_used)
            except (TypeError, ValueError):
                raise serializers.ValidationError({'recipe_ingredients': 'quantity_used 必須是數字'})

            if quantity_used <= 0:
                raise serializers.ValidationError({'recipe_ingredients': 'quantity_used 必須大於 0'})

            ingredient_id = int(ingredient_id)
            ingredient_ids.append(ingredient_id)
            normalized_rows.append((ingredient_id, quantity_used))

        if len(ingredient_ids) != len(set(ingredient_ids)):
            raise serializers.ValidationError({'recipe_ingredients': '同一個原物料不可重複設定'})

        ingredients = Ingredient.objects.filter(
            id__in=ingredient_ids,
            store=product.store,
        )
        ingredients_by_id = {i.id: i for i in ingredients}

        missing_ids = [i for i in ingredient_ids if i not in ingredients_by_id]
        if missing_ids:
            raise serializers.ValidationError({'recipe_ingredients': f'找不到原物料或不屬於此店家: {missing_ids}'})

        ProductIngredient.objects.filter(product=product).delete()

        ProductIngredient.objects.bulk_create([
            ProductIngredient(
                product=product,
                ingredient=ingredients_by_id[ingredient_id],
                quantity_used=quantity_used,
            )
            for ingredient_id, quantity_used in normalized_rows
        ])

    def create(self, validated_data):
        recipe_ingredients = validated_data.pop('recipe_ingredients', None)
        request = self.context['request']
        merchant = getattr(request.user, 'merchant_profile', None)
        if not merchant or not hasattr(merchant, 'store'):
            raise serializers.ValidationError('Merchant store not found.')
        
        validated_data['merchant'] = merchant
        validated_data['store'] = merchant.store
        if 'is_available' not in validated_data:
            validated_data['is_available'] = True

        product = super().create(validated_data)

        if recipe_ingredients is not None:
            self._sync_recipe_ingredients(product, recipe_ingredients)

        return product
    
    def update(self, instance, validated_data):
        recipe_ingredients = validated_data.pop('recipe_ingredients', None)

        # multipart PATCH 可能讓 JSONField 未正確解析，這裡做保險處理
        if recipe_ingredients is None and 'recipe_ingredients' in self.initial_data:
            recipe_ingredients = self.initial_data.get('recipe_ingredients')

        product = super().update(instance, validated_data)

        if recipe_ingredients is not None:
            self._sync_recipe_ingredients(product, recipe_ingredients)

        return product


class PublicProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True, allow_null=True)
    food_tags = serializers.ListField(
        child=serializers.CharField(),
        read_only=True
    )
    is_linked_to_surplus = serializers.SerializerMethodField()
    is_sold_out_by_ingredients = serializers.SerializerMethodField()
    ingredient_max_sellable_quantity = serializers.SerializerMethodField()
    is_orderable = serializers.SerializerMethodField()
    
    class Meta:
        model = Product
        fields = [
            'id', 'name', 'description', 'price', 'image', 'service_type',
            'is_available', 'store', 'category', 'category_name', 'food_tags',
            'is_linked_to_surplus', 'is_sold_out_by_ingredients',
            'ingredient_max_sellable_quantity', 'is_orderable'
        ]
    
    def get_is_linked_to_surplus(self, obj):
        """檢查此產品是否被關聯為惜福品"""
        from apps.surplus_food.models import SurplusFood
        return SurplusFood.objects.filter(product=obj, status='active').exists()

    def _compute_ingredient_max_sellable_quantity(self, obj):
        links = list(obj.ingredient_links.select_related('ingredient').all())
        if not links:
            return None

        max_quantities = []
        for link in links:
            if link.quantity_used <= 0:
                continue
            max_by_ingredient = int(link.ingredient.quantity // link.quantity_used)
            max_quantities.append(max_by_ingredient)

        if not max_quantities:
            return None

        return min(max_quantities)

    def get_ingredient_max_sellable_quantity(self, obj):
        return self._compute_ingredient_max_sellable_quantity(obj)

    def get_is_sold_out_by_ingredients(self, obj):
        max_qty = self._compute_ingredient_max_sellable_quantity(obj)
        if max_qty is None:
            return False
        return max_qty <= 0

    def get_is_orderable(self, obj):
        return bool(obj.is_available) and not self.get_is_sold_out_by_ingredients(obj)


class ProductSpecificationSerializer(serializers.ModelSerializer):
    """規格選項序列化器"""
    price_adjustment_display = serializers.SerializerMethodField()
    
    class Meta:
        model = ProductSpecification
        fields = [
            'id', 'group', 'name', 'price_adjustment', 
            'price_adjustment_display', 'is_active', 'display_order', 
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def get_price_adjustment_display(self, obj):
        """格式化價格調整顯示"""
        if obj.price_adjustment > 0:
            return f"+NT${obj.price_adjustment}"
        elif obj.price_adjustment < 0:
            return f"-NT${abs(obj.price_adjustment)}"
        return "NT$0"


class SpecificationGroupSerializer(serializers.ModelSerializer):
    """規格類別序列化器"""
    options = ProductSpecificationSerializer(many=True, read_only=True)
    selection_type_display = serializers.CharField(source='get_selection_type_display', read_only=True)
    options_count = serializers.SerializerMethodField()
    
    class Meta:
        model = SpecificationGroup
        fields = [
            'id', 'product', 'name', 'selection_type', 'selection_type_display',
            'is_required', 'display_order', 'is_active', 
            'options', 'options_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def get_options_count(self, obj):
        """取得該類別下的選項數量"""
        return obj.options.count()
    
    def validate_product(self, value):
        """驗證商品屬於當前商家"""
        request = self.context.get('request')
        if request:
            merchant = getattr(request.user, 'merchant_profile', None)
            if merchant and hasattr(merchant, 'store'):
                if value.store != merchant.store:
                    raise serializers.ValidationError('無權限操作此商品的規格類別')
        return value

