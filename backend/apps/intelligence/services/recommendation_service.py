from django.db.models import Count, Q
from apps.products.models import Product
from apps.orders.models import TakeoutOrderItem, DineInOrderItem
from apps.stores.models import Store
from collections import Counter
import logging

logger = logging.getLogger(__name__)


class RecommendationService:
    """
    個人化推薦服務
    基於用戶的訂單歷史和食物標籤偏好提供推薦
    """
    
    @staticmethod
    def get_user_favorite_tags(user, limit=10):
        """
        分析用戶最喜歡的食物標籤
        基於用戶的歷史訂單
        返回: [{'tag': '標籤名', 'count': 次數}, ...]
        """
        # 收集用戶所有訂購過的商品
        takeout_items = TakeoutOrderItem.objects.filter(
            order__user=user
        ).select_related('product')
        
        dinein_items = DineInOrderItem.objects.filter(
            order__user=user
        ).select_related('product')
        
        # 統計所有標籤出現次數
        tag_counter = Counter()
        
        for item in takeout_items:
            if item.product.food_tags:
                for tag in item.product.food_tags:
                    # 根據訂購次數加權
                    tag_counter[tag] += item.quantity
        
        for item in dinein_items:
            if item.product.food_tags:
                for tag in item.product.food_tags:
                    tag_counter[tag] += item.quantity
        
        # 返回最常出現的標籤，包含次數
        return [
            {'tag': tag, 'count': count} 
            for tag, count in tag_counter.most_common(limit)
        ]
    
    @staticmethod
    def get_recommended_products_by_tags(user, store=None, limit=10):
        """
        基於用戶喜好的標籤推薦商品
        """
        # 獲取用戶喜愛的標籤
        favorite_tag_data = RecommendationService.get_user_favorite_tags(user)
        
        if not favorite_tag_data:
            # 如果沒有歷史記錄，返回熱門商品
            return RecommendationService.get_popular_products(store, limit)
        
        # 提取標籤名稱
        favorite_tags = [item['tag'] for item in favorite_tag_data]
        
        # 找出包含這些標籤的商品
        query = Product.objects.filter(is_available=True)
        
        if store:
            query = query.filter(store=store)
        
        # 排除用戶已訂購過的商品
        ordered_product_ids = set()
        ordered_product_ids.update(
            TakeoutOrderItem.objects.filter(
                order__user=user
            ).values_list('product_id', flat=True)
        )
        ordered_product_ids.update(
            DineInOrderItem.objects.filter(
                order__user=user
            ).values_list('product_id', flat=True)
        )
        
        # 計算每個商品與用戶喜好的匹配度
        recommended_products = []
        
        for product in query.exclude(id__in=ordered_product_ids):
            if not product.food_tags:
                continue
            
            # 計算標籤匹配度（改為包含匹配）
            matching_tags = []
            match_score = 0
            
            for product_tag in product.food_tags:
                for favorite_tag in favorite_tags:
                    # 如果商品標籤包含喜好標籤，或喜好標籤包含商品標籤
                    if favorite_tag in product_tag or product_tag in favorite_tag:
                        matching_tags.append(product_tag)
                        match_score += 1
                        break  # 避免同一個商品標籤重複計分
            
            if match_score > 0:
                recommended_products.append({
                    'product': product,
                    'score': match_score,
                    'matching_tags': matching_tags  # 已經是列表，不需要轉換
                })
        
        # 按匹配度排序
        recommended_products.sort(key=lambda x: x['score'], reverse=True)
        
        return recommended_products[:limit]
    
    @staticmethod
    def get_popular_products(store=None, limit=10):
        """
        獲取熱門商品（當用戶沒有歷史記錄時使用）
        """
        query = Product.objects.filter(is_available=True)
        
        if store:
            query = query.filter(store=store)
        
        # 統計訂購次數
        popular_products = query.annotate(
            order_count=Count('takeout_order_items') + Count('dinein_order_items')
        ).filter(order_count__gt=0).order_by('-order_count')[:limit]
        
        return [{'product': p, 'score': p.order_count, 'matching_tags': []} 
                for p in popular_products]
    
    @staticmethod
    def get_similar_products(product, limit=5):
        """
        找出與指定商品相似的商品（基於標籤包含匹配）
        """
        if not product.food_tags:
            return []
        
        similar_products = []
        
        for p in Product.objects.filter(
            store=product.store,
            is_available=True
        ).exclude(id=product.id):
            if not p.food_tags:
                continue
            
            # 計算標籤重疊度（改為包含匹配）
            common_tags = []
            for p_tag in p.food_tags:
                for prod_tag in product.food_tags:
                    # 如果標籤互相包含
                    if prod_tag in p_tag or p_tag in prod_tag:
                        common_tags.append(p_tag)
                        break
            
            if common_tags:
                # 計算相似度：共同標籤數 / 所有標籤數
                all_tags = set(product.food_tags + p.food_tags)
                similarity = len(common_tags) / len(all_tags)
                similar_products.append({
                    'product': p,
                    'similarity': similarity,
                    'common_tags': common_tags
                })
        
        # 按相似度排序
        similar_products.sort(key=lambda x: x['similarity'], reverse=True)
        
        return similar_products[:limit]
    
    @staticmethod
    def get_store_recommendations_for_user(user, limit=5, selected_tags=None):
        """
        為用戶推薦店家
        基於用戶喜好的標籤找出相關店家，如果匹配店家不足則補充熱門店家
        
        Args:
            user: 用戶對象
            limit: 返回數量
            selected_tags: 可選，用戶選擇的特定標籤列表（如果提供，只根據這些標籤推薦）
        """
        favorite_tag_data = RecommendationService.get_user_favorite_tags(user)
        
        if not favorite_tag_data:
            # 返回熱門店家
            return Store.objects.filter(
                is_published=True
            ).annotate(
                order_count=Count('takeout_orders') + Count('dinein_orders')
            ).order_by('-order_count')[:limit]
        
        # 如果用戶選擇了特定標籤，使用選擇的標籤；否則使用所有喜好標籤
        if selected_tags and len(selected_tags) > 0:
            favorite_tags = selected_tags
            logger.warning(f"[推薦服務] 使用用戶選擇的標籤: {favorite_tags}")
        else:
            # 提取標籤名稱
            favorite_tags = [item['tag'] for item in favorite_tag_data]
            logger.warning(f"[推薦服務] 用戶喜好標籤: {favorite_tags}")
        print(f"[推薦服務] 用戶喜好標籤: {favorite_tags}", flush=True)
        
        # 找出有相關商品的店家並計算匹配度
        stores_with_score = []
        all_stores = Store.objects.filter(is_published=True)
        
        logger.warning(f"[推薦服務] 總共 {all_stores.count()} 間已發布的店家")
        
        for store in all_stores:
            matching_products = Product.objects.filter(
                store=store,
                is_available=True
            )
            
            total_score = 0
            product_count = matching_products.count()
            
            logger.warning(f"[店家] {store.name} - 商品數: {product_count}")
            print(f"\n[店家] {store.name} - 商品數: {product_count}", flush=True)
            
            for product in matching_products:
                if product.food_tags:
                    # 只記錄一次商品信息
                    logger.warning(f"  商品: {product.name}, food_tags: {product.food_tags}, 類型: {type(product.food_tags)}")
                    print(f"  商品: {product.name}, food_tags: {product.food_tags}, 類型: {type(product.food_tags)}", flush=True)
                    
                    # 改為包含匹配：檢查商品標籤中是否包含用戶喜好標籤的字段
                    matched_in_this_product = set()  # 記錄已匹配的喜好標籤，避免重複計分
                    for product_tag in product.food_tags:
                        for favorite_tag in favorite_tags:
                            # 如果商品標籤包含喜好標籤（例如："素食便當" 包含 "素食"）
                            if favorite_tag in product_tag and favorite_tag not in matched_in_this_product:
                                logger.warning(f"    ✓ 匹配標籤: '{product_tag}' 包含 '{favorite_tag}'")
                                print(f"    ✓ 匹配標籤: '{product_tag}' 包含 '{favorite_tag}'", flush=True)
                                total_score += 1
                                matched_in_this_product.add(favorite_tag)
                                break  # 避免同一個商品標籤重複計分
            
            logger.warning(f"  最終分數: {total_score}")
            print(f"  最終分數: {total_score}", flush=True)
            
            # 所有店家都加入列表，但有匹配的店家分數更高
            stores_with_score.append({
                'store': store,
                'score': total_score,
                'product_count': product_count
            })
        
        # 按分數排序（分數高的優先），分數相同則按商品數量排序
        stores_with_score.sort(key=lambda x: (x['score'], x['product_count']), reverse=True)
        
        logger.warning(f"[排序結果]")
        print(f"\n[排序結果]", flush=True)
        for item in stores_with_score[:limit]:
            logger.warning(f"  {item['store'].name}: 分數={item['score']}, 商品數={item['product_count']}")
            print(f"  {item['store'].name}: 分數={item['score']}, 商品數={item['product_count']}", flush=True)
        
        # 返回前 limit 個店家（包含有匹配和無匹配的）
        return [item['store'] for item in stores_with_score[:limit]]
