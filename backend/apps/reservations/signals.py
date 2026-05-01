from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver
import threading

from .models import Reservation
from .firestore_services import delete_reservation_from_firestore, sync_reservation_to_firestore
from .notification_services import (
    create_platform_reservation_notification,
    send_platform_line_reservation_cancelled_notification,
    send_platform_line_reservation_confirmed_notification,
    send_platform_line_reservation_created_notification,
    send_platform_line_reservation_table_changed_notification,
)


def _send_line_async(callback, reservation):
    thread = threading.Thread(target=callback, args=(reservation,), daemon=True)
    thread.start()


@receiver(pre_save, sender=Reservation)
def reservation_track_previous_state(sender, instance, **kwargs):
    if not instance.pk:
        instance._previous_status = None
        return

    old_instance = Reservation.objects.filter(pk=instance.pk).only(
        'status',
        'table_label',
        'merchant_note',
    ).first()
    if not old_instance:
        instance._previous_status = None
        instance._previous_table_label = ''
        instance._previous_merchant_note = ''
        return

    instance._previous_status = old_instance.status
    instance._previous_table_label = old_instance.table_label or ''
    instance._previous_merchant_note = old_instance.merchant_note or ''


@receiver(post_save, sender=Reservation)
def reservation_send_platform_line_notifications(sender, instance, created, **kwargs):
    sync_reservation_to_firestore(instance)

    if created:
        _send_line_async(send_platform_line_reservation_created_notification, instance)
        return

    previous_status = getattr(instance, '_previous_status', None)
    previous_table_label = getattr(instance, '_previous_table_label', instance.table_label or '')
    previous_merchant_note = getattr(instance, '_previous_merchant_note', instance.merchant_note or '')

    if previous_status != 'confirmed' and instance.status == 'confirmed':
        table_label = (instance.table_label or '').strip() or '未指定'
        create_platform_reservation_notification(
            instance,
            '訂位已確認',
            f'{instance.store.name} 已接受你的訂位，桌位：{table_label}。',
        )
        _send_line_async(send_platform_line_reservation_confirmed_notification, instance)
        return

    table_changed = (previous_table_label or '') != (instance.table_label or '')
    merchant_note_changed = (previous_merchant_note or '') != (instance.merchant_note or '')
    if instance.status == 'confirmed' and previous_status == 'confirmed' and (table_changed or merchant_note_changed):
        table_label = (instance.table_label or '').strip() or '未指定'
        create_platform_reservation_notification(
            instance,
            '訂位桌位已更新',
            f'{instance.store.name} 已更新你的訂位桌位，最新桌位：{table_label}。',
        )
        _send_line_async(send_platform_line_reservation_table_changed_notification, instance)
        return

    if previous_status != 'cancelled' and instance.status == 'cancelled':
        create_platform_reservation_notification(
            instance,
            '訂位已取消',
            f'{instance.store.name} 已取消你的訂位。',
        )
        _send_line_async(send_platform_line_reservation_cancelled_notification, instance)


@receiver(post_delete, sender=Reservation)
def reservation_delete_firestore_document(sender, instance, **kwargs):
    delete_reservation_from_firestore(instance.id)
