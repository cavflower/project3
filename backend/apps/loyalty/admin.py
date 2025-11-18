from django.contrib import admin
from .models import PointRule, MembershipLevel, RedemptionProduct


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
