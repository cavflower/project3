from rest_framework import serializers
from .models import Staff, Shift, EmployeeScheduleRequest


class StaffSerializer(serializers.ModelSerializer):
    """員工序列化器"""
    
    class Meta:
        model = Staff
        fields = [
            'id',
            'store',
            'name',
            'role',
            'status',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'store', 'created_at', 'updated_at']


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
            'shift_type': {'required': True},
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
    shift_type_display = serializers.SerializerMethodField()
    
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
            'shift_type',
            'shift_type_display',
            'role',
            'notes',
            'week_start_date',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'employee', 'company', 'created_at', 'updated_at']
        extra_kwargs = {
            'date': {'required': True},
            'shift_type': {'required': True},
            'role': {'required': True},
            'week_start_date': {'required': True},
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

