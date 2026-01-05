from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'faqs', views.StoreFAQViewSet, basename='faq')
router.register(r'conversations', views.ConversationLogViewSet, basename='conversation')
router.register(r'broadcasts', views.BroadcastMessageViewSet, basename='broadcast')
router.register(r'platform-broadcasts', views.PlatformBroadcastViewSet, basename='platform-broadcast')
router.register(r'config', views.StoreLineBotConfigViewSet, basename='linebot-config')
router.register(r'merchant-binding', views.MerchantLineBindingViewSet, basename='merchant-line-binding')

urlpatterns = [
    # LINE Webhook
    path('webhook/', views.webhook, name='line-webhook'),
    path('webhook/<int:store_id>/', views.webhook_by_store, name='line-webhook-by-store'),
    
    # 用戶綁定
    path('bind/', views.bind_line_account, name='bind-line-account'),
    path('binding/', views.get_line_binding, name='get-line-binding'),
    
    # 管理員設定店家 LINE BOT
    path('admin/store/<int:store_id>/config/', views.admin_store_line_config, name='admin-store-line-config'),
    
    # REST API
    path('', include(router.urls)),
]
