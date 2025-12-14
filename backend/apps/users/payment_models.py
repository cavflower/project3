# backend/apps/users/models.py - 添加到現有的 models.py 檔案中

from django.db import models
from django.contrib.auth import get_user_model
from cryptography.fernet import Fernet
from django.conf import settings

User = get_user_model()

class PaymentCard(models.Model):
    """用戶的信用卡資料"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='payment_cards')
    card_holder_name = models.CharField(max_length=100, verbose_name='持卡人姓名')
    card_number_encrypted = models.BinaryField(verbose_name='加密的卡號')  # 加密儲存
    card_last_four = models.CharField(max_length=4, verbose_name='卡號後四碼')
    expiry_month = models.CharField(max_length=2, verbose_name='到期月份')
    expiry_year = models.CharField(max_length=4, verbose_name='到期年份')
    cvv_encrypted = models.BinaryField(verbose_name='加密的CVV')  # 加密儲存
    is_default = models.BooleanField(default=False, verbose_name='是否為預設卡片')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='建立時間')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新時間')

    class Meta:
        verbose_name = '信用卡'
        verbose_name_plural = '信用卡'
        ordering = ['-is_default', '-created_at']

    def __str__(self):
        return f"{self.card_holder_name} - **** {self.card_last_four}"

    def save(self, *args, **kwargs):
        # 如果設為預設卡片，將其他卡片設為非預設
        if self.is_default:
            PaymentCard.objects.filter(user=self.user).exclude(id=self.id).update(is_default=False)
        super().save(*args, **kwargs)
