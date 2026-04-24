import hmac
import hashlib
import json
import base64
import re
from decimal import Decimal
from urllib.parse import parse_qs
from typing import Optional
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.conf import settings
from django.db.models import Count
from django.utils import timezone
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
from .services.message_handler import MessageHandler, AIReplyService
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
        handle_postback_event(event, store_id)


MEMBERSHIP_LEVEL_QUERY_KEYWORDS = [
    '會員等級',
    '會員級別',
    '我的等級',
    '等級',
    '會員',
    'memberlevel',
    'membership',
]


MERCHANT_OPERATIONS_QUERY_KEYWORDS = [
    '營運',
    '營運狀況',
    '營業狀況',
    '營運報表',
    '報表',
    '訂單統計',
    '訂單狀況',
    '訂單數',
    '捐款',
    '捐款金額',
    '公益點數',
]


def is_membership_level_query(message: str) -> bool:
    normalized = re.sub(r'\s+', '', (message or '').lower())
    return any(keyword in normalized for keyword in MEMBERSHIP_LEVEL_QUERY_KEYWORDS)


def is_merchant_operations_query(message: str) -> bool:
    normalized = re.sub(r'\s+', '', (message or '').lower())
    return any(keyword in normalized for keyword in MERCHANT_OPERATIONS_QUERY_KEYWORDS)


def build_membership_level_reply(store, line_user_id: str) -> Optional[str]:
    if not getattr(store, 'enable_loyalty', False):
        return None

    from apps.loyalty.models import CustomerLoyaltyAccount, MembershipLevel

    binding = (
        LineUserBinding.objects.filter(
            line_user_id=line_user_id,
            is_active=True,
        )
        .select_related('user')
        .first()
    )
    if not binding:
        return f"若要查詢 {store.name} 的會員等級，請先在 DineVerse 綁定目前這個 LINE 帳號。"

    account = (
        CustomerLoyaltyAccount.objects.filter(
            user=binding.user,
            store=store,
        )
        .select_related('current_level')
        .first()
    )
    if not account:
        return f"您目前還沒有 {store.name} 的會員紀錄，完成消費累積點數後就能查看會員等級。"

    current_level = account.current_level
    current_level_name = current_level.name if current_level else '一般會員'

    lines = [
        f"{store.name} 會員資訊",
        '',
        f"目前等級：{current_level_name}",
        f"累積點數：{account.total_points}",
        f"可用點數：{account.available_points}",
    ]

    if current_level and current_level.benefits:
        lines.append(f"會員權益：{current_level.benefits}")

    next_level = (
        MembershipLevel.objects.filter(
            store=store,
            active=True,
            threshold_points__gt=account.total_points,
        )
        .order_by('threshold_points', 'rank')
        .first()
    )
    if next_level:
        needed_points = max(next_level.threshold_points - account.total_points, 0)
        lines.append(f"下一級：{next_level.name}（再 {needed_points} 點）")

    return '\n'.join(lines)


def build_store_business_info_text(store) -> str:
    opening_hours_text = AIReplyService._format_opening_hours(getattr(store, 'opening_hours', None))
    service_labels = []
    if getattr(store, 'enable_takeout', False):
        service_labels.append('外帶')
    if getattr(store, 'enable_reservation', False):
        service_labels.append('訂位')
    if getattr(store, 'enable_loyalty', False):
        service_labels.append('會員')
    if getattr(store, 'enable_surplus_food', False):
        service_labels.append('惜食')

    services_text = '、'.join(service_labels) if service_labels else '未啟用額外服務'
    status_text = '營業中' if getattr(store, 'is_open', False) else '休息中'
    fixed_holidays = getattr(store, 'fixed_holidays', '') or '未提供'
    phone = getattr(store, 'phone', '') or '未提供'
    address = getattr(store, 'address', '') or '未提供'

    return (
        f"店家資訊\n"
        f"店名：{store.name}\n"
        f"目前狀態：{status_text}\n"
        f"電話：{phone}\n"
        f"地址：{address}\n"
        f"營業時間：\n{opening_hours_text}\n"
        f"固定休息日：{fixed_holidays}\n"
        f"可用服務：{services_text}"
    )


def build_merchant_operations_reply(line_user_id: str) -> Optional[str]:
    merchant_binding = (
        MerchantLineBinding.objects.filter(
            line_user_id=line_user_id,
            is_active=True,
        )
        .select_related('merchant__user')
        .first()
    )
    user_binding = (
        LineUserBinding.objects.filter(
            line_user_id=line_user_id,
            is_active=True,
        )
        .select_related('user')
        .first()
    )

    if not merchant_binding:
        return None

    if not user_binding or user_binding.current_mode != 'merchant':
        return '目前不是店家模式，先輸入「切換」切到店家模式後，就可以查詢營運資訊。'

    merchant = merchant_binding.merchant
    if not hasattr(merchant, 'store'):
        return '目前找不到店家資料，請先完成店家設定。'

    store = merchant.store

    from apps.orders.models import TakeoutOrder, DineInOrder
    from apps.surplus_food.models import SurplusFoodOrder
    from apps.loyalty.models import CustomerLoyaltyAccount

    now = timezone.now()
    today = now.date()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    takeout_qs = TakeoutOrder.objects.filter(store=store)
    dinein_qs = DineInOrder.objects.filter(store=store)
    surplus_qs = SurplusFoodOrder.objects.filter(store=store)

    today_takeout = takeout_qs.filter(created_at__date=today).exclude(status='rejected').count()
    today_dinein = dinein_qs.filter(created_at__date=today).exclude(status='rejected').count()
    today_surplus = surplus_qs.filter(created_at__date=today).exclude(status__in=['rejected', 'cancelled', 'expired']).count()

    pending_takeout = takeout_qs.filter(status='pending').count()
    pending_dinein = dinein_qs.filter(status='pending').count()
    pending_surplus = surplus_qs.filter(status='pending').count()

    monthly_takeout = takeout_qs.filter(created_at__gte=month_start).exclude(status='rejected').count()
    monthly_dinein = dinein_qs.filter(created_at__gte=month_start).exclude(status='rejected').count()
    monthly_surplus = surplus_qs.filter(created_at__gte=month_start).exclude(status__in=['rejected', 'cancelled', 'expired']).count()

    completed_surplus_orders = store.surplus_completed_order_count_total or 0
    completed_surplus_revenue = Decimal(str(store.surplus_completed_revenue_total or 0))
    donation_amount = (completed_surplus_revenue * Decimal('0.6')).quantize(Decimal('0.01'))
    active_members = CustomerLoyaltyAccount.objects.filter(store=store).count() if getattr(store, 'enable_loyalty', False) else 0

    return (
        f"{store.name} 營運摘要\n\n"
        f"店家狀態：{'營業中' if store.is_open else '休息中'} / {'已上架' if store.is_published else '未上架'}\n"
        f"今日訂單：外帶 {today_takeout}、內用 {today_dinein}、惜食 {today_surplus}\n"
        f"待處理訂單：外帶 {pending_takeout}、內用 {pending_dinein}、惜食 {pending_surplus}\n"
        f"本月訂單：外帶 {monthly_takeout}、內用 {monthly_dinein}、惜食 {monthly_surplus}\n"
        f"惜食完成單：{completed_surplus_orders}\n"
        f"累積惜食營收：NT$ {completed_surplus_revenue:,.0f}\n"
        f"累積捐款金額：NT$ {donation_amount:,.0f}\n"
        f"會員人數：{active_members}"
    )


def reactivate_line_bindings(line_user_id: str):
    LineUserBinding.objects.filter(
        line_user_id=line_user_id,
        is_active=False,
    ).update(is_active=True)
    MerchantLineBinding.objects.filter(
        line_user_id=line_user_id,
        is_active=False,
    ).update(is_active=True)


def claim_platform_coupon_for_line_user(line_user_id: str, coupon_token: str):
    from apps.loyalty.models import PlatformCoupon, UserPlatformCoupon

    binding = (
        LineUserBinding.objects.filter(
            line_user_id=line_user_id,
            is_active=True,
            current_mode='customer',
        )
        .select_related('user')
        .first()
    )
    if not binding:
        return False, '找不到綁定的 DineVerse 會員帳戶，請先完成 LINE 綁定。'

    try:
        coupon = PlatformCoupon.objects.get(
            claim_token=coupon_token,
            is_active=True,
        )
    except PlatformCoupon.DoesNotExist:
        return False, '這張優惠券目前無法領取。'

    if coupon.expires_at <= timezone.now():
        return False, '這張優惠券已過期，無法領取。'

    user_coupon, created = UserPlatformCoupon.objects.get_or_create(
        user=binding.user,
        coupon=coupon,
        defaults={'status': 'claimed'},
    )
    if created:
        return True, f"已成功領取「{coupon.title}」，優惠券已存入個人資料中的優惠券存放處。"

    return True, f"您已經領取過「{coupon.title}」，可前往個人資料中的優惠券存放處查看。"


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
            if user_message.strip() in ['綁定狀態', '推播狀態', 'debug', 'Debug']:
                user_binding = LineUserBinding.objects.filter(line_user_id=line_user_id).first()
                masked_line_user_id = f"{line_user_id[:6]}...{line_user_id[-4:]}" if line_user_id else 'N/A'

                if user_binding:
                    binding_info = (
                        f"綁定帳號：{user_binding.user.username}\n"
                        f"顯示名稱：{user_binding.display_name or '未設定'}\n"
                        f"目前模式：{user_binding.current_mode}\n"
                        f"個人化推薦：{'開啟' if user_binding.notify_personalized_recommendation else '關閉'}\n"
                        f"交易通知：{'開啟' if user_binding.notify_transactional_notifications else '關閉'}"
                    )
                else:
                    binding_info = '找不到此 LINE 帳號對應的綁定資料，請重新綁定。'

                debug_reply = (
                    "🧪 推播診斷資訊\n\n"
                    f"LINE User ID：{masked_line_user_id}\n"
                    f"平台 BOT 啟用：{'是' if platform_settings.is_line_bot_enabled else '否'}\n"
                    f"個人化推薦總開關：{'是' if platform_settings.is_personalized_recommendation_enabled else '否'}\n"
                    f"BOT 設定完整：{'是' if platform_settings.has_line_bot_config() else '否'}\n\n"
                    f"{binding_info}"
                )

                messages = [temp_line_api.create_text_message(debug_reply)]
                temp_line_api.reply_message(reply_token, messages)
                return

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
            merchant_operations_reply = None
            if is_merchant_operations_query(user_message):
                merchant_operations_reply = build_merchant_operations_reply(line_user_id)

            if merchant_operations_reply:
                messages = [temp_line_api.create_text_message(merchant_operations_reply)]
                temp_line_api.reply_message(reply_token, messages)
                return

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

        membership_reply = None
        if is_membership_level_query(user_message):
            membership_reply = build_membership_level_reply(store, line_user_id)

        if membership_reply:
            ConversationLog.objects.create(
                store=store,
                line_user_id=line_user_id,
                sender_type='user',
                message_type='text',
                message_content=user_message,
                reply_token=reply_token
            )
            ConversationLog.objects.create(
                store=store,
                line_user_id=line_user_id,
                sender_type='bot',
                message_type='text',
                message_content=membership_reply,
                used_ai=False,
            )
            line_api = LineMessagingAPI(bot_config)
            line_api.reply_message(reply_token, [line_api.create_text_message(membership_reply)])
            return
        
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

    reactivate_line_bindings(line_user_id)
    
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
                messages = [
                    line_api.create_text_message(welcome_text),
                    line_api.create_text_message(build_store_business_info_text(bot_config.store)),
                ]
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
    
    messages = locals().get('messages') or [line_api.create_text_message(welcome_text)]
    replied = bool(reply_token) and line_api.reply_message(reply_token, messages)
    if not replied:
        line_api.push_message(line_user_id, messages)


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


def handle_postback_event(event: dict, store_id: int = None):
    """
    處理 Postback 事件（按鈕點擊等）
    
    Args:
        event: LINE postback 事件
    """
    line_user_id = event['source']['userId']
    reply_token = event.get('replyToken')
    postback_data = event.get('postback', {}).get('data', '')

    if not postback_data:
        return

    payload = {key: values[-1] for key, values in parse_qs(postback_data).items() if values}
    action = payload.get('action')

    if action != 'claim_platform_coupon':
        return

    coupon_token = payload.get('token', '').strip()
    if not coupon_token:
        reply_text = '缺少優惠券領取資訊，請稍後再試一次。'
    else:
        _, reply_text = claim_platform_coupon_for_line_user(line_user_id, coupon_token)

    if store_id:
        bot_config = StoreLineBotConfig.objects.filter(store_id=store_id, is_active=True).first()
        line_api = LineMessagingAPI(bot_config) if bot_config else LineMessagingAPI()
    else:
        from apps.intelligence.models import PlatformSettings

        platform_settings = PlatformSettings.get_settings()
        line_api = LineMessagingAPI()
        line_api.channel_access_token = platform_settings.line_bot_channel_access_token
    if reply_token:
        line_api.reply_message(reply_token, [line_api.create_text_message(reply_text)])


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

        if broadcast.coupon_id:
            coupon = broadcast.coupon
            coupon_summary = (
                f"優惠券：{coupon.title}\n"
                f"折抵方式：{coupon.get_discount_type_display()} {coupon.discount_value}\n"
                f"最低消費：NT$ {coupon.min_order_amount}\n"
                f"到期時間：{coupon.expires_at.strftime('%Y-%m-%d %H:%M')}"
            )
            if coupon.max_discount_amount:
                coupon_summary += f"\n最高折抵：NT$ {coupon.max_discount_amount}"

            messages.append(temp_line_api.create_text_message(coupon_summary))
            messages.append(
                temp_line_api.create_template_buttons(
                    alt_text=f"{coupon.title} 領券通知",
                    title='立即領券',
                    text='點擊下方按鈕，將優惠券存入個人資料的優惠券存放處。',
                    actions=[
                        {
                            'type': 'postback',
                            'label': '領取優惠券',
                            'data': f'action=claim_platform_coupon&token={coupon.claim_token}',
                            'displayText': '我要領取這張優惠券',
                        }
                    ],
                )
            )
        
        # 發送訊息
        target_users = broadcast.target_users
        original_target_count = len(target_users)

        allowed_binding_qs = LineUserBinding.objects.filter(
            line_user_id__in=target_users,
            is_active=True,
            current_mode='customer',
        )
        if broadcast.broadcast_type != 'loyalty':
            allowed_binding_qs = allowed_binding_qs.filter(
                notify_personalized_recommendation=True,
            )

        allowed_users = set(
            allowed_binding_qs.values_list('line_user_id', flat=True)
        )
        target_users = [line_user_id for line_user_id in target_users if line_user_id in allowed_users]

        if not target_users:
            empty_reason = '目標用戶皆已關閉個人化推薦通知，未發送推播'
            if broadcast.broadcast_type == 'loyalty':
                empty_reason = '找不到可接收會員優惠的綁定 LINE 會員'
            return Response(
                {'error': empty_reason},
                status=status.HTTP_400_BAD_REQUEST
            )

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
            'skipped_by_preference': max(0, original_target_count - len(target_users)),
            'success_count': success_count,
            'failure_count': failure_count
        })

    @action(detail=False, methods=['get'], url_path='membership-levels')
    def membership_levels(self, request):
        from apps.loyalty.models import MembershipLevel

        user = request.user
        if not hasattr(user, 'merchant_profile') or not hasattr(user.merchant_profile, 'store'):
            return Response(
                {'error': '只有商家可以查詢會員等級'},
                status=status.HTTP_403_FORBIDDEN
            )

        store = user.merchant_profile.store
        if not store.enable_loyalty:
            return Response({
                'loyalty_enabled': False,
                'levels': [],
            })

        levels = MembershipLevel.objects.filter(
            store=store,
            active=True,
        ).order_by('rank', 'threshold_points')

        return Response({
            'loyalty_enabled': True,
            'levels': [
                {
                    'id': level.id,
                    'name': level.name,
                    'threshold_points': level.threshold_points,
                    'discount_percent': level.discount_percent,
                    'benefits': level.benefits,
                }
                for level in levels
            ],
        })

    @action(detail=False, methods=['get'], url_path='membership-targets')
    def membership_targets(self, request):
        from apps.loyalty.models import CustomerLoyaltyAccount

        user = request.user
        if not hasattr(user, 'merchant_profile') or not hasattr(user.merchant_profile, 'store'):
            return Response(
                {'error': '只有商家可以查詢會員目標'},
                status=status.HTTP_403_FORBIDDEN
            )

        store = user.merchant_profile.store
        if not store.enable_loyalty:
            return Response({
                'loyalty_enabled': False,
                'target_count': 0,
                'target_users': [],
                'user_details': [],
            })

        level_ids_param = request.query_params.get('level_ids', '')
        level_ids = [
            int(level_id)
            for level_id in level_ids_param.split(',')
            if level_id.strip().isdigit()
        ]

        accounts = CustomerLoyaltyAccount.objects.filter(store=store).select_related(
            'user',
            'current_level',
        )
        if level_ids:
            accounts = accounts.filter(current_level_id__in=level_ids)

        bindings = LineUserBinding.objects.filter(
            user_id__in=accounts.values_list('user_id', flat=True),
            is_active=True,
            current_mode='customer',
        ).select_related('user')
        binding_map = {binding.user_id: binding for binding in bindings}

        target_users = []
        user_details = []
        for account in accounts:
            binding = binding_map.get(account.user_id)
            if not binding:
                continue
            target_users.append(binding.line_user_id)
            user_details.append({
                'line_user_id': binding.line_user_id,
                'display_name': binding.display_name,
                'username': account.user.username,
                'current_level_name': account.current_level.name if account.current_level else '一般會員',
                'available_points': account.available_points,
                'total_points': account.total_points,
            })

        return Response({
            'loyalty_enabled': True,
            'selected_level_ids': level_ids,
            'target_count': len(target_users),
            'target_users': target_users,
            'user_details': user_details[:20],
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

            if not line_binding.notify_personalized_recommendation:
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

    def _get_popular_recommended_stores(self, limit=5):
        """熱門店家：依惜福品累積捐款金額與完成訂單數排序。"""
        return list(
            Store.objects.filter(is_published=True)
            .order_by('-surplus_completed_revenue_total', '-surplus_completed_order_count_total', '-created_at')[:limit]
        )

    def _get_personalized_recommended_stores(self, user, limit=5):
        """個人化店家：依用戶歷史訂單店家偏好排序。"""
        from apps.orders.models import DineInOrder, TakeoutOrder
        from apps.surplus_food.models import SurplusFoodOrder

        store_scores = {}

        takeout_stats = TakeoutOrder.objects.filter(user=user).exclude(status='rejected').values('store_id').annotate(order_count=Count('id'))
        dinein_stats = DineInOrder.objects.filter(user=user).exclude(status='rejected').values('store_id').annotate(order_count=Count('id'))
        surplus_stats = SurplusFoodOrder.objects.filter(user=user).exclude(status__in=['rejected', 'cancelled', 'expired']).values('store_id').annotate(order_count=Count('id'))

        for row in takeout_stats:
            store_scores[row['store_id']] = store_scores.get(row['store_id'], 0) + row['order_count']
        for row in dinein_stats:
            store_scores[row['store_id']] = store_scores.get(row['store_id'], 0) + row['order_count']
        for row in surplus_stats:
            store_scores[row['store_id']] = store_scores.get(row['store_id'], 0) + row['order_count']

        if not store_scores:
            return []

        ranked_store_ids = [
            store_id
            for store_id, _ in sorted(store_scores.items(), key=lambda item: item[1], reverse=True)
        ]

        stores = Store.objects.filter(id__in=ranked_store_ids, is_published=True)
        store_by_id = {store.id: store for store in stores}
        return [store_by_id[store_id] for store_id in ranked_store_ids if store_id in store_by_id][:limit]

    def _build_recommendation_message(self, title, intro, stores, include_popularity_metrics=False):
        if not stores:
            return None

        lines = [title, '', intro]
        for store in stores:
            if include_popularity_metrics:
                donation_amount = float(store.surplus_completed_revenue_total or 0) * 0.6
                completed_orders = store.surplus_completed_order_count_total or 0
                lines.append(
                    f"• {store.name}（捐款 NT$ {donation_amount:,.0f} / 完成單 {completed_orders}）"
                )
            else:
                lines.append(f"• {store.name}")

        return "\n".join(lines)
    
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
        bindings = LineUserBinding.objects.filter(
            is_active=True,
            current_mode='customer',
        )
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
            bindings = LineUserBinding.objects.filter(
                is_active=True,
                current_mode='customer',
            )
        else:
            bindings = LineUserBinding.objects.filter(
                line_user_id__in=broadcast.target_users,
                is_active=True,
                current_mode='customer',
            )
        target_users = [b.line_user_id for b in bindings]
        
        if not target_users:
            return Response(
                {'error': '沒有目標用戶'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 使用平台 LINE API 發送
        line_api = LineMessagingAPI()
        line_api.channel_access_token = platform_settings.line_bot_channel_access_token
        
        success_count = 0
        failure_count = 0

        selected_stores = list(broadcast.recommended_stores.all())
        popular_stores = selected_stores if selected_stores else self._get_popular_recommended_stores(limit=5)
        coupon = broadcast.coupon
        
        for user_id in target_users:
            try:
                messages = []

                if broadcast.broadcast_type == 'store_recommendation':
                    line_binding = LineUserBinding.objects.filter(line_user_id=user_id, is_active=True).select_related('user').first()

                    if (
                        platform_settings.is_personalized_recommendation_enabled
                        and line_binding
                        and line_binding.notify_personalized_recommendation
                    ):
                        personalized_stores = self._get_personalized_recommended_stores(line_binding.user, limit=5)
                        personalized_message = self._build_recommendation_message(
                            title='🎯 個人化推薦店家',
                            intro=broadcast.message_content or '根據你的訂單行為，我們推薦以下店家：',
                            stores=personalized_stores,
                            include_popularity_metrics=False,
                        )
                        if personalized_message:
                            messages.append(line_api.create_text_message(personalized_message))

                    popular_message = self._build_recommendation_message(
                        title='🔥 熱門店家推薦',
                        intro='以下是目前高捐款金額與高訂單量的熱門店家：',
                        stores=popular_stores,
                        include_popularity_metrics=True,
                    )
                    if popular_message:
                        messages.append(line_api.create_text_message(popular_message))
                elif broadcast.broadcast_type == 'promotion':
                    promotion_message = f"🎁 {broadcast.title}\n\n{broadcast.message_content}"
                    if coupon:
                        promotion_message += (
                            f"\n\n優惠券代碼：{coupon.code}"
                            f"\n優惠內容：{coupon.get_discount_type_display()} {coupon.discount_value}"
                            f"\n最低消費：NT$ {coupon.min_order_amount}"
                            f"\n使用期限：{coupon.expires_at.strftime('%Y-%m-%d %H:%M')}"
                        )
                        if coupon.max_discount_amount:
                            promotion_message += f"\n最高折抵：NT$ {coupon.max_discount_amount}"
                    messages.append(line_api.create_text_message(promotion_message))

                    if coupon:
                        button_title = coupon.title[:40]
                        button_text = '點擊下方按鈕即可直接領取，優惠券會自動存入 DineVerse 個人資料。'
                        messages.append(
                            line_api.create_template_buttons(
                                alt_text=f"{coupon.title} 領券按鈕",
                                title=button_title,
                                text=button_text[:60],
                                actions=[
                                    {
                                        'type': 'postback',
                                        'label': '立即領券',
                                        'data': f"action=claim_platform_coupon&token={coupon.claim_token}",
                                        'displayText': '我要領取這張優惠券',
                                    }
                                ],
                            )
                        )

                if not messages:
                    fallback_message = f"📢 {broadcast.title}\n\n{broadcast.message_content}"
                    if selected_stores:
                        fallback_message += "\n\n🏪 推薦店家："
                        for store in selected_stores[:5]:
                            fallback_message += f"\n• {store.name}"
                    messages = [line_api.create_text_message(fallback_message)]

                result = line_api.push_message(user_id, messages[:5])
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
