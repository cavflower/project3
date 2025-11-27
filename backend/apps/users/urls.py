from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import UserRegisterView, UserDetailView, FirebaseTokenLoginView, UserMeView

urlpatterns = [
    path('register/', UserRegisterView.as_view(), name='user-register'),
    path('token/', FirebaseTokenLoginView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', UserMeView.as_view(), name='user-me'),
    path('<str:uid>/', UserDetailView.as_view(), name='user-detail'),
]
