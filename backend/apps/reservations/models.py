from django.db import models
from django.utils import timezone
from apps.users.models import User
from apps.stores.models import Store
import secrets
import string


class Reservation(models.Model):
    """
    訂位模型 - 支援會員和訪客訂位
    """
    STATUS_CHOICES = (
        ('pending', '待確認'),
        ('confirmed', '已確認'),
        ('completed', '已完成'),
        ('cancelled', '已取消'),
        ('no_show', '未到場'),
    )

    # 訂位基本資訊
    reservation_number = models.CharField(
        max_length=20,
        unique=True,
        verbose_name='訂位編號',
        help_text='系統自動生成的唯一訂位編號'
    )
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name='reservations',
        verbose_name='店家'
    )
    
    # 會員訂位（可為 null 代表訪客訂位）
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reservations',
        verbose_name='會員',
        help_text='如果為 null 則為訪客訂位'
    )
    
    # 訂位人資訊（訪客必填，會員可用此覆蓋預設資訊）
    customer_name = models.CharField(
        max_length=100,
        verbose_name='訂位人姓名'
    )
    customer_phone = models.CharField(
        max_length=20,
        verbose_name='訂位人手機'
    )
    customer_email = models.EmailField(
        blank=True,
        verbose_name='訂位人Email'
    )
    customer_gender = models.CharField(
        max_length=20,
        blank=True,
        verbose_name='訂位人性別',
        help_text='male, female, other, prefer_not_to_say'
    )
    
    # 訂位詳情
    reservation_date = models.DateField(
        verbose_name='訂位日期'
    )
    time_slot = models.CharField(
        max_length=20,
        verbose_name='訂位時段',
        help_text='例如: 18:00-20:00'
    )
    party_size = models.PositiveIntegerField(
        verbose_name='訂位人數（成人）'
    )
    children_count = models.PositiveIntegerField(
        default=0,
        verbose_name='孩童人數'
    )
    special_requests = models.TextField(
        blank=True,
        verbose_name='特殊需求'
    )
    
    # 訂位狀態
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        verbose_name='訂位狀態'
    )
    
    # 取消相關
    cancelled_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='取消時間'
    )
    cancelled_by = models.CharField(
        max_length=20,
        blank=True,
        verbose_name='取消者',
        help_text='customer 或 merchant'
    )
    cancel_reason = models.TextField(
        blank=True,
        verbose_name='取消原因'
    )
    
    # 訪客驗證用（僅訪客訂位使用）
    phone_hash = models.CharField(
        max_length=255,
        blank=True,
        verbose_name='手機號碼雜湊',
        help_text='用於訪客驗證身份'
    )
    
    # 時間戳記
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='建立時間'
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='更新時間'
    )
    confirmed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='確認時間'
    )
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['reservation_number']),
            models.Index(fields=['customer_phone']),
            models.Index(fields=['reservation_date', 'status']),
            models.Index(fields=['store', 'reservation_date']),
        ]
        verbose_name = '訂位'
        verbose_name_plural = '訂位列表'
    
    def __str__(self):
        return f"{self.reservation_number} - {self.customer_name} ({self.store.name})"
    
    def save(self, *args, **kwargs):
        # 自動生成訂位編號
        if not self.reservation_number:
            self.reservation_number = self.generate_reservation_number()
        
        # 訪客訂位時生成手機雜湊
        if not self.user and self.customer_phone and not self.phone_hash:
            import hashlib
            self.phone_hash = hashlib.sha256(
                self.customer_phone.encode()
            ).hexdigest()
        
        super().save(*args, **kwargs)
    
    @staticmethod
    def generate_reservation_number():
        """生成唯一訂位編號 格式: R + 日期(YYYYMMDD) + 隨機4碼"""
        date_str = timezone.now().strftime('%Y%m%d')
        random_str = ''.join(secrets.choice(string.digits) for _ in range(4))
        reservation_number = f"R{date_str}{random_str}"
        
        # 確保唯一性
        while Reservation.objects.filter(reservation_number=reservation_number).exists():
            random_str = ''.join(secrets.choice(string.digits) for _ in range(4))
            reservation_number = f"R{date_str}{random_str}"
        
        return reservation_number
    
    @property
    def is_guest_reservation(self):
        """判斷是否為訪客訂位"""
        return self.user is None
    
    @property
    def can_edit(self):
        """判斷是否可編輯（僅待確認和已確認狀態可編輯）"""
        return self.status in ['pending', 'confirmed']
    
    @property
    def can_cancel(self):
        """判斷是否可取消（未完成和未取消狀態可取消）"""
        return self.status in ['pending', 'confirmed']


class ReservationChangeLog(models.Model):
    """
    訂位變更記錄
    """
    reservation = models.ForeignKey(
        Reservation,
        on_delete=models.CASCADE,
        related_name='change_logs',
        verbose_name='訂位'
    )
    changed_by = models.CharField(
        max_length=20,
        verbose_name='變更者',
        help_text='customer, merchant, system'
    )
    change_type = models.CharField(
        max_length=20,
        verbose_name='變更類型',
        help_text='created, updated, cancelled, confirmed, completed'
    )
    old_values = models.JSONField(
        null=True,
        blank=True,
        verbose_name='變更前數據'
    )
    new_values = models.JSONField(
        null=True,
        blank=True,
        verbose_name='變更後數據'
    )
    note = models.TextField(
        blank=True,
        verbose_name='備註'
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='變更時間'
    )
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = '訂位變更記錄'
        verbose_name_plural = '訂位變更記錄列表'
    
    def __str__(self):
        return f"{self.reservation.reservation_number} - {self.change_type} at {self.created_at}"



class TimeSlot(models.Model):
    """
    訂位時段
    """
    DAY_CHOICES = [
        ('monday', '星期一'),
        ('tuesday', '星期二'),
        ('wednesday', '星期三'),
        ('thursday', '星期四'),
        ('friday', '星期五'),
        ('saturday', '星期六'),
        ('sunday', '星期日'),
    ]
    
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name='time_slots',
        verbose_name='店家'
    )
    day_of_week = models.CharField(
        max_length=10,
        choices=DAY_CHOICES,
        verbose_name='星期'
    )
    start_time = models.TimeField(verbose_name='開始時間')
    end_time = models.TimeField(
        null=True,
        blank=True,
        verbose_name='結束時間'
    )
    max_capacity = models.PositiveIntegerField(
        verbose_name='人數上限',
        help_text='此時段可容納的最大人數'
    )
    max_party_size = models.PositiveIntegerField(
        default=10,
        verbose_name='單筆訂位最多人數',
        help_text='單筆訂位可接受的最多人數'
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name='啟用狀態'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = '訂位時段'
        verbose_name_plural = '訂位時段列表'
        ordering = ['day_of_week', 'start_time']
        unique_together = ['store', 'day_of_week', 'start_time']
    
    def __str__(self):
        time_display = f"{self.start_time.strftime('%H:%M')}"
        if self.end_time:
            time_display += f"-{self.end_time.strftime('%H:%M')}"
        return f"{self.store.name} - {self.get_day_of_week_display()} {time_display}"
