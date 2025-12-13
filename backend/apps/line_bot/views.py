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
from rest_framework.permissions import IsAuthenticated
from apps.stores.models import Store
from .models import LineUserBinding, StoreFAQ, ConversationLog, BroadcastMessage, StoreLineBotConfig
from .serializers import (
    LineUserBindingSerializer,
    StoreFAQSerializer,
    ConversationLogSerializer,
    BroadcastMessageSerializer,
    BroadcastMessageCreateSerializer,
    StoreLineBotConfigSerializer
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
    
    # 從資料庫取得第一個啟用的店家配置（用於簽名驗證）
    try:
        bot_config = StoreLineBotConfig.objects.filter(is_active=True).first()
        if not bot_config:
            if settings.DEBUG:
                print("[LINE Webhook] No active StoreLineBotConfig found!")
            return HttpResponse(status=403)
        
        channel_secret = bot_config.line_channel_secret
        if not channel_secret:
            if settings.DEBUG:
                print("[LINE Webhook] Channel Secret is empty in database!")
            return HttpResponse(status=403)
            
        if settings.DEBUG:
            print(f"[LINE Webhook] Using channel secret from database (length: {len(channel_secret)})")
            
    except Exception as e:
        if settings.DEBUG:
            print(f"[LINE Webhook] Error getting config: {e}")
        return HttpResponse(status=403)
    
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


def handle_event(event: dict):
    """
    處理單一 LINE 事件
    
    Args:
        event: LINE 事件物件
    """
    event_type = event.get('type')
    
    if event_type == 'message':
        handle_message_event(event)
    elif event_type == 'follow':
        handle_follow_event(event)
    elif event_type == 'unfollow':
        handle_unfollow_event(event)
    elif event_type == 'postback':
        handle_postback_event(event)


def handle_message_event(event: dict):
    """
    處理訊息事件
    
    Args:
        event: LINE 訊息事件
    """
    message = event.get('message', {})
    message_type = message.get('type')
    
    if message_type != 'text':
        # 目前只處理文字訊息
        return
    
    line_user_id = event['source']['userId']
    user_message = message.get('text', '')
    reply_token = event.get('replyToken')
    
    # 簡化版：使用第一個啟用的店家配置
    # 未來可以透過 Channel ID 或其他方式識別多店家
    try:
        # 取得第一個啟用的店家配置
        bot_config = StoreLineBotConfig.objects.filter(is_active=True).first()
        
        if not bot_config:
            raise StoreLineBotConfig.DoesNotExist
        
        store = bot_config.store
        
        if settings.DEBUG:
            print(f"[LINE Webhook] Store: {store.name}")
            print(f"[LINE Webhook] Message: {user_message}")
        
        # 初始化店家專屬的服務
        line_api = LineMessagingAPI(bot_config)
        message_handler = MessageHandler(bot_config)
        
        store_info = {
            'id': store.id,
            'name': store.name,
            'cuisine_type': store.get_cuisine_type_display(),
            'address': store.address,
            'phone': store.phone,
            'opening_hours': store.opening_hours,
            'description': store.description,
        }
        
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


def handle_follow_event(event: dict):
    """
    處理用戶加入好友事件
    
    Args:
        event: LINE follow 事件
    """
    line_user_id = event['source']['userId']
    reply_token = event.get('replyToken')
    
    # 使用全域配置取得用戶資料
    temp_line_api = LineMessagingAPI()
    profile = temp_line_api.get_profile(line_user_id)
    
    # 歡迎訊息
    welcome_text = f"""歡迎加入 DineVerse！👋

感謝您成為我們的好友！

請先完成帳號綁定，即可開始使用所有功能。"""
    
    messages = [temp_line_api.create_text_message(welcome_text)]
    temp_line_api.reply_message(reply_token, messages)


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
        
        # 準備訊息
        messages = [temp_line_api.create_text_message(broadcast.message_content)]
        
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

