from django.urls import path
from .views import TakeoutOrderCreateView, DineInOrderCreateView, OrderStatusUpdateView

urlpatterns = [
    path('takeout/', TakeoutOrderCreateView.as_view(), name='takeout-order'),
    path('dinein/', DineInOrderCreateView.as_view(), name='dinein-order'),
    path('status/<str:pickup_number>/', OrderStatusUpdateView.as_view(), name='order-status'),
]
