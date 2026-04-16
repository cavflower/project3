from django.db.models.signals import pre_save
from django.dispatch import receiver

from apps.orders.models import Notification

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

    if not instance.user:
        return

    order_number = instance.pickup_number or instance.order_number
    Notification.objects.create(
        user=instance.user,
        title='惜福品訂單狀態更新',
        message=f'您的惜福品訂單 {order_number} 狀態已更新為：{instance.get_status_display()}',
        notification_type='order_status',
        order_number=order_number,
        content_object=instance,
    )
