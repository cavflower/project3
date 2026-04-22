from rest_framework import viewsets, permissions, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Count, DecimalField, Prefetch, Q, Sum, Value
from django.db.models.functions import Coalesce
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
        # 優化查詢：預載入相關資料
        base_queryset = Store.objects.select_related('merchant')

        # 內用桌位配置只需店家基本欄位，避免載入圖片與計數查詢。
        if self.action == 'dine_in_layout':
            base_queryset = base_queryset.only('id', 'merchant_id', 'dine_in_layout', 'updated_at')
        else:
            base_queryset = base_queryset.prefetch_related(
                Prefetch(
                    'images',
                    queryset=StoreImage.objects.only('id', 'store_id', 'image', 'order').order_by('order')
                ),
                Prefetch(
                    'menu_images',
                    queryset=MenuImage.objects.only('id', 'store_id', 'image', 'order').order_by('order')
                )
            ).annotate(
                surplus_order_count=Count(
                    'surplus_orders',
                    filter=Q(surplus_orders__status='completed')
                ),
                surplus_completed_revenue=Coalesce(
                    Sum('surplus_orders__total_price', filter=Q(surplus_orders__status='completed')),
                    Value(0),
                    output_field=DecimalField(max_digits=12, decimal_places=2),
                )
            )

        # 如果是 retrieve（查看單個店家），允許查看已上架的店家
        if self.action == 'retrieve':
            return base_queryset.filter(is_published=True)
        # 只返回當前登入商家的店家資訊
        if getattr(self.request.user, 'user_type', None) == 'merchant':
            return base_queryset.filter(merchant__user_id=self.request.user.id)
        return Store.objects.none()

    def get_permissions(self):
        """
        根據操作類型返回適當的權限類
        """
        # published、retrieve、all（管理員功能）是公開 API，不需要認證
        if self.action in ['published', 'retrieve', 'all']:
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
        if getattr(request.user, 'user_type', None) != 'merchant':
            return Response(
                {"error": "User is not a merchant."},
                status=status.HTTP_403_FORBIDDEN
            )

        lite_param = str(request.query_params.get('lite', '0')).strip().lower()
        is_lite_mode = lite_param in ('1', 'true', 'yes', 'on')
        
        try:
            if is_lite_mode:
                store = Store.objects.filter(merchant__user_id=request.user.id).values(
                    'id',
                    'enable_takeout',
                    'enable_reservation',
                    'enable_loyalty',
                    'enable_surplus_food',
                ).first()

                if not store:
                    raise Store.DoesNotExist

                return Response(store)

            store = self.get_queryset().get(merchant__user_id=request.user.id)
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
        - region: 店家地區（縣市）
        - has_reservation: 是否提供訂位功能
        - has_loyalty: 是否提供會員功能
        - has_surplus_food: 是否提供惜福品功能
        - search: 搜尋關鍵字（店名、描述）
        """
        from django.db.models import Count, Q, Prefetch
        
        # 優化查詢：使用 select_related 和 prefetch_related
        # 為了避免切片問題，我們 prefetch 所有圖片但在 serializer 中只取第一張
        stores = Store.objects.filter(
            is_published=True
        ).select_related(
            'merchant', 'merchant__user'
        ).prefetch_related(
            Prefetch('images', queryset=StoreImage.objects.order_by('order'))
        ).annotate(
            surplus_order_count=Count(
                'surplus_orders',
                filter=Q(surplus_orders__status='completed')
            ),
            surplus_completed_revenue=Coalesce(
                Sum('surplus_orders__total_price', filter=Q(surplus_orders__status='completed')),
                Value(0),
                output_field=DecimalField(max_digits=12, decimal_places=2),
            )
        )
        
        # 餐廳類別篩選
        cuisine_type = request.query_params.get('cuisine_type')
        if cuisine_type and cuisine_type != 'all':
            stores = stores.filter(cuisine_type=cuisine_type)

        # 地區篩選
        region = request.query_params.get('region')
        if region:
            stores = stores.filter(region=region)
        
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
        
        # 搜尋關鍵字（支援店名、描述、地址、料理類型和產品標籤）
        search = request.query_params.get('search')
        if search:
            from django.db.models import JSONField
            from django.db.models.functions import Cast
            
            # 建立料理類型的中文對照字典
            cuisine_type_map = dict(Store.CUISINE_TYPE_CHOICES)
            
            # 找出符合搜尋關鍵字的料理類型代碼
            matching_cuisine_types = [
                code for code, name in Store.CUISINE_TYPE_CHOICES 
                if search.lower() in name.lower()
            ]
            
            # 組合查詢條件（基本欄位搜尋）
            query = Q(name__icontains=search) | \
                    Q(description__icontains=search) | \
                    Q(address__icontains=search)
            
            # 如果有符合的料理類型，加入查詢條件
            if matching_cuisine_types:
                query |= Q(cuisine_type__in=matching_cuisine_types)
            
            # 搜尋關聯產品的名稱和描述
            query |= Q(products__name__icontains=search) | \
                     Q(products__description__icontains=search)
            
            # 使用原生 SQL 搜尋 JSONField（將 JSON 轉為文本搜尋）
            from django.db.models import Exists, OuterRef
            from apps.products.models import Product
            
            # 子查詢：找出 food_tags 包含搜尋關鍵字的產品
            products_with_tag = Product.objects.filter(
                store=OuterRef('pk')
            ).extra(
                where=["food_tags::text LIKE %s"],
                params=[f'%{search}%']
            )
            
            # 加入子查詢條件
            stores = stores.filter(query | Q(Exists(products_with_tag))).distinct()
        else:
            # 沒有搜尋關鍵字時，不需要額外處理
            pass
        
        # 使用輕量級序列化器提升效能
        from .serializers import PublishedStoreSerializer
        serializer = PublishedStoreSerializer(stores, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny])
    def all(self, request):
        """
        獲取所有店家資料（供管理員查看）
        不需要認證，簡化管理員系統
        """
        from django.db.models import Count, Q, Prefetch

        stores = Store.objects.all().select_related(
            'merchant', 'merchant__user'
        ).prefetch_related(
            Prefetch('images', queryset=StoreImage.objects.order_by('order')),
            Prefetch('menu_images', queryset=MenuImage.objects.order_by('order'))
        ).annotate(
            surplus_order_count=Count(
                'surplus_orders',
                filter=Q(surplus_orders__status='completed')
            ),
            surplus_completed_revenue=Coalesce(
                Sum('surplus_orders__total_price', filter=Q(surplus_orders__status='completed')),
                Value(0),
                output_field=DecimalField(max_digits=12, decimal_places=2),
            )
        ).order_by('-created_at')
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
        if not isinstance(layout, (list, dict)):
            return Response(
                {"error": "Layout must be a list or object."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if isinstance(layout, dict):
            floors = layout.get('floors', [])
            if not isinstance(floors, list):
                return Response(
                    {"error": "When layout is object, floors must be a list."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        store.dine_in_layout = layout
        store.save(update_fields=['dine_in_layout', 'updated_at'])
        return Response(store.dine_in_layout, status=status.HTTP_200_OK)

