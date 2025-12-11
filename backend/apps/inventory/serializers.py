from rest_framework import serializers
from .models import Ingredient


class IngredientSerializer(serializers.ModelSerializer):
    """原物料序列化器"""
    
    total_value = serializers.ReadOnlyField()
    is_low_stock = serializers.ReadOnlyField()
    unit_display = serializers.CharField(source='get_unit_display', read_only=True)
    
    class Meta:
        model = Ingredient
        fields = [
            'id',
            'store',
            'name',
            'category',
            'quantity',
            'unit',
            'unit_display',
            'cost_per_unit',
            'supplier',
            'minimum_stock',
            'notes',
            'total_value',
            'is_low_stock',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'store', 'created_at', 'updated_at']
    
    def validate_quantity(self, value):
        """驗證數量必須大於等於0"""
        if value < 0:
            raise serializers.ValidationError("數量不能為負數")
        return value
    
    def validate_cost_per_unit(self, value):
        """驗證單價必須大於等於0"""
        if value < 0:
            raise serializers.ValidationError("單價不能為負數")
        return value


class IngredientExportSerializer(serializers.ModelSerializer):
    """用於匯出的序列化器"""
    
    store_name = serializers.CharField(source='store.name', read_only=True)
    unit_display = serializers.CharField(source='get_unit_display', read_only=True)
    total_value = serializers.ReadOnlyField()
    is_low_stock = serializers.ReadOnlyField()
    
    class Meta:
        model = Ingredient
        fields = [
            'name',
            'store_name',
            'category',
            'quantity',
            'unit_display',
            'cost_per_unit',
            'total_value',
            'supplier',
            'minimum_stock',
            'is_low_stock',
            'notes',
            'created_at',
            'updated_at',
        ]
