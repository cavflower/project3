from django.contrib import admin
from .models import (
	PointRule, MembershipLevel, RedemptionProduct,
	CustomerLoyaltyAccount, PointTransaction, Redemption
)


@admin.register(PointRule)
class PointRuleAdmin(admin.ModelAdmin):
    list_display = ('id', 'store', 'name', 'points_per_currency', 'min_spend', 'active')
    list_filter = ('store', 'active')
    search_fields = ('name',)


@admin.register(MembershipLevel)
class MembershipLevelAdmin(admin.ModelAdmin):
    list_display = ('id', 'store', 'name', 'threshold_points', 'discount_percent', 'rank', 'active')
    list_filter = ('store', 'active')
    search_fields = ('name',)


@admin.register(RedemptionProduct)
class RedemptionProductAdmin(admin.ModelAdmin):
    list_display = ('id', 'store', 'title', 'required_points', 'inventory', 'is_active')
    list_filter = ('store', 'is_active')
    search_fields = ('title',)


@admin.register(CustomerLoyaltyAccount)
class CustomerLoyaltyAccountAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'store', 'total_points', 'available_points', 'current_level', 'created_at')
    list_filter = ('store', 'current_level')
    search_fields = ('user__username', 'user__email')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(PointTransaction)
class PointTransactionAdmin(admin.ModelAdmin):
    list_display = ('id', 'account', 'transaction_type', 'points', 'created_at')
    list_filter = ('transaction_type', 'created_at')
    search_fields = ('account__user__username', 'description')
    readonly_fields = ('created_at',)


@admin.register(Redemption)
class RedemptionAdmin(admin.ModelAdmin):
    list_display = ('id', 'account', 'product', 'points_used', 'status', 'redemption_code', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('account__user__username', 'redemption_code', 'product__title')
    readonly_fields = ('redemption_code', 'created_at', 'updated_at')
