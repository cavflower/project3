from django.db import models
from django.conf import settings
from apps.stores.models import Store


class StoreLineBotConfig(models.Model):
    """
    店家 LINE BOT 配置模型
    每個店家可以有自己的 LINE Channel（由平台管理員設定）
    AI 服務使用平台統一設定
    """
    
    store = models.OneToOneField(
        Store,
        on_delete=models.CASCADE,
        related_name='line_bot_config',
        verbose_name='所屬店家'
    )
    
    # LINE Messaging API 設定（由管理員設定）
    line_channel_access_token = models.CharField(
        max_length=500,
        blank=True,
        verbose_name='LINE Channel Access Token',
        help_text='從 LINE Developers Console 取得'
    )
    line_channel_secret = models.CharField(
        max_length=255,
        blank=True,
        verbose_name='LINE Channel Secret',
        help_text='從 LINE Developers Console 取得'
    )
    
    # LINE 官方帳號操作權限邀請網址（由管理員設定）
    invitation_url = models.URLField(
        max_length=500,
        blank=True,
        verbose_name='操作權限邀請網址',
        help_text='從 LINE Official Account Manager 取得的操作權限邀請網址'
    )
    
    # 系統提示詞自訂（店家設定）
    custom_system_prompt = models.TextField(
        blank=True,
        verbose_name='自訂系統提示詞',
        help_text='留空則使用預設提示詞'
    )
    
    # 歡迎訊息設定（店家設定）
    welcome_message = models.TextField(
        blank=True,
        default='',
        verbose_name='加入好友歡迎訊息',
        help_text='用戶加入好友時自動發送的歡迎訊息，留空則使用預設訊息'
    )
    
    # 功能開關（店家設定）
    enable_ai_reply = models.BooleanField(
        default=True,
        verbose_name='啟用 AI 智能回覆',
        help_text='關閉後只使用 FAQ 匹配'
    )
    enable_conversation_history = models.BooleanField(
        default=True,
        verbose_name='啟用對話歷史',
        help_text='AI 是否參考先前的對話內容'
    )
    
    # 狀態（店家設定）
    is_active = models.BooleanField(
        default=False,
        verbose_name='啟用 LINE BOT',
        help_text='設定完成後啟用'
    )
    
    # 個人化推播預設設定
    broadcast_default_tags = models.JSONField(
        default=list,
        blank=True,
        verbose_name='預設推播標籤',
        help_text='個人化推播預設選擇的食物標籤'
    )
    broadcast_default_days_inactive = models.IntegerField(
        default=0,
        verbose_name='預設閒置天數',
        help_text='個人化推播預設的閒置天數篩選'
    )
    broadcast_default_message = models.TextField(
        blank=True,
        default='',
        verbose_name='預設推播訊息',
        help_text='個人化推播預設的訊息內容'
    )
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='建立時間')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新時間')
    
    class Meta:
        db_table = 'store_line_bot_configs'
        verbose_name = '店家 LINE BOT 配置'
        verbose_name_plural = '店家 LINE BOT 配置'
    
    def __str__(self):
        return f"{self.store.name} - LINE BOT"
    
    def has_line_config(self):
        """檢查是否已設定 LINE Channel"""
        return bool(self.line_channel_access_token and self.line_channel_secret)


class LineUserBinding(models.Model):
    """
    LINE 用戶綁定模型
    將 LINE User ID 與系統用戶綁定
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='line_binding',
        verbose_name='系統用戶'
    )
    line_user_id = models.CharField(
        max_length=255,
        unique=True,
        verbose_name='LINE User ID'
    )
    display_name = models.CharField(
        max_length=255,
        blank=True,
        verbose_name='LINE 顯示名稱'
    )
    picture_url = models.URLField(
        blank=True,
        verbose_name='LINE 頭像'
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name='啟用狀態'
    )
    
    # LINE BOT 模式切換（用於同時綁定顧客和店家的用戶）
    LINE_MODE_CHOICES = [
        ('customer', '顧客模式'),
        ('merchant', '店家模式'),
    ]
    current_mode = models.CharField(
        max_length=20,
        choices=LINE_MODE_CHOICES,
        default='customer',
        verbose_name='當前模式',
        help_text='用於 LINE BOT 切換顯示顧客或店家資訊'
    )
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='綁定時間')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新時間')

    class Meta:
        db_table = 'line_user_bindings'
        verbose_name = 'LINE 用戶綁定'
        verbose_name_plural = 'LINE 用戶綁定'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} - {self.line_user_id}"


class StoreFAQ(models.Model):
    """
    店家 FAQ 模型
    店家可以自訂常見問題與答案
    """
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name='faqs',
        verbose_name='所屬店家'
    )
    question = models.TextField(
        verbose_name='問題',
        help_text='客戶可能詢問的問題'
    )
    answer = models.TextField(
        verbose_name='回答',
        help_text='對應的答案'
    )
    keywords = models.JSONField(
        default=list,
        blank=True,
        verbose_name='關鍵字',
        help_text='用於匹配的關鍵字列表，例如：["營業時間", "幾點開", "幾點關"]'
    )
    priority = models.IntegerField(
        default=0,
        verbose_name='優先順序',
        help_text='數字越大優先級越高'
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name='啟用狀態'
    )
    usage_count = models.IntegerField(
        default=0,
        verbose_name='使用次數',
        help_text='此 FAQ 被觸發的次數'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='建立時間')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新時間')

    class Meta:
        db_table = 'store_faqs'
        verbose_name = '店家 FAQ'
        verbose_name_plural = '店家 FAQ'
        ordering = ['-priority', '-created_at']
        indexes = [
            models.Index(fields=['store', 'is_active']),
        ]

    def __str__(self):
        return f"{self.store.name} - {self.question[:50]}"


class ConversationLog(models.Model):
    """
    對話記錄模型
    記錄所有 LINE BOT 對話以供分析和改進
    """
    MESSAGE_TYPE_CHOICES = [
        ('text', '文字'),
        ('image', '圖片'),
        ('sticker', '貼圖'),
        ('location', '位置'),
        ('other', '其他'),
    ]

    SENDER_TYPE_CHOICES = [
        ('user', '用戶'),
        ('bot', '機器人'),
    ]

    store = models.ForeignKey(
        Store,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='line_conversations',
        verbose_name='相關店家'
    )
    line_user_id = models.CharField(
        max_length=255,
        verbose_name='LINE User ID'
    )
    sender_type = models.CharField(
        max_length=10,
        choices=SENDER_TYPE_CHOICES,
        verbose_name='發送者類型'
    )
    message_type = models.CharField(
        max_length=20,
        choices=MESSAGE_TYPE_CHOICES,
        default='text',
        verbose_name='訊息類型'
    )
    message_content = models.TextField(
        verbose_name='訊息內容'
    )
    reply_token = models.CharField(
        max_length=255,
        blank=True,
        verbose_name='Reply Token'
    )
    matched_faq = models.ForeignKey(
        StoreFAQ,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='conversation_logs',
        verbose_name='匹配的 FAQ'
    )
    used_ai = models.BooleanField(
        default=False,
        verbose_name='使用 AI 回覆'
    )
    ai_model = models.CharField(
        max_length=50,
        blank=True,
        null=True,  # 允許資料庫為 NULL
        default='',
        verbose_name='AI 模型',
        help_text='例如：gpt-4, gemini-pro'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='建立時間')

    class Meta:
        db_table = 'conversation_logs'
        verbose_name = '對話記錄'
        verbose_name_plural = '對話記錄'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['line_user_id', '-created_at']),
            models.Index(fields=['store', '-created_at']),
        ]

    def __str__(self):
        return f"{self.line_user_id} - {self.message_content[:30]}"


class BroadcastMessage(models.Model):
    """
    推播訊息模型
    用於記錄店家的推播訊息
    """
    BROADCAST_TYPE_CHOICES = [
        ('personalized', '個人化推播'),
        ('product', '餐品推播'),
        ('surplus', '惜福品推播'),
        ('loyalty', '會員優惠推播'),
        ('general', '一般通知'),
    ]

    STATUS_CHOICES = [
        ('draft', '草稿'),
        ('scheduled', '已排程'),
        ('sent', '已發送'),
        ('failed', '發送失敗'),
    ]

    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name='broadcast_messages',
        verbose_name='發送店家'
    )
    broadcast_type = models.CharField(
        max_length=20,
        choices=BROADCAST_TYPE_CHOICES,
        verbose_name='推播類型'
    )
    title = models.CharField(
        max_length=255,
        verbose_name='推播標題'
    )
    message_content = models.TextField(
        verbose_name='訊息內容'
    )
    image_url = models.URLField(
        blank=True,
        verbose_name='圖片網址'
    )
    target_users = models.JSONField(
        default=list,
        verbose_name='目標用戶',
        help_text='LINE User ID 列表'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft',
        verbose_name='狀態'
    )
    scheduled_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='排程時間'
    )
    sent_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='發送時間'
    )
    recipient_count = models.IntegerField(
        default=0,
        verbose_name='接收人數'
    )
    success_count = models.IntegerField(
        default=0,
        verbose_name='成功發送數'
    )
    failure_count = models.IntegerField(
        default=0,
        verbose_name='失敗發送數'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        verbose_name='建立者'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='建立時間')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新時間')

    class Meta:
        db_table = 'broadcast_messages'
        verbose_name = '推播訊息'
        verbose_name_plural = '推播訊息'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.store.name} - {self.title}"


class MerchantLineBinding(models.Model):
    """
    店家 LINE 綁定模型
    將 LINE User ID 與店家綁定，用於接收業務通知
    """
    merchant = models.OneToOneField(
        'users.Merchant',
        on_delete=models.CASCADE,
        related_name='line_binding',
        verbose_name='店家'
    )
    line_user_id = models.CharField(
        max_length=255,
        unique=True,
        verbose_name='LINE User ID'
    )
    display_name = models.CharField(
        max_length=255,
        blank=True,
        verbose_name='LINE 顯示名稱'
    )
    picture_url = models.URLField(
        blank=True,
        verbose_name='LINE 頭像'
    )
    
    # 通知偏好設定
    notify_schedule = models.BooleanField(
        default=True,
        verbose_name='排班通知',
        help_text='是否接收排班相關通知'
    )
    notify_analytics = models.BooleanField(
        default=True,
        verbose_name='營運分析',
        help_text='是否接收營運分析報告'
    )
    notify_inventory = models.BooleanField(
        default=True,
        verbose_name='原物料不足',
        help_text='是否接收原物料不足提醒'
    )
    notify_order_alert = models.BooleanField(
        default=True,
        verbose_name='訂單異常',
        help_text='是否接收訂單異常警報'
    )
    
    is_active = models.BooleanField(
        default=True,
        verbose_name='啟用狀態'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='綁定時間')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新時間')

    class Meta:
        db_table = 'merchant_line_bindings'
        verbose_name = '店家 LINE 綁定'
        verbose_name_plural = '店家 LINE 綁定'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.merchant.user.username} - {self.line_user_id}"


class PlatformBroadcast(models.Model):
    """
    平台推播訊息模型
    用於平台管理員發送店家推薦、新店上架等訊息給用戶
    """
    BROADCAST_TYPE_CHOICES = [
        ('store_recommendation', '店家推薦'),
        ('new_store', '新店上架'),
        ('platform_announcement', '平台公告'),
    ]

    STATUS_CHOICES = [
        ('draft', '草稿'),
        ('scheduled', '已排程'),
        ('sent', '已發送'),
        ('failed', '發送失敗'),
    ]

    broadcast_type = models.CharField(
        max_length=30,
        choices=BROADCAST_TYPE_CHOICES,
        default='store_recommendation',
        verbose_name='推播類型'
    )
    title = models.CharField(
        max_length=255,
        verbose_name='推播標題'
    )
    message_content = models.TextField(
        verbose_name='訊息內容'
    )
    image_url = models.URLField(
        blank=True,
        verbose_name='圖片網址'
    )
    
    # 推薦店家（多對多關係）
    recommended_stores = models.ManyToManyField(
        Store,
        blank=True,
        related_name='platform_broadcasts',
        verbose_name='推薦店家'
    )
    
    # 目標用戶設定
    target_all = models.BooleanField(
        default=True,
        verbose_name='發送給全體用戶',
        help_text='啟用時發送給所有已綁定 LINE 的用戶'
    )
    target_users = models.JSONField(
        default=list,
        blank=True,
        verbose_name='目標用戶',
        help_text='指定的 LINE User ID 列表（target_all 為 False 時使用）'
    )
    
    # 發送狀態
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft',
        verbose_name='狀態'
    )
    scheduled_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='排程時間'
    )
    sent_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='發送時間'
    )
    
    # 發送統計
    recipient_count = models.IntegerField(
        default=0,
        verbose_name='接收人數'
    )
    success_count = models.IntegerField(
        default=0,
        verbose_name='成功發送數'
    )
    failure_count = models.IntegerField(
        default=0,
        verbose_name='失敗發送數'
    )
    
    # 管理資訊
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        verbose_name='建立者'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='建立時間')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新時間')

    class Meta:
        db_table = 'platform_broadcasts'
        verbose_name = '平台推播'
        verbose_name_plural = '平台推播'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.get_broadcast_type_display()}] {self.title}"
