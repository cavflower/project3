from django.db import models
from apps.stores.models import Store
from apps.products.models import Product

class TakeoutOrder(models.Model):
    PAYMENT_CHOICES = (
        ('cash', '現金'),
        ('credit_card', '信用卡'),
        ('line_pay', 'LINE Pay'),
    )
    STATUS_CHOICES = (
        ('pending', '待處理'),
        ('accepted', '已接受'),
        ('in_progress', '待完成'),
        ('completed', '已完成'),
        ('rejected', '已拒絕'),
    )
    SERVICE_CHANNEL_CHOICES = (
        ('takeout', '外帶'),
        ('dine_in', '內用'),
    )
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name='order_takeout_orders',
    )
    customer_name = models.CharField(max_length=50)
    customer_phone = models.CharField(max_length=20)
    pickup_at = models.DateTimeField()
    payment_method = models.CharField(max_length=20, choices=PAYMENT_CHOICES)
    notes = models.TextField(blank=True)
    pickup_number = models.CharField(max_length=10, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    service_channel = models.CharField(max_length=20, choices=SERVICE_CHANNEL_CHOICES, default='takeout')
    table_label = models.CharField(max_length=20, blank=True, null=True)
    use_eco_tableware = models.BooleanField(default=False, null=True, blank=True)
    use_utensils = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

class TakeoutOrderItem(models.Model):
    order = models.ForeignKey(
        TakeoutOrder,
        on_delete=models.CASCADE,
        related_name='items',
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='order_takeout_items',
    )
    quantity = models.PositiveIntegerField()
