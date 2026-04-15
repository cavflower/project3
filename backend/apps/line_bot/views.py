import hmac
import hashlib
import json
import base64
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.conf import settings
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from apps.stores.models import Store
from apps.products.models import Product, ProductCategory, SpecificationGroup, ProductSpecification
from apps.reservations.models import TimeSlot
from apps.users.models import Merchant
from .models import LineUserBinding, StoreFAQ, ConversationLog, BroadcastMessage, StoreLineBotConfig, MerchantLineBinding, PlatformBroadcast
from .serializers import (
    LineUserBindingSerializer,
    StoreFAQSerializer,
    ConversationLogSerializer,
    BroadcastMessageSerializer,
    BroadcastMessageCreateSerializer,
    StoreLineBotConfigSerializer,
    MerchantLineBindingSerializer,
    MerchantLineBindingPreferencesSerializer,
    PersonalizedTargetFilterSerializer,
    PlatformBroadcastSerializer
)
from .services.line_api import LineMessagingAPI
from .services.message_handler import MessageHandler
import os


def verify_signature(request_body: bytes, signature: str, channel_secret: str) -> bool:
    """
    驗證 LINE Webhook 簽名
    
    Args:
        request_body: 請求主體
        signature: LINE 提供的簽名
        channel_secret: Channel Secret（從資料庫讀取）
        
    Returns:
        bool: 簽名是否有效
    """
    secret_bytes = channel_secret.encode('utf-8')
    hash_digest = hmac.new(
        secret_bytes,
        request_body,
        hashlib.sha256
    ).digest()
    expected_signature = base64.b64encode(hash_digest).decode('utf-8')
    return signature == expected_signature


@csrf_exempt
@require_http_methods(["POST", "HEAD", "GET"])
def webhook(request):
    """
    LINE Webhook 端點
    接收來自 LINE 平台的事件
    """
    # LINE 驗證時會發送 GET 或 HEAD 請求
    if request.method in ['GET', 'HEAD']:
        return HttpResponse(status=200)
    
    # 優先從 platform_settings 取得 Channel Secret
    try:
        from apps.intelligence.models import PlatformSettings
        platform_settings = PlatformSettings.get_settings()
        channel_secret = platform_settings.line_bot_channel_secret
        
        if not channel_secret:
            # Fallback: 從第一個啟用的店家配置取得
            bot_config = StoreLineBotConfig.objects.filter(is_active=True).first()
            if bot_config and bot_config.line_channel_secret:
                channel_secret = bot_config.line_channel_secret
                if settings.DEBUG:
                    print(f"[LINE Webhook] Using channel secret from store config (length: {len(channel_secret)})")
            else:
                if settings.DEBUG:
                    print("[LINE Webhook] No channel secret found in platform_settings or store_config!")
                return HttpResponse(status=200)  # Return 200 for LINE verification
        else:
            if settings.DEBUG:
                print(f"[LINE Webhook] Using channel secret from platform_settings (length: {len(channel_secret)})")
            
    except Exception as e:
        if settings.DEBUG:
            print(f"[LINE Webhook] Error getting config: {e}")
        return HttpResponse(status=200)  # Return 200 for LINE verification
    
    # 驗證簽名
    signature = request.headers.get('X-Line-Signature', '')
    
    # 開發模式：記錄詳細資訊以便除錯
    if settings.DEBUG:
        print(f"[LINE Webhook] Received request")
        print(f"[LINE Webhook] Signature: {signature}")
        print(f"[LINE Webhook] Body length: {len(request.body)}")
        
    if not verify_signature(request.body, signature, channel_secret):
        if settings.DEBUG:
            print(f"[LINE Webhook] Signature verification failed!")
        return HttpResponse(status=403)
    
    try:
        body = json.loads(request.body.decode('utf-8'))
        events = body.get('events', [])
        
        if settings.DEBUG:
            print(f"[LINE Webhook] Events: {len(events)}")
        
        for event in events:
            handle_event(event)
        
        return HttpResponse(status=200)
    
    except Exception as e:
        print(f"[LINE Webhook] Error: {e}")
        import traceback
        traceback.print_exc()
        return HttpResponse(status=500)


def handle_event(event: dict, store_id: int = None):
    """
    處理單一 LINE 事件
    
    Args:
        event: LINE 事件物件
        store_id: 店家 ID（如果是店家專屬 webhook 會傳入）
    """
    event_type = event.get('type')
    
    if event_type == 'message':
        handle_message_event(event, store_id)
    elif event_type == 'follow':
        handle_follow_event(event, store_id)
    elif event_type == 'unfollow':
        handle_unfollow_event(event)
    elif event_type == 'postback':
        handle_postback_event(event)


def handle_message_event(event: dict, store_id: int = None):
    """
    處理訊息事件
    
    Args:
        event: LINE 訊息事件
        store_id: 店家 ID（如果是店家專屬 webhook 會傳入）
    """
    message = event.get('message', {})
    message_type = message.get('type')
    
    if message_type != 'text':
        # 目前只處理文字訊息
        return
    
    line_user_id = event['source']['userId']
    user_message = message.get('text', '')
    reply_token = event.get('replyToken')
    
    try:
        if store_id:
            # 店家專屬 webhook：使用指定店家的設定
            bot_config = StoreLineBotConfig.objects.filter(store_id=store_id, is_active=True).first()
            if not bot_config:
                raise StoreLineBotConfig.DoesNotExist
        else:
            # 平台級 webhook：使用平台設定發送通用回覆
            from apps.intelligence.models import PlatformSettings
            platform_settings = PlatformSettings.get_settings()
            
            if settings.DEBUG:
                print(f"[LINE Webhook] Platform webhook - Message: {user_message}")
            
            # 初始化平台 LINE API
            temp_line_api = LineMessagingAPI()
            temp_line_api.channel_access_token = platform_settings.line_bot_channel_access_token
            
            # 處理「切換」指令
            if user_message.strip() in ['切換', '切換模式', 'switch', 'Switch']:
                # 查詢用戶綁定狀態
                user_binding = LineUserBinding.objects.filter(line_user_id=line_user_id).first()
                merchant_binding = MerchantLineBinding.objects.filter(line_user_id=line_user_id).first()
                
                if user_binding and merchant_binding:
                    # 用戶同時綁定顧客和店家，執行切換
                    if user_binding.current_mode == 'customer':
                        user_binding.current_mode = 'merchant'
                        mode_name = '店家模式 🏪'
                        mode_desc = '現在您可以查看營業資訊、訂單統計等店家功能。'
                    else:
                        user_binding.current_mode = 'customer'
                        mode_name = '顧客模式 🍽️'
                        mode_desc = '現在您可以查看個人化推薦、優惠資訊等顧客功能。'
                    
                    user_binding.save()
                    
                    switch_reply = f"""✅ 模式已切換！

你現在是【{mode_name}】

{mode_desc}

💡 輸入「切換」可隨時切換模式"""
                    
                    messages = [temp_line_api.create_text_message(switch_reply)]
                    temp_line_api.reply_message(reply_token, messages)
                    
                    if settings.DEBUG:
                        print(f"[LINE Webhook] Mode switched to: {user_binding.current_mode}")
                    return
                    
                elif user_binding:
                    # 只有顧客綁定
                    no_switch_reply = """⚠️ 無法切換模式

您目前只有綁定顧客帳號。

如需使用店家模式，請先以店家身份登入平台並綁定 LINE 帳號。"""
                    messages = [temp_line_api.create_text_message(no_switch_reply)]
                    temp_line_api.reply_message(reply_token, messages)
                    return
                    
                elif merchant_binding:
                    # 只有店家綁定
                    no_switch_reply = """⚠️ 無法切換模式

您目前只有綁定店家帳號。

如需使用顧客模式，請先以顧客身份登入平台並綁定 LINE 帳號。"""
                    messages = [temp_line_api.create_text_message(no_switch_reply)]
                    temp_line_api.reply_message(reply_token, messages)
                    return
                    
                else:
                    # 沒有任何綁定
                    no_binding_reply = """⚠️ 您尚未綁定帳號

請先登入 DineVerse 平台並綁定您的 LINE 帳號。"""
                    messages = [temp_line_api.create_text_message(no_binding_reply)]
                    temp_line_api.reply_message(reply_token, messages)
                    return
            
            # 使用平台自訂的歡迎訊息或預設回覆
            if platform_settings.line_bot_welcome_message:
                platform_reply = platform_settings.line_bot_welcome_message
            else:
                platform_reply = """歡迎使用 DineVerse！🍽️

感謝您的訊息！

如需更多協助，請直接加入各餐廳的官方帳號，即可獲得專屬服務。

祝您用餐愉快！"""
            
            messages = [temp_line_api.create_text_message(platform_reply)]
            temp_line_api.reply_message(reply_token, messages)
            
            if settings.DEBUG:
                print(f"[LINE Webhook] Platform reply: {platform_reply[:50]}...")
            return
        
        store = bot_config.store
        
        if settings.DEBUG:
            print(f"[LINE Webhook] Store: {store.name}")
            print(f"[LINE Webhook] Message: {user_message}")
        
        # 初始化店家專屬的服務
        line_api = LineMessagingAPI(bot_config)
        message_handler = MessageHandler(bot_config)
        
        max_menu_categories = 6
        max_products_per_category = 8
        max_spec_groups_per_product = 3
        max_spec_options_per_group = 6
        max_description_length = 80

        # 整理可供 AI 使用的訂位資訊（限制筆數避免 prompt 過長）
        day_order = {
            'monday': 0,
            'tuesday': 1,
            'wednesday': 2,
            'thursday': 3,
            'friday': 4,
            'saturday': 5,
            'sunday': 6,
        }
        reservation_slots = []
        try:
            active_slots = list(
                TimeSlot.objects.filter(store=store, is_active=True)
            )
            active_slots.sort(
                key=lambda s: (
                    day_order.get(s.day_of_week, 99),
                    s.start_time,
                )
            )
            for slot in active_slots[:20]:
                reservation_slots.append({
                    'day': slot.get_day_of_week_display(),
                    'start_time': slot.start_time.strftime('%H:%M'),
                    'end_time': slot.end_time.strftime('%H:%M') if slot.end_time else '',
                    'max_party_size': slot.max_party_size,
                    'max_capacity': slot.max_capacity,
                })
        except Exception as e:
            if settings.DEBUG:
                print(f"[LINE Webhook] Error fetching reservation slots: {e}")

        store_info = {
            'id': store.id,
            'name': store.name,
            'cuisine_type': store.get_cuisine_type_display(),
            'address': store.address,
            'phone': store.phone,
            'opening_hours': store.opening_hours,
            'description': store.description,
            'fixed_holidays': store.fixed_holidays,
            'website': store.website,
            'line_friend_url': store.line_friend_url,
            'reservation': {
                'enabled': store.enable_reservation,
                'fixed_holidays': store.fixed_holidays,
                'time_slots': reservation_slots,
                'contact_phone': store.phone,
            },
        }
        
        # 取得菜單資料
        menu_data = []
        try:
            categories = ProductCategory.objects.filter(store=store, is_active=True).order_by('display_order')[:max_menu_categories]
            for category in categories:
                products = Product.objects.filter(
                    store=store, 
                    category=category, 
                    is_available=True
                ).prefetch_related('specification_groups__options').order_by('id')[:max_products_per_category]
                
                category_products = []
                for product in products:
                    description = (product.description or '').strip()
                    if len(description) > max_description_length:
                        description = f"{description[:max_description_length]}..."

                    product_info = {
                        'name': product.name,
                        'price': float(product.price),
                        'description': description,
                    }
                    # 加入規格資訊
                    specs = []
                    for group in product.specification_groups.filter(is_active=True).order_by('display_order')[:max_spec_groups_per_product]:
                        options = [
                            f"{opt.name}(+${opt.price_adjustment})" if opt.price_adjustment > 0 
                            else f"{opt.name}(-${abs(opt.price_adjustment)})" if opt.price_adjustment < 0 
                            else opt.name
                            for opt in group.options.filter(is_active=True).order_by('display_order')[:max_spec_options_per_group]
                        ]
                        if options:
                            specs.append(f"{group.name}: {', '.join(options)}")
                    if specs:
                        product_info['specifications'] = specs
                    category_products.append(product_info)
                
                if category_products:
                    menu_data.append({
                        'category': category.name,
                        'products': category_products
                    })
            
            # 也加入沒有分類的產品
            uncategorized = Product.objects.filter(
                store=store, 
                category__isnull=True, 
                is_available=True
            ).prefetch_related('specification_groups__options').order_by('id')[:max_products_per_category]
            
            if uncategorized.exists():
                uncategorized_products = []
                for product in uncategorized:
                    description = (product.description or '').strip()
                    if len(description) > max_description_length:
                        description = f"{description[:max_description_length]}..."

                    product_info = {
                        'name': product.name,
                        'price': float(product.price),
                        'description': description,
                    }
                    uncategorized_products.append(product_info)
                menu_data.append({
                    'category': '其他',
                    'products': uncategorized_products
                })
                
        except Exception as e:
            if settings.DEBUG:
                print(f"[LINE Webhook] Error fetching menu data: {e}")
        
        store_info['menu'] = menu_data
        
        # 處理訊息並取得回覆
        result = message_handler.handle_text_message(
            line_user_id=line_user_id,
            message=user_message,
            store_id=store.id,
            store_info=store_info
        )
        
        if settings.DEBUG:
            print(f"[LINE Webhook] Reply: {result['reply']}")
            print(f"[LINE Webhook] Matched FAQ: {result.get('matched_faq_id')}")
        
        # 記錄用戶訊息
        ConversationLog.objects.create(
            store=store,
            line_user_id=line_user_id,
            sender_type='user',
            message_type='text',
            message_content=user_message,
            reply_token=reply_token
        )
        
        # 記錄 BOT 回覆
        ConversationLog.objects.create(
            store=store,
            line_user_id=line_user_id,
            sender_type='bot',
            message_type='text',
            message_content=result['reply'],
            matched_faq_id=result.get('matched_faq_id'),
            used_ai=result.get('used_ai', False),
            ai_model=result.get('ai_model')
        )
        
        # 發送回覆
        messages = [line_api.create_text_message(result['reply'])]
        line_api.reply_message(reply_token, messages)
        
    except StoreLineBotConfig.DoesNotExist:
        # 找不到對應的店家設定，發送預設訊息
        if settings.DEBUG:
            print("[LINE Webhook] No active StoreLineBotConfig found!")
        
        welcome_text = """歡迎使用 DineVerse 餐廳助手！🎉

此 LINE 官方帳號尚未完成設定。
請到「LINE BOT 設定」頁面完成以下步驟：
1. 輸入 LINE Channel Access Token
2. 輸入 LINE Channel Secret
3. 設定 AI API Key
4. 點擊「更新設定」並啟用 LINE BOT"""
        
        temp_line_api = LineMessagingAPI()
        messages = [temp_line_api.create_text_message(welcome_text)]
        temp_line_api.reply_message(reply_token, messages)


def handle_follow_event(event: dict, store_id: int = None):
    """
    處理用戶加入好友事件
    
    Args:
        event: LINE follow 事件
        store_id: 店家 ID（如果是店家專屬 webhook 會傳入）
    """
    line_user_id = event['source']['userId']
    reply_token = event.get('replyToken')
    
    try:
        if store_id:
            # 店家專屬 webhook：使用指定店家的設定
            bot_config = StoreLineBotConfig.objects.filter(store_id=store_id, is_active=True).first()
            
            if bot_config and bot_config.line_channel_access_token:
                line_api = LineMessagingAPI(bot_config)
                
                if bot_config.welcome_message:
                    welcome_text = bot_config.welcome_message
                else:
                    welcome_text = f"""歡迎加入 {bot_config.store.name}！👋

感謝您成為我們的好友！

有任何問題都可以直接詢問我，我會盡力為您解答。"""
                
                if settings.DEBUG:
                    print(f"[LINE Follow] Store: {bot_config.store.name}")
                    print(f"[LINE Follow] Welcome message: {welcome_text[:50]}...")
            else:
                # 店家未設定，使用預設訊息
                line_api = LineMessagingAPI()
                welcome_text = """歡迎加入！👋

感謝您成為我們的好友！"""
        else:
            # 平台級 webhook：使用平台設定
            from apps.intelligence.models import PlatformSettings
            platform_settings = PlatformSettings.get_settings()
            
            line_api = LineMessagingAPI()
            line_api.channel_access_token = platform_settings.line_bot_channel_access_token
            
            # 使用平台自訂的歡迎訊息
            if platform_settings.line_bot_welcome_message:
                welcome_text = platform_settings.line_bot_welcome_message
            else:
                welcome_text = """歡迎加入 DineVerse！🍽️

我是 DineVerse 平台助手。

如需餐廳相關服務，請直接加入各餐廳的官方帳號，即可獲得專屬服務。

祝您用餐愉快！"""
            
            if settings.DEBUG:
                print(f"[LINE Follow] Platform welcome message: {welcome_text[:50]}...")
            
    except Exception as e:
        if settings.DEBUG:
            print(f"[LINE Follow] Error: {e}")
        line_api = LineMessagingAPI()
        welcome_text = """歡迎加入 DineVerse！👋

感謝您成為我們的好友！"""
    
    messages = [line_api.create_text_message(welcome_text)]
    line_api.reply_message(reply_token, messages)


def handle_unfollow_event(event: dict):
    """
    處理用戶封鎖事件
    
    Args:
        event: LINE unfollow 事件
    """
    line_user_id = event['source']['userId']
    
    # 停用綁定
    try:
        binding = LineUserBinding.objects.get(line_user_id=line_user_id)
        binding.is_active = False
        binding.save()
    except LineUserBinding.DoesNotExist:
        pass


def handle_postback_event(event: dict):
    """
    處理 Postback 事件（按鈕點擊等）
    
    Args:
        event: LINE postback 事件
    """
    # 未來可以在這裡處理互動式按鈕的回應
    pass


# ==================== REST API ViewSets ====================

class StoreFAQViewSet(viewsets.ModelViewSet):
    """
    店家 FAQ 管理 ViewSet
    """
    serializer_class = StoreFAQSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """只返回當前商家的 FAQ"""
        user = self.request.user
        if hasattr(user, 'merchant_profile') and hasattr(user.merchant_profile, 'store'):
            return StoreFAQ.objects.filter(store=user.merchant_profile.store)
        return StoreFAQ.objects.none()
    
    def perform_create(self, serializer):
        """建立 FAQ 時自動關聯店家"""
        user = self.request.user
        if hasattr(user, 'merchant_profile') and hasattr(user.merchant_profile, 'store'):
            serializer.save(store=user.merchant_profile.store)
    
    @action(detail=False, methods=['get'])
    def popular(self, request):
        """取得最常用的 FAQ"""
        queryset = self.get_queryset().order_by('-usage_count')[:10]
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class ConversationLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    對話記錄 ViewSet（唯讀）
    """
    serializer_class = ConversationLogSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """只返回當前商家的對話記錄"""
        user = self.request.user
        if hasattr(user, 'merchant_profile') and hasattr(user.merchant_profile, 'store'):
            return ConversationLog.objects.filter(store=user.merchant_profile.store)
        return ConversationLog.objects.none()
    
    @action(detail=False, methods=['get'])
    def recent(self, request):
        """取得最近的對話"""
        queryset = self.get_queryset()[:50]
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def by_user(self, request):
        """根據 LINE User ID 查詢對話"""
        line_user_id = request.query_params.get('line_user_id')
        if not line_user_id:
            return Response(
                {'error': '請提供 line_user_id 參數'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        queryset = self.get_queryset().filter(line_user_id=line_user_id)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class BroadcastMessageViewSet(viewsets.ModelViewSet):
    """
    推播訊息 ViewSet
    """
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return BroadcastMessageCreateSerializer
        return BroadcastMessageSerializer
    
    def get_queryset(self):
        """只返回當前商家的推播訊息"""
        user = self.request.user
        if hasattr(user, 'merchant_profile') and hasattr(user.merchant_profile, 'store'):
            return BroadcastMessage.objects.filter(store=user.merchant_profile.store)
        return BroadcastMessage.objects.none()
    
    def perform_create(self, serializer):
        """建立推播訊息時自動關聯店家和建立者"""
        user = self.request.user
        if hasattr(user, 'merchant_profile') and hasattr(user.merchant_profile, 'store'):
            serializer.save(
                store=user.merchant_profile.store,
                created_by=user
            )
    
    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        """發送推播訊息"""
        broadcast = self.get_object()
        
        if broadcast.status == 'sent':
            return Response(
                {'error': '此訊息已發送'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 取得店家的 LINE BOT 配置
        try:
            bot_config = StoreLineBotConfig.objects.get(store=broadcast.store, is_active=True)
            temp_line_api = LineMessagingAPI(bot_config)
        except StoreLineBotConfig.DoesNotExist:
            return Response(
                {'error': '此店家尚未設定 LINE BOT'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 準備訊息（包含標題和內容）
        full_message = f"📢 {broadcast.title}\n\n{broadcast.message_content}"
        messages = [temp_line_api.create_text_message(full_message)]
        
        if broadcast.image_url:
            messages.insert(0, temp_line_api.create_image_message(broadcast.image_url))
        
        # 發送訊息
        target_users = broadcast.target_users
        success_count = 0
        failure_count = 0
        
        # 分批發送（每次最多 500 人）
        batch_size = 500
        for i in range(0, len(target_users), batch_size):
            batch = target_users[i:i + batch_size]
            result = temp_line_api.multicast_message(batch, messages)
            
            if result.get('success'):
                success_count += len(batch)
            else:
                failure_count += len(batch)
        
        # 更新狀態
        from django.utils import timezone
        broadcast.status = 'sent'
        broadcast.sent_at = timezone.now()
        broadcast.recipient_count = len(target_users)
        broadcast.success_count = success_count
        broadcast.failure_count = failure_count
        broadcast.save()
        
        return Response({
            'message': '推播已發送',
            'recipient_count': len(target_users),
            'success_count': success_count,
            'failure_count': failure_count
        })
    
    @action(detail=False, methods=['get'])
    def get_personalized_targets(self, request):
        """
        根據篩選條件取得個人化推播的目標用戶
        
        Query Parameters:
            food_tags: 食物標籤列表（逗號分隔）
            days_inactive: 閒置天數（超過此天數未下單的用戶）
        """
        from apps.orders.models import TakeoutOrder, DineInOrder
        from apps.loyalty.models import CustomerLoyaltyAccount
        from django.utils import timezone
        from datetime import timedelta
        from collections import Counter
        
        user = request.user
        if not hasattr(user, 'merchant_profile') or not hasattr(user.merchant_profile, 'store'):
            return Response(
                {'error': '您沒有店家權限'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        store = user.merchant_profile.store
        
        # 解析篩選條件
        food_tags_param = request.query_params.get('food_tags', '')
        food_tags = [tag.strip() for tag in food_tags_param.split(',') if tag.strip()]
        days_inactive = int(request.query_params.get('days_inactive', 0))
        
        # 取得此店家的所有已綁定 LINE 的顧客
        # 透過 CustomerLoyaltyAccount 找到在此店家有消費記錄的用戶
        customer_accounts = CustomerLoyaltyAccount.objects.filter(store=store)
        
        target_users = []
        user_details = []
        
        for account in customer_accounts:
            customer = account.user
            
            # 檢查是否有綁定 LINE
            try:
                line_binding = LineUserBinding.objects.get(user=customer, is_active=True)
            except LineUserBinding.DoesNotExist:
                continue
            
            # 檢查閒置天數篩選
            if days_inactive > 0:
                # 取得最近訂單時間
                last_order_date = None
                
                takeout = TakeoutOrder.objects.filter(
                    user=customer, store=store
                ).order_by('-created_at').first()
                
                dinein = DineInOrder.objects.filter(
                    user=customer, store=store
                ).order_by('-created_at').first()
                
                if takeout:
                    last_order_date = takeout.created_at
                if dinein and (not last_order_date or dinein.created_at > last_order_date):
                    last_order_date = dinein.created_at
                
                if last_order_date:
                    days_since_order = (timezone.now() - last_order_date).days
                    if days_since_order < days_inactive:
                        continue  # 用戶還不夠閒置
            
            # 檢查食物標籤偏好篩選
            if food_tags:
                # 分析用戶的食物偏好（從訂單歷史）
                from apps.orders.models import TakeoutOrderItem, DineInOrderItem
                
                user_tags = Counter()
                
                # 外帶訂單項目
                takeout_items = TakeoutOrderItem.objects.filter(
                    order__user=customer,
                    order__store=store
                ).select_related('product')
                
                for item in takeout_items:
                    if item.product and item.product.food_tags:
                        for tag in item.product.food_tags:
                            user_tags[tag] += 1
                
                # 內用訂單項目
                dinein_items = DineInOrderItem.objects.filter(
                    order__user=customer,
                    order__store=store
                ).select_related('product')
                
                for item in dinein_items:
                    if item.product and item.product.food_tags:
                        for tag in item.product.food_tags:
                            user_tags[tag] += 1
                
                # 檢查是否有匹配的標籤
                if not any(tag in user_tags for tag in food_tags):
                    continue  # 沒有匹配的標籤偏好
            
            # 通過所有篩選，加入目標用戶
            target_users.append(line_binding.line_user_id)
            user_details.append({
                'line_user_id': line_binding.line_user_id,
                'display_name': line_binding.display_name,
                'username': customer.username,
                'total_points': account.total_points,
            })
        
        return Response({
            'target_count': len(target_users),
            'target_users': target_users,
            'user_details': user_details[:20],  # 只返回前 20 個用戶詳情作為預覽
            'filters_applied': {
                'food_tags': food_tags,
                'days_inactive': days_inactive,
            }
        })
    
    @action(detail=False, methods=['get'])
    def available_food_tags(self, request):
        """取得店家商品的所有食物標籤"""
        user = request.user
        if not hasattr(user, 'merchant_profile') or not hasattr(user.merchant_profile, 'store'):
            return Response(
                {'error': '您沒有店家權限'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        store = user.merchant_profile.store
        
        # 從店家商品收集所有食物標籤
        products = Product.objects.filter(store=store, is_available=True)
        all_tags = set()
        
        for product in products:
            if product.food_tags:
                for tag in product.food_tags:
                    all_tags.add(tag)
        
        return Response({
            'tags': sorted(list(all_tags)),
            'count': len(all_tags)
        })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bind_line_account(request):
    """
    綁定 LINE 帳號
    """
    line_user_id = request.data.get('line_user_id')
    
    if not line_user_id:
        return Response(
            {'error': '請提供 line_user_id'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # 檢查是否已綁定
    if LineUserBinding.objects.filter(line_user_id=line_user_id).exists():
        return Response(
            {'error': '此 LINE 帳號已被綁定'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # 取得 LINE 用戶資料（使用全域配置）
    temp_line_api = LineMessagingAPI()
    profile = temp_line_api.get_profile(line_user_id)
    
    if not profile:
        return Response(
            {'error': '無法取得 LINE 用戶資料'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # 建立綁定
    binding = LineUserBinding.objects.create(
        user=request.user,
        line_user_id=line_user_id,
        display_name=profile.get('displayName', ''),
        picture_url=profile.get('pictureUrl', '')
    )
    
    serializer = LineUserBindingSerializer(binding)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_line_binding(request):
    """
    取得當前用戶的 LINE 綁定資訊
    """
    try:
        binding = LineUserBinding.objects.get(user=request.user)
        serializer = LineUserBindingSerializer(binding)
        return Response(serializer.data)
    except LineUserBinding.DoesNotExist:
        return Response(
            {'message': '尚未綁定 LINE 帳號'},
            status=status.HTTP_404_NOT_FOUND
        )


class StoreLineBotConfigViewSet(viewsets.ModelViewSet):
    """
    店家 LINE BOT 設定 ViewSet
    """
    serializer_class = StoreLineBotConfigSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """只返回用戶擁有的店家的設定"""
        user = self.request.user
        # Store -> merchant -> user 的關聯
        store_ids = Store.objects.filter(merchant__user=user).values_list('id', flat=True)
        return StoreLineBotConfig.objects.filter(store_id__in=store_ids)
    
    def perform_create(self, serializer):
        """建立設定時驗證店家擁有權"""
        store = serializer.validated_data['store']
        if store.merchant.user != self.request.user:
            raise PermissionError('您沒有權限為此店家設定 LINE BOT')
        serializer.save()
    
    def perform_update(self, serializer):
        """更新設定時驗證店家擁有權"""
        store = serializer.validated_data.get('store', serializer.instance.store)
        if store.merchant.user != self.request.user:
            raise PermissionError('您沒有權限修改此店家的 LINE BOT 設定')
        serializer.save()


@csrf_exempt
@require_http_methods(["GET", "POST"])
def admin_store_line_config(request, store_id):
    """
    管理員設定店家 LINE BOT（GET 取得設定，POST 更新設定）
    """
    # 驗證管理員權限
    is_admin = request.headers.get('X-Admin-Auth') == 'true'
    if not is_admin:
        return JsonResponse({'detail': '需要管理員權限'}, status=403)
    
    # 取得店家
    try:
        store = Store.objects.get(pk=store_id)
    except Store.DoesNotExist:
        return JsonResponse({'detail': '店家不存在'}, status=404)
    
    # 取得或建立 LINE BOT 設定
    config, created = StoreLineBotConfig.objects.get_or_create(store=store)
    
    if request.method == 'GET':
        return JsonResponse({
            'store_id': store.id,
            'store_name': store.name,
            'line_channel_access_token_set': bool(config.line_channel_access_token),
            'line_channel_secret_set': bool(config.line_channel_secret),
            'invitation_url': config.invitation_url,
            'is_active': config.is_active,
            'welcome_message': config.welcome_message,
            'webhook_url': f'/api/line-bot/webhook/{store.id}/',
        })
    
    elif request.method == 'POST':
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'detail': '無效的 JSON'}, status=400)
        
        # 更新設定（管理員可設定的欄位）
        if 'line_channel_access_token' in data and data['line_channel_access_token']:
            config.line_channel_access_token = data['line_channel_access_token']
        if 'line_channel_secret' in data and data['line_channel_secret']:
            config.line_channel_secret = data['line_channel_secret']
        if 'invitation_url' in data:
            config.invitation_url = data.get('invitation_url', '')
        
        config.save()
        
        return JsonResponse({
            'message': 'LINE BOT 設定已更新',
            'store_id': store.id,
            'has_line_config': config.has_line_config(),
        })


@csrf_exempt
@require_http_methods(["POST"])
def webhook_by_store(request, store_id):
    """
    指定店家的 LINE Webhook 端點
    用於接收來自特定店家 LINE Channel 的事件
    """
    try:
        store = Store.objects.get(pk=store_id)
        config = StoreLineBotConfig.objects.get(store=store)
    except (Store.DoesNotExist, StoreLineBotConfig.DoesNotExist):
        # 即使沒有設定，也回傳 200 給 LINE 驗證
        return JsonResponse({'status': 'ok'})
    
    # 如果沒有設定 channel secret，直接回傳 200（用於 LINE 驗證）
    if not config.line_channel_secret:
        return JsonResponse({'status': 'ok'})
    
    # 驗證簽名
    signature = request.headers.get('X-Line-Signature', '')
    if signature and not verify_signature(request.body, signature, config.line_channel_secret):
        return HttpResponse('Invalid signature', status=403)
    
    # 處理事件
    try:
        body = json.loads(request.body.decode('utf-8'))
        events = body.get('events', [])
        
        # 如果沒有事件（LINE 驗證請求），直接回傳 200
        if not events:
            return JsonResponse({'status': 'ok'})
        
        # 檢查是否啟用
        if not config.is_active:
            return JsonResponse({'status': 'ok', 'message': 'Bot is disabled'})
        
        for event in events:
            handle_event(event, store_id)
        
        return JsonResponse({'status': 'ok'})
    except Exception as e:
        print(f"[LINE BOT] Error handling webhook for store {store_id}: {e}")
        # 即使有錯誤也回傳 200，避免 LINE 重試
        return JsonResponse({'status': 'ok'})


class MerchantLineBindingViewSet(viewsets.ViewSet):
    """
    店家 LINE 綁定 ViewSet
    處理店家 LINE 綁定、解綁及通知偏好設定
    """
    permission_classes = [IsAuthenticated]
    
    def _get_merchant(self, user):
        """取得當前用戶的 Merchant 資料"""
        try:
            return Merchant.objects.get(user=user)
        except Merchant.DoesNotExist:
            return None
    
    @action(detail=False, methods=['get'], url_path='status')
    def binding_status(self, request):
        """
        取得店家 LINE 綁定狀態
        GET /api/line-bot/merchant-binding/status/
        """
        merchant = self._get_merchant(request.user)
        if not merchant:
            return Response(
                {'detail': '您不是店家用戶'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            binding = MerchantLineBinding.objects.get(merchant=merchant)
            serializer = MerchantLineBindingSerializer(binding)
            return Response({
                'is_bound': True,
                **serializer.data
            })
        except MerchantLineBinding.DoesNotExist:
            return Response({
                'is_bound': False
            })
    
    @action(detail=False, methods=['post'], url_path='bind')
    def bind(self, request):
        """
        綁定店家 LINE 帳號
        POST /api/line-bot/merchant-binding/bind/
        
        Body:
            line_user_id: LINE User ID
            display_name: LINE 顯示名稱
            picture_url: LINE 頭像 URL
        """
        merchant = self._get_merchant(request.user)
        if not merchant:
            return Response(
                {'detail': '您不是店家用戶'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        line_user_id = request.data.get('line_user_id')
        display_name = request.data.get('display_name', '')
        picture_url = request.data.get('picture_url', '')
        
        if not line_user_id:
            return Response(
                {'detail': '缺少 LINE User ID'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 檢查是否已有其他店家綁定此 LINE ID
        existing = MerchantLineBinding.objects.filter(line_user_id=line_user_id).first()
        if existing and existing.merchant_id != merchant.user_id:
            return Response(
                {'detail': '此 LINE 帳號已被其他店家綁定'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 建立或更新綁定
        binding, created = MerchantLineBinding.objects.update_or_create(
            merchant=merchant,
            defaults={
                'line_user_id': line_user_id,
                'display_name': display_name,
                'picture_url': picture_url,
                'is_active': True,
            }
        )
        
        serializer = MerchantLineBindingSerializer(binding)
        return Response({
            'success': True,
            'message': 'LINE 帳號綁定成功',
            **serializer.data
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
    
    @action(detail=False, methods=['post'], url_path='unbind')
    def unbind(self, request):
        """
        解除店家 LINE 綁定
        POST /api/line-bot/merchant-binding/unbind/
        """
        merchant = self._get_merchant(request.user)
        if not merchant:
            return Response(
                {'detail': '您不是店家用戶'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            binding = MerchantLineBinding.objects.get(merchant=merchant)
            binding.delete()
            return Response({
                'success': True,
                'message': 'LINE 帳號已解除綁定'
            })
        except MerchantLineBinding.DoesNotExist:
            return Response(
                {'detail': '您尚未綁定 LINE 帳號'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=False, methods=['patch'], url_path='preferences')
    def update_preferences(self, request):
        """
        更新店家 LINE 通知偏好
        PATCH /api/line-bot/merchant-binding/preferences/
        
        Body (任一或多個):
            notify_schedule: boolean
            notify_analytics: boolean
            notify_inventory: boolean
            notify_order_alert: boolean
        """
        merchant = self._get_merchant(request.user)
        if not merchant:
            return Response(
                {'detail': '您不是店家用戶'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            binding = MerchantLineBinding.objects.get(merchant=merchant)
        except MerchantLineBinding.DoesNotExist:
            return Response(
                {'detail': '請先綁定 LINE 帳號'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = MerchantLineBindingPreferencesSerializer(
            binding,
            data=request.data,
            partial=True
        )
        
        if serializer.is_valid():
            serializer.save()
            full_serializer = MerchantLineBindingSerializer(binding)
            return Response({
                'success': True,
                'message': '通知偏好已更新',
                **full_serializer.data
            })
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PlatformBroadcastViewSet(viewsets.ModelViewSet):
    """
    平台推播 ViewSet
    提供平台管理員發送店家推薦、新店上架等推播訊息
    使用 X-Admin-Auth 標頭進行認證
    """
    queryset = PlatformBroadcast.objects.all()
    serializer_class = PlatformBroadcastSerializer
    permission_classes = [AllowAny]  # 使用 X-Admin-Auth 標頭認證
    
    def _is_admin(self, request):
        """檢查是否為管理員（X-Admin-Auth 標頭）"""
        is_admin_header = request.headers.get('X-Admin-Auth') == 'true'
        is_staff = hasattr(request, 'user') and request.user.is_authenticated and (request.user.is_staff or request.user.is_superuser)
        return is_admin_header or is_staff
    
    def get_queryset(self):
        """只有管理員可以看到平台推播"""
        if not self._is_admin(self.request):
            return PlatformBroadcast.objects.none()
        return PlatformBroadcast.objects.all()
    
    def perform_create(self, serializer):
        """建立推播時記錄建立者"""
        user = self.request.user
        if user.is_authenticated:
            serializer.save(created_by=user)
        else:
            serializer.save(created_by=None)
    
    @action(detail=False, methods=['get'])
    def available_stores(self, request):
        """取得可推薦的店家列表"""
        stores = Store.objects.filter(is_published=True)
        store_list = [
            {
                'id': store.id,
                'name': store.name,
                'cuisine_type': store.get_cuisine_type_display() if hasattr(store, 'get_cuisine_type_display') else store.cuisine_type,
            }
            for store in stores
        ]
        return Response({'stores': store_list, 'count': len(store_list)})
    
    @action(detail=False, methods=['get'])
    def target_preview(self, request):
        """預覽推播目標用戶數量"""
        # 取得所有已綁定 LINE 的用戶
        bindings = LineUserBinding.objects.filter(is_active=True)
        return Response({
            'total_users': bindings.count(),
            'sample_users': [
                {
                    'line_user_id': b.line_user_id,
                    'display_name': b.display_name,
                }
                for b in bindings[:10]
            ]
        })
    
    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        """發送平台推播"""
        from apps.intelligence.models import PlatformSettings
        from django.utils import timezone
        
        broadcast = self.get_object()
        
        if broadcast.status == 'sent':
            return Response(
                {'error': '此推播已發送'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 取得平台 LINE BOT 設定
        platform_settings = PlatformSettings.get_settings()
        if not platform_settings.has_line_bot_config():
            return Response(
                {'error': '平台 LINE BOT 尚未設定'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not platform_settings.is_line_bot_enabled:
            return Response(
                {'error': '平台 LINE BOT 未啟用'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 取得目標用戶
        if broadcast.target_all:
            bindings = LineUserBinding.objects.filter(is_active=True)
            target_users = [b.line_user_id for b in bindings]
        else:
            target_users = broadcast.target_users
        
        if not target_users:
            return Response(
                {'error': '沒有目標用戶'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 建立訊息
        message = f"📢 {broadcast.title}\n\n{broadcast.message_content}"
        
        # 如果有推薦店家，加入店家資訊
        recommended_stores = broadcast.recommended_stores.all()
        if recommended_stores:
            message += "\n\n🏪 推薦店家："
            for store in recommended_stores[:5]:  # 最多顯示 5 家
                message += f"\n• {store.name}"
        
        # 使用平台 LINE API 發送
        line_api = LineMessagingAPI()
        line_api.channel_access_token = platform_settings.line_bot_channel_access_token
        
        # 建立 LINE 訊息物件列表
        messages = [line_api.create_text_message(message)]
        
        success_count = 0
        failure_count = 0
        
        for user_id in target_users:
            try:
                result = line_api.push_message(user_id, messages)
                if result:
                    success_count += 1
                else:
                    print(f"[Platform Broadcast] Failed to send to {user_id}: push_message returned False")
                    failure_count += 1
            except Exception as e:
                print(f"[Platform Broadcast] Failed to send to {user_id}: {e}")
                failure_count += 1
        
        # 更新推播狀態
        broadcast.status = 'sent'
        broadcast.sent_at = timezone.now()
        broadcast.recipient_count = len(target_users)
        broadcast.success_count = success_count
        broadcast.failure_count = failure_count
        broadcast.save()
        
        return Response({
            'message': '推播已發送',
            'recipient_count': len(target_users),
            'success_count': success_count,
            'failure_count': failure_count
        })
