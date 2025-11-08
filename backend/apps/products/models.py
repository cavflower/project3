from django.db import models
from apps.users.models import Merchant

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

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.merchant.user.username})"
