from django.db import models
from apps.users.models import Merchant
from apps.stores.models import Store


class ProductCategory(models.Model):
    """
    產品類別模型
    商家可以建立類別來分類管理產品
    """
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name='product_categories',
        verbose_name='所屬店家'
    )
    name = models.CharField(
        max_length=100,
        verbose_name='類別名稱',
        help_text='例如：主餐、飲料、甜點'
    )
    description = models.TextField(
        blank=True,
        verbose_name='類別描述'
    )
    display_order = models.PositiveIntegerField(
        default=0,
        verbose_name='顯示順序',
        help_text='數字越小越前面'
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name='啟用狀態'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='建立時間')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新時間')
    
    class Meta:
        db_table = 'product_categories'
        verbose_name = '產品類別'
        verbose_name_plural = '產品類別'
        ordering = ['display_order', 'name']
        unique_together = ['store', 'name']
    
    def __str__(self):
        return f"{self.store.name} - {self.name}"


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

    category = models.ForeignKey(
        ProductCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='products',
        verbose_name='產品類別'
    )
    
    # 食物類型標籤（用於個人化推薦）- 店家自訂標籤
    food_tags = models.JSONField(
        default=list,
        blank=True,
        verbose_name='食物標籤',
        help_text='輸入此商品的食物特性標籤，例如：["辣", "甜", "素食"]'
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
        db_table = 'products'
        verbose_name = '產品'
        verbose_name_plural = '產品'
        ordering = ['-created_at']
        # 添加索引以優化查詢效能
        indexes = [
            models.Index(fields=['store', 'is_available']),
            models.Index(fields=['store', 'service_type', 'is_available']),
            models.Index(fields=['category', 'is_available']),
        ]

    def save(self, *args, **kwargs):
        if not self.store and self.merchant and hasattr(self.merchant, 'store'):
            self.store = self.merchant.store
        super().save(*args, **kwargs)   

    def __str__(self):
        return f"{self.name} ({self.merchant.user.username})"


class SpecificationGroup(models.Model):
    """
    規格類別模型
    用於分組管理商品規格，如：大小、配料、辣度
    可設定單選或多選模式
    """
    SELECTION_TYPES = (
        ('single', '單選'),    # 只能選一個選項
        ('multiple', '多選'),  # 可選多個選項
    )
    
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='specification_groups',
        verbose_name='所屬商品'
    )
    name = models.CharField(
        max_length=100,
        verbose_name='類別名稱',
        help_text='例如：大小、配料、辣度'
    )
    selection_type = models.CharField(
        max_length=10,
        choices=SELECTION_TYPES,
        default='single',
        verbose_name='選擇類型',
        help_text='單選：只能選一個；多選：可選多個'
    )
    is_required = models.BooleanField(
        default=False,
        verbose_name='必選',
        help_text='是否必須選擇此類別的選項'
    )
    display_order = models.PositiveIntegerField(
        default=0,
        verbose_name='顯示順序',
        help_text='數字越小越前面'
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name='啟用狀態'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='建立時間')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新時間')

    class Meta:
        db_table = 'specification_groups'
        verbose_name = '規格類別'
        verbose_name_plural = '規格類別'
        ordering = ['display_order', 'name']
        unique_together = ['product', 'name']

    def __str__(self):
        return f"{self.product.name} - {self.name} ({self.get_selection_type_display()})"


class ProductSpecification(models.Model):
    """
    規格選項模型
    隸屬於規格類別下的具體選項，如：大份、小份
    可設定價格調整（正數加價、負數減價）
    """
    group = models.ForeignKey(
        SpecificationGroup,
        on_delete=models.CASCADE,
        related_name='options',
        verbose_name='所屬類別'
    )
    name = models.CharField(
        max_length=100,
        verbose_name='選項名稱',
        help_text='例如：大份、小份、加辣'
    )
    price_adjustment = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name='價格調整',
        help_text='正數為加價，負數為減價'
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name='啟用狀態'
    )
    display_order = models.PositiveIntegerField(
        default=0,
        verbose_name='顯示順序',
        help_text='數字越小越前面'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='建立時間')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新時間')

    class Meta:
        db_table = 'product_specifications'
        verbose_name = '規格選項'
        verbose_name_plural = '規格選項'
        ordering = ['display_order', 'name']
        unique_together = ['group', 'name']

    def __str__(self):
        adjustment = f"+{self.price_adjustment}" if self.price_adjustment > 0 else str(self.price_adjustment)
        return f"{self.group.name} - {self.name} ({adjustment})"

