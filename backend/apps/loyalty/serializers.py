from rest_framework import serializers
from .models import PointRule, MembershipLevel, RedemptionProduct


class PointRuleSerializer(serializers.ModelSerializer):
	class Meta:
		model = PointRule
		fields = [
			'id', 'store', 'name', 'points_per_currency', 'min_spend', 'active', 'created_at', 'updated_at'
		]
		read_only_fields = ['id', 'created_at', 'updated_at']


class MembershipLevelSerializer(serializers.ModelSerializer):
	class Meta:
		model = MembershipLevel
		fields = [
			'id', 'store', 'name', 'threshold_points', 'discount_percent', 'benefits', 'rank', 'active',
			'created_at', 'updated_at'
		]
		read_only_fields = ['id', 'created_at', 'updated_at']


class RedemptionProductSerializer(serializers.ModelSerializer):
	class Meta:
		model = RedemptionProduct
		fields = [
			'id', 'store', 'title', 'description', 'required_points', 'inventory', 'is_active',
			'created_at', 'updated_at'
		]
		read_only_fields = ['id', 'created_at', 'updated_at']
