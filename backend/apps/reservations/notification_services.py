import logging

from apps.intelligence.models import PlatformSettings
from apps.line_bot.models import LineUserBinding
from apps.line_bot.services.line_api import LineMessagingAPI
from apps.users.models import User

logger = logging.getLogger(__name__)


def _resolve_customer_user_id(reservation):
    if reservation.user_id:
        return reservation.user_id

    customer_email = (reservation.customer_email or '').strip()
    if customer_email:
        user_id = User.objects.filter(
            email__iexact=customer_email,
            user_type='customer',
        ).values_list('id', flat=True).first()
        if user_id:
            return user_id

    customer_phone = (reservation.customer_phone or '').strip()
    if customer_phone:
        return User.objects.filter(
            phone_number=customer_phone,
            user_type='customer',
        ).values_list('id', flat=True).first()

    return None


def _get_customer_line_binding(reservation):
    user_id = _resolve_customer_user_id(reservation)
    if not user_id:
        return None

    binding = LineUserBinding.objects.filter(user_id=user_id, is_active=True).first()
    if not binding:
        return None

    if not binding.notify_transactional_notifications:
        return None

    # 顧客端訂位通知只在顧客模式發送。
    if binding.current_mode != 'customer':
        return None

    return binding


def _build_line_api():
    settings = PlatformSettings.get_settings()
    if not settings.is_line_bot_enabled or not settings.has_line_bot_config():
        return None

    line_api = LineMessagingAPI()
    line_api.channel_access_token = settings.line_bot_channel_access_token
    return line_api


def create_platform_reservation_notification(reservation, title, message):
    """Create an in-app notification for logged-in reservation customers."""
    user_id = _resolve_customer_user_id(reservation)
    if not user_id:
        return

    try:
        from apps.orders.models import Notification

        Notification.objects.create(
            user_id=user_id,
            title=title,
            message=message,
            notification_type='system',
            order_number=reservation.reservation_number,
            content_object=reservation,
        )
    except Exception as exc:
        logger.warning('Failed to create reservation platform notification: %s', exc)


def _build_reservation_summary(reservation):
    store_name = getattr(getattr(reservation, 'store', None), 'name', '店家')
    reservation_date = reservation.reservation_date.strftime('%Y/%m/%d')
    total_party_size = (reservation.party_size or 0) + (reservation.children_count or 0)

    lines = [
        f"店家：{store_name}",
        f"訂位編號：{reservation.reservation_number}",
        f"日期：{reservation_date}",
        f"時段：{reservation.time_slot}",
        f"人數：{total_party_size} 人",
    ]
    return "\n".join(lines)


def send_platform_line_reservation_created_notification(reservation):
    binding = _get_customer_line_binding(reservation)
    if not binding:
        return

    line_api = _build_line_api()
    if not line_api:
        return

    message = (
        "📝 訂位已成立（待店家確認）\n\n"
        f"{_build_reservation_summary(reservation)}\n\n"
        "我們會在店家確認後，第一時間通知你。"
    )

    try:
        line_api.push_message(binding.line_user_id, [line_api.create_text_message(message)])
    except Exception as exc:
        logger.warning('Failed to send reservation-created LINE notification: %s', exc)


def send_platform_line_reservation_confirmed_notification(reservation):
    binding = _get_customer_line_binding(reservation)
    if not binding:
        return

    line_api = _build_line_api()
    if not line_api:
        return

    table_label = (reservation.table_label or '').strip() or '未指定'

    message_lines = [
        '✅ 訂位已確認',
        '',
        _build_reservation_summary(reservation),
        f'桌位：{table_label}',
    ]

    merchant_note = (reservation.merchant_note or '').strip()
    if merchant_note:
        message_lines.extend(['', f'店家備註：{merchant_note}'])

    message_lines.extend(['', '歡迎準時蒞臨，祝你用餐愉快！'])
    message = "\n".join(message_lines)

    try:
        line_api.push_message(binding.line_user_id, [line_api.create_text_message(message)])
    except Exception as exc:
        logger.warning('Failed to send reservation-confirmed LINE notification: %s', exc)


def send_platform_line_reservation_table_changed_notification(reservation):
    binding = _get_customer_line_binding(reservation)
    if not binding:
        return

    line_api = _build_line_api()
    if not line_api:
        return

    table_label = (reservation.table_label or '').strip() or '未指定'

    message_lines = [
        '🔄 訂位桌位已更新',
        '',
        _build_reservation_summary(reservation),
        f'新桌位：{table_label}',
    ]

    merchant_note = (reservation.merchant_note or '').strip()
    if merchant_note:
        message_lines.extend(['', f'店家備註：{merchant_note}'])

    message_lines.extend(['', '請依最新桌位資訊入座，謝謝。'])
    message = "\n".join(message_lines)

    try:
        line_api.push_message(binding.line_user_id, [line_api.create_text_message(message)])
    except Exception as exc:
        logger.warning('Failed to send reservation-table-changed LINE notification: %s', exc)


def send_platform_line_reservation_cancelled_notification(reservation):
    binding = _get_customer_line_binding(reservation)
    if not binding:
        return

    line_api = _build_line_api()
    if not line_api:
        return

    message_lines = [
        '⚠️ 訂位已取消',
        '',
        _build_reservation_summary(reservation),
    ]

    cancel_reason = (reservation.cancel_reason or '').strip()
    if cancel_reason:
        message_lines.extend(['', f'取消原因：{cancel_reason}'])

    message_lines.extend(['', '如需協助，請透過平台重新預約或聯繫店家。'])
    message = "\n".join(message_lines)

    try:
        line_api.push_message(binding.line_user_id, [line_api.create_text_message(message)])
    except Exception as exc:
        logger.warning('Failed to send reservation-cancelled LINE notification: %s', exc)
