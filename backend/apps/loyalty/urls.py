from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
	MerchantPointRuleViewSet,
	MerchantMembershipLevelViewSet,
	MerchantRedemptionProductViewSet,
	PublicRedemptionProductViewSet,
)

router = DefaultRouter()
router.register(r'merchant/point-rules', MerchantPointRuleViewSet, basename='merchant-point-rule')
router.register(r'merchant/membership-levels', MerchantMembershipLevelViewSet, basename='merchant-membership-level')
router.register(r'merchant/redemptions', MerchantRedemptionProductViewSet, basename='merchant-redemption')
router.register(r'redemptions', PublicRedemptionProductViewSet, basename='public-redemption')

urlpatterns = [
	path('', include(router.urls)),
]
