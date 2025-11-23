from rest_framework import serializers
from .models import TakeoutOrder, TakeoutOrderItem

class TakeoutOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = TakeoutOrderItem
        fields = ['product', 'quantity']

    def validate_product(self, value):
        store = self.context['store']
        if value.store_id != store.id:
            raise serializers.ValidationError('商品不屬於該店家')
        return value

class TakeoutOrderSerializer(serializers.ModelSerializer):
    items = TakeoutOrderItemSerializer(many=True)

    class Meta:
        model = TakeoutOrder
        fields = ['id', 'store', 'customer_name', 'customer_phone',
                  'pickup_at', 'payment_method', 'notes', 'pickup_number', 'items']
        read_only_fields = ['pickup_number']

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        order = TakeoutOrder.objects.create(
            pickup_number=self.generate_pickup_number(validated_data['store']),
            **validated_data
        )
        for item_data in items_data:
            TakeoutOrderItem.objects.create(order=order, **item_data)
        return order

    def generate_pickup_number(self, store):
        from uuid import uuid4
        return f"{store.id}-{uuid4().hex[:4].upper()}"
