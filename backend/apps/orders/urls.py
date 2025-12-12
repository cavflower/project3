from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    TakeoutOrderCreateView, 
    DineInOrderCreateView, 
    OrderStatusUpdateView,

    OrderListView,
    CustomerOrderListView,
    NotificationViewSet
)

router = DefaultRouter()
router.register(r'notifications', NotificationViewSet, basename='notification')

urlpatterns = [
    path('list/', OrderListView.as_view(), name='order-list'),
    path('customer-orders/', CustomerOrderListView.as_view(), name='customer-orders'),
    path('takeout/', TakeoutOrderCreateView.as_view(), name='takeout-order'),
    path('dinein/', DineInOrderCreateView.as_view(), name='dinein-order'),
    path('status/<str:pickup_number>/', OrderStatusUpdateView.as_view(), name='order-status'),
] + router.urls
