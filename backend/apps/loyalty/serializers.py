from rest_framework import serializers
from .models import (
	PointRule, MembershipLevel, RedemptionProduct,
	CustomerLoyaltyAccount, PointTransaction, Redemption,
	PlatformCoupon, UserPlatformCoupon
)


class PointRuleSerializer(serializers.ModelSerializer):
	class Meta:
		model = PointRule
		fields = [
			'id', 'store', 'name', 'points_per_currency', 'min_spend', 'active', 'created_at', 'updated_at'
		]

		read_only_fields = ['id', 'store', 'created_at', 'updated_at']



class MembershipLevelSerializer(serializers.ModelSerializer):
	class Meta:
		model = MembershipLevel
		fields = [
			'id', 'store', 'name', 'threshold_points', 'discount_percent', 'benefits', 'rank', 'active',
			'created_at', 'updated_at'
		]
		read_only_fields = ['id', 'store', 'created_at', 'updated_at']


class RedemptionProductSerializer(serializers.ModelSerializer):
	class Meta:
		model = RedemptionProduct
		fields = [
			'id', 'store', 'title', 'description', 'required_points', 'inventory', 'is_active',
			'created_at', 'updated_at'
		]
		
		read_only_fields = ['id', 'store', 'created_at', 'updated_at']



class CustomerLoyaltyAccountSerializer(serializers.ModelSerializer):
	current_level_name = serializers.CharField(source='current_level.name', read_only=True)
	current_level_benefits = serializers.CharField(source='current_level.benefits', read_only=True)
	current_level_discount = serializers.DecimalField(
		source='current_level.discount_percent', max_digits=5, decimal_places=2, read_only=True
	)
	store_name = serializers.CharField(source='store.name', read_only=True)

	class Meta:
		model = CustomerLoyaltyAccount
		fields = [
			'id', 'user', 'store', 'store_name', 'total_points', 'available_points',
			'current_level', 'current_level_name', 'current_level_benefits', 'current_level_discount',
			'created_at', 'updated_at'
		]
		read_only_fields = ['id', 'user', 'store', 'total_points', 'available_points', 'current_level', 'created_at', 'updated_at']


class PointTransactionSerializer(serializers.ModelSerializer):
	transaction_type_display = serializers.CharField(source='get_transaction_type_display', read_only=True)

	class Meta:
		model = PointTransaction
		fields = [
			'id', 'account', 'transaction_type', 'transaction_type_display', 'points',
			'description', 'order', 'redemption', 'created_at'
		]
		read_only_fields = ['id', 'created_at']


class RedemptionSerializer(serializers.ModelSerializer):
	product_title = serializers.CharField(source='product.title', read_only=True)
	product_description = serializers.CharField(source='product.description', read_only=True)
	status_display = serializers.CharField(source='get_status_display', read_only=True)
	user_username = serializers.CharField(source='account.user.username', read_only=True)

	class Meta:
		model = Redemption
		fields = [
			'id', 'account', 'user_username', 'product', 'product_title', 'product_description',
			'points_used', 'status', 'status_display', 'redemption_code', 'expires_at',
			'redeemed_at', 'notes', 'created_at', 'updated_at'
		]
		read_only_fields = ['id', 'redemption_code', 'created_at', 'updated_at']


class RedemptionCreateSerializer(serializers.ModelSerializer):
	"""用於顧客建立兌換的序列化器"""
	class Meta:
		model = Redemption
		fields = ['product']

	def create(self, validated_data):
		user = self.context['request'].user
		product = validated_data['product']
		
		# 獲取或創建顧客會員帳戶
		account, created = CustomerLoyaltyAccount.objects.get_or_create(
			user=user,
			store=product.store
		)
		
		# 檢查點數是否足夠
		if account.available_points < product.required_points:
			raise serializers.ValidationError('點數不足，無法兌換此商品')
		
		# 檢查庫存
		if product.inventory is not None and product.inventory <= 0:
			raise serializers.ValidationError('商品庫存不足')
		
		# 創建兌換記錄
		from datetime import timedelta
		from django.utils import timezone
		
		redemption = Redemption.objects.create(
			account=account,
			product=product,
			points_used=product.required_points,
			expires_at=timezone.now() + timedelta(days=30)  # 30天有效期
		)
		
		# 扣除點數
		account.available_points -= product.required_points
		account.save()
		
		# 創建點數交易記錄
		PointTransaction.objects.create(
			account=account,
			transaction_type='redeem',
			points=-product.required_points,
			description=f'兌換商品: {product.title}',
			redemption=redemption
		)
		
		# 扣除庫存
		if product.inventory is not None:
			product.inventory -= 1
			product.save()
		
		return redemption


class PlatformCouponSerializer(serializers.ModelSerializer):
	discount_type_display = serializers.CharField(source='get_discount_type_display', read_only=True)

	class Meta:
		model = PlatformCoupon
		fields = [
			'id', 'title', 'description', 'code', 'claim_token',
			'discount_type', 'discount_type_display', 'discount_value',
			'min_order_amount', 'max_discount_amount', 'expires_at',
			'is_active', 'created_at', 'updated_at'
		]
		read_only_fields = ['id', 'claim_token', 'created_at', 'updated_at']


class UserPlatformCouponSerializer(serializers.ModelSerializer):
	title = serializers.CharField(source='coupon.title', read_only=True)
	description = serializers.CharField(source='coupon.description', read_only=True)
	code = serializers.CharField(source='coupon.code', read_only=True)
	discount_type = serializers.CharField(source='coupon.discount_type', read_only=True)
	discount_type_display = serializers.CharField(source='coupon.get_discount_type_display', read_only=True)
	discount_value = serializers.DecimalField(source='coupon.discount_value', max_digits=10, decimal_places=2, read_only=True)
	min_order_amount = serializers.DecimalField(source='coupon.min_order_amount', max_digits=10, decimal_places=2, read_only=True)
	max_discount_amount = serializers.DecimalField(source='coupon.max_discount_amount', max_digits=10, decimal_places=2, read_only=True)
	expires_at = serializers.DateTimeField(source='coupon.expires_at', read_only=True)
	is_active = serializers.BooleanField(source='coupon.is_active', read_only=True)
	is_expired = serializers.SerializerMethodField()

	class Meta:
		model = UserPlatformCoupon
		fields = [
			'id', 'coupon', 'title', 'description', 'code',
			'discount_type', 'discount_type_display', 'discount_value',
			'min_order_amount', 'max_discount_amount',
			'status', 'expires_at', 'is_active', 'is_expired',
			'claimed_at', 'used_at'
		]
		read_only_fields = fields

	def get_is_expired(self, obj):
		from django.utils import timezone
		expires_at = getattr(obj.coupon, 'expires_at', None)
		return bool(expires_at and expires_at <= timezone.now())
