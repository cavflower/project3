from rest_framework import serializers
from .models import User, Merchant, Company

class MerchantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Merchant
        fields = ['company_account', 'plan', 'platform_fee_discount', 'discount_reason']

class UserSerializer(serializers.ModelSerializer):
    # 讓 merchant_profile 在讀取時可見，但在寫入(註冊)時是可選的
    merchant_profile = MerchantSerializer(required=False, read_only=True, allow_null=True)

    class Meta:
        model = User
        fields = ['id', 'firebase_uid', 'email', 'username', 'user_type', 'avatar_url', 'phone_number', 'gender', 'address', 'company_tax_id', 'created_at', 'merchant_profile']
        read_only_fields = ['id', 'created_at']
        extra_kwargs = {
            'company_tax_id': {'allow_null': True, 'required': False},
        }
    
    def to_representation(self, instance):
        """自定義序列化輸出，確保 merchant_profile 正確處理"""
        representation = super().to_representation(instance)
        # 如果用戶沒有 merchant_profile，確保返回 None 而不是錯誤
        if not hasattr(instance, 'merchant_profile') or instance.merchant_profile is None:
            representation['merchant_profile'] = None
        return representation

    def create(self, validated_data):
        """
        Create and return a new `User` instance, given the validated data.
        """
        # 如果有 merchant_profile 資料，先將其彈出
        merchant_data = validated_data.pop('merchant_profile', None)
        
        # 移除 password（如果存在），因為我們使用 Firebase 認證，不需要 Django 的密碼
        validated_data.pop('password', None)
        
        # 確保所有可選欄位都有預設值
        validated_data.setdefault('avatar_url', '')
        validated_data.setdefault('phone_number', '')
        validated_data.setdefault('address', '')
        validated_data.setdefault('company_tax_id', '')
        
        # 處理統編：如果提供了統編，檢查是否對應到某間公司
        company_tax_id = validated_data.get('company_tax_id', '').strip().upper()
        if company_tax_id:
            # 統一統編格式（去除空格、轉為大寫）
            validated_data['company_tax_id'] = company_tax_id
            # 如果對應的公司不存在，自動創建（使用統編作為名稱）
            company, created = Company.objects.get_or_create(
                tax_id=company_tax_id,
                defaults={'name': f"公司 {company_tax_id}"}
            )
            if created:
                print(f"[DEBUG] 自動創建公司記錄（員工註冊）: {company.name} ({company.tax_id})")
        else:
            validated_data['company_tax_id'] = None
        
        try:
            # 直接建立 User，不使用 create_user（因為不需要設定密碼）
            user = User.objects.create(**validated_data)
        except Exception as e:
            # 重新拋出異常，讓視圖層處理
            raise e

        # 如果使用者類型是 'merchant' 且有商家資料，則建立 Merchant 物件
        if user.user_type == 'merchant' and merchant_data:
            try:
                # 確保 plan 欄位不會在註冊時被強制要求
                merchant_data.pop('plan', None)
                
                # 統一統編格式（去除空格、轉為大寫）
                company_account = merchant_data.get('company_account', '').strip().upper()
                merchant_data['company_account'] = company_account
                
                # 如果提供了統編，確保對應的 Company 記錄存在
                if company_account:
                    company, created = Company.objects.get_or_create(
                        tax_id=company_account,
                        defaults={'name': f"公司 {company_account}"}
                    )
                    if created:
                        print(f"[DEBUG] 自動創建公司記錄: {company.name} ({company.tax_id})")
                
                Merchant.objects.create(user=user, **merchant_data)
            except Exception as e:
                # 如果創建 Merchant 失敗，刪除已創建的 User
                user.delete()
                raise e
            
        return user

    def update(self, instance, validated_data):
        """
        Update and return an existing `User` instance, given the validated data.
        """
        merchant_data = validated_data.pop('merchant_profile', None)

        # Update User fields
        instance.username = validated_data.get('username', instance.username)
        instance.phone_number = validated_data.get('phone_number', instance.phone_number)
        instance.gender = validated_data.get('gender', instance.gender)
        instance.address = validated_data.get('address', instance.address)
        instance.avatar_url = validated_data.get('avatar_url', instance.avatar_url)
        
        # 處理 company_tax_id 更新
        if 'company_tax_id' in validated_data:
            company_tax_id = validated_data.get('company_tax_id')
            if company_tax_id:
                # 統一格式（去除空格、轉為大寫）
                company_tax_id = company_tax_id.strip().upper()
                instance.company_tax_id = company_tax_id
                # 自動創建對應的 Company 記錄
                company, created = Company.objects.get_or_create(
                    tax_id=company_tax_id,
                    defaults={'name': f"公司 {company_tax_id}"}
                )
                if created:
                    print(f"[DEBUG] 自動創建公司記錄（更新用戶）: {company.name} ({company.tax_id})")
            else:
                # 如果傳入 null 或空字串，清除統編
                instance.company_tax_id = None
        
        instance.save()

        # Update nested Merchant profile if data is provided
        if merchant_data and hasattr(instance, 'merchant_profile'):
            merchant_profile = instance.merchant_profile
            merchant_profile.plan = merchant_data.get('plan', merchant_profile.plan)
            merchant_profile.save()

        return instance
