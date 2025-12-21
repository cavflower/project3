from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from apps.stores.models import Store
from apps.products.models import Product
from django.utils import timezone
from datetime import time
from decimal import Decimal
import uuid


class SurplusFoodCategory(models.Model):
    """
    惜福食品類別模型
    商家可以建立類別來分類管理惜福食品
    """
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name='surplus_categories',
        verbose_name='所屬店家'
    )
    name = models.CharField(
        max_length=100,
        verbose_name='類別名稱',
        help_text='例如：麵包類、熟食類、飲料類'
    )
    description = models.TextField(
        blank=True,
        verbose_name='類別描述'
    )
    display_order = models.PositiveIntegerField(
        default=0,
        verbose_name='顯示順序',
        help_text='數字越小越前面'
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name='啟用狀態'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='建立時間')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新時間')
    
    class Meta:
        db_table = 'surplus_food_categories'
        verbose_name = '惜福食品類別'
        verbose_name_plural = '惜福食品類別'
        ordering = ['display_order', 'name']
        unique_together = ['store', 'name']
    
    def __str__(self):
        return f"{self.store.name} - {self.name}"


class SurplusTimeSlot(models.Model):
    """
    惜福時段設定模型
    商家可以設定特定時段作為惜福食品販售時段
    """
    DAY_CHOICES = [
        ('monday', '星期一'),
        ('tuesday', '星期二'),
        ('wednesday', '星期三'),
        ('thursday', '星期四'),
        ('friday', '星期五'),
        ('saturday', '星期六'),
        ('sunday', '星期日'),
    ]
    
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name='surplus_time_slots',
        verbose_name='所屬店家'
    )
    name = models.CharField(
        max_length=100,
        verbose_name='時段名稱',
        help_text='例如：午餐惜福、晚餐惜福'
    )
    day_of_week = models.CharField(
        max_length=10,
        choices=DAY_CHOICES,
        verbose_name='星期'
    )
    start_time = models.TimeField(verbose_name='開始時間')
    end_time = models.TimeField(verbose_name='結束時間')
    is_active = models.BooleanField(
        default=True,
        verbose_name='啟用狀態'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='建立時間')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新時間')
    
    class Meta:
        db_table = 'surplus_time_slots'
        verbose_name = '惜福時段'
        verbose_name_plural = '惜福時段'
        ordering = ['day_of_week', 'start_time']
        unique_together = ['store', 'day_of_week', 'start_time']
    
    def __str__(self):
        return f"{self.store.name} - {self.get_day_of_week_display()} {self.name}"
    
    def clean(self):
        """驗證時段設定"""
        super().clean()
        
        # 驗證結束時間必須晚於開始時間（允許 00:00 表示跨日到午夜）
        if self.start_time and self.end_time:
            # 如果結束時間是 00:00，表示跨日營業到午夜，不需要驗證
            is_midnight = self.end_time == time(0, 0)
            if not is_midnight and self.start_time >= self.end_time:
                raise ValidationError({
                    'end_time': '結束時間必須晚於開始時間（或設為 00:00 表示營業至午夜）'
                })
        
        # 驗證不能在尖峰時段（8:00-13:00, 17:00-19:00）
        if self.start_time and self.end_time:
            # 如果結束時間是 00:00，表示跨日到午夜，只檢查開始時間
            is_midnight = self.end_time == time(0, 0)
            
            peak_hours = [
                (time(8, 0), time(13, 0)),   # 早午餐尖峰
                (time(17, 0), time(19, 0)),  # 晚餐尖峰
            ]
            
            for peak_start, peak_end in peak_hours:
                # 檢查時段是否與尖峰時段重疊
                if is_midnight:
                    # 跨日時段，只要開始時間不在尖峰時段內即可
                    if peak_start <= self.start_time < peak_end:
                        raise ValidationError({
                            'start_time': f'惜福時段不能設在尖峰時段（08:00-13:00, 17:00-19:00）'
                        })
                else:
                    # 一般時段，檢查是否重疊
                    if not (self.end_time <= peak_start or self.start_time >= peak_end):
                        raise ValidationError({
                            'start_time': f'惜福時段不能設在尖峰時段（08:00-13:00, 17:00-19:00）'
                        })
    
    def save(self, *args, **kwargs):
        # 在儲存前執行驗證
        self.clean()
        super().save(*args, **kwargs)


class SurplusFood(models.Model):
    """
    惜福食品模型
    商家可以將即期或剩餘的食材/商品設定為惜福品
    """
    STATUS_CHOICES = [
        ('active', '上架中'),
        ('inactive', '已下架'),
        ('sold_out', '已售完'),
    ]
    
    DINING_OPTION_CHOICES = [
        ('dine_in', '內用'),
        ('takeout', '外帶'),
        ('both', '內用和外帶'),
    ]
    
    CONDITION_CHOICES = [
        ('near_expiry', '即期品'),
        ('surplus', '剩餘品'),
        ('damaged_package', '外包裝損傷'),
    ]
    
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name='surplus_foods',
        verbose_name='所屬店家'
    )
    category = models.ForeignKey(
        SurplusFoodCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='foods',
        verbose_name='惜福品類別',
        help_text='選擇此惜福品所屬的類別'
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='surplus_items',
        verbose_name='關聯商品',
        help_text='可選：關聯到現有商品'
    )
    title = models.CharField(
        max_length=255,
        verbose_name='惜福品名稱'
    )
    description = models.TextField(
        blank=True,
        verbose_name='商品描述'
    )
    original_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name='原價'
    )
    surplus_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name='惜福價'
    )
    quantity = models.PositiveIntegerField(
        default=1,
        verbose_name='可售數量'
    )
    remaining_quantity = models.PositiveIntegerField(
        verbose_name='剩餘數量'
    )
    condition = models.CharField(
        max_length=20,
        choices=CONDITION_CHOICES,
        default='surplus',
        verbose_name='商品狀況'
    )
    dining_option = models.CharField(
        max_length=20,
        choices=DINING_OPTION_CHOICES,
        default='both',
        verbose_name='用餐選項'
    )
    expiry_date = models.DateField(
        null=True,
        blank=True,
        verbose_name='到期日',
        help_text='即期品必填'
    )
    time_slot = models.ForeignKey(
        SurplusTimeSlot,
        on_delete=models.CASCADE,
        null=True,
        related_name='surplus_foods',
        verbose_name='惜福時段'
    )
    image = models.ImageField(
        upload_to='surplus_food_images/',
        blank=True,
        null=True,
        verbose_name='商品圖片'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active',
        verbose_name='狀態'
    )
    pickup_instructions = models.TextField(
        blank=True,
        verbose_name='取餐說明',
        help_text='例如：請於時段內到店取餐'
    )
    tags = models.JSONField(
        default=list,
        blank=True,
        verbose_name='標籤',
        help_text='例如：["素食", "無麩質", "環保"]'
    )
    code = models.CharField(
        max_length=20,
        unique=True,
        editable=False,
        verbose_name='惜福品編號'
    )
    views_count = models.PositiveIntegerField(
        default=0,
        verbose_name='瀏覽次數'
    )
    orders_count = models.PositiveIntegerField(
        default=0,
        verbose_name='訂購次數'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='建立時間')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新時間')
    published_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='上架時間'
    )
    
    class Meta:
        db_table = 'surplus_foods'
        verbose_name = '惜福食品'
        verbose_name_plural = '惜福食品'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['store', 'status']),
        ]
    
    def __str__(self):
        return f"{self.title} - {self.store.name}"
    
    def clean(self):
        """驗證惜福食品設定"""
        super().clean()
        
        # 驗證惜福價必須至少打8折（不能超過原價的80%）
        if self.original_price and self.surplus_price:
            max_allowed_price = self.original_price * Decimal('0.8')  # 最多只能是原價的80%
            
            if self.surplus_price >= self.original_price:
                raise ValidationError({
                    'surplus_price': '惜福價必須低於原價'
                })
            
            if self.surplus_price > max_allowed_price:
                raise ValidationError({
                    'surplus_price': '惜福價不能高於原價的80%'
                })
    
    def save(self, *args, **kwargs):
        # 自動生成惜福品編號
        if not self.code:
            self.code = self.generate_code()
        
        # 初始化剩餘數量（新建時）
        if not self.pk:
            if not self.remaining_quantity or self.remaining_quantity == 0:
                self.remaining_quantity = self.quantity
        
        # 自動檢查狀態
        if self.status == 'active':
            if self.remaining_quantity <= 0:
                self.status = 'sold_out'
        
        # 在儲存前執行驗證
        self.clean()
        
        super().save(*args, **kwargs)
    
    @staticmethod
    def generate_code():
        """生成唯一的惜福品編號"""
        return f"SF{uuid.uuid4().hex[:8].upper()}"
    
    @property
    def discount_percent(self):
        """計算折扣百分比"""
        if self.original_price > 0:
            return round((1 - (self.surplus_price / self.original_price)) * 100, 1)
        return 0
    
    @property
    def is_available(self):
        """檢查是否可賣"""
        return (
            self.status == 'active' and
            self.remaining_quantity > 0
        )
    
    @property
    def is_near_sold_out(self):
        """檢查是否即將售完（剩餘數量 <= 3）"""
        return self.remaining_quantity <= 3 and self.remaining_quantity > 0


class SurplusFoodOrder(models.Model):
    """
    惜福食品訂單模型
    """
    STATUS_CHOICES = [
        ('pending', '待確認'),
        ('confirmed', '已確認'),
        ('ready', '可取餐'),
        ('completed', '已完成'),
        ('cancelled', '已取消'),
        ('rejected', '已拒絕'),
        ('expired', '已過期'),
    ]
    
    PAYMENT_CHOICES = [
        ('cash', '現金'),
        ('credit_card', '信用卡'),
        ('line_pay', 'LINE Pay'),
        ('points', '點數兌換'),
    ]
    
    ORDER_TYPE_CHOICES = [
        ('dine_in', '內用'),
        ('takeout', '外帶'),
    ]
    
    order_number = models.CharField(
        max_length=20,
        unique=True,
        verbose_name='訂單編號'
    )
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name='surplus_orders',
        verbose_name='店家'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='user_surplus_orders',
        verbose_name='會員',
        help_text='如果是會員下單則記錄用戶資訊'
    )
    # 移除單一品項關聯，改用 items 關聯支援多品項
    # surplus_food 欄位已被 SurplusFoodOrderItem 取代
    customer_name = models.CharField(max_length=100, verbose_name='顧客姓名')
    customer_phone = models.CharField(max_length=20, verbose_name='顧客手機')
    customer_email = models.EmailField(blank=True, verbose_name='顧客Email')
    # 移除 quantity 和 unit_price，這些資訊現在在 SurplusFoodOrderItem 中
    total_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name='總價',
        default=0
    )
    payment_method = models.CharField(
        max_length=20,
        choices=PAYMENT_CHOICES,
        verbose_name='付款方式'
    )
    order_type = models.CharField(
        max_length=20,
        choices=ORDER_TYPE_CHOICES,
        default='takeout',
        verbose_name='訂單類型',
        help_text='內用或外帶'
    )
    table_label = models.CharField(
        max_length=20,
        blank=True,
        verbose_name='桌號',
        help_text='內用訂單的桌號'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        verbose_name='訂單狀態'
    )
    pickup_time = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='預計取餐時間'
    )
    pickup_number = models.CharField(
        max_length=10,
        blank=True,
        verbose_name='取餐號碼',
        help_text='例如：S001, S002'
    )
    use_utensils = models.BooleanField(
        default=False,
        verbose_name='是否需要餐具'
    )
    notes = models.TextField(blank=True, verbose_name='備註')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='訂單時間')
    confirmed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='確認時間'
    )
    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='完成時間'
    )
    
    class Meta:
        db_table = 'surplus_food_orders'
        verbose_name = '惜福食品訂單'
        verbose_name_plural = '惜福食品訂單'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.order_number} - {self.customer_name}"
    
    def save(self, *args, **kwargs):
        # 自動生成訂單編號
        if not self.order_number:
            self.order_number = self.generate_order_number()
        
        # 總價由訂單項目計算，不在這裡計算
        # self.total_price 會在創建訂單項目後更新
        
        super().save(*args, **kwargs)
    
    def update_total_price(self):
        """根據訂單項目更新總價"""
        from django.db.models import Sum, F
        total = self.items.aggregate(
            total=Sum(F('quantity') * F('unit_price'))
        )['total'] or 0
        self.total_price = total
        self.save(update_fields=['total_price'])
    
    @staticmethod
    def generate_order_number():
        """生成唯一訂單編號"""
        import secrets
        import string
        date_str = timezone.now().strftime('%Y%m%d')
        random_str = ''.join(secrets.choice(string.digits) for _ in range(4))
        order_number = f"SFO{date_str}{random_str}"
        
        while SurplusFoodOrder.objects.filter(order_number=order_number).exists():
            random_str = ''.join(secrets.choice(string.digits) for _ in range(4))
            order_number = f"SFO{date_str}{random_str}"
        
        return order_number


class SurplusFoodOrderItem(models.Model):
    """
    惜福食品訂單項目模型 - 支援一張訂單多個品項
    """
    order = models.ForeignKey(
        SurplusFoodOrder,
        on_delete=models.CASCADE,
        related_name='items',
        verbose_name='訂單'
    )
    surplus_food = models.ForeignKey(
        SurplusFood,
        on_delete=models.CASCADE,
        related_name='order_items',
        verbose_name='惜福食品'
    )
    quantity = models.PositiveIntegerField(default=1, verbose_name='數量')
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name='單價'
    )
    subtotal = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name='小計'
    )
    
    class Meta:
        db_table = 'surplus_food_order_items'
        verbose_name = '惜福食品訂單項目'
        verbose_name_plural = '惜福食品訂單項目'
    
    def __str__(self):
        return f"{self.order.order_number} - {self.surplus_food.title} x {self.quantity}"
    
    def save(self, *args, **kwargs):
        # 計算小計
        self.subtotal = self.quantity * self.unit_price
        super().save(*args, **kwargs)


class GreenPointRule(models.Model):
    """
    綠色點數回饋設定模型
    商家設定顧客透過環保行為可以獲得的點數量
    """
    ACTION_TYPE_CHOICES = [
        ('no_utensils', '外帶不要餐具'),
        ('own_container', '自備環保容器'),
        ('own_cup', '自備環保杯'),
        ('own_bag', '自備購物袋'),
        ('dine_in_eco', '內用自備環保餐具'),
    ]
    
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name='green_point_rules',
        verbose_name='所屬店家'
    )
    action_type = models.CharField(
        max_length=30,
        choices=ACTION_TYPE_CHOICES,
        verbose_name='環保行為類型'
    )
    name = models.CharField(
        max_length=100,
        verbose_name='回饋名稱',
        help_text='例如：外帶不要餐具回饋'
    )
    description = models.TextField(
        blank=True,
        verbose_name='回饋說明'
    )
    points_reward = models.PositiveIntegerField(
        default=1,
        verbose_name='獎勵點數',
        help_text='完成此環保行為可獲得的點數'
    )
    
    is_active = models.BooleanField(
        default=True,
        verbose_name='啟用狀態'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='建立時間')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新時間')
    
    class Meta:
        db_table = 'green_point_rules'
        verbose_name = '綠色點數回饋設定'
        verbose_name_plural = '綠色點數回饋設定'
        ordering = ['action_type']
        unique_together = ['store', 'action_type']  # 每個店家每種行為只能一個規則
    
    def __str__(self):
        return f"{self.store.name} - {self.get_action_type_display()} ({self.points_reward}點)"


class PointRedemptionRule(models.Model):
    """
    點數兌換規則模型
    商家設定顧客可以用點數兌換的折扣或商品
    """
    REDEMPTION_TYPE_CHOICES = [
        ('discount', '折扣兌換'),
        ('product', '商品兌換'),
    ]
    
    DISCOUNT_TYPE_CHOICES = [
        ('percent', '百分比折扣'),
        ('amount', '固定金額折扣'),
    ]
    
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name='point_redemption_rules',
        verbose_name='所屬店家'
    )
    name = models.CharField(
        max_length=100,
        verbose_name='規則名稱',
        help_text='例如：100點換9折'
    )
    description = models.TextField(
        blank=True,
        verbose_name='規則描述'
    )
    redemption_type = models.CharField(
        max_length=20,
        choices=REDEMPTION_TYPE_CHOICES,
        default='discount',
        verbose_name='兌換類型'
    )
    required_points = models.PositiveIntegerField(
        verbose_name='所需點數',
        help_text='兌換所需的綠色點數'
    )
    
    # 折扣兌換相關
    discount_type = models.CharField(
        max_length=20,
        choices=DISCOUNT_TYPE_CHOICES,
        null=True,
        blank=True,
        verbose_name='折扣類型'
    )
    discount_value = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name='折扣值',
        help_text='百分比或金額'
    )
    
    # 商品兌換相關
    product_name = models.CharField(
        max_length=255,
        blank=True,
        verbose_name='兌換商品名稱'
    )
    product_description = models.TextField(
        blank=True,
        verbose_name='商品描述'
    )
    max_quantity_per_order = models.PositiveIntegerField(
        default=1,
        verbose_name='單筆訂單可兌換份數',
        help_text='商品兌換時，單筆訂單最多可兌換的份數（折扣兌換固定為1）'
    )
    
    is_active = models.BooleanField(
        default=True,
        verbose_name='啟用狀態'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='建立時間')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新時間')
    
    class Meta:
        db_table = 'point_redemption_rules'
        verbose_name = '點數兌換規則'
        verbose_name_plural = '點數兌換規則'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.store.name} - {self.name} ({self.required_points}點)"


class UserGreenPoints(models.Model):
    """
    用戶綠色點數餘額
    每個用戶在每間店家有獨立的點數餘額
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='green_points',
        verbose_name='用戶'
    )
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name='user_green_points',
        verbose_name='店家'
    )
    points = models.PositiveIntegerField(
        default=0,
        verbose_name='點數餘額'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='建立時間')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新時間')
    
    class Meta:
        db_table = 'user_green_points'
        verbose_name = '用戶綠色點數'
        verbose_name_plural = '用戶綠色點數'
        unique_together = ['user', 'store']  # 每個用戶在每間店只有一筆餘額記錄
    
    def __str__(self):
        return f"{self.user.email} @ {self.store.name}: {self.points}點"
    
    @classmethod
    def get_or_create_balance(cls, user, store):
        """獲取或創建用戶在某店家的點數餘額"""
        balance, created = cls.objects.get_or_create(
            user=user,
            store=store,
            defaults={'points': 0}
        )
        return balance
    
    def add_points(self, amount, reason='', order=None):
        """增加點數"""
        if amount <= 0:
            return
        self.points += amount
        self.save()
        # 記錄交易
        GreenPointTransaction.objects.create(
            user=self.user,
            store=self.store,
            amount=amount,
            transaction_type='earn',
            reason=reason,
            order_id=order.id if order else None
        )
    
    def use_points(self, amount, reason='', order=None):
        """使用點數"""
        if amount <= 0 or self.points < amount:
            return False
        self.points -= amount
        self.save()
        # 記錄交易
        GreenPointTransaction.objects.create(
            user=self.user,
            store=self.store,
            amount=amount,
            transaction_type='redeem',
            reason=reason,
            order_id=order.id if order else None
        )
        return True


class GreenPointTransaction(models.Model):
    """
    綠色點數交易記錄
    """
    TRANSACTION_TYPE_CHOICES = [
        ('earn', '獲得'),
        ('redeem', '兌換'),
    ]
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='green_point_transactions',
        verbose_name='用戶'
    )
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name='green_point_transactions',
        verbose_name='店家'
    )
    amount = models.PositiveIntegerField(
        verbose_name='點數'
    )
    transaction_type = models.CharField(
        max_length=20,
        choices=TRANSACTION_TYPE_CHOICES,
        verbose_name='交易類型'
    )
    reason = models.CharField(
        max_length=255,
        blank=True,
        verbose_name='原因說明'
    )
    order_id = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name='關聯訂單ID'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='交易時間')
    
    class Meta:
        db_table = 'green_point_transactions'
        verbose_name = '綠色點數交易記錄'
        verbose_name_plural = '綠色點數交易記錄'
        ordering = ['-created_at']
    
    def __str__(self):
        type_str = '獲得' if self.transaction_type == 'earn' else '兌換'
        return f"{self.user.email} {type_str} {self.amount}點 @ {self.store.name}"




