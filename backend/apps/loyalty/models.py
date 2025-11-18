from django.db import models
from apps.stores.models import Store


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

