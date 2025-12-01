from django.db import models
from apps.stores.models import Store
from apps.products.models import Product
from django.utils import timezone
import uuid


class SurplusTimeSlot(models.Model):
    """
    惜福時段設定模型
    商家可以設定特定時段作為惜福食品販售時段
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
        related_name='surplus_time_slots',
        verbose_name='所屬店家'
    )
    name = models.CharField(
        max_length=100,
        verbose_name='時段名稱',
        help_text='例如：午餐惜福、晚餐惜福'
    )
    day_of_week = models.CharField(
        max_length=10,
        choices=DAY_CHOICES,
        verbose_name='星期'
    )
    start_time = models.TimeField(verbose_name='開始時間')
    end_time = models.TimeField(verbose_name='結束時間')
    is_active = models.BooleanField(
        default=True,
        verbose_name='啟用狀態'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='建立時間')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新時間')
    
    class Meta:
        db_table = 'surplus_time_slots'
        verbose_name = '惜福時段'
        verbose_name_plural = '惜福時段'
        ordering = ['day_of_week', 'start_time']
        unique_together = ['store', 'day_of_week', 'start_time']
    
    def __str__(self):
        return f"{self.store.name} - {self.get_day_of_week_display()} {self.name}"


class SurplusFood(models.Model):
    """
    惜福食品模型
    商家可以將即期或剩餘的食材/商品設定為惜福品
    """
    STATUS_CHOICES = [
        ('active', '上架中'),
        ('inactive', '已下架'),
        ('sold_out', '已售完'),
    ]
    
    CONDITION_CHOICES = [
        ('near_expiry', '即期品'),
        ('surplus', '剩餘品'),
        ('damaged_package', '外包裝損傷'),
        ('end_of_day', '當日剩餘'),
    ]
    
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name='surplus_foods',
        verbose_name='所屬店家'
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='surplus_items',
        verbose_name='關聯商品',
        help_text='可選：關聯到現有商品'
    )
    title = models.CharField(
        max_length=255,
        verbose_name='惜福品名稱'
    )
    description = models.TextField(
        blank=True,
        verbose_name='商品描述'
    )
    original_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name='原價'
    )
    surplus_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name='惜福價'
    )
    quantity = models.PositiveIntegerField(
        default=1,
        verbose_name='可售數量'
    )
    remaining_quantity = models.PositiveIntegerField(
        verbose_name='剩餘數量'
    )
    condition = models.CharField(
        max_length=20,
        choices=CONDITION_CHOICES,
        default='surplus',
        verbose_name='商品狀況'
    )
    expiry_date = models.DateField(
        null=True,
        blank=True,
        verbose_name='到期日',
        help_text='即期品必填'
    )
    time_slot = models.ForeignKey(
        SurplusTimeSlot,
        on_delete=models.CASCADE,
        null=True,
        related_name='surplus_foods',
        verbose_name='惜福時段'
    )
    image = models.ImageField(
        upload_to='surplus_food_images/',
        blank=True,
        null=True,
        verbose_name='商品圖片'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active',
        verbose_name='狀態'
    )
    pickup_instructions = models.TextField(
        blank=True,
        verbose_name='取餐說明',
        help_text='例如：請於時段內到店取餐'
    )
    tags = models.JSONField(
        default=list,
        blank=True,
        verbose_name='標籤',
        help_text='例如：["素食", "無麩質", "環保"]'
    )
    code = models.CharField(
        max_length=20,
        unique=True,
        editable=False,
        verbose_name='惜福品編號'
    )
    views_count = models.PositiveIntegerField(
        default=0,
        verbose_name='瀏覽次數'
    )
    orders_count = models.PositiveIntegerField(
        default=0,
        verbose_name='訂購次數'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='建立時間')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新時間')
    published_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='上架時間'
    )
    
    class Meta:
        db_table = 'surplus_foods'
        verbose_name = '惜福食品'
        verbose_name_plural = '惜福食品'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['store', 'status']),
        ]
    
    def __str__(self):
        return f"{self.title} - {self.store.name}"
    
    def save(self, *args, **kwargs):
        # 自動生成惜福品編號
        if not self.code:
            self.code = self.generate_code()
        
        # 初始化剩餘數量（新建時）
        if not self.pk:
            if not self.remaining_quantity or self.remaining_quantity == 0:
                self.remaining_quantity = self.quantity
        
        # 自動檢查狀態
        if self.status == 'active':
            if self.remaining_quantity <= 0:
                self.status = 'sold_out'
        
        super().save(*args, **kwargs)
    
    @staticmethod
    def generate_code():
        """生成唯一的惜福品編號"""
        return f"SF{uuid.uuid4().hex[:8].upper()}"
    
    @property
    def discount_percent(self):
        """計算折扣百分比"""
        if self.original_price > 0:
            return round((1 - (self.surplus_price / self.original_price)) * 100, 1)
        return 0
    
    @property
    def is_available(self):
        """檢查是否可賣"""
        return (
            self.status == 'active' and
            self.remaining_quantity > 0
        )
    
    @property
    def is_near_sold_out(self):
        """檢查是否即將售完（剩餘數量 <= 3）"""
        return self.remaining_quantity <= 3 and self.remaining_quantity > 0


class SurplusFoodOrder(models.Model):
    """
    惜福食品訂單模型
    """
    STATUS_CHOICES = [
        ('pending', '待確認'),
        ('confirmed', '已確認'),
        ('ready', '可取餐'),
        ('completed', '已完成'),
        ('cancelled', '已取消'),
        ('expired', '已過期'),
    ]
    
    PAYMENT_CHOICES = [
        ('cash', '現金'),
        ('credit_card', '信用卡'),
        ('line_pay', 'LINE Pay'),
        ('points', '點數兌換'),
    ]
    
    order_number = models.CharField(
        max_length=20,
        unique=True,
        verbose_name='訂單編號'
    )
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name='surplus_orders',
        verbose_name='店家'
    )
    surplus_food = models.ForeignKey(
        SurplusFood,
        on_delete=models.CASCADE,
        related_name='orders',
        verbose_name='惜福食品'
    )
    customer_name = models.CharField(max_length=100, verbose_name='顧客姓名')
    customer_phone = models.CharField(max_length=20, verbose_name='顧客手機')
    customer_email = models.EmailField(blank=True, verbose_name='顧客Email')
    quantity = models.PositiveIntegerField(default=1, verbose_name='數量')
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name='單價'
    )
    total_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name='總價'
    )
    payment_method = models.CharField(
        max_length=20,
        choices=PAYMENT_CHOICES,
        verbose_name='付款方式'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        verbose_name='訂單狀態'
    )
    pickup_time = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='預計取餐時間'
    )
    notes = models.TextField(blank=True, verbose_name='備註')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='訂單時間')
    confirmed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='確認時間'
    )
    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='完成時間'
    )
    
    class Meta:
        db_table = 'surplus_food_orders'
        verbose_name = '惜福食品訂單'
        verbose_name_plural = '惜福食品訂單'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.order_number} - {self.customer_name}"
    
    def save(self, *args, **kwargs):
        # 自動生成訂單編號
        if not self.order_number:
            self.order_number = self.generate_order_number()
        
        # 計算總價
        self.total_price = self.quantity * self.unit_price
        
        super().save(*args, **kwargs)
    
    @staticmethod
    def generate_order_number():
        """生成唯一訂單編號"""
        import secrets
        import string
        date_str = timezone.now().strftime('%Y%m%d')
        random_str = ''.join(secrets.choice(string.digits) for _ in range(4))
        order_number = f"SFO{date_str}{random_str}"
        
        while SurplusFoodOrder.objects.filter(order_number=order_number).exists():
            random_str = ''.join(secrets.choice(string.digits) for _ in range(4))
            order_number = f"SFO{date_str}{random_str}"
        
        return order_number
