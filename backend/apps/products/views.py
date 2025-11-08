# backend/apps/products/views.py

from rest_framework import viewsets, permissions, status, serializers
from rest_framework.response import Response
from .models import Product
from .serializers import ProductSerializer
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
        """
        This view should return a list of all the products
        for the currently authenticated user's merchant.
        """
        user = self.request.user
        # 修改這裡：檢查 merchant_profile
        if hasattr(user, 'merchant_profile'):
            # 修改這裡：用 user.merchant_profile 進行過濾
            return Product.objects.filter(merchant=user.merchant_profile)
        return Product.objects.none() # Return empty if not a merchant

    def perform_create(self, serializer):
        """
        Associate the product with the logged-in merchant.
        """
        # 修改這裡：檢查 merchant_profile
        if hasattr(self.request.user, 'merchant_profile'):
            # 修改這裡：儲存時關聯 user.merchant_profile
            serializer.save(merchant=self.request.user.merchant_profile)
        else:
            # This should ideally not happen due to permissions
            raise serializers.ValidationError("User is not a merchant and cannot create products.")