from django.db import models
from apps.users.models import User
from apps.stores.models import Store
from apps.products.models import Product
from apps.orders.models import TakeoutOrder, DineInOrder


class StoreReview(models.Model):
    """店家評論"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='store_reviews')
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name='reviews')
    
    # 訂單關聯（可選）
    takeout_order = models.ForeignKey(TakeoutOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='store_reviews')
    dinein_order = models.ForeignKey(DineInOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='store_reviews')
    
    # 評分
    rating = models.IntegerField(default=5, help_text='1-5星評分')
    
    # 快速標籤
    tags = models.JSONField(default=list, blank=True, help_text='快速標籤列表')
    
    # 評論內容
    comment = models.TextField(blank=True, help_text='文字評論')
    
    # 時間戳
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # 店家回覆
    merchant_reply = models.TextField(blank=True, help_text='商家回覆')
    replied_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'reviews_store_review'
        ordering = ['-created_at']
        verbose_name = '店家評論'
        verbose_name_plural = '店家評論'
        
    def __str__(self):
        return f'{self.user.username} - {self.store.name} ({self.rating}星)'


class ProductReview(models.Model):
    """菜品評論"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='product_reviews')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='reviews')
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name='product_reviews')
    
    # 訂單關聯（可選）
    takeout_order = models.ForeignKey(TakeoutOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='product_reviews')
    dinein_order = models.ForeignKey(DineInOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='product_reviews')
    
    # 評分
    rating = models.IntegerField(default=5, help_text='1-5星評分')
    
    # 評論內容
    comment = models.TextField(blank=True, help_text='文字評論')
    
    # 時間戳
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'reviews_product_review'
        ordering = ['-created_at']
        verbose_name = '菜品評論'
        verbose_name_plural = '菜品評論'
        
    def __str__(self):
        return f'{self.user.username} - {self.product.name} ({self.rating}星)'
