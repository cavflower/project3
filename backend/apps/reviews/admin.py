from django.contrib import admin
from .models import StoreReview, ProductReview, StoreReviewImage, ProductReviewImage


@admin.register(StoreReview)
class StoreReviewAdmin(admin.ModelAdmin):
    list_display = ['user', 'store', 'rating', 'created_at', 'has_reply']
    list_filter = ['rating', 'created_at', 'store']
    search_fields = ['user__username', 'store__name', 'comment']
    readonly_fields = ['created_at', 'updated_at']
    
    def has_reply(self, obj):
        return bool(obj.merchant_reply)
    has_reply.boolean = True
    has_reply.short_description = '已回覆'


@admin.register(ProductReview)
class ProductReviewAdmin(admin.ModelAdmin):
    list_display = ['user', 'product', 'store', 'rating', 'created_at']
    list_filter = ['rating', 'created_at', 'store']
    search_fields = ['user__username', 'product__name', 'comment']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(StoreReviewImage)
class StoreReviewImageAdmin(admin.ModelAdmin):
    list_display = ['id', 'store_review', 'created_at']
    list_filter = ['created_at']
    search_fields = ['store_review__user__username', 'store_review__store__name']
    readonly_fields = ['created_at']


@admin.register(ProductReviewImage)
class ProductReviewImageAdmin(admin.ModelAdmin):
    list_display = ['id', 'product_review', 'created_at']
    list_filter = ['created_at']
    search_fields = ['product_review__user__username', 'product_review__product__name']
    readonly_fields = ['created_at']
