from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ProductViewSet, 
    PublicProductViewSet, 
    ProductCategoryViewSet, 
    PublicProductCategoryViewSet,
    TakeoutOrderCreateView
)

urlpatterns = [
    path('takeout/', TakeoutOrderCreateView.as_view(), name='takeout-order'),
]


router = DefaultRouter()
router.register(r'products', ProductViewSet, basename='product')
router.register(r'categories', ProductCategoryViewSet, basename='product-category')
router.register(r'public/products', PublicProductViewSet, basename='public-product')
router.register(r'public/categories', PublicProductCategoryViewSet, basename='public-category')


urlpatterns = [
    path('', include(router.urls)),
]


