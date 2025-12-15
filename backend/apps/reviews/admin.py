from django.contrib import admin
from .models import StoreReview, ProductReview


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
