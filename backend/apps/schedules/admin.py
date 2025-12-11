from django.contrib import admin
from .models import Staff, Shift


@admin.register(Staff)
class StaffAdmin(admin.ModelAdmin):
    list_display = ['name', 'role', 'store', 'status', 'created_at']
    list_filter = ['store', 'role']
    search_fields = ['name', 'role', 'status']


@admin.register(Shift)
class ShiftAdmin(admin.ModelAdmin):
    list_display = ['store', 'date', 'shift_type', 'role', 'staff_needed', 'status']
    list_filter = ['store', 'date', 'shift_type', 'status']
    search_fields = ['role', 'store__name']
    filter_horizontal = ['assigned_staff']

