from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'faqs', views.StoreFAQViewSet, basename='faq')
router.register(r'conversations', views.ConversationLogViewSet, basename='conversation')
router.register(r'broadcasts', views.BroadcastMessageViewSet, basename='broadcast')
router.register(r'config', views.StoreLineBotConfigViewSet, basename='linebot-config')

urlpatterns = [
    # LINE Webhook
    path('webhook/', views.webhook, name='line-webhook'),
    
    # 用戶綁定
    path('bind/', views.bind_line_account, name='bind-line-account'),
    path('binding/', views.get_line_binding, name='get-line-binding'),
    
    # REST API
    path('', include(router.urls)),
]
