from django.db import models
from apps.stores.models import Store


class Staff(models.Model):
    """員工模型"""
    
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name='staff_members',
        verbose_name='所屬店家'
    )
    name = models.CharField(max_length=100, verbose_name='姓名')
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
    
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name='shifts',
        verbose_name='所屬店家'
    )
    date = models.DateField(verbose_name='日期')
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

