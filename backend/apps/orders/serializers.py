# backend/apps/orders/serializers.py
from rest_framework import serializers
from firebase_admin import credentials, firestore, initialize_app
import firebase_admin
from .models import TakeoutOrder, TakeoutOrderItem, DineInOrder, DineInOrderItem, Notification
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
        fields = ['product', 'quantity', 'unit_price', 'specifications']
        extra_kwargs = {
            'unit_price': {'required': False},
            'specifications': {'required': False},
        }

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
        user = None
        if request and request.user.is_authenticated:
            validated_data['user'] = request.user
            user = request.user

        
        # 1. 寫入 PostgreSQL - 完整訂單資料
        order = TakeoutOrder.objects.create(
            pickup_number=pickup_number,
            **validated_data
        )
        
        # 建立訂單項目並計算總金額
        total_amount = 0
        firestore_items = []
        for item_data in items_data:
            product = item_data['product']
            quantity = item_data['quantity']
            unit_price = item_data.get('unit_price') or product.price
            specifications = item_data.get('specifications', [])
            
            item = TakeoutOrderItem.objects.create(
                order=order,
                product=product,
                quantity=quantity,
                unit_price=unit_price,
                specifications=specifications
            )
            total_amount += float(unit_price) * quantity
            
            # 準備 Firestore 資料
            firestore_items.append({
                'product_id': product.id,
                'quantity': quantity,
                'unit_price': float(unit_price),
                'specifications': specifications
            })
        
        # 2. 自動建立或更新會員帳戶（如果用戶已登入）
        if user and store.enable_loyalty:
            from apps.loyalty.models import CustomerLoyaltyAccount, PointRule, PointTransaction
            from decimal import Decimal
            
            loyalty_account, created = CustomerLoyaltyAccount.objects.get_or_create(
                user=user,
                store=store,
                defaults={'available_points': 0, 'total_points': 0}
            )
            if created:
                logger.info(f"為用戶 {user.email} 在店家 {store.name} 創建會員帳戶")
            
            # 計算並累積點數（根據店家的點數規則）
            try:
                # 獲取該店家的活躍點數規則
                point_rule = PointRule.objects.filter(
                    store=store,
                    active=True
                ).first()
                
                if point_rule:
                    # 檢查是否達到最低消費門檻
                    min_spend = point_rule.min_spend or Decimal('0')
                    if total_amount >= min_spend:
                        # 計算獲得的點數
                        earned_points = int(total_amount * point_rule.points_per_currency)
                        
                        if earned_points > 0:
                            # 更新會員帳戶點數
                            loyalty_account.available_points += earned_points
                            loyalty_account.total_points += earned_points
                            loyalty_account.save()
                            
                            # 創建點數交易記錄
                            PointTransaction.objects.create(
                                account=loyalty_account,
                                points=earned_points,
                                transaction_type='earn',
                                description=f'外帶訂單消費 ${total_amount} 元獲得點數',
                                order=order
                            )
                            
                            logger.info(f"用戶 {user.email} 在店家 {store.name} 獲得 {earned_points} 點")
            except Exception as e:
                logger.error(f"計算點數時發生錯誤: {e}")
        
        # 3. 寫入 Firestore - 即時訂單通知

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
                'items': firestore_items,
                'status': 'pending',
                'created_at': firestore.SERVER_TIMESTAMP,
            })
        except Exception as exc:
            logger.exception("Failed to write order to Firestore")
        
        return order

    def generate_pickup_number(self, store):
        import random
        # 生成 1-1000 的隨機取餐號碼
        random_number = random.randint(1, 1000)
        return str(random_number)


# ===== 內用訂單 Serializers =====
class DineInOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = DineInOrderItem
        fields = ['product', 'quantity', 'unit_price', 'specifications']
        extra_kwargs = {
            'unit_price': {'required': False},
            'specifications': {'required': False},
        }

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

        user = None
        if request and request.user.is_authenticated:
            validated_data['user'] = request.user
            user = request.user

        
        # 1. 寫入 PostgreSQL - 完整訂單資料
        order = DineInOrder.objects.create(
            order_number=order_number,
            **validated_data
        )
        
        # 建立訂單項目並計算總金額
        total_amount = 0
        firestore_items = []
        for item_data in items_data:
            product = item_data['product']
            quantity = item_data['quantity']
            unit_price = item_data.get('unit_price') or product.price
            specifications = item_data.get('specifications', [])
            
            item = DineInOrderItem.objects.create(
                order=order,
                product=product,
                quantity=quantity,
                unit_price=unit_price,
                specifications=specifications
            )
            total_amount += float(unit_price) * quantity
            
            # 準備 Firestore 資料
            firestore_items.append({
                'product_id': product.id,
                'quantity': quantity,
                'unit_price': float(unit_price),
                'specifications': specifications
            })
        
        # 2. 自動建立或更新會員帳戶（如果用戶已登入）
        if user and store.enable_loyalty:
            from apps.loyalty.models import CustomerLoyaltyAccount, PointRule, PointTransaction
            from decimal import Decimal
            
            loyalty_account, created = CustomerLoyaltyAccount.objects.get_or_create(
                user=user,
                store=store,
                defaults={'available_points': 0, 'total_points': 0}
            )
            if created:
                logger.info(f"為用戶 {user.email} 在店家 {store.name} 創建會員帳戶")
            
            # 計算並累積點數（根據店家的點數規則）
            try:
                # 獲取該店家的活躍點數規則
                point_rule = PointRule.objects.filter(
                    store=store,
                    active=True
                ).first()
                
                if point_rule:
                    # 檢查是否達到最低消費門檻
                    min_spend = point_rule.min_spend or Decimal('0')
                    if total_amount >= min_spend:
                        # 計算獲得的點數
                        earned_points = int(total_amount * point_rule.points_per_currency)
                        
                        if earned_points > 0:
                            # 更新會員帳戶點數
                            loyalty_account.available_points += earned_points
                            loyalty_account.total_points += earned_points
                            loyalty_account.save()
                            
                            # 創建點數交易記錄
                            PointTransaction.objects.create(
                                account=loyalty_account,
                                points=earned_points,
                                transaction_type='earn',
                                description=f'內用訂單消費 ${total_amount} 元獲得點數'
                            )
                            
                            logger.info(f"用戶 {user.email} 在店家 {store.name} 獲得 {earned_points} 點")
            except Exception as e:
                logger.error(f"計算點數時發生錯誤: {e}")
        
        # 3. 寫入 Firestore - 即時訂單通知

        try:
            db.collection('orders').document(order_number).set({
                'store_id': store.id,
                'order_number': order_number,
                'pickup_number': order_number,
                'customer_name': validated_data.get('customer_name', ''),
                'customer_phone': validated_data.get('customer_phone', ''),
                'table_label': validated_data.get('table_label', ''),
                'payment_method': validated_data.get('payment_method', ''),
                'notes': validated_data.get('notes', ''),
                'channel': 'dine_in',
                'use_eco_tableware': validated_data.get('use_eco_tableware', False),
                'items': firestore_items,
                'status': 'pending',
                'created_at': firestore.SERVER_TIMESTAMP,
            })
        except Exception as exc:
            logger.exception("Failed to write dinein order to Firestore")
        
        return order

    def generate_order_number(self, store):
        import random
        # 生成 1-1000 的隨機訂單號碼
        random_number = random.randint(1, 1000)
        return str(random_number)


class NotificationSerializer(serializers.ModelSerializer):
    notification_type_display = serializers.CharField(source='get_notification_type_display', read_only=True)
    
    class Meta:
        model = Notification
        fields = [
            'id', 'title', 'message', 'notification_type', 
            'notification_type_display', 'is_read', 
            'order_number', 'created_at'
        ]
