from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    RecommendationViewSet, 
    PlatformSettingsViewSet, 
    FinancialAnalysisViewSet,
    LineLoginViewSet
)

router = DefaultRouter()
router.register(r'recommendations', RecommendationViewSet, basename='recommendation')
router.register(r'platform', PlatformSettingsViewSet, basename='platform-settings')
router.register(r'financial', FinancialAnalysisViewSet, basename='financial-analysis')
router.register(r'line-login', LineLoginViewSet, basename='line-login')

urlpatterns = [
    path('', include(router.urls)),
]
