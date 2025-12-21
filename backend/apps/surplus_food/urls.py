from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SurplusFoodCategoryViewSet,
    SurplusTimeSlotViewSet,
    SurplusFoodViewSet,
    PublicSurplusFoodViewSet,
    SurplusFoodOrderViewSet,
    GreenPointRuleViewSet,
    PointRedemptionRuleViewSet,
    UserGreenPointsView,
    PublicRedemptionRulesView
)

router = DefaultRouter()
router.register(r'categories', SurplusFoodCategoryViewSet, basename='surplus-category')
router.register(r'time-slots', SurplusTimeSlotViewSet, basename='surplus-timeslot')
router.register(r'foods', SurplusFoodViewSet, basename='surplus-food')
router.register(r'orders', SurplusFoodOrderViewSet, basename='surplus-order')
router.register(r'green-point-rules', GreenPointRuleViewSet, basename='green-point-rule')
router.register(r'redemption-rules', PointRedemptionRuleViewSet, basename='redemption-rule')

# 公開 API（顧客端）
public_router = DefaultRouter()
public_router.register(r'foods', PublicSurplusFoodViewSet, basename='public-surplus-food')
public_router.register(r'orders', SurplusFoodOrderViewSet, basename='public-surplus-order')

urlpatterns = [
    # 商家端 API
    path('merchant/surplus/', include(router.urls)),
    
    # 顧客端公開 API
    path('surplus/', include(public_router.urls)),
    
    # 用戶綠色點數餘額 API
    path('green-points/store/<int:store_id>/', UserGreenPointsView.as_view(), name='user-green-points'),
    
    # 公開兌換規則 API
    path('redemption-rules/store/<int:store_id>/', PublicRedemptionRulesView.as_view(), name='public-redemption-rules'),
]


