from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.utils import timezone
from django.db.models import Q
from .models import SurplusTimeSlot, SurplusFood, SurplusFoodOrder, SurplusFoodCategory
from .serializers import (
    SurplusTimeSlotSerializer,
    SurplusFoodSerializer,
    SurplusFoodListSerializer,
    SurplusFoodOrderSerializer,
    SurplusFoodCategorySerializer
)


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
        now = timezone.now()
        queryset = SurplusFood.objects.filter(
            status='active',
            remaining_quantity__gt=0,
            available_from__lte=now,
            available_until__gte=now
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
    
    def get_queryset(self):
        """只返回當前商家的訂單"""
        user = self.request.user
        if hasattr(user, 'merchant_profile') and hasattr(user.merchant_profile, 'store'):
            queryset = SurplusFoodOrder.objects.filter(store=user.merchant_profile.store)
            
            # 支援狀態篩選
            status_filter = self.request.query_params.get('status', None)
            if status_filter:
                queryset = queryset.filter(status=status_filter)
            
            return queryset.order_by('-created_at')
        return SurplusFoodOrder.objects.none()
    
    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """確認訂單"""
        order = self.get_object()
        order.status = 'confirmed'
        order.confirmed_at = timezone.now()
        order.save()
        
        serializer = self.get_serializer(order)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def ready(self, request, pk=None):
        """標記為可取餐"""
        order = self.get_object()
        order.status = 'ready'
        order.save()
        
        serializer = self.get_serializer(order)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """完成訂單"""
        order = self.get_object()
        order.status = 'completed'
        order.completed_at = timezone.now()
        order.save()
        
        serializer = self.get_serializer(order)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """取消訂單並恢復庫存"""
        order = self.get_object()
        
        # 恢復庫存
        surplus_food = order.surplus_food
        surplus_food.remaining_quantity += order.quantity
        surplus_food.save()
        
        order.status = 'cancelled'
        order.save()
        
        serializer = self.get_serializer(order)
        return Response(serializer.data)
