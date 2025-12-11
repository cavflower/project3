from django.contrib import admin
from .models import Reservation, ReservationChangeLog, TimeSlot


@admin.register(Reservation)
class ReservationAdmin(admin.ModelAdmin):
    list_display = [
        'reservation_number',
        'customer_name',
        'store',
        'reservation_date',
        'time_slot',
        'party_size',
        'status',
        'is_guest_reservation',
        'created_at',
    ]
    list_filter = [
        'status',
        'reservation_date',
        'created_at',
    ]
    search_fields = [
        'reservation_number',
        'customer_name',
        'customer_phone',
        'customer_email',
        'store__name',
    ]
    readonly_fields = [
        'reservation_number',
        'phone_hash',
        'created_at',
        'updated_at',
        'confirmed_at',
        'cancelled_at',
    ]
    fieldsets = (
        ('訂位資訊', {
            'fields': (
                'reservation_number',
                'store',
                'user',
                'status',
            )
        }),
        ('顧客資訊', {
            'fields': (
                'customer_name',
                'customer_phone',
                'customer_email',
                'customer_gender',
            )
        }),
        ('訂位詳情', {
            'fields': (
                'reservation_date',
                'time_slot',
                'party_size',
                'children_count',
                'special_requests',
            )
        }),
        ('取消資訊', {
            'fields': (
                'cancelled_at',
                'cancelled_by',
                'cancel_reason',
            ),
            'classes': ('collapse',),
        }),
        ('系統資訊', {
            'fields': (
                'phone_hash',
                'created_at',
                'updated_at',
                'confirmed_at',
            ),
            'classes': ('collapse',),
        }),
    )


@admin.register(ReservationChangeLog)
class ReservationChangeLogAdmin(admin.ModelAdmin):
    list_display = [
        'reservation',
        'change_type',
        'changed_by',
        'created_at',
    ]
    list_filter = [
        'change_type',
        'changed_by',
        'created_at',
    ]
    search_fields = [
        'reservation__reservation_number',
        'note',
    ]
    readonly_fields = [
        'reservation',
        'changed_by',
        'change_type',
        'old_values',
        'new_values',
        'note',
        'created_at',
    ]


@admin.register(TimeSlot)
class TimeSlotAdmin(admin.ModelAdmin):
    list_display = [
        'store',
        'day_of_week',
        'start_time',
        'end_time',
        'max_capacity',
        'max_party_size',
        'is_active',
    ]
    list_filter = [
        'day_of_week',
        'is_active',
        'store',
    ]
    search_fields = ['store__name']
    fieldsets = (
        ('基本資訊', {
            'fields': (
                'store',
                'day_of_week',
            )
        }),
        ('時間設定', {
            'fields': (
                'start_time',
                'end_time',
            )
        }),
        ('容量設定', {
            'fields': (
                'max_capacity',
                'max_party_size',
            )
        }),
        ('狀態', {
            'fields': ('is_active',)
        }),
    )
