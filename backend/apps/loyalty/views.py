from rest_framework import viewsets, permissions, serializers, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import (
	PointRule, MembershipLevel, RedemptionProduct,
	CustomerLoyaltyAccount, PointTransaction, Redemption
)
from .serializers import (
	PointRuleSerializer,
	MembershipLevelSerializer,
	RedemptionProductSerializer,
	CustomerLoyaltyAccountSerializer,
	PointTransactionSerializer,
	RedemptionSerializer,
	RedemptionCreateSerializer,
)


class MerchantOnlyMixin:
	"""Provide helper to filter queryset to the current merchant's store."""

	def get_store(self):
		user = self.request.user
		if not hasattr(user, 'merchant_profile'):
			return None
		try:
			return user.merchant_profile.store
		except Exception:
			return None


class MerchantPointRuleViewSet(viewsets.ModelViewSet, MerchantOnlyMixin):
	queryset = PointRule.objects.all()
	serializer_class = PointRuleSerializer
	permission_classes = [permissions.IsAuthenticated]

	def get_queryset(self):
		store = self.get_store()
		if not store:
			return PointRule.objects.none()
		return PointRule.objects.filter(store=store)

	def perform_create(self, serializer):
		store = self.get_store()
		if not store:
			raise serializers.ValidationError('User is not a merchant or store not configured')
		serializer.save(store=store)


class MerchantMembershipLevelViewSet(viewsets.ModelViewSet, MerchantOnlyMixin):
	queryset = MembershipLevel.objects.all()
	serializer_class = MembershipLevelSerializer
	permission_classes = [permissions.IsAuthenticated]

	def get_queryset(self):
		store = self.get_store()
		if not store:
			return MembershipLevel.objects.none()
		return MembershipLevel.objects.filter(store=store)

	def perform_create(self, serializer):
		store = self.get_store()
		if not store:
			raise serializers.ValidationError('User is not a merchant or store not configured')
		serializer.save(store=store)


class MerchantRedemptionProductViewSet(viewsets.ModelViewSet, MerchantOnlyMixin):
	queryset = RedemptionProduct.objects.all()
	serializer_class = RedemptionProductSerializer
	permission_classes = [permissions.IsAuthenticated]

	def get_queryset(self):
		store = self.get_store()
		if not store:
			return RedemptionProduct.objects.none()
		return RedemptionProduct.objects.filter(store=store)

	def perform_create(self, serializer):
		store = self.get_store()
		if not store:
			raise serializers.ValidationError('User is not a merchant or store not configured')
		serializer.save(store=store)


class PublicRedemptionProductViewSet(viewsets.ReadOnlyModelViewSet):
	"""Public listing of redemption products for customers to browse."""
	queryset = RedemptionProduct.objects.filter(is_active=True)
	serializer_class = RedemptionProductSerializer
	permission_classes = [permissions.AllowAny]


class CustomerLoyaltyAccountViewSet(viewsets.ReadOnlyModelViewSet):
	"""顧客會員帳戶視圖：顧客查看自己在各商家的會員資訊"""
	serializer_class = CustomerLoyaltyAccountSerializer
	permission_classes = [permissions.IsAuthenticated]

	def get_queryset(self):
		return CustomerLoyaltyAccount.objects.filter(user=self.request.user)

	@action(detail=True, methods=['get'])
	def transactions(self, request, pk=None):
		"""獲取特定會員帳戶的點數交易記錄"""
		account = self.get_object()
		transactions = PointTransaction.objects.filter(account=account)
		serializer = PointTransactionSerializer(transactions, many=True)
		return Response(serializer.data)


class PointTransactionViewSet(viewsets.ReadOnlyModelViewSet):
	"""點數交易記錄視圖：顧客查看自己的點數交易歷史"""
	serializer_class = PointTransactionSerializer
	permission_classes = [permissions.IsAuthenticated]

	def get_queryset(self):
		user_accounts = CustomerLoyaltyAccount.objects.filter(user=self.request.user)
		return PointTransaction.objects.filter(account__in=user_accounts)


class CustomerRedemptionViewSet(viewsets.ModelViewSet):
	"""顧客兌換視圖：顧客進行商品兌換和查看兌換記錄"""
	permission_classes = [permissions.IsAuthenticated]

	def get_serializer_class(self):
		if self.action == 'create':
			return RedemptionCreateSerializer
		return RedemptionSerializer

	def get_queryset(self):
		user_accounts = CustomerLoyaltyAccount.objects.filter(user=self.request.user)
		return Redemption.objects.filter(account__in=user_accounts)

	@action(detail=True, methods=['post'])
	def cancel(self, request, pk=None):
		"""取消兌換並退回點數"""
		redemption = self.get_object()
		
		if redemption.status != 'pending':
			return Response(
				{'error': '只能取消待確認狀態的兌換'},
				status=status.HTTP_400_BAD_REQUEST
			)
		
		# 退回點數
		account = redemption.account
		account.available_points += redemption.points_used
		account.save()
		
		# 創建退回點數的交易記錄
		PointTransaction.objects.create(
			account=account,
			transaction_type='adjust',
			points=redemption.points_used,
			description=f'取消兌換: {redemption.product.title}',
			redemption=redemption
		)
		
		# 退回庫存
		if redemption.product.inventory is not None:
			redemption.product.inventory += 1
			redemption.product.save()
		
		# 更新兌換狀態
		redemption.status = 'cancelled'
		redemption.save()
		
		serializer = self.get_serializer(redemption)
		return Response(serializer.data)


class MerchantRedemptionManagementViewSet(viewsets.ModelViewSet, MerchantOnlyMixin):
	"""商家兌換管理視圖：商家查看和管理顧客的兌換記錄"""
	serializer_class = RedemptionSerializer
	permission_classes = [permissions.IsAuthenticated]

	def get_queryset(self):
		store = self.get_store()
		if not store:
			return Redemption.objects.none()
		return Redemption.objects.filter(product__store=store)

	@action(detail=True, methods=['post'])
	def confirm(self, request, pk=None):
		"""確認兌換"""
		redemption = self.get_object()
		if redemption.status != 'pending':
			return Response(
				{'error': '此兌換已被處理'},
				status=status.HTTP_400_BAD_REQUEST
			)
		
		redemption.status = 'confirmed'
		redemption.save()
		
		serializer = self.get_serializer(redemption)
		return Response(serializer.data)

	@action(detail=True, methods=['post'])
	def complete(self, request, pk=None):
		"""完成兌換（顧客已取貨）"""
		from django.utils import timezone
		
		redemption = self.get_object()
		if redemption.status not in ['pending', 'confirmed']:
			return Response(
				{'error': '無法完成此兌換'},
				status=status.HTTP_400_BAD_REQUEST
			)
		
		redemption.status = 'redeemed'
		redemption.redeemed_at = timezone.now()
		redemption.save()
		
		serializer = self.get_serializer(redemption)
		return Response(serializer.data)

