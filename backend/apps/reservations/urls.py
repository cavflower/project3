from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ReservationViewSet,
    MerchantReservationViewSet,
    TimeSlotViewSet,
    PublicTimeSlotViewSet,
)

router = DefaultRouter()
router.register(r'reservations', ReservationViewSet, basename='reservation')
router.register(r'merchant/reservations', MerchantReservationViewSet, basename='merchant-reservation')
router.register(r'merchant/time-slots', TimeSlotViewSet, basename='time-slot')
router.register(r'time-slots', PublicTimeSlotViewSet, basename='public-time-slot')

urlpatterns = [
    path('', include(router.urls)),
]
