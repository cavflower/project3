from django.contrib import admin
from .models import Product, ProductCategory, ProductIngredient


@admin.register(ProductCategory)
class ProductCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'store', 'display_order', 'is_active', 'created_at']
    list_filter = ['is_active', 'store']
    search_fields = ['name', 'description']
    ordering = ['store', 'display_order']


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'store', 'category', 'price', 'is_available', 'service_type']
    list_filter = ['is_available', 'service_type', 'store', 'category']
    search_fields = ['name', 'description']
    ordering = ['-created_at']


@admin.register(ProductIngredient)
class ProductIngredientAdmin(admin.ModelAdmin):
    list_display = ['product', 'ingredient', 'quantity_used', 'updated_at']
    list_filter = ['product__store']
    search_fields = ['product__name', 'ingredient__name']
    ordering = ['product', 'ingredient']
