# backend/apps/orders/serializers.py
from rest_framework import serializers
from firebase_admin import credentials, firestore, initialize_app
import firebase_admin
from .models import TakeoutOrder, TakeoutOrderItem, DineInOrder, DineInOrderItem
import logging

logger = logging.getLogger(__name__)

# 初始化 Firebase Admin
if not firebase_admin._apps:
    cred = credentials.Certificate('serviceAccountKey.json')
    firebase_app = initialize_app(cred)
db = firestore.client()


# ===== 外帶訂單 Serializers =====
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
        fields = [
            'id', 'store', 'user', 'customer_name', 'customer_phone',
            'pickup_at', 'payment_method', 'notes', 'pickup_number',
            'use_utensils', 'items'
        ]
        read_only_fields = ['pickup_number', 'user']

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        store = validated_data['store']
        pickup_number = self.generate_pickup_number(store)
        
        # 從 request 獲取用戶資訊（如果已登入）
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['user'] = request.user
        
        # 1. 寫入 PostgreSQL - 完整訂單資料
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
        
        # 2. 寫入 Firestore - 即時訂單通知
        try:
            db.collection('orders').document(pickup_number).set({
                'store_id': store.id,
                'pickup_number': pickup_number,
                'customer_name': validated_data.get('customer_name', ''),
                'customer_phone': validated_data.get('customer_phone', ''),
                'payment_method': validated_data.get('payment_method', ''),
                'notes': validated_data.get('notes', ''),
                'channel': 'takeout',
                'use_utensils': validated_data.get('use_utensils', False),
                'items': [
                    {'product_id': item['product'].id, 'quantity': item['quantity']}
                    for item in items_data
                ],
                'status': 'pending',
                'created_at': firestore.SERVER_TIMESTAMP,
            })
        except Exception as exc:
            logger.exception("Failed to write order to Firestore")
        
        return order

    def generate_pickup_number(self, store):
        from uuid import uuid4
        return f"{store.id}-{uuid4().hex[:4].upper()}"


# ===== 內用訂單 Serializers =====
class DineInOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = DineInOrderItem
        fields = ['product', 'quantity']

    def validate_product(self, value):
        store = self.context['store']
        if value.store_id != store.id:
            raise serializers.ValidationError('商品不屬於該店家')
        return value


class DineInOrderSerializer(serializers.ModelSerializer):
    items = DineInOrderItemSerializer(many=True)

    class Meta:
        model = DineInOrder
        fields = [
            'id', 'store', 'user', 'customer_name', 'customer_phone',
            'table_label', 'payment_method', 'notes', 'order_number',
            'use_eco_tableware', 'items'
        ]
        read_only_fields = ['order_number', 'user']

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        store = validated_data['store']
        order_number = self.generate_order_number(store)
        
        # 從 request 獲取用戶資訊（如果已登入）
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['user'] = request.user
        
        # 1. 寫入 PostgreSQL - 完整訂單資料
        order = DineInOrder.objects.create(
            order_number=order_number,
            **validated_data
        )
        
        # 建立訂單項目
        for item_data in items_data:
            DineInOrderItem.objects.create(
                order=order,
                **item_data
            )
        
        # 2. 寫入 Firestore - 即時訂單通知
        try:
            db.collection('orders').document(order_number).set({
                'store_id': store.id,
                'order_number': order_number,
                'pickup_number': order_number,  # 相容舊欄位
                'customer_name': validated_data.get('customer_name', ''),
                'customer_phone': validated_data.get('customer_phone', ''),
                'table_label': validated_data.get('table_label', ''),
                'payment_method': validated_data.get('payment_method', ''),
                'notes': validated_data.get('notes', ''),
                'channel': 'dine_in',
                'use_eco_tableware': validated_data.get('use_eco_tableware', False),
                'items': [
                    {'product_id': item['product'].id, 'quantity': item['quantity']}
                    for item in items_data
                ],
                'status': 'pending',
                'created_at': firestore.SERVER_TIMESTAMP,
            })
        except Exception as exc:
            logger.exception("Failed to write dinein order to Firestore")
        
        return order

    def generate_order_number(self, store):
        from uuid import uuid4
        return f"{store.id}-{uuid4().hex[:4].upper()}"
