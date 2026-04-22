from decimal import Decimal

from django.db import transaction
from django.db.models import F
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from apps.orders.models import Notification
from apps.orders.notification_services import (
    send_platform_line_new_order_to_merchant_notification,
    send_platform_line_order_pickup_ready_notification,
)
from apps.stores.models import Store

from .models import SurplusFoodOrder


@receiver(pre_save, sender=SurplusFoodOrder)
def surplus_order_status_change(sender, instance, **kwargs):
    """當惜福品訂單狀態變更時，寫入用戶通知。"""
    if not instance.pk:
        return

    try:
        old_instance = SurplusFoodOrder.objects.get(pk=instance.pk)
    except SurplusFoodOrder.DoesNotExist:
        return

    if old_instance.status == instance.status:
        return

    order_number = instance.pickup_number or instance.order_number

    if instance.user:
        Notification.objects.create(
            user=instance.user,
            title='惜福品訂單狀態更新',
            message=f'您的惜福品訂單 {order_number} 狀態已更新為：{instance.get_status_display()}',
            notification_type='order_status',
            order_number=order_number,
            content_object=instance,
        )

        if instance.status == 'ready':
            send_platform_line_order_pickup_ready_notification(
                order=instance,
                order_type_label='惜福品',
                order_number=order_number,
            )


@receiver(post_save, sender=SurplusFoodOrder)
def surplus_order_created_notify_merchant(sender, instance, created, **kwargs):
    if not created:
        return

    send_platform_line_new_order_to_merchant_notification(
        order=instance,
        order_type_label='惜福品',
        order_number=instance.order_number,
    )


@receiver(post_save, sender=SurplusFoodOrder)
def accumulate_store_surplus_completed_stats(sender, instance, **kwargs):
    """將惜福品完成訂單累積到店家統計（一次性計入，不回退）。"""
    if instance.status != 'completed':
        return

    if instance.counted_in_store_surplus_stats:
        return

    with transaction.atomic():
        marked = SurplusFoodOrder.objects.filter(
            pk=instance.pk,
            status='completed',
            counted_in_store_surplus_stats=False,
        ).update(counted_in_store_surplus_stats=True)
        if not marked:
            return

        revenue = Decimal(str(instance.total_price or 0)).quantize(Decimal('0.01'))
        Store.objects.filter(pk=instance.store_id).update(
            surplus_completed_order_count_total=F('surplus_completed_order_count_total') + 1,
            surplus_completed_revenue_total=F('surplus_completed_revenue_total') + revenue,
        )
