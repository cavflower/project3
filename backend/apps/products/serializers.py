from rest_framework import serializers
from .models import Product

class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = '__all__'
        read_only_fields = ['merchant', 'store']
        extra_kwargs = {
            'is_available': {'default': True}
        }

    def create(self, validated_data):
        request = self.context['request']
        merchant = getattr(request.user, 'merchant_profile', None)
        if not merchant or not hasattr(merchant, 'store'):
            raise serializers.ValidationError('Merchant store not found.')
        validated_data['merchant'] = merchant
        validated_data['store'] = merchant.store
        if 'is_available' not in validated_data:
            validated_data['is_available'] = True
        return super().create(validated_data)


class PublicProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ['id', 'name', 'description', 'price', 'image', 'service_type', 'is_available', 'store']

