from django.contrib import admin
from .models import Ingredient


@admin.register(Ingredient)
class IngredientAdmin(admin.ModelAdmin):
    list_display = ['name', 'store', 'category', 'quantity', 'unit', 'cost_per_unit', 'is_low_stock', 'created_at']
    list_filter = ['store', 'category', 'unit', 'created_at']
    search_fields = ['name', 'category', 'supplier']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('基本資訊', {
            'fields': ('store', 'name', 'category')
        }),
        ('庫存資訊', {
            'fields': ('quantity', 'unit', 'minimum_stock')
        }),
        ('成本資訊', {
            'fields': ('cost_per_unit', 'supplier')
        }),
        ('其他', {
            'fields': ('notes', 'created_at', 'updated_at')
        }),
    )
