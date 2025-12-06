# backend/apps/orders/serializers.py
from rest_framework import serializers
from firebase_admin import credentials, firestore, initialize_app
import firebase_admin
from .models import TakeoutOrder, TakeoutOrderItem
import logging

logger = logging.getLogger(__name__)

# 初始化 Firebase Admin
if not firebase_admin._apps:
    cred = credentials.Certificate('serviceAccountKey.json')
    firebase_app = initialize_app(cred)
db = firestore.client()


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
    service_channel = serializers.CharField(required=False, allow_blank=True)
    table_label = serializers.CharField(required=False, allow_blank=True)
    use_eco_tableware = serializers.BooleanField(required=False)
    use_utensils = serializers.BooleanField(required=False)
    items = TakeoutOrderItemSerializer(many=True)

    class Meta:
        model = TakeoutOrder
        fields = [
            'id', 'store', 'customer_name', 'customer_phone',
            'pickup_at', 'payment_method', 'notes', 'pickup_number',
            'service_channel', 'table_label', 'use_eco_tableware', 'use_utensils',
            'items'
        ]
        read_only_fields = ['pickup_number']

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        store = validated_data['store']
        pickup_number = self.generate_pickup_number(store)
        
        # 1. 寫入 PostgreSQL (Supabase) - 完整訂單資料
        order = TakeoutOrder.objects.create(
            pickup_number=pickup_number,
            **validated_data
        )
        
        # 建立訂單項目
        for item_data in items_data:
            TakeoutOrderItem.objects.create(
                order=order,
                **item_data
            )
        
        # 2. 寫入 Firestore - 店家 ID、取餐號碼及訂單管理所需資料
        try:
            db.collection('orders').document(pickup_number).set({
                'store_id': store.id,
                'pickup_number': pickup_number,
                'customer_name': validated_data.get('customer_name', ''),
                'customer_phone': validated_data.get('customer_phone', ''),
                'payment_method': validated_data.get('payment_method', ''),
                'notes': validated_data.get('notes', ''),
                'channel': validated_data.get('service_channel', 'takeout'),
                'use_eco_tableware': validated_data.get('use_eco_tableware'),
                'use_utensils': validated_data.get('use_utensils'),
                'table_label': validated_data.get('table_label'),
                'items': [
                    {'product_id': item['product'].id, 'quantity': item['quantity']}
                    for item in items_data
                ],
                'status': 'pending',
                'created_at': firestore.SERVER_TIMESTAMP,
            })
        except Exception as exc:  # noqa: BLE001
            logger.exception("Failed to write order to Firestore")
            # Firestore 失敗不影響主要流程，只記錄錯誤
        
        return order

    def generate_pickup_number(self, store):
        from uuid import uuid4
        return f"{store.id}-{uuid4().hex[:4].upper()}"
