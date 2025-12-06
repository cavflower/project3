from django.urls import path
from .views import TakeoutOrderCreateView, OrderStatusUpdateView

urlpatterns = [
    path('takeout/', TakeoutOrderCreateView.as_view(), name='takeout-order'),
    path('status/<str:pickup_number>/', OrderStatusUpdateView.as_view(), name='order-status'),
]
