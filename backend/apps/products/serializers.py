from rest_framework import serializers
from .models import Product

class ProductSerializer(serializers.ModelSerializer):
    """
    Serializer for the Product model.
    """
    merchant_name = serializers.CharField(source='merchant.user.username', read_only=True)

    class Meta:
        model = Product
        fields = [
            'id', 
            'merchant', 
            'merchant_name',
            'name', 
            'description', 
            'price', 
            'image', 
            'is_available',
            'created_at',
            'updated_at',
            'service_type'
        ]
        read_only_fields = ['merchant'] # Merchant is set automatically from the request user.
