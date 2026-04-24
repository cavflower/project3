import logging

from apps.intelligence.models import PlatformSettings
from apps.line_bot.models import LineUserBinding, MerchantLineBinding
from apps.line_bot.services.line_api import LineMessagingAPI

logger = logging.getLogger(__name__)


def _is_line_user_in_mode(line_user_id, expected_mode):
    """Return True when the linked user is in expected LINE mode.

    If no customer binding exists for this LINE user, allow delivery.
    This keeps merchant-only bindings working while enforcing mode for dual-role users.
    """
    line_binding = LineUserBinding.objects.filter(
        line_user_id=line_user_id,
        is_active=True,
    ).first()
    if not line_binding:
        return True
    return line_binding.current_mode == expected_mode


def send_platform_line_order_pickup_ready_notification(order, order_type_label, order_number):
    """Send automatic platform LINE notification when an order becomes pickup-ready."""
    user = getattr(order, 'user', None)
    if not user:
        return

    binding = LineUserBinding.objects.filter(user=user, is_active=True).first()
    if not binding:
        return

    if not binding.notify_transactional_notifications:
        return

    # 顧客取餐通知只在顧客模式下發送，避免與店家模式通知互相干擾。
    if binding.current_mode != 'customer':
        return

    settings = PlatformSettings.get_settings()
    if not settings.is_line_bot_enabled or not settings.has_line_bot_config():
        return

    store_name = getattr(getattr(order, 'store', None), 'name', '店家')

    message = (
        f"✅ 取餐通知\n\n"
        f"{store_name} 的{order_type_label}訂單已可取餐\n"
        f"訂單編號：{order_number}\n\n"
        f"謝謝你的訂購，歡迎再次使用 DineVerse！"
    )

    line_api = LineMessagingAPI()
    line_api.channel_access_token = settings.line_bot_channel_access_token

    try:
        line_api.push_message(binding.line_user_id, [line_api.create_text_message(message)])
    except Exception as exc:
        logger.warning('Failed to send platform LINE pickup-ready notification: %s', exc)


def send_platform_line_order_cancelled_notification(order, order_type_label, order_number):
    """Send automatic platform LINE notification when an order is cancelled/rejected."""
    user = getattr(order, 'user', None)
    if not user:
        return

    binding = LineUserBinding.objects.filter(user=user, is_active=True).first()
    if not binding:
        return

    if not binding.notify_transactional_notifications:
        return

    # 顧客交易通知只在顧客模式下發送，避免與店家模式通知互相干擾。
    if binding.current_mode != 'customer':
        return

    settings = PlatformSettings.get_settings()
    if not settings.is_line_bot_enabled or not settings.has_line_bot_config():
        return

    store_name = getattr(getattr(order, 'store', None), 'name', '店家')
    status = getattr(order, 'status', '')

    try:
        status_display = order.get_status_display()
    except Exception:
        status_display = status or '已取消'

    if status in {'rejected', 'cancelled'}:
        status_display = '已取消'

    message = (
        f"❌ 訂單取消通知\n\n"
        f"{store_name} 的{order_type_label}訂單已取消\n"
        f"訂單編號：{order_number}\n"
        f"目前狀態：{status_display}\n\n"
        f"如有疑問請直接聯繫店家。"
    )

    line_api = LineMessagingAPI()
    line_api.channel_access_token = settings.line_bot_channel_access_token

    try:
        line_api.push_message(binding.line_user_id, [line_api.create_text_message(message)])
    except Exception as exc:
        logger.warning('Failed to send platform LINE cancelled notification: %s', exc)


def send_platform_line_new_order_to_merchant_notification(order, order_type_label, order_number):
    """Send automatic platform LINE notification to merchant when a new order is created."""
    store = getattr(order, 'store', None)
    if not store:
        return

    merchant = getattr(store, 'merchant', None)
    if not merchant:
        return

    merchant_binding = MerchantLineBinding.objects.filter(
        merchant=merchant,
        is_active=True,
    ).first()
    if not merchant_binding:
        return

    if not merchant_binding.notify_order_alert:
        return

    # 店家新訂單通知僅在店家模式下發送，避免顧客模式收到商務通知。
    if not _is_line_user_in_mode(merchant_binding.line_user_id, 'merchant'):
        return

    settings = PlatformSettings.get_settings()
    if not settings.is_line_bot_enabled or not settings.has_line_bot_config():
        return

    customer_name = getattr(order, 'customer_name', '') or '顧客'
    message = (
        f"🔔 新訂單通知\n\n"
        f"{store.name} 收到一筆{order_type_label}訂單\n"
        f"訂單編號：{order_number}\n"
        f"顧客：{customer_name}\n\n"
        f"請至商家後台盡快確認訂單。"
    )

    line_api = LineMessagingAPI()
    line_api.channel_access_token = settings.line_bot_channel_access_token

    try:
        line_api.push_message(merchant_binding.line_user_id, [line_api.create_text_message(message)])
    except Exception as exc:
        logger.warning('Failed to send merchant new-order LINE notification: %s', exc)
