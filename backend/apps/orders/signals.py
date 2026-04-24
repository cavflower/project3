from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from .models import TakeoutOrder, DineInOrder, Notification
from .notification_services import (
    send_platform_line_new_order_to_merchant_notification,
    send_platform_line_order_cancelled_notification,
    send_platform_line_order_pickup_ready_notification,
)

@receiver(pre_save, sender=TakeoutOrder)
def takeout_order_status_change(sender, instance, **kwargs):
    if not instance.pk:
        return
    
    try:
        old_instance = TakeoutOrder.objects.get(pk=instance.pk)
        if old_instance.status != instance.status and instance.user:
            Notification.objects.create(
                user=instance.user,
                title='訂單狀態更新',
                message=f'您的外帶訂單 {instance.pickup_number} 狀態已更新為：{instance.get_status_display()}',
                notification_type='order_status',
                order_number=instance.pickup_number,
                content_object=instance
            )

            if instance.status == 'ready_for_pickup':
                send_platform_line_order_pickup_ready_notification(
                    order=instance,
                    order_type_label='外帶',
                    order_number=instance.pickup_number,
                )
            elif instance.status in {'rejected', 'cancelled'}:
                send_platform_line_order_cancelled_notification(
                    order=instance,
                    order_type_label='外帶',
                    order_number=instance.pickup_number,
                )
    except TakeoutOrder.DoesNotExist:
        pass

@receiver(pre_save, sender=DineInOrder)
def dinein_order_status_change(sender, instance, **kwargs):
    if not instance.pk:
        return
    
    try:
        old_instance = DineInOrder.objects.get(pk=instance.pk)
        if old_instance.status != instance.status and instance.user:
            Notification.objects.create(
                user=instance.user,
                title='訂單狀態更新',
                message=f'您的內用訂單 {instance.order_number} 狀態已更新為：{instance.get_status_display()}',
                notification_type='order_status',
                order_number=instance.order_number,
                content_object=instance
            )

            if instance.status == 'ready_for_pickup':
                send_platform_line_order_pickup_ready_notification(
                    order=instance,
                    order_type_label='內用',
                    order_number=instance.order_number,
                )
            elif instance.status in {'rejected', 'cancelled'}:
                send_platform_line_order_cancelled_notification(
                    order=instance,
                    order_type_label='內用',
                    order_number=instance.order_number,
                )
    except DineInOrder.DoesNotExist:
        pass


@receiver(post_save, sender=TakeoutOrder)
def takeout_order_created_notify_merchant(sender, instance, created, **kwargs):
    if not created:
        return

    send_platform_line_new_order_to_merchant_notification(
        order=instance,
        order_type_label='外帶',
        order_number=instance.pickup_number,
    )


@receiver(post_save, sender=DineInOrder)
def dinein_order_created_notify_merchant(sender, instance, created, **kwargs):
    if not created:
        return

    send_platform_line_new_order_to_merchant_notification(
        order=instance,
        order_type_label='內用',
        order_number=instance.order_number,
    )
