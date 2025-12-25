from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from datetime import datetime, timedelta
from django.utils import timezone
from django.conf import settings as django_settings
from .services.recommendation_service import RecommendationService
from .services.financial_analysis_service import FinancialAnalysisService
from .services.line_login_service import LineLoginService
from .serializers import (
    RecommendedProductSerializer, 
    UserPreferenceSerializer,
    PlatformSettingsSerializer,
    PlatformSettingsPublicSerializer
)
from .models import PlatformSettings
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


class PlatformSettingsViewSet(viewsets.ViewSet):
    """
    平台設定 API
    提供管理員配置平台級 AI 設定
    """
    
    @action(detail=False, methods=['get', 'post'], url_path='ai')
    def ai_settings(self, request):
        """
        取得或更新 AI 設定
        
        GET: 取得設定（管理員可看完整資訊）
        POST: 更新設定（僅限管理員）
        """
        settings = PlatformSettings.get_settings()
        is_admin = request.headers.get('X-Admin-Auth') == 'true'
        
        if request.method == 'GET':
            if is_admin:
                # 管理員：顯示完整設定，但遮罩 API Key
                data = {
                    'ai_provider': settings.ai_provider,
                    'ai_api_key_set': bool(settings.ai_api_key),
                    'ai_model': settings.ai_model,
                    'ai_temperature': settings.ai_temperature,
                    'ai_max_tokens': settings.ai_max_tokens,
                    'is_ai_enabled': settings.is_ai_enabled,
                    'default_system_prompt': settings.default_system_prompt,
                    'updated_at': settings.updated_at,
                    'updated_by': settings.updated_by,
                    'has_ai_config': settings.has_ai_config(),
                }
                return Response(data)
            else:
                serializer = PlatformSettingsPublicSerializer(settings)
                return Response(serializer.data)
        
        elif request.method == 'POST':
            if not is_admin:
                return Response(
                    {'detail': '需要管理員權限'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            serializer = PlatformSettingsSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
            validated_data = serializer.validated_data
            
            if 'ai_provider' in validated_data:
                settings.ai_provider = validated_data['ai_provider']
            if 'ai_api_key' in validated_data and validated_data['ai_api_key']:
                settings.ai_api_key = validated_data['ai_api_key']
            if 'ai_model' in validated_data:
                settings.ai_model = validated_data['ai_model']
            if 'ai_temperature' in validated_data:
                settings.ai_temperature = validated_data['ai_temperature']
            if 'ai_max_tokens' in validated_data:
                settings.ai_max_tokens = validated_data['ai_max_tokens']
            if 'is_ai_enabled' in validated_data:
                settings.is_ai_enabled = validated_data['is_ai_enabled']
            if 'default_system_prompt' in validated_data:
                settings.default_system_prompt = validated_data['default_system_prompt']
            
            settings.updated_by = 'admin'
            settings.save()
            
            logger.info("[Platform AI] Settings updated by admin")
            
            return Response({
                'message': 'AI 設定已更新',
                'ai_provider': settings.ai_provider,
                'ai_model': settings.ai_model,
                'is_ai_enabled': settings.is_ai_enabled,
                'has_ai_config': settings.has_ai_config(),
            })

    @action(detail=False, methods=['get', 'post'], url_path='line')
    def line_settings(self, request):
        """
        取得或更新 LINE 設定
        
        GET: 取得設定（管理員可看完整資訊）
        POST: 更新設定（僅限管理員）
        """
        settings = PlatformSettings.get_settings()
        is_admin = request.headers.get('X-Admin-Auth') == 'true'
        
        if request.method == 'GET':
            if is_admin:
                # 管理員：顯示完整設定，但遮罩敏感資訊
                data = {
                    'line_login_channel_id': settings.line_login_channel_id,
                    'line_login_channel_secret_set': bool(settings.line_login_channel_secret),
                    'line_bot_channel_access_token_set': bool(settings.line_bot_channel_access_token),
                    'line_bot_channel_secret_set': bool(settings.line_bot_channel_secret),
                    'is_line_bot_enabled': settings.is_line_bot_enabled,
                    'line_bot_welcome_message': settings.line_bot_welcome_message,
                    'has_line_login_config': settings.has_line_login_config(),
                    'has_line_bot_config': settings.has_line_bot_config(),
                    'updated_at': settings.updated_at,
                }
                return Response(data)
            else:
                # 非管理員：只顯示是否已設定
                return Response({
                    'has_line_login_config': settings.has_line_login_config(),
                    'has_line_bot_config': settings.has_line_bot_config(),
                })
        
        elif request.method == 'POST':
            if not is_admin:
                return Response(
                    {'detail': '需要管理員權限'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            data = request.data
            
            if 'line_login_channel_id' in data:
                settings.line_login_channel_id = data['line_login_channel_id']
            if 'line_login_channel_secret' in data and data['line_login_channel_secret']:
                settings.line_login_channel_secret = data['line_login_channel_secret']
            if 'line_bot_channel_access_token' in data and data['line_bot_channel_access_token']:
                settings.line_bot_channel_access_token = data['line_bot_channel_access_token']
            if 'line_bot_channel_secret' in data and data['line_bot_channel_secret']:
                settings.line_bot_channel_secret = data['line_bot_channel_secret']
            if 'is_line_bot_enabled' in data:
                settings.is_line_bot_enabled = data['is_line_bot_enabled']
            if 'line_bot_welcome_message' in data:
                settings.line_bot_welcome_message = data['line_bot_welcome_message']
            
            settings.updated_by = 'admin'
            settings.save()
            
            logger.info("[Platform LINE] Settings updated by admin")
            
            return Response({
                'message': 'LINE 設定已更新',
                'has_line_login_config': settings.has_line_login_config(),
                'has_line_bot_config': settings.has_line_bot_config(),
                'is_line_bot_enabled': settings.is_line_bot_enabled,
            })

class FinancialAnalysisViewSet(viewsets.ViewSet):
    """
    財務分析 API
    為商家提供銷售數據和 AI 分析報告
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def _get_store(self, request):
        """取得當前用戶的店家"""
        try:
            from apps.users.models import Merchant
            merchant = Merchant.objects.get(user=request.user)
            return merchant.store
        except:
            return None
    
    @action(detail=False, methods=['get'], url_path='sales-summary')
    def sales_summary(self, request):
        """
        取得銷售摘要
        
        Query params:
            period: 'day', 'week', 'month' (預設: week)
            start_date: ISO 格式日期
            end_date: ISO 格式日期
        """
        store = self._get_store(request)
        if not store:
            return Response(
                {'detail': '找不到店家資料'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # 解析參數
        period = request.query_params.get('period', 'week')
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')
        
        start_date = None
        end_date = None
        
        if start_date_str:
            try:
                start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
            except:
                pass
        
        if end_date_str:
            try:
                end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
            except:
                pass
        
        # 呼叫服務
        service = FinancialAnalysisService(store)
        summary = service.get_sales_summary(
            start_date=start_date,
            end_date=end_date,
            period=period
        )
        
        return Response(summary)
    
    @action(detail=False, methods=['get'], url_path='ai-report')
    def ai_report(self, request):
        """
        取得 AI 分析報告
        
        Query params:
            period: 'day', 'week', 'month' (預設: week)
        """
        store = self._get_store(request)
        if not store:
            return Response(
                {'detail': '找不到店家資料'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        period = request.query_params.get('period', 'week')
        
        # 取得銷售數據
        service = FinancialAnalysisService(store)
        summary = service.get_sales_summary(period=period)
        
        # 生成 AI 分析
        ai_analysis = service.generate_ai_analysis(summary)
        
        return Response({
            'period': summary.get('period'),
            'summary': summary.get('summary'),
            'ai_analysis': ai_analysis,
            'generated_at': timezone.now().isoformat()
        })


class LineLoginViewSet(viewsets.ViewSet):
    """
    LINE Login API
    處理 LINE 用戶綁定與解綁
    """
    permission_classes = [permissions.IsAuthenticated]
    
    @action(detail=False, methods=['get'], url_path='auth-url')
    def get_auth_url(self, request):
        """
        取得 LINE Login 授權 URL
        
        Query params:
            redirect_uri: 授權完成後的回調 URL
        """
        redirect_uri = request.query_params.get('redirect_uri')
        if not redirect_uri:
            # 預設回調 URL
            redirect_uri = request.build_absolute_uri('/api/intelligence/line-login/callback/')
        
        try:
            settings = PlatformSettings.get_settings()
            if not settings.has_line_login_config():
                return Response(
                    {'detail': 'LINE Login 尚未設定，請聯繫平台管理員'},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE
                )
            
            service = LineLoginService()
            # 儲存 state 到 session 防止 CSRF
            import secrets
            state = secrets.token_urlsafe(32)
            # 儲存 state 和 user_id 的對應關係（簡化版，實際應該用 cache）
            request.session['line_login_state'] = state
            request.session['line_login_user_id'] = request.user.id
            request.session['line_login_redirect_uri'] = redirect_uri
            
            auth_url = service.get_authorization_url(redirect_uri, state)
            
            return Response({
                'auth_url': auth_url,
                'state': state,
            })
        except Exception as e:
            logger.error(f"[LINE Login] Get auth URL error: {e}")
            return Response(
                {'detail': '取得授權 URL 失敗'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get', 'post'], url_path='callback', permission_classes=[permissions.AllowAny])
    def callback(self, request):
        """
        LINE Login 回調處理
        LINE 授權完成後會跳轉到這裡
        """
        code = request.query_params.get('code') or request.data.get('code')
        state = request.query_params.get('state') or request.data.get('state')
        error = request.query_params.get('error')
        
        if error:
            return Response(
                {'detail': f'LINE 授權失敗: {error}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not code:
            return Response(
                {'detail': '缺少授權碼'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 驗證 state（簡化版）
        # 實際應該從 cache 中檢查
        
        redirect_uri = request.query_params.get('redirect_uri')
        if not redirect_uri:
            redirect_uri = request.build_absolute_uri('/api/intelligence/line-login/callback/')
        
        try:
            service = LineLoginService()
            
            # 用授權碼換取 token
            token_data = service.exchange_code_for_token(code, redirect_uri)
            access_token = token_data.get('access_token')
            
            # 取得用戶資料
            profile = service.get_user_profile(access_token)
            line_user_id = profile.get('userId')
            display_name = profile.get('displayName', '')
            picture_url = profile.get('pictureUrl', '')
            
            return Response({
                'success': True,
                'line_user_id': line_user_id,
                'display_name': display_name,
                'picture_url': picture_url,
                'access_token': access_token,  # 前端可用來完成綁定
            })
            
        except Exception as e:
            logger.error(f"[LINE Login] Callback error: {e}")
            return Response(
                {'detail': f'LINE 登入失敗: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'], url_path='bind')
    def bind(self, request):
        """
        綁定 LINE 帳號
        
        Body:
            line_user_id: LINE User ID
            display_name: LINE 顯示名稱
            picture_url: LINE 頭像 URL
        """
        line_user_id = request.data.get('line_user_id')
        display_name = request.data.get('display_name', '')
        picture_url = request.data.get('picture_url', '')
        
        if not line_user_id:
            return Response(
                {'detail': '缺少 LINE User ID'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            service = LineLoginService()
            binding = service.bind_user(
                request.user,
                line_user_id,
                display_name,
                picture_url
            )
            
            return Response({
                'success': True,
                'message': 'LINE 帳號綁定成功',
                'binding': {
                    'line_user_id': binding.line_user_id,
                    'display_name': binding.display_name,
                    'picture_url': binding.picture_url,
                    'bound_at': binding.created_at.isoformat(),
                }
            })
            
        except ValueError as e:
            return Response(
                {'detail': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"[LINE Login] Bind error: {e}")
            return Response(
                {'detail': '綁定失敗'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'], url_path='unbind')
    def unbind(self, request):
        """
        解除 LINE 綁定
        """
        try:
            service = LineLoginService()
            success = service.unbind_user(request.user)
            
            if success:
                return Response({
                    'success': True,
                    'message': 'LINE 帳號已解除綁定'
                })
            else:
                return Response(
                    {'detail': '您尚未綁定 LINE 帳號'},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
        except Exception as e:
            logger.error(f"[LINE Login] Unbind error: {e}")
            return Response(
                {'detail': '解除綁定失敗'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'], url_path='status')
    def binding_status(self, request):
        """
        取得 LINE 綁定狀態
        """
        try:
            service = LineLoginService()
            binding_status = service.get_binding_status(request.user)
            
            return Response(binding_status)
            
        except Exception as e:
            logger.error(f"[LINE Login] Get status error: {e}")
            return Response(
                {'detail': '取得綁定狀態失敗'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

