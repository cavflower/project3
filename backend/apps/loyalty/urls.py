from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
	MerchantPointRuleViewSet,
	MerchantMembershipLevelViewSet,
	MerchantRedemptionProductViewSet,
	PublicRedemptionProductViewSet,
	CustomerLoyaltyAccountViewSet,
	PointTransactionViewSet,
	CustomerRedemptionViewSet,
	MerchantRedemptionManagementViewSet,
)

router = DefaultRouter()
# 商家端路由
router.register(r'merchant/point-rules', MerchantPointRuleViewSet, basename='merchant-point-rule')
router.register(r'merchant/membership-levels', MerchantMembershipLevelViewSet, basename='merchant-membership-level')
router.register(r'merchant/redemptions', MerchantRedemptionProductViewSet, basename='merchant-redemption')
router.register(r'merchant/redemption-management', MerchantRedemptionManagementViewSet, basename='merchant-redemption-management')

# 顧客端路由
router.register(r'customer/accounts', CustomerLoyaltyAccountViewSet, basename='customer-loyalty-account')
router.register(r'customer/transactions', PointTransactionViewSet, basename='customer-point-transaction')
router.register(r'customer/my-redemptions', CustomerRedemptionViewSet, basename='customer-redemption')

# 公開路由
router.register(r'redemptions', PublicRedemptionProductViewSet, basename='public-redemption')

urlpatterns = [
	path('', include(router.urls)),
]
