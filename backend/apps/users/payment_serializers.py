# backend/apps/users/serializers.py - 信用卡序列化器

from rest_framework import serializers
from .models import PaymentCard
from cryptography.fernet import Fernet
from django.conf import settings
import os

# 加密金鑰（應該放在環境變數中）
ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY', Fernet.generate_key())
cipher_suite = Fernet(ENCRYPTION_KEY)


class PaymentCardSerializer(serializers.ModelSerializer):
    card_number = serializers.CharField(write_only=True, max_length=19)
    cvv = serializers.CharField(write_only=True, max_length=4)
    
    class Meta:
        model = PaymentCard
        fields = [
            'id', 'card_holder_name', 'card_number', 'card_last_four',
            'expiry_month', 'expiry_year', 'cvv', 'is_default',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'card_last_four', 'created_at', 'updated_at']

    def validate_card_number(self, value):
        """驗證卡號格式 - 簡化版本，只檢查16碼數字"""
        # 移除空格和破折號
        card_number = value.replace(' ', '').replace('-', '')
        
        # 檢查是否為16位數字
        if not card_number.isdigit() or len(card_number) != 16:
            raise serializers.ValidationError('信用卡號碼必須為16位數字')
        
        return card_number

    def validate_cvv(self, value):
        """驗證 CVV - 簡化版本"""
        if not value.isdigit() or len(value) != 3:
            raise serializers.ValidationError('CVV 必須為 3 位數字')
        return value

    def validate_expiry_month(self, value):
        """驗證月份 - 簡化版本"""
        if not value.isdigit() or not (1 <= int(value) <= 12):
            raise serializers.ValidationError('月份必須在 01-12 之間')
        return value.zfill(2)  # 確保是兩位數

    def validate_expiry_year(self, value):
        """驗證年份 - 簡化版本，不檢查是否過期"""
        if not value.isdigit() or len(value) != 4:
            raise serializers.ValidationError('年份必須為 4 位數')
        
        return value

    def create(self, validated_data):
        """創建新卡片並加密敏感資訊"""
        card_number = validated_data.pop('card_number')
        cvv = validated_data.pop('cvv')
        
        # 加密卡號和 CVV
        encrypted_card_number = cipher_suite.encrypt(card_number.encode())
        encrypted_cvv = cipher_suite.encrypt(cvv.encode())
        
        # 取得卡號後四碼
        card_last_four = card_number[-4:]
        
        # user 會由 ViewSet 的 perform_create 傳入，不需要在這裡手動取得
        payment_card = PaymentCard.objects.create(
            card_number_encrypted=encrypted_card_number,
            card_last_four=card_last_four,
            cvv_encrypted=encrypted_cvv,
            **validated_data
        )
        
        return payment_card

    def update(self, instance, validated_data):
        """更新卡片資訊"""
        # 如果有新的卡號，重新加密
        if 'card_number' in validated_data:
            card_number = validated_data.pop('card_number')
            instance.card_number_encrypted = cipher_suite.encrypt(card_number.encode())
            instance.card_last_four = card_number[-4:]
        
        # 如果有新的 CVV，重新加密
        if 'cvv' in validated_data:
            cvv = validated_data.pop('cvv')
            instance.cvv_encrypted = cipher_suite.encrypt(cvv.encode())
        
        # 更新其他欄位
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()
        return instance
