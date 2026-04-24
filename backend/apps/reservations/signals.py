from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from .models import Reservation
from .notification_services import (
    send_platform_line_reservation_cancelled_notification,
    send_platform_line_reservation_confirmed_notification,
    send_platform_line_reservation_created_notification,
)


@receiver(pre_save, sender=Reservation)
def reservation_track_previous_state(sender, instance, **kwargs):
    if not instance.pk:
        instance._previous_status = None
        return

    old_instance = Reservation.objects.filter(pk=instance.pk).only('status').first()
    if not old_instance:
        instance._previous_status = None
        return

    instance._previous_status = old_instance.status


@receiver(post_save, sender=Reservation)
def reservation_send_platform_line_notifications(sender, instance, created, **kwargs):
    if created:
        send_platform_line_reservation_created_notification(instance)
        return

    previous_status = getattr(instance, '_previous_status', None)

    if previous_status != 'confirmed' and instance.status == 'confirmed':
        send_platform_line_reservation_confirmed_notification(instance)
        return

    if previous_status != 'cancelled' and instance.status == 'cancelled':
        send_platform_line_reservation_cancelled_notification(instance)
