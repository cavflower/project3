from django.db import models
from apps.stores.models import Store
from apps.users.models import User, Company


class Staff(models.Model):
    """員工模型"""
    
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name='staff_members',
        verbose_name='所屬店家'
    )
    name = models.CharField(max_length=100, verbose_name='姓名')
    nickname = models.CharField(
        max_length=100,
        blank=True,
        default='',
        verbose_name='暱稱'
    )
    employee_user_id = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name='對應員工帳號ID',
        help_text='若此員工來自系統使用者，記錄其 User ID 以避免重複建立'
    )
    role = models.CharField(max_length=100, verbose_name='職務')
    status = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='備註／出勤狀態',
        help_text='例如：本週可排、可支援午班等'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='建立時間')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新時間')
    
    class Meta:
        db_table = 'staff'
        verbose_name = '員工'
        verbose_name_plural = '員工'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} ({self.role}) - {self.store.name}"


class JobRole(models.Model):
    """店家可維護的職務清單"""

    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name='job_roles',
        verbose_name='所屬店家'
    )
    name = models.CharField(max_length=100, verbose_name='職務名稱')
    description = models.CharField(max_length=255, blank=True, default='', verbose_name='職務說明')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='建立時間')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新時間')

    class Meta:
        db_table = 'job_roles'
        verbose_name = '職務'
        verbose_name_plural = '職務'
        ordering = ['name', '-created_at']
        unique_together = [['store', 'name']]

    def __str__(self):
        return f"{self.store.name} - {self.name}"


class Shift(models.Model):
    """排班時段模型"""
    
    SHIFT_TYPE_CHOICES = [
        ('morning', '早班'),
        ('noon', '午班'),
        ('evening', '晚班'),
    ]
    
    STATUS_CHOICES = [
        ('ready', '準備就緒'),
        ('ongoing', '進行中'),
        ('pending', '待排班'),
    ]

    PERIOD_TYPE_CHOICES = [
        ('day', '日'),
        ('week', '週'),
        ('month', '月'),
    ]
    
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name='shifts',
        verbose_name='所屬店家'
    )
    date = models.DateField(verbose_name='日期')
    period_type = models.CharField(
        max_length=10,
        choices=PERIOD_TYPE_CHOICES,
        default='day',
        verbose_name='排班方式'
    )
    shift_type = models.CharField(
        max_length=20,
        choices=SHIFT_TYPE_CHOICES,
        default='morning',
        verbose_name='時段類型'
    )
    role = models.CharField(max_length=100, verbose_name='需求職務')
    staff_needed = models.PositiveIntegerField(default=1, verbose_name='需求人數')
    start_hour = models.PositiveIntegerField(default=8, verbose_name='開始小時')
    start_minute = models.PositiveIntegerField(default=0, verbose_name='開始分鐘')
    end_hour = models.PositiveIntegerField(default=12, verbose_name='結束小時')
    end_minute = models.PositiveIntegerField(default=0, verbose_name='結束分鐘')
    assigned_staff = models.ManyToManyField(
        Staff,
        related_name='assigned_shifts',
        blank=True,
        verbose_name='已指派員工'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        verbose_name='狀態'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='建立時間')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新時間')
    
    class Meta:
        db_table = 'shifts'
        verbose_name = '排班時段'
        verbose_name_plural = '排班時段'
        ordering = ['date', 'start_hour', 'start_minute']
    
    def __str__(self):
        return f"{self.store.name} - {self.date} {self.get_shift_type_display()}"
    
    @property
    def shift_name(self):
        """生成時段名稱"""
        start_time = f"{self.start_hour:02d}:{self.start_minute:02d}"
        end_time = f"{self.end_hour:02d}:{self.end_minute:02d}"
        return f"{self.get_shift_type_display()} ({start_time} - {end_time})"


class EmployeeScheduleRequest(models.Model):
    """員工排班申請模型"""
    
    SHIFT_TYPE_CHOICES = [
        ('full_day', '整天'),
        ('midnight', '凌晨'),
        ('morning', '早上'),
        ('afternoon', '下午'),
        ('evening', '晚上'),
    ]

    PERIOD_TYPE_CHOICES = [
        ('day', '日'),
        ('week', '週'),
        ('month', '月'),
    ]

    ASSIGNMENT_STATUS_CHOICES = [
        ('pending', '待安排'),
        ('scheduled', '已排班'),
        ('rejected', '已排休'),
    ]

    ATTENDANCE_STATUS_CHOICES = [
        ('unmarked', '未標記'),
        ('present', '到班'),
        ('late', '遲到'),
        ('absent', '未到班'),
    ]

    OFF_DUTY_STATUS_CHOICES = [
        ('unmarked', '未標記'),
        ('on_time', '準時'),
        ('left_early', '早退'),
        ('overtime', '加班'),
    ]
    
    employee = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='schedule_requests',
        verbose_name='員工',
        help_text='申請排班的員工'
    )
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='employee_requests',
        verbose_name='所屬公司',
        help_text='員工所屬的公司'
    )
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name='employee_schedule_requests',
        verbose_name='申請店家',
        help_text='申請排班的店家'
    )
    date = models.DateField(verbose_name='日期')
    period_type = models.CharField(
        max_length=10,
        choices=PERIOD_TYPE_CHOICES,
        default='day',
        verbose_name='可上班時間設定方式'
    )
    shift_type = models.CharField(
        max_length=20,
        choices=SHIFT_TYPE_CHOICES,
        default='full_day',
        verbose_name='時段類型'
    )
    role = models.CharField(max_length=100, blank=True, null=True, verbose_name='職務')
    assignment_status = models.CharField(
        max_length=20,
        choices=ASSIGNMENT_STATUS_CHOICES,
        default='pending',
        verbose_name='店家安排狀態'
    )
    assigned_shift_types = models.JSONField(
        blank=True,
        default=list,
        verbose_name='店家安排時段'
    )
    assigned_slot_roles = models.JSONField(
        blank=True,
        default=dict,
        verbose_name='店家安排時段職務'
    )
    actual_slot_work_times = models.JSONField(
        blank=True,
        default=dict,
        verbose_name='實際班表時段上下班時間'
    )
    actual_slot_attendance = models.JSONField(
        blank=True,
        default=dict,
        verbose_name='實際班表時段到班狀況'
    )
    actual_slot_off_duty_status = models.JSONField(
        blank=True,
        default=dict,
        verbose_name='實際班表時段下班狀況'
    )
    actual_slot_actual_end_times = models.JSONField(
        blank=True,
        default=dict,
        verbose_name='實際班表時段實際下班時間'
    )
    notes = models.TextField(
        blank=True,
        default='',
        verbose_name='備註',
        help_text='員工填寫的備註說明'
    )
    week_start_date = models.DateField(
        verbose_name='週起始日期',
        help_text='該申請所屬的週（週一日期）',
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='建立時間')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新時間')
    
    class Meta:
        db_table = 'employee_schedule_requests'
        verbose_name = '員工排班申請'
        verbose_name_plural = '員工排班申請'
        ordering = ['-date', 'period_type', 'shift_type']
        unique_together = [['employee', 'store', 'date', 'period_type', 'shift_type']]
    
    def __str__(self):
        return f"{self.employee.username} - {self.store.name} - {self.get_period_type_display()} {self.date} {self.get_shift_type_display()}"

