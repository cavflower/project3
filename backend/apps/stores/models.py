from django.db import models
from apps.users.models import Merchant


class Store(models.Model):
    """
    店家資訊模型
    """
    merchant = models.OneToOneField(
        Merchant,
        on_delete=models.CASCADE,
        related_name='store',
        help_text="The merchant who owns this store."
    )
    name = models.CharField(
        max_length=255,
        verbose_name='餐廳名稱',
        help_text="The name of the restaurant/store."
    )
    CUISINE_TYPE_CHOICES = [
        ('japanese', '日式'),
        ('korean', '韓式'),
        ('american', '美式'),
        ('taiwanese', '台式'),
        ('western', '西式'),
        ('beverages', '飲料'),
        ('desserts', '甜點'),
        ('other', '其他'),
    ]
    cuisine_type = models.CharField(
        max_length=20,
        choices=CUISINE_TYPE_CHOICES,
        default='other',
        verbose_name='餐廳類別',
        help_text="The cuisine type of the restaurant."
    )
    description = models.TextField(
        blank=True,
        verbose_name='餐廳描述',
        help_text="A detailed description of the restaurant."
    )
    address = models.TextField(
        verbose_name='地址',
        help_text="The address of the restaurant."
    )
    phone = models.CharField(
        max_length=20,
        verbose_name='電話',
        help_text="The phone number of the restaurant."
    )
    email = models.EmailField(
        blank=True,
        verbose_name='Email',
        help_text="The email address of the restaurant."
    )
    website = models.URLField(
        blank=True,
        verbose_name='餐廳網站',
        help_text="The website URL of the restaurant."
    )
    transportation = models.TextField(
        blank=True,
        verbose_name='交通方式',
        help_text="Transportation information to reach the restaurant."
    )
    opening_hours = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='營業時間',
        help_text="Opening hours for each day of the week."
    )
    fixed_holidays = models.TextField(
        blank=True,
        verbose_name='固定休息日',
        help_text="Fixed holidays or maintenance days."
    )
    is_open = models.BooleanField(
        default=True,
        verbose_name='營業狀態',
        help_text="Indicates if the restaurant is currently open."
    )
    is_published = models.BooleanField(
        default=False,
        verbose_name='是否上架',
        help_text="Whether the store is published and visible to customers."
    )
    # 平均預算
    budget_lunch = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        blank=True,
        null=True,
        verbose_name='午餐平均預算',
        help_text="Average budget for lunch."
    )
    budget_dinner = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        blank=True,
        null=True,
        verbose_name='晚餐平均預算',
        help_text="Average budget for dinner."
    )
    budget_banquet = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        blank=True,
        null=True,
        verbose_name='宴會平均預算',
        help_text="Average budget for banquet."
    )
    # 支付方式
    credit_cards = models.CharField(
        max_length=500,
        blank=True,
        verbose_name='接受的信用卡',
        help_text="Accepted credit cards (comma-separated)."
    )
    # 設施與服務
    has_wifi = models.BooleanField(
        default=False,
        verbose_name='提供 Wi-Fi',
        help_text="Whether the restaurant provides Wi-Fi."
    )
    parking_info = models.TextField(
        blank=True,
        verbose_name='停車場資訊',
        help_text="Parking information."
    )
    has_english_menu = models.BooleanField(
        default=False,
        verbose_name='提供英文菜單',
        help_text="Whether the restaurant has an English menu."
    )
    # 吸菸政策
    SMOKING_CHOICES = (
        ('no_smoking', '完全禁煙'),
        ('smoking_allowed', '可吸菸'),
        ('separate_room', '有專用吸菸室'),
    )
    smoking_policy = models.CharField(
        max_length=20,
        choices=SMOKING_CHOICES,
        default='no_smoking',
        verbose_name='吸菸政策',
        help_text="Smoking policy of the restaurant."
    )
    # 兒童友善
    suitable_for_children = models.BooleanField(
        default=False,
        verbose_name='適合帶小孩',
        help_text="Whether the restaurant is suitable for children."
    )
    # 備註
    remarks = models.TextField(
        blank=True,
        verbose_name='備註',
        help_text="Additional remarks or notes."
    )
    # 菜單設定
    MENU_TYPE_CHOICES = (
        ('text', '文字與價格'),
        ('image', '菜單圖片'),
    )
    menu_type = models.CharField(
        max_length=10,
        choices=MENU_TYPE_CHOICES,
        default='text',
        blank=True,
        verbose_name='菜單類型',
        help_text="Type of menu display: text with prices or menu images."
    )
    menu_text = models.TextField(
        blank=True,
        verbose_name='菜單文字內容',
        help_text="Menu items with prices in text format."
    )
    # 功能開關
    enable_reservation = models.BooleanField(
        default=True,
        verbose_name='啟用訂位功能',
        help_text="Enable or disable reservation feature."
    )
    enable_loyalty = models.BooleanField(
        default=True,
        verbose_name='啟用會員功能',
        help_text="Enable or disable loyalty program feature."
    )
    enable_surplus_food = models.BooleanField(
        default=True,
        verbose_name='啟用惜福品功能',
        help_text="Enable or disable surplus food feature."
    )
    # 標籤（用於分類和搜尋）
    dine_in_layout = models.JSONField(
        default=list,
        blank=True,
        verbose_name='內用座位配置',
        help_text="Configuration data for dine-in tables (floor plan)."
    )
    tags = models.JSONField(
        default=list,
        blank=True,
        null=True,
        verbose_name='標籤',
        help_text="Tags for categorizing and searching the store (e.g., ['Italian', 'Pizza', 'Romantic'])."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = '店家資訊'
        verbose_name_plural = '店家資訊'
        indexes = [
            models.Index(fields=['is_published', 'cuisine_type']),  # 加速公開店家分類查詢
            models.Index(fields=['is_published', 'enable_reservation']),  # 加速訂位功能篩選
            models.Index(fields=['is_published', 'enable_loyalty']),  # 加速會員功能篩選
            models.Index(fields=['is_published', 'enable_surplus_food']),  # 加速惜福功能篩選
            models.Index(fields=['name']),  # 加速店名搜尋
            models.Index(fields=['created_at']),  # 加速時間排序
        ]

    def __str__(self):
        return f"{self.name} ({self.merchant.user.username})"


class StoreImage(models.Model):
    """
    餐廳圖片模型 - 支援多張圖片
    """
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name='images',
        help_text="The store this image belongs to."
    )
    image = models.ImageField(
        upload_to='store_images/',
        verbose_name='圖片',
        help_text="An image of the restaurant."
    )
    order = models.IntegerField(
        default=0,
        verbose_name='排序',
        help_text="Order of the image (lower numbers appear first)."
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = '餐廳圖片'
        verbose_name_plural = '餐廳圖片'
        ordering = ['order', 'created_at']

    def __str__(self):
        return f"{self.store.name} - Image {self.order}"


class MenuImage(models.Model):
    """
    菜單圖片模型
    """
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name='menu_images',
        help_text="The store this menu image belongs to."
    )
    image = models.ImageField(
        upload_to='menu_images/',
        verbose_name='菜單圖片',
        help_text="A menu image of the restaurant."
    )
    order = models.IntegerField(
        default=0,
        verbose_name='排序',
        help_text="Order of the menu image (lower numbers appear first)."
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = '菜單圖片'
        verbose_name_plural = '菜單圖片'
        ordering = ['order', 'created_at']

    def __str__(self):
        return f"{self.store.name} - Menu Image {self.order}"

