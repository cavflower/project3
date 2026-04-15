from rest_framework import serializers
from .models import Staff, Shift, EmployeeScheduleRequest, JobRole


class StaffSerializer(serializers.ModelSerializer):
    """員工序列化器"""
    
    class Meta:
        model = Staff
        fields = [
            'id',
            'store',
            'name',
            'nickname',
            'employee_user_id',
            'role',
            'status',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'store', 'created_at', 'updated_at']
        extra_kwargs = {
            'nickname': {'required': False, 'allow_blank': True},
            'employee_user_id': {'required': False, 'allow_null': True},
        }


class JobRoleSerializer(serializers.ModelSerializer):
    """店家職務序列化器"""

    class Meta:
        model = JobRole
        fields = [
            'id',
            'store',
            'name',
            'description',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'store', 'created_at', 'updated_at']
        extra_kwargs = {
            'name': {'required': True},
            'description': {'required': False},
        }


class ShiftSerializer(serializers.ModelSerializer):
    """排班時段序列化器"""
    
    assigned_staff_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        allow_empty=True
    )
    assigned_staff = StaffSerializer(many=True, read_only=True)
    shift_name = serializers.ReadOnlyField()
    
    class Meta:
        model = Shift
        fields = [
            'id',
            'store',
            'date',
            'period_type',
            'shift_type',
            'role',
            'staff_needed',
            'start_hour',
            'start_minute',
            'end_hour',
            'end_minute',
            'assigned_staff_ids',
            'assigned_staff',
            'status',
            'shift_name',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'store', 'created_at', 'updated_at']
        extra_kwargs = {
            'date': {'required': True},
            'period_type': {'required': False},
            'shift_type': {'required': False},
            'role': {'required': True},
            'staff_needed': {'required': True},
            'start_hour': {'required': True},
            'start_minute': {'required': True},
            'end_hour': {'required': True},
            'end_minute': {'required': True},
            'status': {'required': False},
        }


class ScheduleDataSerializer(serializers.Serializer):
    """排班資料批次序列化器（用於一次性儲存所有資料）"""
    
    shifts = ShiftSerializer(many=True, required=False, allow_empty=True)
    staff = StaffSerializer(many=True, required=False, allow_empty=True)


class EmployeeScheduleRequestSerializer(serializers.ModelSerializer):
    """員工排班申請序列化器"""
    
    employee_name = serializers.SerializerMethodField()
    company_name = serializers.SerializerMethodField()
    store_name = serializers.SerializerMethodField()
    period_type_display = serializers.SerializerMethodField()
    shift_type_display = serializers.SerializerMethodField()
    assignment_status_display = serializers.SerializerMethodField()
    assigned_shift_types_display = serializers.SerializerMethodField()
    actual_slot_attendance_display = serializers.SerializerMethodField()
    actual_slot_off_duty_status_display = serializers.SerializerMethodField()
    
    class Meta:
        model = EmployeeScheduleRequest
        fields = [
            'id',
            'employee',
            'employee_name',
            'company',
            'company_name',
            'store',
            'store_name',
            'date',
            'period_type',
            'period_type_display',
            'shift_type',
            'shift_type_display',
            'role',
            'assignment_status',
            'assignment_status_display',
            'assigned_shift_types',
            'assigned_shift_types_display',
            'assigned_slot_roles',
            'actual_slot_work_times',
            'actual_slot_attendance',
            'actual_slot_attendance_display',
            'actual_slot_off_duty_status',
            'actual_slot_off_duty_status_display',
            'actual_slot_actual_end_times',
            'notes',
            'week_start_date',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'employee', 'company', 'created_at', 'updated_at']
        extra_kwargs = {
            'date': {'required': True},
            'period_type': {'required': False},
            'shift_type': {'required': False},
            'role': {'required': False, 'allow_blank': True, 'allow_null': True},
            'assignment_status': {'required': False},
            'assigned_shift_types': {'required': False},
            'assigned_slot_roles': {'required': False},
            'actual_slot_work_times': {'required': False},
            'actual_slot_attendance': {'required': False},
            'actual_slot_off_duty_status': {'required': False},
            'actual_slot_actual_end_times': {'required': False},
            'week_start_date': {'required': False, 'allow_null': True},
        }
    
    def get_employee_name(self, obj):
        """安全獲取員工名稱"""
        try:
            return obj.employee.username if obj.employee else ''
        except:
            return ''
    
    def get_company_name(self, obj):
        """安全獲取公司名稱"""
        try:
            return obj.company.name if obj.company else ''
        except:
            return ''
    
    def get_store_name(self, obj):
        """安全獲取店家名稱"""
        try:
            return obj.store.name if obj.store else ''
        except:
            return ''
    
    def get_shift_type_display(self, obj):
        """安全獲取時段顯示名稱"""
        try:
            return obj.get_shift_type_display() if obj.shift_type else ''
        except:
            return obj.shift_type if obj.shift_type else ''

    def get_period_type_display(self, obj):
        """安全獲取排班方式顯示名稱"""
        try:
            return obj.get_period_type_display() if obj.period_type else ''
        except:
            return obj.period_type if obj.period_type else ''

    def get_assignment_status_display(self, obj):
        """安全獲取店家安排狀態顯示名稱"""
        try:
            return obj.get_assignment_status_display() if obj.assignment_status else ''
        except:
            return obj.assignment_status if obj.assignment_status else ''

    def get_assigned_shift_types_display(self, obj):
        """安全獲取店家安排時段顯示名稱"""
        try:
            values = obj.assigned_shift_types or []
            if not isinstance(values, list):
                return []

            labels = dict(EmployeeScheduleRequest.SHIFT_TYPE_CHOICES)
            return [labels.get(value, value) for value in values]
        except:
            return []

    def get_actual_slot_attendance_display(self, obj):
        """安全獲取時段到班狀況顯示名稱"""
        try:
            values = obj.actual_slot_attendance or {}
            if not isinstance(values, dict):
                return {}

            labels = dict(EmployeeScheduleRequest.ATTENDANCE_STATUS_CHOICES)
            return {slot: labels.get(status, status) for slot, status in values.items()}
        except:
            return {}

    def get_actual_slot_off_duty_status_display(self, obj):
        """安全獲取時段下班狀況顯示名稱"""
        try:
            values = obj.actual_slot_off_duty_status or {}
            if not isinstance(values, dict):
                return {}

            labels = dict(EmployeeScheduleRequest.OFF_DUTY_STATUS_CHOICES)
            return {slot: labels.get(status, status) for slot, status in values.items()}
        except:
            return {}

