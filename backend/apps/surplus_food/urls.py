from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SurplusFoodCategoryViewSet,
    SurplusTimeSlotViewSet,
    SurplusFoodViewSet,
    PublicSurplusFoodViewSet,
    SurplusFoodOrderViewSet
)

router = DefaultRouter()
router.register(r'categories', SurplusFoodCategoryViewSet, basename='surplus-category')
router.register(r'time-slots', SurplusTimeSlotViewSet, basename='surplus-timeslot')
router.register(r'foods', SurplusFoodViewSet, basename='surplus-food')
router.register(r'orders', SurplusFoodOrderViewSet, basename='surplus-order')

# 公開 API（顧客端）
public_router = DefaultRouter()
public_router.register(r'foods', PublicSurplusFoodViewSet, basename='public-surplus-food')

urlpatterns = [
    # 商家端 API
    path('merchant/surplus/', include(router.urls)),
    
    # 顧客端公開 API
    path('surplus/', include(public_router.urls)),
]
