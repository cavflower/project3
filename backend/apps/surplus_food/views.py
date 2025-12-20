from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.utils import timezone
from django.db.models import Q
from datetime import datetime
import firebase_admin
from firebase_admin import firestore
from .models import SurplusTimeSlot, SurplusFood, SurplusFoodOrder, SurplusFoodCategory
from .serializers import (
    SurplusTimeSlotSerializer,
    SurplusFoodSerializer,
    SurplusFoodListSerializer,
    SurplusFoodOrderSerializer,
    SurplusFoodCategorySerializer
)

# Firestore 初始化
try:
    db = firestore.client()
except ValueError:
    # Firebase 已經初始化
    db = firestore.client()


class SurplusFoodCategoryViewSet(viewsets.ModelViewSet):
    """
    惜福食品類別管理 ViewSet（商家端）
    """
    serializer_class = SurplusFoodCategorySerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """只返回當前商家的類別"""
        user = self.request.user
        if hasattr(user, 'merchant_profile') and hasattr(user.merchant_profile, 'store'):
            return SurplusFoodCategory.objects.filter(store=user.merchant_profile.store)
        return SurplusFoodCategory.objects.none()
    
    def perform_create(self, serializer):
        """創建時自動關聯到商家的店鋪"""
        user = self.request.user
        if hasattr(user, 'merchant_profile') and hasattr(user.merchant_profile, 'store'):
            serializer.save(store=user.merchant_profile.store)
        else:
            raise ValueError("使用者沒有關聯的店鋪")


class SurplusTimeSlotViewSet(viewsets.ModelViewSet):
    """
    惜福時段管理 ViewSet（商家端）
    """
    serializer_class = SurplusTimeSlotSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """只返回當前商家的時段"""
        user = self.request.user
        if hasattr(user, 'merchant_profile') and hasattr(user.merchant_profile, 'store'):
            return SurplusTimeSlot.objects.filter(store=user.merchant_profile.store)
        return SurplusTimeSlot.objects.none()
    
    def perform_create(self, serializer):
        """創建時自動關聯到商家的店鋪"""
        user = self.request.user
        if hasattr(user, 'merchant_profile') and hasattr(user.merchant_profile, 'store'):
            serializer.save(store=user.merchant_profile.store)
        else:
            raise ValueError("使用者沒有關聯的店鋪")


class SurplusFoodViewSet(viewsets.ModelViewSet):
    """
    惜福食品管理 ViewSet（商家端）
    """
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        """根據動作選擇序列化器"""
        if self.action == 'list':
            return SurplusFoodListSerializer
        return SurplusFoodSerializer
    
    def get_queryset(self):
        """只返回當前商家的惜福食品"""
        user = self.request.user
        if hasattr(user, 'merchant_profile') and hasattr(user.merchant_profile, 'store'):
            queryset = SurplusFood.objects.filter(store=user.merchant_profile.store)
            
            # 支援狀態篩選
            status_filter = self.request.query_params.get('status', None)
            if status_filter:
                queryset = queryset.filter(status=status_filter)
            
            # 支援類別篩選
            category_filter = self.request.query_params.get('category', None)
            if category_filter:
                queryset = queryset.filter(category_id=category_filter)
            
            return queryset
        return SurplusFood.objects.none()
    
    def perform_create(self, serializer):
        """創建時自動關聯到商家的店鋪"""
        user = self.request.user
        if hasattr(user, 'merchant_profile') and hasattr(user.merchant_profile, 'store'):
            serializer.save(
                store=user.merchant_profile.store,
                status='active'  # 預設為上架狀態
            )
        else:
            raise ValueError("使用者沒有關聯的店鋪")
    
    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        """上架惜福品"""
        surplus_food = self.get_object()
        
        # 檢查必要欄位
        if not surplus_food.title or not surplus_food.surplus_price:
            return Response(
                {'error': '請填寫完整的商品資訊'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if surplus_food.remaining_quantity <= 0:
            return Response(
                {'error': '庫存不足，無法上架'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        surplus_food.status = 'active'
        surplus_food.published_at = timezone.now()
        surplus_food.save()
        
        serializer = self.get_serializer(surplus_food)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def unpublish(self, request, pk=None):
        """下架惜福品"""
        surplus_food = self.get_object()
        surplus_food.status = 'inactive'
        surplus_food.save()
        
        serializer = self.get_serializer(surplus_food)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """獲取惜福食品統計資料"""
        user = request.user
        if not hasattr(user, 'merchant_profile') or not hasattr(user.merchant_profile, 'store'):
            return Response({'error': '無權限'}, status=status.HTTP_403_FORBIDDEN)
        
        store = user.merchant_profile.store
        queryset = SurplusFood.objects.filter(store=store)
        
        stats = {
            'total': queryset.count(),
            'active': queryset.filter(status='active').count(),
            'inactive': queryset.filter(status='inactive').count(),
            'sold_out': queryset.filter(status='sold_out').count(),
            'total_views': sum(queryset.values_list('views_count', flat=True)),
            'total_orders': sum(queryset.values_list('orders_count', flat=True)),
        }
        
        return Response(stats)


class PublicSurplusFoodViewSet(viewsets.ReadOnlyModelViewSet):
    """
    惜福食品公開瀏覽 ViewSet（顧客端）
    """
    serializer_class = SurplusFoodListSerializer
    permission_classes = [AllowAny]
    
    def get_queryset(self):
        """只返回上架中且有庫存的惜福食品"""
        queryset = SurplusFood.objects.filter(
            status='active',
            remaining_quantity__gt=0
        )
        
        # 支援店家篩選
        store_id = self.request.query_params.get('store', None)
        if store_id:
            queryset = queryset.filter(store_id=store_id)
        
        # 支援條件篩選
        condition = self.request.query_params.get('condition', None)
        if condition:
            queryset = queryset.filter(condition=condition)
        
        # 支援搜尋
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) |
                Q(description__icontains=search)
            )
        
        return queryset.order_by('-created_at')
    
    @action(detail=False, methods=['get'], url_path='categories')
    def get_categories(self, request):
        """獲取指定店家的惜福品類別（公開）"""
        store_id = request.query_params.get('store', None)
        if not store_id:
            return Response({'detail': 'store parameter is required'}, status=400)
        
        categories = SurplusFoodCategory.objects.filter(
            store_id=store_id,
            is_active=True
        ).order_by('display_order', 'name')
        
        serializer = SurplusFoodCategorySerializer(categories, many=True)
        return Response(serializer.data)
    
    def retrieve(self, request, *args, **kwargs):
        """瀏覽詳情時增加瀏覽次數"""
        instance = self.get_object()
        instance.views_count += 1
        instance.save(update_fields=['views_count'])
        
        serializer = SurplusFoodSerializer(instance)
        return Response(serializer.data)


class SurplusFoodOrderViewSet(viewsets.ModelViewSet):
    """
    惜福食品訂單 ViewSet（商家端）
    """
    serializer_class = SurplusFoodOrderSerializer
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        """創建訂單時不需要認證（顧客下單），其他操作需要認證（商家管理）"""
        if self.action == 'create':
            return [AllowAny()]
        return [IsAuthenticated()]
    
    def get_queryset(self):
        """只返回當前商家的訂單，優化查詢效能"""
        user = self.request.user
        if hasattr(user, 'merchant_profile') and hasattr(user.merchant_profile, 'store'):
            queryset = SurplusFoodOrder.objects.filter(
                store=user.merchant_profile.store
            ).select_related(
                'store', 'user'
            ).prefetch_related(
                'items', 'items__surplus_food'
            )
            
            # 支援狀態篩選
            status_filter = self.request.query_params.get('status', None)
            if status_filter:
                queryset = queryset.filter(status=status_filter)
            
            # 支援訂單類型篩選（內用/外帶）
            order_type_filter = self.request.query_params.get('order_type', None)
            if order_type_filter:
                queryset = queryset.filter(order_type=order_type_filter)
            
            return queryset.order_by('-created_at')
        return SurplusFoodOrder.objects.none()
    
    def generate_pickup_number(self, order_number):
        """生成惜福品取餐號碼（S + 訂單號後三碼）"""
        # 取訂單號碼後三碼
        last_three = order_number[-3:] if len(order_number) >= 3 else order_number
        return f"S{last_three}"
    
    def create(self, request, *args, **kwargs):
        """創建訂單時生成取餐號碼並寫入 Firestore"""
        # 列印請求資料用於除錯
        print("收到惜福品訂單請求：", request.data)
        
        # 獲取店家資訊
        user = request.user
        if not (hasattr(user, 'merchant_profile') and hasattr(user.merchant_profile, 'store')):
            # 如果不是商家，從 items 或 surplus_food 取得 store
            items = request.data.get('items')
            surplus_food_id = request.data.get('surplus_food')
            
            store = None
            if items and len(items) > 0:
                # 新格式：從第一個 item 取得店家
                first_item_id = items[0].get('surplus_food')
                try:
                    surplus_food = SurplusFood.objects.get(id=first_item_id)
                    store = surplus_food.store
                    print(f"從惜福品品項 {first_item_id} 取得店家：{store.name}")
                except SurplusFood.DoesNotExist:
                    print(f"找不到惜福品 ID: {first_item_id}")
                    return Response(
                        {'error': '找不到指定的惜福品'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            elif surplus_food_id:
                # 舊格式：直接從 surplus_food 取得
                try:
                    surplus_food = SurplusFood.objects.get(id=surplus_food_id)
                    store = surplus_food.store
                    print(f"從惜福品 {surplus_food_id} 取得店家：{store.name}")
                except SurplusFood.DoesNotExist:
                    print(f"找不到惜福品 ID: {surplus_food_id}")
                    return Response(
                        {'error': '找不到指定的惜福品'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            else:
                print("請求中缺少 items 或 surplus_food")
                return Response(
                    {'error': '必須提供訂單品項（items）或惜福品（surplus_food）'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            store = user.merchant_profile.store
            print(f"從商家用戶取得店家：{store.name}")
        
        # 創建訂單
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except Exception as e:
            print(f"序列化驗證失敗：{e}")
            raise
        

        # 保存訂單（serializer.save 會調用 create 方法處理品項）
        # 注意：先不設定 pickup_number，等訂單創建後再更新
        save_kwargs = {
            'store': store,
        }
        
        # 如果用戶已登入且不是商家（或者是商家但想記錄），關聯用戶
        # 通常惜福品是由顧客購買，所以記錄當前登入用戶
        if request.user.is_authenticated:
            save_kwargs['user'] = request.user
            
        order = serializer.save(**save_kwargs)
        
        # 生成取餐號碼（基於訂單號後三碼）
        pickup_number = self.generate_pickup_number(order.order_number)
        order.pickup_number = pickup_number
        order.save(update_fields=['pickup_number'])
        print(f"生成取餐號碼：{pickup_number}（訂單號: {order.order_number}）")
        
        # 寫入 Firestore（惜福品專用 collection）
        try:
            # 準備訂單品項資訊
            items_info = []
            for item in order.items.all():
                items_info.append({
                    'surplus_food_id': str(item.surplus_food.id),
                    'surplus_food_title': item.surplus_food.title,
                    'quantity': item.quantity,
                    'unit_price': float(item.unit_price),
                    'subtotal': float(item.subtotal)
                })
            
            surplus_orders_ref = db.collection('surplus_orders').document(str(order.id))
            surplus_orders_ref.set({
                'store_id': str(store.id),
                'order_id': str(order.id),
                'order_number': order.order_number,
                'pickup_number': pickup_number,
                'customer_name': order.customer_name,
                'items': items_info,  # 多品項資訊
                'total_price': float(order.total_price),
                'status': order.status,
                'order_type': order.order_type,
                'use_utensils': order.use_utensils,
                'created_at': datetime.now(),
                'pickup_time': order.pickup_time.isoformat() if order.pickup_time else None,
            })
        except Exception as e:
            # Firestore 寫入失敗不影響主流程
            print(f"寫入 Firestore 失敗: {e}")
        
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """確認訂單並更新 Firestore"""
        order = self.get_object()
        order.status = 'confirmed'
        order.confirmed_at = timezone.now()
        order.save()
        
        # 更新 Firestore
        try:
            surplus_orders_ref = db.collection('surplus_orders').document(str(order.id))
            surplus_orders_ref.update({'status': 'confirmed'})
        except Exception as e:
            print(f"更新 Firestore 失敗: {e}")
        
        serializer = self.get_serializer(order)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def ready(self, request, pk=None):
        """標記為可取餐並更新 Firestore"""
        order = self.get_object()
        order.status = 'ready'
        order.save()
        
        # 更新 Firestore
        try:
            surplus_orders_ref = db.collection('surplus_orders').document(str(order.id))
            surplus_orders_ref.update({'status': 'ready'})
        except Exception as e:
            print(f"更新 Firestore 失敗: {e}")
        
        serializer = self.get_serializer(order)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """完成訂單並更新 Firestore 狀態"""
        order = self.get_object()
        order.status = 'completed'
        order.completed_at = timezone.now()
        order.save()
        
        # 更新 Firestore 狀態為 completed（讓顧客端即時收到通知）
        # 不直接刪除，讓顧客端有時間看到狀態變更
        try:
            surplus_orders_ref = db.collection('surplus_orders').document(str(order.id))
            surplus_orders_ref.update({'status': 'completed'})
        except Exception as e:
            print(f"更新 Firestore 失敗: {e}")
        
        serializer = self.get_serializer(order)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """取消訂單並恢復庫存，從 Firestore 刪除"""
        order = self.get_object()
        
        # 恢復所有品項的庫存
        for item in order.items.all():
            surplus_food = item.surplus_food
            surplus_food.remaining_quantity += item.quantity
            surplus_food.orders_count -= 1
            surplus_food.save()
        
        order.status = 'cancelled'
        order.save()
        
        # 從 Firestore 刪除
        try:
            surplus_orders_ref = db.collection('surplus_orders').document(str(order.id))
            surplus_orders_ref.delete()
        except Exception as e:
            print(f"刪除 Firestore 文件失敗: {e}")
        
        serializer = self.get_serializer(order)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """拒絕訂單並恢復庫存，更新 Firestore 狀態"""
        order = self.get_object()
        
        # 恢復所有品項的庫存
        for item in order.items.all():
            surplus_food = item.surplus_food
            surplus_food.remaining_quantity += item.quantity
            surplus_food.orders_count -= 1
            surplus_food.save()
        
        order.status = 'rejected'  # 使用 rejected 狀態表示拒絕
        order.save()
        
        # 更新 Firestore 狀態為 rejected（讓顧客端即時收到通知）
        # 不直接刪除，讓顧客端有時間看到狀態變更
        try:
            surplus_orders_ref = db.collection('surplus_orders').document(str(order.id))
            surplus_orders_ref.update({'status': 'rejected'})
        except Exception as e:
            print(f"更新 Firestore 失敗: {e}")
        
        serializer = self.get_serializer(order)
        return Response(serializer.data)
    
    @action(detail=True, methods=['delete'])
    def delete_order(self, request, pk=None):
        """刪除已完成或已取消的訂單（只刪除 PostgreSQL）"""
        order = self.get_object()
        
        # 檢查狀態，只允許刪除已完成、已取消或已拒絕的訂單
        if order.status not in ['completed', 'cancelled', 'rejected']:
            return Response(
                {'error': '只能刪除已完成或已取消的訂單'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 刪除訂單
        order.delete()
        
        # 嘗試刪除 Firestore 資料（如果還存在的話）
        try:
            surplus_orders_ref = db.collection('surplus_orders').document(str(pk))
            surplus_orders_ref.delete()
        except Exception as e:
            # Firestore 刪除失敗不影響主要流程（可能已經被刪除）
            print(f"刪除 Firestore 文件失敗: {e}")
        
        return Response(
            {'message': '訂單已刪除'},
            status=status.HTTP_204_NO_CONTENT
        )
