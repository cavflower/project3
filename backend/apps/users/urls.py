from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import UserRegisterView, UserDetailView, FirebaseTokenLoginView, UserMeView
from .payment_views import PaymentCardViewSet

router = DefaultRouter()
router.register(r'payment-cards', PaymentCardViewSet, basename='payment-card')

urlpatterns = [
    path('', include(router.urls)),  # Router URLs 要放在最前面
    path('register/', UserRegisterView.as_view(), name='user-register'),
    path('token/', FirebaseTokenLoginView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', UserMeView.as_view(), name='user-me'),
    path('<str:uid>/', UserDetailView.as_view(), name='user-detail'),
]
