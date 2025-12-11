from django.db import models
from django.contrib.auth import get_user_model
from apps.stores.models import Store
import uuid

User = get_user_model()


class PointRule(models.Model):
	"""
	規則：消費多少金額可獲得多少點數（針對商家）
	"""
	store = models.ForeignKey(
		Store, on_delete=models.CASCADE, related_name='point_rules'
	)
	name = models.CharField(max_length=200, help_text='規則名稱，供商家管理用')
	# 表示每消費 1 單位貨幣，獲得多少點數（可以是小數）
	points_per_currency = models.DecimalField(max_digits=10, decimal_places=4, default=0)
	# 最低消費金額才會算入此規則
	min_spend = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
	active = models.BooleanField(default=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		verbose_name = '點數規則'
		verbose_name_plural = '點數規則'

	def __str__(self):
		return f"{self.store.name} - {self.name}"


class MembershipLevel(models.Model):
	"""
	會員等級：達到某個門檻（以點數為單位）享有的權益
	"""
	store = models.ForeignKey(
		Store, on_delete=models.CASCADE, related_name='membership_levels'
	)
	name = models.CharField(max_length=200)
	# 所需最低點數門檻
	threshold_points = models.IntegerField(default=0, help_text='需要的累積點數達到此門檻可成為此等級')
	# 可選的折扣或回饋（百分比）
	discount_percent = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
	benefits = models.TextField(blank=True, default='')
	# 用於排序，數字越小代表越高等級（或可自由定義）
	rank = models.IntegerField(default=0)
	active = models.BooleanField(default=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		verbose_name = '會員等級'
		verbose_name_plural = '會員等級'
		ordering = ['rank', '-threshold_points']

	def __str__(self):
		return f"{self.store.name} - {self.name}"


class RedemptionProduct(models.Model):
	"""
	可兌換商品：商家建立，可由會員用點數兌換
	"""
	store = models.ForeignKey(
		Store, on_delete=models.CASCADE, related_name='redemption_products'
	)
	title = models.CharField(max_length=255)
	description = models.TextField(blank=True, default='')
	required_points = models.IntegerField(help_text='兌換此商品所需點數')
	inventory = models.IntegerField(null=True, blank=True, help_text='存量（null 表示不限量）')
	is_active = models.BooleanField(default=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		verbose_name = '兌換商品'
		verbose_name_plural = '兌換商品'

	def __str__(self):
		return f"{self.store.name} - {self.title} ({self.required_points} pts)"


class CustomerLoyaltyAccount(models.Model):
	"""
	顧客會員帳戶：記錄顧客在特定商家的點數累積與會員等級
	"""
	user = models.ForeignKey(
		User, on_delete=models.CASCADE, related_name='loyalty_accounts'
	)
	store = models.ForeignKey(
		Store, on_delete=models.CASCADE, related_name='customer_accounts'
	)
	# 累計總點數（歷史所有獲得的點數）
	total_points = models.IntegerField(default=0, help_text='歷史累積總點數')
	# 可用點數（扣除已使用的點數）
	available_points = models.IntegerField(default=0, help_text='目前可用點數')
	# 當前會員等級
	current_level = models.ForeignKey(
		'MembershipLevel', on_delete=models.SET_NULL, null=True, blank=True,
		related_name='members'
	)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		verbose_name = '顧客會員帳戶'
		verbose_name_plural = '顧客會員帳戶'
		unique_together = ['user', 'store']

	def __str__(self):
		return f"{self.user.username} @ {self.store.name} ({self.available_points} pts)"

	def update_level(self):
		"""根據累計總點數更新會員等級"""
		levels = MembershipLevel.objects.filter(
			store=self.store,
			active=True,
			threshold_points__lte=self.total_points
		).order_by('-threshold_points')
		
		if levels.exists():
			self.current_level = levels.first()
			self.save()


class PointTransaction(models.Model):
	"""
	點數交易記錄：記錄每一筆點數的獲得或使用
	"""
	TRANSACTION_TYPE_CHOICES = [
		('earn', '獲得'),
		('redeem', '兌換使用'),
		('adjust', '調整'),
		('expire', '過期'),
	]

	account = models.ForeignKey(
		CustomerLoyaltyAccount, on_delete=models.CASCADE, related_name='transactions'
	)
	transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPE_CHOICES)
	points = models.IntegerField(help_text='點數變動量（正數為獲得，負數為使用）')
	description = models.TextField(blank=True, default='')
	# 關聯訂單（如果是從訂單獲得點數）
	order = models.ForeignKey(
		'orders.TakeoutOrder', on_delete=models.SET_NULL, null=True, blank=True,
		related_name='point_transactions'
	)
	# 關聯兌換記錄（如果是兌換使用點數）
	redemption = models.ForeignKey(
		'Redemption', on_delete=models.SET_NULL, null=True, blank=True,
		related_name='point_transactions'
	)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		verbose_name = '點數交易記錄'
		verbose_name_plural = '點數交易記錄'
		ordering = ['-created_at']

	def __str__(self):
		sign = '+' if self.points >= 0 else ''
		return f"{self.account.user.username} {sign}{self.points} pts - {self.get_transaction_type_display()}"


class Redemption(models.Model):
	"""
	兌換記錄：顧客使用點數兌換商品的記錄
	"""
	STATUS_CHOICES = [
		('pending', '待確認'),
		('confirmed', '已確認'),
		('redeemed', '已兌換'),
		('cancelled', '已取消'),
		('expired', '已過期'),
	]

	account = models.ForeignKey(
		CustomerLoyaltyAccount, on_delete=models.CASCADE, related_name='redemptions'
	)
	product = models.ForeignKey(
		RedemptionProduct, on_delete=models.CASCADE, related_name='redemptions'
	)
	points_used = models.IntegerField(help_text='兌換時使用的點數')
	status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
	redemption_code = models.CharField(max_length=50, unique=True, editable=False)
	# 兌換碼有效期限
	expires_at = models.DateTimeField(null=True, blank=True)
	# 實際兌換時間
	redeemed_at = models.DateTimeField(null=True, blank=True)
	notes = models.TextField(blank=True, default='')
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		verbose_name = '兌換記錄'
		verbose_name_plural = '兌換記錄'
		ordering = ['-created_at']

	def __str__(self):
		return f"{self.account.user.username} - {self.product.title} ({self.redemption_code})"

	def save(self, *args, **kwargs):
		if not self.redemption_code:
			self.redemption_code = self.generate_redemption_code()
		super().save(*args, **kwargs)

	@staticmethod
	def generate_redemption_code():
		"""生成唯一的兌換碼"""
		return f"RDM-{uuid.uuid4().hex[:8].upper()}"

