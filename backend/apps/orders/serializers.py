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
        doc_id = pickup_number

        # 寫入 Firestore
        # Firestore 不接受 Django Model 物件，改成原生欄位值
        order_doc = {
            'store_id': store.id,
            'customer_name': validated_data.get('customer_name', ''),
            'customer_phone': validated_data.get('customer_phone', ''),
            'pickup_at': validated_data.get('pickup_at'),
            'payment_method': validated_data.get('payment_method'),
            'notes': validated_data.get('notes', ''),
            'pickup_number': pickup_number,
            'service_channel': validated_data.get('service_channel'),
            'table_label': validated_data.get('table_label'),
            'use_eco_tableware': validated_data.get('use_eco_tableware'),
            'use_utensils': validated_data.get('use_utensils'),
            'status': 'pending',
            'items': [
                {'product_id': item['product'].id, 'quantity': item['quantity']}
                for item in items_data
            ],
            'created_at': firestore.SERVER_TIMESTAMP,
        }
        try:
            db.collection('orders').document(doc_id).set(order_doc)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Failed to write order to Firestore")
            raise serializers.ValidationError({"detail": str(exc)})

        # 回傳一個可序列化的物件
        class Obj: pass
        obj = Obj()
        obj.id = 0
        obj.store = store
        obj.customer_name = validated_data['customer_name']
        obj.customer_phone = validated_data['customer_phone']
        obj.pickup_at = validated_data['pickup_at']
        obj.payment_method = validated_data['payment_method']
        obj.notes = validated_data.get('notes', '')
        obj.pickup_number = pickup_number
        obj.items = []  # 如果需要可加詳細項目
        return obj

    def generate_pickup_number(self, store):
        from uuid import uuid4
        return f"{store.id}-{uuid4().hex[:4].upper()}"
