from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.utils import timezone
from django.db.models import Q
from django.db import transaction
import json
from .models import StoreReview, ProductReview, StoreReviewImage, ProductReviewImage
from .serializers import (
    StoreReviewSerializer, 
    ProductReviewSerializer,
    ReviewSubmissionSerializer
)
from apps.orders.models import TakeoutOrder, DineInOrder
from apps.products.models import Product


class StoreReviewViewSet(viewsets.ModelViewSet):
    """店家評論ViewSet"""
    serializer_class = StoreReviewSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    
    def get_permissions(self):
        """列表和詳情可公開瀏覽，其他操作需認證"""
        if self.action in ['list', 'retrieve']:
            return [AllowAny()]
        return [IsAuthenticated()]
    
    def get_queryset(self):
        queryset = StoreReview.objects.all()
        
        # 篩選店家
        store_id = self.request.query_params.get('store_id')
        if store_id:
            queryset = queryset.filter(store_id=store_id)
        
        # 店家查看自己店的評論（需要登入）
        if self.request.user.is_authenticated and hasattr(self.request.user, 'user_type') and self.request.user.user_type == 'merchant':
            # Store.merchant 指向 Merchant 模型，需要通過 merchant.user 來關聯
            queryset = queryset.filter(store__merchant__user=self.request.user)
        
        return queryset
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def update(self, request, *args, **kwargs):
        return self._update_review(request, partial=False, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        return self._update_review(request, partial=True, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        review = self.get_object()
        if review.user_id != request.user.id:
            return Response(
                {'error': '只能刪除自己的評論'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)

    def _update_review(self, request, partial=False, *args, **kwargs):
        review = self.get_object()
        if review.user_id != request.user.id:
            return Response(
                {'error': '只能編輯自己的評論'},
                status=status.HTTP_403_FORBIDDEN
            )

        payload = self._normalize_store_update_payload(request.data)
        remove_image_ids = payload.pop('remove_image_ids', [])

        serializer = self.get_serializer(review, data=payload, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        if remove_image_ids:
            StoreReviewImage.objects.filter(store_review=review, id__in=remove_image_ids).delete()

        new_images = request.FILES.getlist('review_images')
        current_count = review.images.count()
        if current_count + len(new_images) > 5:
            return Response(
                {'error': '店家評論最多可保留 5 張圖片'},
                status=status.HTTP_400_BAD_REQUEST
            )

        for image_file in new_images:
            StoreReviewImage.objects.create(store_review=review, image=image_file)

        refreshed = self.get_serializer(review)
        return Response(refreshed.data)

    def _normalize_store_update_payload(self, data):
        payload = {}

        if 'rating' in data:
            payload['rating'] = data.get('rating')
        if 'comment' in data:
            payload['comment'] = data.get('comment', '')

        tags = data.get('tags')
        if tags is not None:
            if isinstance(tags, str):
                try:
                    tags = json.loads(tags)
                except json.JSONDecodeError:
                    tags = []
            if not isinstance(tags, list):
                tags = []
            payload['tags'] = tags

        remove_image_ids = data.get('remove_image_ids', [])
        if isinstance(remove_image_ids, str):
            try:
                remove_image_ids = json.loads(remove_image_ids)
            except json.JSONDecodeError:
                remove_image_ids = []
        if not isinstance(remove_image_ids, list):
            remove_image_ids = []

        payload['remove_image_ids'] = [
            int(image_id)
            for image_id in remove_image_ids
            if str(image_id).isdigit()
        ]

        return payload
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def reply(self, request, pk=None):
        """商家回覆評論"""
        review = self.get_object()
        
        # 檢查是否為店家且為自己店的評論
        if request.user.user_type != 'merchant':
            return Response(
                {'error': '只有商家可以回覆評論'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if review.store.merchant.user != request.user:
            return Response(
                {'error': '無權回覆此評論'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        reply_text = request.data.get('reply')
        if not reply_text:
            return Response(
                {'error': '回覆內容不能為空'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        review.merchant_reply = reply_text
        review.replied_at = timezone.now()
        review.save()
        
        serializer = self.get_serializer(review)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def my_reviews(self, request):
        """取得當前用戶的店家評論"""
        queryset = StoreReview.objects.filter(user=request.user).select_related(
            'store', 'takeout_order', 'dinein_order'
        ).order_by('-created_at')
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class ProductReviewViewSet(viewsets.ModelViewSet):
    """菜品評論ViewSet"""
    serializer_class = ProductReviewSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    
    def get_queryset(self):
        queryset = ProductReview.objects.all()
        
        # 篩選店家
        store_id = self.request.query_params.get('store_id')
        if store_id:
            queryset = queryset.filter(store_id=store_id)
        
        # 篩選菜品
        product_id = self.request.query_params.get('product_id')
        if product_id:
            queryset = queryset.filter(product_id=product_id)
        
        # 店家查看自己店的評論
        if self.request.user.user_type == 'merchant':
            queryset = queryset.filter(store__merchant__user=self.request.user)
        
        return queryset
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def update(self, request, *args, **kwargs):
        return self._update_review(request, partial=False, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        return self._update_review(request, partial=True, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        review = self.get_object()
        if review.user_id != request.user.id:
            return Response(
                {'error': '只能刪除自己的評論'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)

    def _update_review(self, request, partial=False, *args, **kwargs):
        review = self.get_object()
        if review.user_id != request.user.id:
            return Response(
                {'error': '只能編輯自己的評論'},
                status=status.HTTP_403_FORBIDDEN
            )

        payload = self._normalize_product_update_payload(request.data)
        remove_image_ids = payload.pop('remove_image_ids', [])

        serializer = self.get_serializer(review, data=payload, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        if remove_image_ids:
            ProductReviewImage.objects.filter(product_review=review, id__in=remove_image_ids).delete()

        new_images = request.FILES.getlist('review_images')
        current_count = review.images.count()
        if current_count + len(new_images) > 5:
            return Response(
                {'error': '每道菜評論最多可保留 5 張圖片'},
                status=status.HTTP_400_BAD_REQUEST
            )

        for image_file in new_images:
            ProductReviewImage.objects.create(product_review=review, image=image_file)

        refreshed = self.get_serializer(review)
        return Response(refreshed.data)

    def _normalize_product_update_payload(self, data):
        payload = {}

        if 'rating' in data:
            payload['rating'] = data.get('rating')
        if 'comment' in data:
            payload['comment'] = data.get('comment', '')

        remove_image_ids = data.get('remove_image_ids', [])
        if isinstance(remove_image_ids, str):
            try:
                remove_image_ids = json.loads(remove_image_ids)
            except json.JSONDecodeError:
                remove_image_ids = []
        if not isinstance(remove_image_ids, list):
            remove_image_ids = []

        payload['remove_image_ids'] = [
            int(image_id)
            for image_id in remove_image_ids
            if str(image_id).isdigit()
        ]

        return payload
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def my_reviews(self, request):
        """取得當前用戶的菜品評論"""
        queryset = ProductReview.objects.filter(user=request.user).select_related(
            'product', 'store', 'takeout_order', 'dinein_order'
        ).order_by('-created_at')
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class ReviewSubmissionViewSet(viewsets.ViewSet):
    """評論提交ViewSet"""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    
    @action(detail=False, methods=['post'])
    def submit(self, request):
        """提交完整的訂單評論（店家+菜品）"""
        raw_payload = self._get_normalized_payload(request)
        serializer = ReviewSubmissionSerializer(data=raw_payload)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        data = serializer.validated_data
        order_id = data['order_id']
        order_type = data['order_type']
        
        # 獲取訂單
        try:
            if order_type == 'takeout':
                order = TakeoutOrder.objects.get(id=order_id)
                order_field = 'takeout_order'
            else:
                order = DineInOrder.objects.get(id=order_id)
                order_field = 'dinein_order'
        except (TakeoutOrder.DoesNotExist, DineInOrder.DoesNotExist):
            return Response(
                {'error': '訂單不存在'},
                status=status.HTTP_404_NOT_FOUND
            )

        # 僅允許會員對自己的已完成訂單評論
        if not order.user_id or order.user_id != request.user.id:
            return Response(
                {'error': '只能評論自己的訂單'},
                status=status.HTTP_403_FORBIDDEN
            )

        if order.status != 'completed':
            return Response(
                {'error': '訂單尚未完成，無法評論'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        store = order.store
        
        # 檢查是否已評論
        existing_store_review = StoreReview.objects.filter(
            user=request.user,
            store=store,
            **{order_field: order}
        ).exists()
        
        if existing_store_review:
            return Response(
                {'error': '您已經評論過這個訂單'},
                status=status.HTTP_400_BAD_REQUEST
            )

        review_images = request.FILES.getlist('review_images')
        if len(review_images) > 5:
            return Response(
                {'error': '最多可上傳 5 張圖片'},
                status=status.HTTP_400_BAD_REQUEST
            )

        product_review_images_map = {}
        for key in request.FILES:
            if not key.startswith('product_review_images_'):
                continue

            product_id_str = key.replace('product_review_images_', '').strip()
            if not product_id_str.isdigit():
                continue

            product_id = int(product_id_str)
            product_files = request.FILES.getlist(key)
            if len(product_files) > 5:
                return Response(
                    {'error': f'菜品 {product_id} 最多可上傳 5 張圖片'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            product_review_images_map[product_id] = product_files

        order_product_ids = set(
            order.items.filter(product_id__isnull=False).values_list('product_id', flat=True)
        )
        parsed_product_reviews = {}

        for pr_data in data.get('product_reviews', []):
            try:
                product_id = int(pr_data['product_id'])
                rating = int(pr_data['rating'])
            except (TypeError, ValueError):
                return Response(
                    {'error': '菜品評論資料格式錯誤'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if product_id not in order_product_ids:
                return Response(
                    {'error': f'菜品 {product_id} 不屬於此訂單，無法評論'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if rating < 1 or rating > 5:
                return Response(
                    {'error': '每道菜評分必須在 1 到 5 之間'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            parsed_product_reviews[product_id] = {
                'rating': rating,
                'comment': pr_data.get('comment', '')
            }

        for product_id in product_review_images_map.keys():
            if product_id not in order_product_ids:
                return Response(
                    {'error': f'菜品 {product_id} 不屬於此訂單，無法上傳圖片'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        missing_product_ids = order_product_ids - set(parsed_product_reviews.keys())
        if missing_product_ids:
            missing_product_names = list(
                Product.objects.filter(id__in=missing_product_ids).values_list('name', flat=True)
            )
            return Response(
                {
                    'error': '每道菜都至少要評分 1 顆星',
                    'missing_products': missing_product_names
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        product_map = {
            product.id: product
            for product in Product.objects.filter(id__in=order_product_ids, store=store)
        }

        if set(product_map.keys()) != order_product_ids:
            return Response(
                {'error': '訂單中的部分菜品資料異常，請稍後再試'},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            # 1. 創建店家評論
            store_review_data = {
                'user': request.user,
                'store': store,
                order_field: order,
                'rating': data['store_rating'],
                'tags': data.get('store_tags', []),
                'comment': data.get('store_comment', '')
            }
            store_review = StoreReview.objects.create(**store_review_data)

            # 儲存評論圖片
            for image_file in review_images:
                StoreReviewImage.objects.create(store_review=store_review, image=image_file)

            # 2. 創建菜品評論
            product_reviews = []
            for product_id, pr_data in parsed_product_reviews.items():
                product_review = ProductReview.objects.create(
                    user=request.user,
                    product=product_map[product_id],
                    store=store,
                    **{order_field: order},
                    rating=pr_data['rating'],
                    comment=pr_data.get('comment', '')
                )

                for image_file in product_review_images_map.get(product_id, []):
                    ProductReviewImage.objects.create(product_review=product_review, image=image_file)

                product_reviews.append(product_review)
        
        return Response({
            'message': '評論提交成功',
            'store_review_id': store_review.id,
            'product_review_count': len(product_reviews)
        }, status=status.HTTP_201_CREATED)

    def _get_normalized_payload(self, request):
        """支援 JSON 與 multipart/form-data 提交評論。"""
        payload = {
            'order_id': request.data.get('order_id'),
            'order_type': request.data.get('order_type'),
            'store_rating': request.data.get('store_rating'),
            'store_tags': request.data.get('store_tags', []),
            'store_comment': request.data.get('store_comment', ''),
            'product_reviews': request.data.get('product_reviews', []),
        }

        for key in ['store_tags', 'product_reviews']:
            value = payload.get(key)
            if isinstance(value, str):
                value = value.strip()
                if not value:
                    payload[key] = []
                    continue
                try:
                    payload[key] = json.loads(value)
                except json.JSONDecodeError:
                    payload[key] = []

        if not isinstance(payload.get('store_tags'), list):
            payload['store_tags'] = []
        if not isinstance(payload.get('product_reviews'), list):
            payload['product_reviews'] = []

        return payload
