from rest_framework import viewsets, permissions, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Store, StoreImage, MenuImage
from .serializers import StoreSerializer, StoreImageSerializer, MenuImageSerializer


class IsStoreOwner(permissions.BasePermission):
    """
    檢查使用者是否為該店家的擁有者
    """
    def has_object_permission(self, request, view, obj):
        return obj.merchant == request.user.merchant_profile


class StoreViewSet(viewsets.ModelViewSet):
    """
    Store 的 ViewSet，提供 CRUD 操作
    """
    serializer_class = StoreSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # 如果是 retrieve（查看單個店家），允許查看已上架的店家
        if self.action == 'retrieve':
            return Store.objects.filter(is_published=True)
        # 只返回當前登入商家的店家資訊
        if hasattr(self.request.user, 'merchant_profile'):
            return Store.objects.filter(merchant=self.request.user.merchant_profile)
        return Store.objects.none()

    def get_permissions(self):
        """
        根據操作類型返回適當的權限類
        """
        # published 和 retrieve（查看已上架店家）是公開 API，不需要認證
        if self.action in ['published', 'retrieve']:
            return [permissions.AllowAny()]
        if self.action in ['update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsStoreOwner()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        # 確保只有商家可以創建店家資訊
        if not hasattr(self.request.user, 'merchant_profile'):
            raise serializers.ValidationError("User is not a merchant and cannot create stores.")
        serializer.save(merchant=self.request.user.merchant_profile)

    @action(detail=False, methods=['get'])
    def my_store(self, request):
        """
        獲取當前商家的店家資訊
        """
        if not hasattr(request.user, 'merchant_profile'):
            return Response(
                {"error": "User is not a merchant."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            store = Store.objects.get(merchant=request.user.merchant_profile)
            serializer = self.get_serializer(store)
            return Response(serializer.data)
        except Store.DoesNotExist:
            return Response(
                {"error": "Store not found. Please create your store information."},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['post'])
    def upload_images(self, request, pk=None):
        """
        上傳多張餐廳圖片
        """
        store = self.get_object()
        if store.merchant != request.user.merchant_profile:
            return Response(
                {"error": "You don't have permission to upload images for this store."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        images = request.FILES.getlist('images')
        created_images = []
        for idx, image in enumerate(images):
            store_image = StoreImage.objects.create(
                store=store,
                image=image,
                order=idx
            )
            created_images.append(StoreImageSerializer(store_image).data)
        
        return Response({
            "message": f"Successfully uploaded {len(created_images)} images.",
            "images": created_images
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path='images/(?P<image_id>[^/.]+)')
    def delete_image(self, request, pk=None, image_id=None):
        """
        刪除指定的餐廳圖片
        """
        store = self.get_object()
        if store.merchant != request.user.merchant_profile:
            return Response(
                {"error": "You don't have permission to delete images for this store."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            image = StoreImage.objects.get(id=image_id, store=store)
            image.delete()
            return Response(
                {"message": "Image deleted successfully."},
                status=status.HTTP_204_NO_CONTENT
            )
        except StoreImage.DoesNotExist:
            return Response(
                {"error": "Image not found."},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        """
        上架店家（只能執行一次）
        """
        store = self.get_object()
        if store.merchant != request.user.merchant_profile:
            return Response(
                {"error": "You don't have permission to publish this store."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if store.is_published:
            return Response(
                {"error": "Store is already published."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        store.is_published = True
        store.save()
        serializer = self.get_serializer(store)
        return Response({
            "message": "Store published successfully.",
            "store": serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def unpublish(self, request, pk=None):
        """
        下架店家
        """
        store = self.get_object()
        if store.merchant != request.user.merchant_profile:
            return Response(
                {"error": "You don't have permission to unpublish this store."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        store.is_published = False
        store.save()
        serializer = self.get_serializer(store)
        return Response({
            "message": "Store unpublished successfully.",
            "store": serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def published(self, request):
        """
        獲取所有已上架的店家（公開 API，供顧客瀏覽）
        支援篩選參數：
        - cuisine_type: 餐廳類別
        - has_reservation: 是否提供訂位功能
        - has_loyalty: 是否提供會員功能
        - has_surplus_food: 是否提供惜福品功能
        - search: 搜尋關鍵字（店名、描述）
        """
        stores = Store.objects.filter(is_published=True)
        
        # 餐廳類別篩選
        cuisine_type = request.query_params.get('cuisine_type')
        if cuisine_type and cuisine_type != 'all':
            stores = stores.filter(cuisine_type=cuisine_type)
        
        # 功能篩選
        has_reservation = request.query_params.get('has_reservation')
        if has_reservation == 'true':
            stores = stores.filter(enable_reservation=True)
        
        has_loyalty = request.query_params.get('has_loyalty')
        if has_loyalty == 'true':
            stores = stores.filter(enable_loyalty=True)
        
        has_surplus_food = request.query_params.get('has_surplus_food')
        if has_surplus_food == 'true':
            stores = stores.filter(enable_surplus_food=True)
        
        # 搜尋關鍵字
        search = request.query_params.get('search')
        if search:
            from django.db.models import Q
            stores = stores.filter(
                Q(name__icontains=search) | 
                Q(description__icontains=search) |
                Q(address__icontains=search)
            )
        
        serializer = self.get_serializer(stores, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def upload_menu_images(self, request, pk=None):
        """
        上傳多張菜單圖片
        """
        store = self.get_object()
        if store.merchant != request.user.merchant_profile:
            return Response(
                {"error": "You don't have permission to upload menu images for this store."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        images = request.FILES.getlist('images')
        created_images = []
        for idx, image in enumerate(images):
            menu_image = MenuImage.objects.create(
                store=store,
                image=image,
                order=idx
            )
            created_images.append(MenuImageSerializer(menu_image).data)
        
        return Response({
            "message": f"Successfully uploaded {len(created_images)} menu images.",
            "images": created_images
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path='menu_images/(?P<image_id>[^/.]+)')
    def delete_menu_image(self, request, pk=None, image_id=None):
        """
        刪除指定的菜單圖片
        """
        store = self.get_object()
        if store.merchant != request.user.merchant_profile:
            return Response(
                {"error": "You don't have permission to delete menu images for this store."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            image = MenuImage.objects.get(id=image_id, store=store)
            image.delete()
            return Response(
                {"message": "Menu image deleted successfully."},
                status=status.HTTP_204_NO_CONTENT
            )
        except MenuImage.DoesNotExist:
            return Response(
                {"error": "Menu image not found."},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['get', 'post'], url_path='dine_in_layout')
    def dine_in_layout(self, request, pk=None):
        """
        取得或更新內用桌位配置
        """
        store = self.get_object()

        if request.method.lower() == 'get':
            return Response(store.dine_in_layout or [])

        if not hasattr(request.user, 'merchant_profile') or store.merchant != request.user.merchant_profile:
            return Response(
                {"error": "You don't have permission to update this store layout."},
                status=status.HTTP_403_FORBIDDEN
            )

        layout = request.data.get('layout', [])
        if not isinstance(layout, list):
            return Response(
                {"error": "Layout must be a list."},
                status=status.HTTP_400_BAD_REQUEST
            )

        store.dine_in_layout = layout
        store.save(update_fields=['dine_in_layout', 'updated_at'])
        return Response(store.dine_in_layout, status=status.HTTP_200_OK)

