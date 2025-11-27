from django.urls import path
from .views import TakeoutOrderCreateView

urlpatterns = [
    path('takeout/', TakeoutOrderCreateView.as_view(), name='takeout-order'),
]
