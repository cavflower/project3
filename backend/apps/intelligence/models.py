from django.conf import settings
from django.db import models


class PlatformSettings(models.Model):
    """
    平台設定模型 - 單例模式
    儲存平台級別的 AI 和其他全域設定
    由平台管理員統一配置，供整個平台使用
    """
    AI_PROVIDER_CHOICES = [
        ('gemini', 'Google Gemini'),
        ('openai', 'OpenAI GPT'),
        ('groq', 'Groq'),
    ]
    
    # AI 設定
    ai_provider = models.CharField(
        max_length=20,
        choices=AI_PROVIDER_CHOICES,
        default='gemini',
        verbose_name='AI 提供商'
    )
    ai_api_key = models.CharField(
        max_length=500,
        blank=True,
        verbose_name='AI API Key',
        help_text='由平台管理員設定，供所有店家使用'
    )
    ai_model = models.CharField(
        max_length=100,
        default='gemini-2.5-flash',
        verbose_name='AI 模型',
        help_text='例如: gemini-2.5-flash, gpt-4o-mini, llama-3.3-70b-versatile'
    )
    ai_temperature = models.FloatField(
        default=0.7,
        verbose_name='AI 溫度參數',
        help_text='控制回覆的隨機性，0-1之間'
    )
    ai_max_tokens = models.IntegerField(
        default=500,
        verbose_name='最大 Token 數',
        help_text='限制 AI 回覆的長度'
    )
    
    # 功能開關
    is_ai_enabled = models.BooleanField(
        default=True,
        verbose_name='啟用 AI 服務',
        help_text='關閉後所有店家的 AI 回覆功能將停用'
    )
    
    # 預設系統提示詞（可被店家自訂覆蓋）
    default_system_prompt = models.TextField(
        blank=True,
        default='',
        verbose_name='預設系統提示詞',
        help_text='所有店家 AI 回覆的預設提示詞，店家可自訂覆蓋'
    )
    
    # ===== LINE Login 設定（用於用戶綁定）=====
    line_login_channel_id = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='LINE Login Channel ID',
        help_text='從 LINE Developers Console 取得'
    )
    line_login_channel_secret = models.CharField(
        max_length=255,
        blank=True,
        verbose_name='LINE Login Channel Secret',
        help_text='從 LINE Developers Console 取得'
    )
    
    # ===== 平台 LINE BOT 設定（用於推送訊息）=====
    line_bot_channel_access_token = models.CharField(
        max_length=500,
        blank=True,
        verbose_name='LINE BOT Channel Access Token',
        help_text='平台 LINE Messaging API 的 Access Token'
    )
    line_bot_channel_secret = models.CharField(
        max_length=255,
        blank=True,
        verbose_name='LINE BOT Channel Secret',
        help_text='平台 LINE Messaging API 的 Channel Secret'
    )
    is_line_bot_enabled = models.BooleanField(
        default=False,
        verbose_name='啟用平台 LINE BOT',
        help_text='開啟後平台可發送推播訊息給用戶'
    )
    line_bot_welcome_message = models.TextField(
        blank=True,
        default='歡迎使用 DineVerse！我可以為您推薦美食店家。',
        verbose_name='LINE BOT 歡迎訊息'
    )
    is_personalized_recommendation_enabled = models.BooleanField(
        default=True,
        verbose_name='啟用個人化推薦',
        help_text='開啟後會根據用戶訂單行為發送個人化店家推薦。'
    )
    personalized_recommendation_min_interval_minutes = models.IntegerField(
        default=4320,
        verbose_name='個人化推薦最小間隔（分鐘）',
        help_text='同一用戶兩次個人化推薦推播之間的最小間隔。預設 4320 分鐘（72 小時）。'
    )
    personalized_recommendation_weekly_limit = models.IntegerField(
        default=2,
        verbose_name='個人化推薦每週上限',
        help_text='同一用戶每 7 天最多接收的個人化推薦推播次數。'
    )
    
    # 管理資訊
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新時間')
    updated_by = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='更新者'
    )
    
    class Meta:
        db_table = 'platform_settings'
        verbose_name = '平台設定'
        verbose_name_plural = '平台設定'
    
    def __str__(self):
        return f"平台設定 (AI: {self.get_ai_provider_display()})"
    
    @classmethod
    def get_settings(cls):
        """
        取得或建立唯一的設定實例（單例模式）
        """
        obj, created = cls.objects.get_or_create(pk=1)
        return obj
    
    def has_ai_config(self):
        """檢查是否已設定 AI"""
        return bool(self.ai_api_key) and self.is_ai_enabled
    
    def has_line_login_config(self):
        """檢查是否已設定 LINE Login"""
        return bool(self.line_login_channel_id and self.line_login_channel_secret)
    
    def has_line_bot_config(self):
        """檢查是否已設定平台 LINE BOT"""
        return bool(self.line_bot_channel_access_token and self.line_bot_channel_secret)
    
    def save(self, *args, **kwargs):
        # 強制使用 pk=1 確保單例
        self.pk = 1
        super().save(*args, **kwargs)


class PersonalizedRecommendationPushLog(models.Model):
    """個人化推薦推播記錄，用於限流與稽核。"""

    PUSH_TYPE_CHOICES = [
        ('personalized', '個人化推薦'),
        ('popular', '熱門推薦'),
        ('fallback', '備援推薦'),
    ]

    STATUS_CHOICES = [
        ('success', '成功'),
        ('skipped', '略過'),
        ('failed', '失敗'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='personalized_recommendation_push_logs',
        verbose_name='系統用戶'
    )
    line_user_id = models.CharField(
        max_length=255,
        db_index=True,
        verbose_name='LINE User ID'
    )
    push_type = models.CharField(
        max_length=30,
        choices=PUSH_TYPE_CHOICES,
        verbose_name='推播類型'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        verbose_name='狀態'
    )
    reason = models.CharField(
        max_length=255,
        blank=True,
        verbose_name='原因'
    )
    error_message = models.TextField(
        blank=True,
        verbose_name='錯誤訊息'
    )
    recommended_store_ids = models.JSONField(
        default=list,
        blank=True,
        verbose_name='推薦店家 ID 清單'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='建立時間')

    class Meta:
        db_table = 'personalized_recommendation_push_logs'
        verbose_name = '個人化推薦推播記錄'
        verbose_name_plural = '個人化推薦推播記錄'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'push_type', 'created_at']),
            models.Index(fields=['line_user_id', 'created_at']),
            models.Index(fields=['push_type', 'status', 'created_at']),
        ]

    def __str__(self):
        user_display = self.user.username if self.user_id else self.line_user_id
        return f"{user_display} - {self.push_type} - {self.status}"

