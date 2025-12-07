from django.contrib import admin
from .models import TakeoutOrder, TakeoutOrderItem, DineInOrder, DineInOrderItem


# ===== 外帶訂單 Admin =====
class TakeoutOrderItemInline(admin.TabularInline):
    model = TakeoutOrderItem
    extra = 0
    raw_id_fields = ['product']


@admin.register(TakeoutOrder)
class TakeoutOrderAdmin(admin.ModelAdmin):
    list_display = [
        'pickup_number', 
        'customer_name', 
        'store', 
        'status', 
        'payment_method',
        'pickup_at',
        'created_at'
    ]
    list_filter = ['status', 'payment_method', 'created_at']
    search_fields = ['pickup_number', 'customer_name', 'customer_phone']
    readonly_fields = ['pickup_number', 'created_at', 'updated_at']
    raw_id_fields = ['store', 'user']
    inlines = [TakeoutOrderItemInline]
    
    fieldsets = (
        ('基本資訊', {
            'fields': ('pickup_number', 'status', 'store')
        }),
        ('顧客資訊', {
            'fields': ('user', 'customer_name', 'customer_phone')
        }),
        ('訂單詳情', {
            'fields': ('pickup_at', 'payment_method', 'notes', 'use_utensils')
        }),
        ('時間戳記', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('store', 'user').prefetch_related('items')


@admin.register(TakeoutOrderItem)
class TakeoutOrderItemAdmin(admin.ModelAdmin):
    list_display = ['order', 'product', 'quantity']
    raw_id_fields = ['order', 'product']


# ===== 內用訂單 Admin =====
class DineInOrderItemInline(admin.TabularInline):
    model = DineInOrderItem
    extra = 0
    raw_id_fields = ['product']


@admin.register(DineInOrder)
class DineInOrderAdmin(admin.ModelAdmin):
    list_display = [
        'order_number', 
        'table_label',
        'customer_name', 
        'store', 
        'status', 
        'payment_method',
        'created_at'
    ]
    list_filter = ['status', 'payment_method', 'use_eco_tableware', 'created_at']
    search_fields = ['order_number', 'customer_name', 'customer_phone', 'table_label']
    readonly_fields = ['order_number', 'created_at', 'updated_at', 'completed_at']
    raw_id_fields = ['store', 'user']
    inlines = [DineInOrderItemInline]
    
    fieldsets = (
        ('基本資訊', {
            'fields': ('order_number', 'status', 'store', 'table_label')
        }),
        ('顧客資訊', {
            'fields': ('user', 'customer_name', 'customer_phone')
        }),
        ('訂單詳情', {
            'fields': ('payment_method', 'notes', 'use_eco_tableware')
        }),
        ('時間戳記', {
            'fields': ('created_at', 'updated_at', 'completed_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('store', 'user').prefetch_related('items')


@admin.register(DineInOrderItem)
class DineInOrderItemAdmin(admin.ModelAdmin):
    list_display = ['order', 'product', 'quantity']
    raw_id_fields = ['order', 'product']
