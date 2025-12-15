from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .services.recommendation_service import RecommendationService
from .serializers import RecommendedProductSerializer, UserPreferenceSerializer
from apps.stores.models import Store
from apps.orders.models import TakeoutOrder, DineInOrder
import logging

logger = logging.getLogger(__name__)


class RecommendationViewSet(viewsets.ViewSet):
    """
    個人化推薦 API
    提供基於用戶行為的商品和店家推薦
    """
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    
    @action(detail=False, methods=['get'], url_path='products')
    def recommended_products(self, request):
        """
        獲取為用戶推薦的商品
        
        Query Parameters:
        - store_id: 指定店家ID（可選）
        - limit: 返回數量（預設10）
        """
        if not request.user.is_authenticated:
            return Response({
                'detail': '請先登入以獲得個人化推薦'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        store_id = request.query_params.get('store_id')
        limit = int(request.query_params.get('limit', 10))
        
        store = None
        if store_id:
            try:
                store = Store.objects.get(id=store_id, is_published=True)
            except Store.DoesNotExist:
                return Response({
                    'detail': '店家不存在'
                }, status=status.HTTP_404_NOT_FOUND)
        
        # 獲取推薦
        recommendations = RecommendationService.get_recommended_products_by_tags(
            user=request.user,
            store=store,
            limit=limit
        )
        
        serializer = RecommendedProductSerializer(recommendations, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], url_path='stores')
    def recommended_stores(self, request):
        """
        獲取為用戶推薦的店家
        
        Query Parameters:
        - limit: 返回數量（預設5）
        - tags: 可選，用戶選擇的標籤（逗號分隔，例如：tags=素食,辣）
        """
        logger.warning(f"=== 推薦店家 API 被調用 ===")
        logger.warning(f"用戶: {request.user}, 已認證: {request.user.is_authenticated}")
        
        if not request.user.is_authenticated:
            # 未登入用戶返回熱門店家
            logger.warning("用戶未登入，返回熱門店家")
            stores = Store.objects.filter(
                is_published=True
            ).order_by('-created_at')[:5]
            
            from apps.stores.serializers import PublishedStoreSerializer
            serializer = PublishedStoreSerializer(stores, many=True)
            return Response(serializer.data)
        
        limit = int(request.query_params.get('limit', 5))
        
        # 獲取用戶選擇的標籤
        selected_tags_str = request.query_params.get('tags', '')
        selected_tags = None
        if selected_tags_str:
            selected_tags = [tag.strip() for tag in selected_tags_str.split(',') if tag.strip()]
            logger.warning(f"用戶選擇的標籤: {selected_tags}")
        
        logger.warning(f"開始為用戶 {request.user.username} 生成推薦，limit={limit}")
        
        stores = RecommendationService.get_store_recommendations_for_user(
            user=request.user,
            limit=limit,
            selected_tags=selected_tags
        )
        
        logger.warning(f"推薦服務返回 {len(stores)} 間店家")
        for store in stores:
            logger.warning(f"  - {store.name}")
        
        from apps.stores.serializers import PublishedStoreSerializer
        serializer = PublishedStoreSerializer(stores, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], url_path='preferences')
    def user_preferences(self, request):
        """
        獲取用戶的食物偏好分析
        """
        if not request.user.is_authenticated:
            return Response({
                'detail': '請先登入'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        # 獲取用戶喜愛的標籤
        favorite_tags = RecommendationService.get_user_favorite_tags(
            user=request.user,
            limit=10
        )
        
        # 統計訂單數
        total_orders = TakeoutOrder.objects.filter(user=request.user).count() + \
                      DineInOrder.objects.filter(user=request.user).count()
        
        data = {
            'favorite_tags': favorite_tags,
            'total_orders': total_orders,
            'recommendation_available': len(favorite_tags) > 0
        }
        
        serializer = UserPreferenceSerializer(data)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'], url_path='similar')
    def similar_products(self, request, pk=None):
        """
        獲取與指定商品相似的商品
        
        Parameters:
        - pk: 商品ID
        """
        from apps.products.models import Product
        
        try:
            product = Product.objects.get(id=pk, is_available=True)
        except Product.DoesNotExist:
            return Response({
                'detail': '商品不存在'
            }, status=status.HTTP_404_NOT_FOUND)
        
        similar = RecommendationService.get_similar_products(
            product=product,
            limit=5
        )
        
        # 轉換格式以符合序列化器
        formatted_similar = [{
            'product': item['product'],
            'score': int(item['similarity'] * 100),
            'matching_tags': item['common_tags']
        } for item in similar]
        
        serializer = RecommendedProductSerializer(formatted_similar, many=True)
        return Response(serializer.data)
