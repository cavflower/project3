from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Q
from .models import StoreReview, ProductReview
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
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = StoreReview.objects.all()
        
        # 篩選店家
        store_id = self.request.query_params.get('store_id')
        if store_id:
            queryset = queryset.filter(store_id=store_id)
        
        # 店家查看自己店的評論
        if self.request.user.user_type == 'merchant':
            queryset = queryset.filter(store__merchant=self.request.user)
        
        return queryset
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
    
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
        
        if review.store.merchant != request.user:
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


class ProductReviewViewSet(viewsets.ModelViewSet):
    """菜品評論ViewSet"""
    serializer_class = ProductReviewSerializer
    permission_classes = [IsAuthenticated]
    
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
            queryset = queryset.filter(store__merchant=self.request.user)
        
        return queryset
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ReviewSubmissionViewSet(viewsets.ViewSet):
    """評論提交ViewSet"""
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['post'])
    def submit(self, request):
        """提交完整的訂單評論（店家+菜品）"""
        serializer = ReviewSubmissionSerializer(data=request.data)
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
        
        # 2. 創建菜品評論
        product_reviews = []
        for pr_data in data.get('product_reviews', []):
            try:
                product = Product.objects.get(id=pr_data['product_id'])
                product_review = ProductReview.objects.create(
                    user=request.user,
                    product=product,
                    store=store,
                    **{order_field: order},
                    rating=pr_data['rating'],
                    comment=pr_data.get('comment', '')
                )
                product_reviews.append(product_review)
            except Product.DoesNotExist:
                continue
        
        return Response({
            'message': '評論提交成功',
            'store_review_id': store_review.id,
            'product_review_count': len(product_reviews)
        }, status=status.HTTP_201_CREATED)
