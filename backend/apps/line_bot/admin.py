from django.contrib import admin
from .models import LineUserBinding, StoreFAQ, ConversationLog, BroadcastMessage, StoreLineBotConfig


@admin.register(StoreLineBotConfig)
class StoreLineBotConfigAdmin(admin.ModelAdmin):
    list_display = ['store', 'ai_provider', 'enable_ai_reply', 'is_active', 'created_at']
    list_filter = ['ai_provider', 'enable_ai_reply', 'is_active', 'created_at']
    search_fields = ['store__name']
    readonly_fields = ['created_at', 'updated_at']
    fieldsets = (
        ('店家資訊', {
            'fields': ('store', 'is_active')
        }),
        ('LINE 設定', {
            'fields': ('line_channel_access_token', 'line_channel_secret')
        }),
        ('AI 設定', {
            'fields': ('ai_provider', 'ai_api_key', 'ai_model', 'ai_temperature', 'ai_max_tokens')
        }),
        ('進階設定', {
            'fields': ('custom_system_prompt', 'enable_ai_reply', 'enable_conversation_history')
        }),
        ('時間戳記', {
            'fields': ('created_at', 'updated_at')
        }),
    )


@admin.register(LineUserBinding)
class LineUserBindingAdmin(admin.ModelAdmin):
    list_display = ['user', 'line_user_id', 'display_name', 'is_active', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['user__username', 'user__email', 'line_user_id', 'display_name']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(StoreFAQ)
class StoreFAQAdmin(admin.ModelAdmin):
    list_display = ['store', 'question', 'priority', 'is_active', 'usage_count', 'created_at']
    list_filter = ['is_active', 'store', 'created_at']
    search_fields = ['question', 'answer', 'store__name']
    readonly_fields = ['usage_count', 'created_at', 'updated_at']
    ordering = ['-priority', '-created_at']


@admin.register(ConversationLog)
class ConversationLogAdmin(admin.ModelAdmin):
    list_display = ['line_user_id', 'store', 'sender_type', 'message_content', 'used_ai', 'created_at']
    list_filter = ['sender_type', 'message_type', 'used_ai', 'created_at']
    search_fields = ['line_user_id', 'message_content', 'store__name']
    readonly_fields = ['created_at']
    date_hierarchy = 'created_at'


@admin.register(BroadcastMessage)
class BroadcastMessageAdmin(admin.ModelAdmin):
    list_display = ['store', 'title', 'broadcast_type', 'status', 'recipient_count', 'created_at']
    list_filter = ['broadcast_type', 'status', 'created_at']
    search_fields = ['title', 'message_content', 'store__name']
    readonly_fields = ['sent_at', 'recipient_count', 'success_count', 'failure_count', 'created_at', 'updated_at']
    date_hierarchy = 'created_at'
