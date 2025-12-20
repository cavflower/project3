from django.db.models.signals import pre_save
from django.dispatch import receiver
from .models import TakeoutOrder, DineInOrder, Notification

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
    except DineInOrder.DoesNotExist:
        pass


# 惜福品訂單狀態變更通知
try:
    from apps.surplus_food.models import SurplusFoodOrder
    
    @receiver(pre_save, sender=SurplusFoodOrder)
    def surplus_order_status_change(sender, instance, **kwargs):
        if not instance.pk:
            return
        
        try:
            old_instance = SurplusFoodOrder.objects.get(pk=instance.pk)
            if old_instance.status != instance.status and instance.user:
                Notification.objects.create(
                    user=instance.user,
                    title='惜福品訂單狀態更新',
                    message=f'您的惜福品訂單 {instance.pickup_number} 狀態已更新為：{instance.get_status_display()}',
                    notification_type='order_status',
                    order_number=instance.pickup_number,
                )
        except SurplusFoodOrder.DoesNotExist:
            pass
except ImportError:
    pass
