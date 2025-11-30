from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProductViewSet, PublicProductViewSet
from .views import TakeoutOrderCreateView

urlpatterns = [
    path('takeout/', TakeoutOrderCreateView.as_view(), name='takeout-order'),
]


router = DefaultRouter()
router.register(r'products', ProductViewSet, basename='product')
router.register(r'public/products', PublicProductViewSet, basename='public-product')


urlpatterns = [
    path('', include(router.urls)),
]


