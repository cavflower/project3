# backend/apps/products/views.py

from rest_framework import viewsets, permissions, status, serializers
from rest_framework.response import Response
from rest_framework.decorators import action
from .models import Product, ProductCategory
from .serializers import ProductSerializer, PublicProductSerializer, ProductCategorySerializer
from rest_framework import generics, permissions
from django.shortcuts import get_object_or_404
from apps.orders.serializers import TakeoutOrderSerializer
from apps.stores.models import Store

class TakeoutOrderCreateView(generics.CreateAPIView):
    serializer_class = TakeoutOrderSerializer
    permission_classes = [permissions.AllowAny]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        store = get_object_or_404(Store, pk=self.request.data.get('store'))
        context['store'] = store
        return context

# 移除這行，因為 Merchant 模型不需要直接在這裡使用
# from apps.users.models import Merchant # <--- 移除或註解掉

class IsOwner(permissions.BasePermission):
    """
    Custom permission to only allow owners of an object to edit it.
    """
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True

        # 修改這裡：檢查 merchant_profile
        if not hasattr(request.user, 'merchant_profile'):
            return False
        
        # 修改這裡：比較 obj.merchant 和 request.user.merchant_profile
        return obj.merchant == request.user.merchant_profile


class ProductCategoryViewSet(viewsets.ModelViewSet):
    """
    產品類別的 CRUD API
    """
    serializer_class = ProductCategorySerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        merchant = getattr(self.request.user, 'merchant_profile', None)
        if not merchant or not hasattr(merchant, 'store'):
            return ProductCategory.objects.none()
        return ProductCategory.objects.filter(store=merchant.store)
    
    def perform_create(self, serializer):
        merchant = getattr(self.request.user, 'merchant_profile', None)
        if not merchant or not hasattr(merchant, 'store'):
            raise serializers.ValidationError('User is not a merchant or has no store.')
        serializer.save(store=merchant.store)


class ProductViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows products to be viewed or edited.
    """
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        """
        Instantiates and returns the list of permissions that this view requires.
        For object-level actions (update, destroy), we add the IsOwner permission.
        """
        if self.action in ['update', 'partial_update', 'destroy']:
            # IsOwner 權限已在上面修改
            return [permissions.IsAuthenticated(), IsOwner()]
        return super().get_permissions()

    def get_queryset(self):
        merchant = getattr(self.request.user, 'merchant_profile', None)
        if not merchant or not hasattr(merchant, 'store'):
            return Product.objects.none()
        return Product.objects.filter(store=merchant.store)

    def perform_create(self, serializer):
        merchant = getattr(self.request.user, 'merchant_profile', None)
        if not merchant or not hasattr(merchant, 'store'):
            raise serializers.ValidationError('User is not a merchant or has no store.')
        serializer.save(merchant=merchant, store=merchant.store)


class PublicProductViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Product.objects.filter(is_available=True)
    serializer_class = PublicProductSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        store_id = self.request.query_params.get('store')
        service_type = self.request.query_params.get('service_type')
        if store_id:
            qs = qs.filter(store_id=store_id)
        if service_type in ('takeaway', 'dine_in'):
            qs = qs.filter(service_type__in=[service_type, 'both'])
        return qs


class PublicProductCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    公開的產品類別 API
    允許顧客端查看店家的產品類別（僅限啟用的類別）
    """
    queryset = ProductCategory.objects.filter(is_active=True)
    serializer_class = ProductCategorySerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        store_id = self.request.query_params.get('store')
        if store_id:
            qs = qs.filter(store_id=store_id)
        return qs.order_by('display_order', 'name')
    

class TakeoutOrderCreateView(generics.CreateAPIView):
    serializer_class = TakeoutOrderSerializer
    permission_classes = [permissions.AllowAny]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        store_id = self.request.data.get('store')
        context['store'] = get_object_or_404(Store, pk=store_id)
        return context
