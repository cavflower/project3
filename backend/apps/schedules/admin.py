from django.contrib import admin
from .models import Staff, Shift, JobRole, EmployeeScheduleRequest


@admin.register(Staff)
class StaffAdmin(admin.ModelAdmin):
    list_display = ['name', 'nickname', 'employee_user_id', 'role', 'store', 'status', 'created_at']
    list_filter = ['store', 'role']
    search_fields = ['name', 'nickname', 'employee_user_id', 'role', 'status']


@admin.register(Shift)
class ShiftAdmin(admin.ModelAdmin):
    list_display = ['store', 'date', 'shift_type', 'role', 'staff_needed', 'status']
    list_filter = ['store', 'date', 'shift_type', 'status']
    search_fields = ['role', 'store__name']
    filter_horizontal = ['assigned_staff']


@admin.register(JobRole)
class JobRoleAdmin(admin.ModelAdmin):
    list_display = ['name', 'store', 'description', 'created_at']
    list_filter = ['store']
    search_fields = ['name', 'description', 'store__name']


@admin.register(EmployeeScheduleRequest)
class EmployeeScheduleRequestAdmin(admin.ModelAdmin):
    list_display = ['employee', 'store', 'date', 'shift_type', 'assignment_status', 'role', 'created_at']
    list_filter = ['store', 'period_type', 'shift_type', 'assignment_status']
    search_fields = ['employee__username', 'role', 'notes', 'store__name']

