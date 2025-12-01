from django.db import models
from apps.stores.models import Store
from apps.products.models import Product

class TakeoutOrder(models.Model):
    PAYMENT_CHOICES = (
        ('cash', '現金'),
        ('credit_card', '信用卡'),
        ('line_pay', 'LINE Pay'),
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
