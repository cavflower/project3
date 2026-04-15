from rest_framework import serializers
from .models import User, Merchant, Company


def normalize_tax_id(value):
    """Normalize optional tax id values and safely handle null/non-string input."""
    if value is None:
        return ''
    if isinstance(value, str):
        return value.strip().upper()
    return str(value).strip().upper()

class MerchantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Merchant
        fields = ['company_account', 'plan', 'platform_fee_discount', 'discount_reason']
        extra_kwargs = {
            'company_account': {'required': False, 'allow_blank': True},
            'plan': {'required': False, 'allow_null': True},
        }

class UserSerializer(serializers.ModelSerializer):
    # 讓 merchant_profile 在讀取時可見，但在寫入(註冊)時是可選的
    merchant_profile = MerchantSerializer(required=False, allow_null=True)

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

    def _build_unique_company_account(self, user, preferred_account=''):
        """Build a non-empty unique company_account for Merchant profile."""
        normalized = normalize_tax_id(preferred_account)
        if normalized and not Merchant.objects.filter(company_account=normalized).exclude(user=user).exists():
            return normalized

        fallback_base = f"{user.id:08d}"
        if not Merchant.objects.filter(company_account=fallback_base).exclude(user=user).exists():
            return fallback_base

        suffix = 1
        while True:
            candidate = f"{user.id:06d}{suffix % 100:02d}"[-8:]
            if not Merchant.objects.filter(company_account=candidate).exclude(user=user).exists():
                return candidate
            suffix += 1

    def _ensure_merchant_profile(self, user, merchant_data=None):
        """Ensure merchant users always have a Merchant profile."""
        merchant_data = merchant_data or {}
        preferred_account = merchant_data.get('company_account') or user.company_tax_id or ''
        company_account = self._build_unique_company_account(user, preferred_account)
        incoming_plan = merchant_data.get('plan', None)

        merchant, created = Merchant.objects.get_or_create(
            user=user,
            defaults={
                'company_account': company_account,
                'plan': incoming_plan,
            }
        )

        if not created:
            has_changes = False
            if not merchant.company_account:
                merchant.company_account = company_account
                has_changes = True
            if incoming_plan is not None and merchant.plan != incoming_plan:
                merchant.plan = incoming_plan
                has_changes = True
            if has_changes:
                merchant.save()

        return merchant

    def _sync_staff_records_by_company_binding(self, user, previous_company_tax_id=''):
        """根據員工統編綁定同步 schedules 的 staff 資料。"""
        from apps.schedules.models import Staff
        from apps.stores.models import Store

        current_company_tax_id = normalize_tax_id(user.company_tax_id)
        previous_company_tax_id = normalize_tax_id(previous_company_tax_id)

        if previous_company_tax_id and previous_company_tax_id != current_company_tax_id:
            Staff.objects.filter(
                employee_user_id=user.id,
                store__merchant__company_account=previous_company_tax_id,
            ).delete()

        if not current_company_tax_id:
            Staff.objects.filter(employee_user_id=user.id).delete()
            return

        stores = Store.objects.filter(merchant__company_account=current_company_tax_id).select_related('merchant')
        if not stores.exists():
            return

        display_name = (user.username or user.email or f"員工{user.id}").strip()

        for store in stores:
            staff_obj, created = Staff.objects.get_or_create(
                store=store,
                employee_user_id=user.id,
                defaults={
                    'name': display_name,
                    'nickname': display_name,
                    'role': '員工',
                    'status': '在職',
                }
            )

            if created:
                continue

            fields_to_update = []
            if not (staff_obj.name or '').strip():
                staff_obj.name = display_name
                fields_to_update.append('name')
            if not (staff_obj.nickname or '').strip():
                staff_obj.nickname = display_name
                fields_to_update.append('nickname')
            if not (staff_obj.role or '').strip():
                staff_obj.role = '員工'
                fields_to_update.append('role')
            if not (staff_obj.status or '').strip():
                staff_obj.status = '在職'
                fields_to_update.append('status')

            if fields_to_update:
                staff_obj.save(update_fields=fields_to_update)

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
        company_tax_id = normalize_tax_id(validated_data.get('company_tax_id', ''))
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

        # 如果使用者類型是 merchant，確保一定有 Merchant 物件
        if user.user_type == 'merchant':
            try:
                self._ensure_merchant_profile(user, merchant_data)
            except Exception as e:
                # 如果創建 Merchant 失敗，刪除已創建的 User
                user.delete()
                raise e

            self._sync_staff_records_by_company_binding(user)
            
        return user

    def update(self, instance, validated_data):
        """
        Update and return an existing `User` instance, given the validated data.
        """
        merchant_data = validated_data.pop('merchant_profile', None)
        previous_company_tax_id = normalize_tax_id(instance.company_tax_id)

        # Update User fields
        instance.username = validated_data.get('username', instance.username)
        instance.phone_number = validated_data.get('phone_number', instance.phone_number)
        instance.gender = validated_data.get('gender', instance.gender)
        instance.address = validated_data.get('address', instance.address)
        instance.avatar_url = validated_data.get('avatar_url', instance.avatar_url)
        
        # 處理 company_tax_id 更新
        if 'company_tax_id' in validated_data:
            company_tax_id = validated_data.get('company_tax_id')
            normalized_company_tax_id = normalize_tax_id(company_tax_id)
            if normalized_company_tax_id:
                # 統一格式（去除空格、轉為大寫）
                instance.company_tax_id = normalized_company_tax_id
                # 自動創建對應的 Company 記錄
                company, created = Company.objects.get_or_create(
                    tax_id=normalized_company_tax_id,
                    defaults={'name': f"公司 {normalized_company_tax_id}"}
                )
                if created:
                    print(f"[DEBUG] 自動創建公司記錄（更新用戶）: {company.name} ({company.tax_id})")
            else:
                # 如果傳入 null 或空字串，清除統編
                instance.company_tax_id = None
        
        instance.save()

        # Update or create nested Merchant profile if needed
        if instance.user_type == 'merchant' and merchant_data:
            self._ensure_merchant_profile(instance, merchant_data)

        self._sync_staff_records_by_company_binding(
            instance,
            previous_company_tax_id=previous_company_tax_id,
        )

        return instance
