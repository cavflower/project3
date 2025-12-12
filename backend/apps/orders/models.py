from django.db import models
from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from apps.stores.models import Store
from apps.products.models import Product


class TakeoutOrder(models.Model):
    """外帶訂單模型"""
    PAYMENT_CHOICES = (
        ('cash', '現金'),
        ('credit_card', '信用卡'),
        ('line_pay', 'LINE Pay'),
    )
    STATUS_CHOICES = (
        ('pending', '待處理'),
        ('accepted', '已接受'),
        ('ready_for_pickup', '可取餐'),
        ('completed', '已完成'),
        ('rejected', '已拒絕'),
    )
    
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name='takeout_orders',
        verbose_name='店家'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='user_takeout_orders',
        verbose_name='會員',
        help_text='如果是會員下單則記錄用戶資訊'
    )
    customer_name = models.CharField(max_length=50, verbose_name='顧客姓名')
    customer_phone = models.CharField(max_length=20, verbose_name='顧客電話')
    pickup_at = models.DateTimeField(verbose_name='取餐時間')
    payment_method = models.CharField(max_length=20, choices=PAYMENT_CHOICES, verbose_name='付款方式')
    notes = models.TextField(blank=True, verbose_name='備註')
    pickup_number = models.CharField(max_length=10, unique=True, verbose_name='取單號碼')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='訂單狀態')
    use_utensils = models.BooleanField(default=False, verbose_name='需要餐具')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='建立時間')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新時間')

    class Meta:
        verbose_name = '外帶訂單'
        verbose_name_plural = '外帶訂單'
        ordering = ['-created_at']

    def __str__(self):
        return f"外帶 - {self.pickup_number} - {self.customer_name}"


class TakeoutOrderItem(models.Model):
    """外帶訂單項目"""
    order = models.ForeignKey(
        TakeoutOrder,
        on_delete=models.CASCADE,
        related_name='items',
        verbose_name='訂單'
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='takeout_order_items',
        verbose_name='商品'
    )
    quantity = models.PositiveIntegerField(verbose_name='數量')

    class Meta:
        verbose_name = '外帶訂單項目'
        verbose_name_plural = '外帶訂單項目'

    def __str__(self):
        return f"{self.order.pickup_number} - {self.product.name} x {self.quantity}"


class DineInOrder(models.Model):
    """內用訂單模型"""
    PAYMENT_CHOICES = (
        ('cash', '現金'),
        ('credit_card', '信用卡'),
        ('line_pay', 'LINE Pay'),
    )
    STATUS_CHOICES = (
        ('pending', '待處理'),
        ('accepted', '已接受'),
        ('preparing', '準備中'),
        ('ready', '已完成'),
        ('completed', '已送達'),
        ('rejected', '已拒絕'),
    )
    
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name='dinein_orders',
        verbose_name='店家'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='user_dinein_orders',
        verbose_name='會員',
        help_text='如果是會員下單則記錄用戶資訊'
    )
    customer_name = models.CharField(max_length=50, verbose_name='顧客姓名', help_text='通常為桌號')
    customer_phone = models.CharField(max_length=20, verbose_name='顧客電話', default='0000000000')
    table_label = models.CharField(max_length=20, verbose_name='桌號')
    payment_method = models.CharField(max_length=20, choices=PAYMENT_CHOICES, verbose_name='付款方式')
    notes = models.TextField(blank=True, verbose_name='備註')
    order_number = models.CharField(max_length=10, unique=True, verbose_name='訂單號碼')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='訂單狀態')
    use_eco_tableware = models.BooleanField(default=False, verbose_name='使用環保餐具')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='建立時間')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新時間')
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name='完成時間')

    class Meta:
        verbose_name = '內用訂單'
        verbose_name_plural = '內用訂單'
        ordering = ['-created_at']

    def __str__(self):
        return f"內用 - {self.order_number} - 桌號{self.table_label}"


class DineInOrderItem(models.Model):
    """內用訂單項目"""
    order = models.ForeignKey(
        DineInOrder,
        on_delete=models.CASCADE,
        related_name='items',
        verbose_name='訂單'
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='dinein_order_items',
        verbose_name='商品'
    )
    quantity = models.PositiveIntegerField(verbose_name='數量')

    class Meta:
        verbose_name = '內用訂單項目'
        verbose_name_plural = '內用訂單項目'

    def __str__(self):
        return f"{self.order.order_number} - {self.product.name} x {self.quantity}"


class Notification(models.Model):
    """通知模型"""
    NOTIFICATION_TYPES = (
        ('order_status', '訂單狀態更新'),
        ('system', '系統通知'),
    )
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
        verbose_name='用戶'
    )
    title = models.CharField(max_length=100, verbose_name='標題')
    message = models.TextField(verbose_name='內容')
    notification_type = models.CharField(
        max_length=20, 
        choices=NOTIFICATION_TYPES, 
        default='order_status',
        verbose_name='通知類型'
    )
    is_read = models.BooleanField(default=False, verbose_name='已讀')
    
    # 關聯到訂單 (可以是 TakeoutOrder 或 DineInOrder)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, null=True, blank=True)
    object_id = models.PositiveIntegerField(null=True, blank=True)
    content_object = GenericForeignKey('content_type', 'object_id')
    
    # 為了方便前端顯示，也可以直接存 order_number
    order_number = models.CharField(max_length=50, blank=True, verbose_name='訂單號碼')
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='建立時間')

    class Meta:
        verbose_name = '通知'
        verbose_name_plural = '通知'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user} - {self.title}"

