from rest_framework import viewsets, permissions, serializers, status
from rest_framework.response import Response
from .models import PointRule, MembershipLevel, RedemptionProduct
from .serializers import (
	PointRuleSerializer,
	MembershipLevelSerializer,
	RedemptionProductSerializer,
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

