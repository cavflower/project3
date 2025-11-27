from django.db import models
from apps.stores.models import Store


class Ingredient(models.Model):
    """原物料品項模型"""
    
    UNIT_CHOICES = [
        ('kg', '公斤'),
        ('g', '公克'),
        ('l', '公升'),
        ('ml', '毫升'),
        ('piece', '個'),
        ('pack', '包'),
        ('box', '箱'),
    ]
    
    store = models.ForeignKey(
        Store, 
        on_delete=models.CASCADE, 
        related_name='ingredients',
        verbose_name='所屬店家'
    )
    name = models.CharField(max_length=200, verbose_name='原料名稱')
    category = models.CharField(max_length=100, blank=True, verbose_name='類別')
    quantity = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=0,
        verbose_name='數量'
    )
    unit = models.CharField(
        max_length=20, 
        choices=UNIT_CHOICES, 
        default='kg',
        verbose_name='單位'
    )
    cost_per_unit = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=0,
        verbose_name='單價'
    )
    supplier = models.CharField(max_length=200, blank=True, verbose_name='供應商')
    minimum_stock = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=0,
        verbose_name='最低庫存量'
    )
    notes = models.TextField(blank=True, verbose_name='備註')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='建立時間')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新時間')
    
    class Meta:
        db_table = 'ingredients'
        verbose_name = '原物料'
        verbose_name_plural = '原物料'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} - {self.store.name}"
    
    @property
    def total_value(self):
        """計算庫存總價值"""
        return self.quantity * self.cost_per_unit
    
    @property
    def is_low_stock(self):
        """檢查是否低於最低庫存量"""
        return self.quantity <= self.minimum_stock
