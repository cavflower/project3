from rest_framework import serializers
from .models import User, Merchant

class MerchantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Merchant
        fields = ['company_account', 'plan'] # 新增 'plan'

class UserSerializer(serializers.ModelSerializer):
    # 讓 merchant_profile 在讀取時可見，但在寫入(註冊)時是可選的
    merchant_profile = MerchantSerializer(required=False)

    class Meta:
        model = User
        fields = ['id', 'firebase_uid', 'email', 'username', 'user_type', 'avatar_url', 'phone_number', 'address', 'created_at', 'merchant_profile']
        read_only_fields = ['id', 'created_at']

    def create(self, validated_data):
        """
        Create and return a new `User` instance, given the validated data.
        """
        # 如果有 merchant_profile 資料，先將其彈出
        merchant_data = validated_data.pop('merchant_profile', None)
        
        # 建立 User
        user = User.objects.create_user(**validated_data)

        # 如果使用者類型是 'merchant' 且有商家資料，則建立 Merchant 物件
        if user.user_type == 'merchant' and merchant_data:
            # 確保 plan 欄位不會在註冊時被強制要求
            merchant_data.pop('plan', None) 
            Merchant.objects.create(user=user, **merchant_data)
            
        return user

    def update(self, instance, validated_data):
        """
        Update and return an existing `User` instance, given the validated data.
        """
        merchant_data = validated_data.pop('merchant_profile', None)

        # Update User fields
        instance.username = validated_data.get('username', instance.username)
        instance.phone_number = validated_data.get('phone_number', instance.phone_number)
        instance.address = validated_data.get('address', instance.address)
        instance.avatar_url = validated_data.get('avatar_url', instance.avatar_url)
        instance.save()

        # Update nested Merchant profile if data is provided
        if merchant_data and hasattr(instance, 'merchant_profile'):
            merchant_profile = instance.merchant_profile
            merchant_profile.plan = merchant_data.get('plan', merchant_profile.plan)
            merchant_profile.save()

        return instance
