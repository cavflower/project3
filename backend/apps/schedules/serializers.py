from rest_framework import serializers
from .models import Staff, Shift, ShiftApplication


class StaffSerializer(serializers.ModelSerializer):
    """員工序列化器"""
    
    user_id = serializers.IntegerField(source='user.id', read_only=True, allow_null=True)
    
    class Meta:
        model = Staff
        fields = [
            'id',
            'store',
            'user',
            'user_id',
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
    applications = serializers.SerializerMethodField()
    application_count = serializers.SerializerMethodField()
    
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
            'applications',
            'application_count',
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
    
    def get_applications(self, obj):
        """獲取該排班的申請列表"""
        applications = obj.applications.all()
        return ShiftApplicationSerializer(applications, many=True).data
    
    def get_application_count(self, obj):
        """獲取待確認的申請數量"""
        return obj.applications.filter(status='pending').count()


class ShiftApplicationSerializer(serializers.ModelSerializer):
    """排班申請序列化器"""
    
    staff_name = serializers.CharField(source='staff.name', read_only=True)
    staff_role = serializers.CharField(source='staff.role', read_only=True)
    shift_info = serializers.SerializerMethodField()
    
    class Meta:
        model = ShiftApplication
        fields = [
            'id',
            'shift',
            'staff',
            'staff_name',
            'staff_role',
            'status',
            'message',
            'shift_info',
            'created_at',
            'updated_at',
            'reviewed_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'reviewed_at']
    
    def get_shift_info(self, obj):
        """獲取排班資訊"""
        return {
            'id': obj.shift.id,
            'date': obj.shift.date,
            'shift_type': obj.shift.shift_type,
            'shift_name': obj.shift.shift_name,
            'role': obj.shift.role,
        }


class ScheduleDataSerializer(serializers.Serializer):
    """排班資料批次序列化器（用於一次性儲存所有資料）"""
    
    shifts = ShiftSerializer(many=True, required=False, allow_empty=True)
    staff = StaffSerializer(many=True, required=False, allow_empty=True)

