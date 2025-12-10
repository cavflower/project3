from rest_framework import serializers
from .models import User, Merchant
from apps.stores.models import Store
from apps.schedules.models import Staff

class MerchantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Merchant
        fields = ['company_account', 'plan'] # 新增 'plan'

class StaffProfileSerializer(serializers.ModelSerializer):
    """員工資料序列化器"""
    store_name = serializers.CharField(source='store.name', read_only=True)
    
    class Meta:
        model = Staff
        fields = ['id', 'store', 'store_name', 'name', 'role', 'status']
        read_only_fields = ['id', 'store', 'store_name', 'name', 'role', 'status']

class UserSerializer(serializers.ModelSerializer):
    # 讓 merchant_profile 在讀取時可見，但在寫入(註冊)時是可選的
    merchant_profile = MerchantSerializer(required=False, read_only=True)
    staff_profile = StaffProfileSerializer(required=False, read_only=True)
    company_account = serializers.CharField(write_only=True, required=False, allow_blank=True, allow_null=True)
    has_staff_profile = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'firebase_uid', 'email', 'username', 'user_type', 'avatar_url', 'phone_number', 'gender', 'address', 'created_at', 'merchant_profile', 'staff_profile', 'has_staff_profile', 'company_account']
        read_only_fields = ['id', 'created_at']
    
    def get_has_staff_profile(self, obj):
        """檢查用戶是否有員工資料"""
        return hasattr(obj, 'staff_profile') and obj.staff_profile is not None

    def create(self, validated_data):
        """
        Create and return a new `User` instance, given the validated data.
        """
        # 如果有 merchant_profile 資料，先將其彈出
        merchant_data = validated_data.pop('merchant_profile', None)
        
        # 取得統一編號（如果提供）
        company_account = validated_data.pop('company_account', None)
        if company_account:
            company_account = company_account.strip()
            if not company_account:
                company_account = None
        
        # 移除 password（如果存在），因為我們使用 Firebase 認證，不需要 Django 的密碼
        validated_data.pop('password', None)
        
        # 確保所有可選欄位都有預設值
        validated_data.setdefault('avatar_url', '')
        validated_data.setdefault('phone_number', '')
        validated_data.setdefault('address', '')
        
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
                Merchant.objects.create(user=user, **merchant_data)
            except Exception as e:
                # 如果創建 Merchant 失敗，刪除已創建的 User
                user.delete()
                raise e
        
        # 如果提供了統一編號，嘗試創建員工記錄
        if company_account and user.user_type == 'customer':
            try:
                # 查找對應的 Merchant
                merchant = Merchant.objects.filter(company_account=company_account).first()
                if merchant:
                    # 檢查該 Merchant 是否有 Store
                    if hasattr(merchant, 'store') and merchant.store:
                        store = merchant.store
                        # 創建 Staff 記錄並關聯 User
                        Staff.objects.create(
                            store=store,
                            user=user,
                            name=user.username,
                            role='員工',  # 預設職務，店長可以之後修改
                            status=''
                        )
                    else:
                        # Merchant 存在但沒有 Store，不創建員工記錄
                        pass
                else:
                    # 統一編號不存在，不創建員工記錄（不報錯，因為是選填）
                    pass
            except Exception as e:
                # 如果創建員工記錄失敗，不影響註冊流程，只記錄錯誤
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f'創建員工記錄失敗: {str(e)}')
            
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
        instance.save()

        # Update nested Merchant profile if data is provided
        if merchant_data and hasattr(instance, 'merchant_profile'):
            merchant_profile = instance.merchant_profile
            merchant_profile.plan = merchant_data.get('plan', merchant_profile.plan)
            merchant_profile.save()

        return instance
