from django.db import models
from apps.users.models import Merchant
from apps.stores.models import Store


class Product(models.Model):
    """
    Represents a product offered by a merchant.
    """
    merchant = models.ForeignKey(
        Merchant, 
        on_delete=models.CASCADE, 
        related_name='products',
        help_text="The merchant who owns this product."
    )

    store = models.ForeignKey(
    Store,
    on_delete=models.CASCADE,
    related_name='products'
    )

    name = models.CharField(
        max_length=255,
        help_text="The name of the product."
    )
    description = models.TextField(
        blank=True,
        help_text="A detailed description of the product."
    )
    price = models.DecimalField(
        max_digits=10, 
        decimal_places=2,
        help_text="The price of the product."
    )
    image = models.ImageField(
        upload_to='product_images/', 
        blank=True, 
        null=True,
        help_text="An image of the product."
    )
    is_available = models.BooleanField(
        default=True,
        help_text="Indicates if the product is available for purchase."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    service_type = models.CharField(
        max_length=10,
        choices=[
            ('dine_in', '內用'),
            ('takeaway', '外帶'),
            ('both', '內用與外帶'),
        ],
        default='both'
    )

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.store and self.merchant and hasattr(self.merchant, 'store'):
            self.store = self.merchant.store
        super().save(*args, **kwargs)   

    def __str__(self):
        return f"{self.name} ({self.merchant.user.username})"

class TakeoutOrder(models.Model):
    PAYMENT_CHOICES = (
        ('cash', '現金'),
        ('credit_card', '信用卡'),
        ('line_pay', 'LINE Pay'),
    )
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name='product_takeout_orders',
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
        related_name='product_takeout_items',
    )
    quantity = models.PositiveIntegerField()
