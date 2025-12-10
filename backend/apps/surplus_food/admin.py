from django.contrib import admin
from .models import SurplusTimeSlot, SurplusFood, SurplusFoodOrder, SurplusFoodCategory, SurplusFoodOrderItem


@admin.register(SurplusFoodCategory)
class SurplusFoodCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'store', 'display_order', 'is_active', 'created_at']
    list_filter = ['is_active', 'store']
    search_fields = ['name', 'store__name']
    ordering = ['store', 'display_order', 'name']


@admin.register(SurplusTimeSlot)
class SurplusTimeSlotAdmin(admin.ModelAdmin):
    list_display = ['name', 'store', 'day_of_week', 'start_time', 'end_time', 'is_active']
    list_filter = ['is_active', 'day_of_week', 'store']
    search_fields = ['name', 'store__name']
    ordering = ['day_of_week', 'start_time']


@admin.register(SurplusFood)
class SurplusFoodAdmin(admin.ModelAdmin):
    list_display = ['code', 'title', 'store', 'surplus_price', 'remaining_quantity', 'status', 'created_at']
    list_filter = ['status', 'condition', 'store']
    search_fields = ['title', 'code', 'store__name']
    readonly_fields = ['code', 'views_count', 'orders_count', 'created_at', 'updated_at']
    ordering = ['-created_at']
    
    fieldsets = (
        ('基本資訊', {
            'fields': ('store', 'product', 'title', 'description', 'code')
        }),
        ('價格與數量', {
            'fields': ('original_price', 'surplus_price', 'quantity', 'remaining_quantity')
        }),
        ('商品狀況', {
            'fields': ('condition', 'expiry_date', 'image', 'tags')
        }),
        ('販售時間', {
            'fields': ('available_from', 'available_until', 'time_slot')
        }),
        ('狀態與說明', {
            'fields': ('status', 'pickup_instructions')
        }),
        ('統計資訊', {
            'fields': ('views_count', 'orders_count', 'created_at', 'updated_at', 'published_at')
        }),
    )


class SurplusFoodOrderItemInline(admin.TabularInline):
    """訂單項目內嵌顯示"""
    model = SurplusFoodOrderItem
    extra = 0
    readonly_fields = ['surplus_food', 'quantity', 'unit_price', 'subtotal']
    can_delete = False
    
    def has_add_permission(self, request, obj=None):
        return False


@admin.register(SurplusFoodOrder)
class SurplusFoodOrderAdmin(admin.ModelAdmin):
    list_display = ['order_number', 'store', 'customer_name', 'get_items_summary', 'total_price', 'status', 'created_at']
    list_filter = ['status', 'payment_method', 'store']
    search_fields = ['order_number', 'customer_name', 'customer_phone']
    readonly_fields = ['order_number', 'total_price', 'created_at', 'confirmed_at', 'completed_at']
    ordering = ['-created_at']
    inlines = [SurplusFoodOrderItemInline]
    
    fieldsets = (
        ('訂單資訊', {
            'fields': ('order_number', 'store', 'status', 'pickup_number')
        }),
        ('顧客資訊', {
            'fields': ('customer_name', 'customer_phone', 'customer_email')
        }),
        ('訂單詳情', {
            'fields': ('total_price', 'payment_method', 'order_type', 'use_utensils')
        }),
        ('時間與備註', {
            'fields': ('pickup_time', 'notes', 'created_at', 'confirmed_at', 'completed_at')
        }),
    )
    
    def get_items_summary(self, obj):
        """顯示訂單品項摘要"""
        items = obj.items.all()
        if not items:
            return '-'
        summary = ', '.join([f"{item.surplus_food.title} x{item.quantity}" for item in items])
        return summary if len(summary) <= 50 else summary[:47] + '...'
    get_items_summary.short_description = '訂單品項'


@admin.register(SurplusFoodOrderItem)
class SurplusFoodOrderItemAdmin(admin.ModelAdmin):
    list_display = ['order', 'surplus_food', 'quantity', 'unit_price', 'subtotal']
    list_filter = ['order__store']
    search_fields = ['order__order_number', 'surplus_food__title']
    readonly_fields = ['subtotal']

