from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ProductViewSet, 
    PublicProductViewSet, 
    ProductCategoryViewSet, 
    PublicProductCategoryViewSet,
    SpecificationGroupViewSet,
    ProductSpecificationViewSet,
    PublicSpecificationGroupViewSet,
    TakeoutOrderCreateView
)

router = DefaultRouter()
router.register(r'products', ProductViewSet, basename='product')
router.register(r'categories', ProductCategoryViewSet, basename='product-category')
router.register(r'specification-groups', SpecificationGroupViewSet, basename='specification-group')
router.register(r'specifications', ProductSpecificationViewSet, basename='product-specification')
router.register(r'public/products', PublicProductViewSet, basename='public-product')
router.register(r'public/categories', PublicProductCategoryViewSet, basename='public-category')
router.register(r'public/specification-groups', PublicSpecificationGroupViewSet, basename='public-specification-group')

urlpatterns = [
    path('', include(router.urls)),
    path('takeout/', TakeoutOrderCreateView.as_view(), name='takeout-order'),
]
