from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.http import HttpResponse
from django.utils import timezone
from django.db import models
import csv
from .models import Ingredient
from .serializers import IngredientSerializer, IngredientExportSerializer


class IngredientViewSet(viewsets.ModelViewSet):
    """原物料管理 ViewSet"""
    
    serializer_class = IngredientSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """只返回當前商家的原物料"""
        user = self.request.user
        
        # 檢查用戶是否為商家
        if not hasattr(user, 'merchant_profile'):
            return Ingredient.objects.none()
        
        merchant = user.merchant_profile
        if not hasattr(merchant, 'store') or not merchant.store:
            return Ingredient.objects.none()
        
        return Ingredient.objects.filter(store=merchant.store)
    
    def perform_create(self, serializer):
        """建立原物料時自動設定店家"""
        user = self.request.user
        
        if not hasattr(user, 'merchant_profile'):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("您必須是商家才能新增原物料")
        
        merchant = user.merchant_profile
        if not hasattr(merchant, 'store') or not merchant.store:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("您必須先建立店家才能新增原物料")
        
        serializer.save(store=merchant.store)
    
    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        """取得低庫存原物料"""
        queryset = self.get_queryset().filter(quantity__lte=models.F('minimum_stock'))
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def export_today(self, request):
        """匯出當日原物料清單為 CSV"""
        queryset = self.get_queryset()
        
        # 建立 CSV response
        response = HttpResponse(content_type='text/csv; charset=utf-8-sig')
        today = timezone.now().strftime('%Y-%m-%d')
        response['Content-Disposition'] = f'attachment; filename="inventory_{today}.csv"'
        
        # 加入 UTF-8 BOM 以支援 Excel 正確顯示中文
        response.write('\ufeff')
        
        writer = csv.writer(response)
        
        # 寫入標題
        writer.writerow([
            '原料名稱',
            '店家',
            '類別',
            '數量',
            '單位',
            '單價',
            '庫存總價值',
            '供應商',
            '最低庫存量',
            '低庫存警示',
            '備註',
            '建立時間',
            '更新時間',
        ])
        
        # 寫入資料
        for item in queryset:
            writer.writerow([
                item.name,
                item.store.name,
                item.category,
                str(item.quantity),
                item.get_unit_display(),
                str(item.cost_per_unit),
                str(item.total_value),
                item.supplier,
                str(item.minimum_stock),
                '是' if item.is_low_stock else '否',
                item.notes,
                item.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                item.updated_at.strftime('%Y-%m-%d %H:%M:%S'),
            ])
        
        return response
    
    @action(detail=False, methods=['get'])
    def by_category(self, request):
        """依類別分組取得原物料"""
        queryset = self.get_queryset()
        category = request.query_params.get('category', None)
        
        if category:
            queryset = queryset.filter(category=category)
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def adjust_quantity(self, request, pk=None):
        """調整庫存數量"""
        ingredient = self.get_object()
        adjustment = request.data.get('adjustment', 0)
        
        try:
            adjustment = float(adjustment)
            new_quantity = ingredient.quantity + adjustment
            
            if new_quantity < 0:
                return Response(
                    {'error': '調整後的數量不能為負數'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            ingredient.quantity = new_quantity
            ingredient.save()
            
            serializer = self.get_serializer(ingredient)
            return Response(serializer.data)
            
        except (ValueError, TypeError):
            return Response(
                {'error': '無效的調整數量'},
                status=status.HTTP_400_BAD_REQUEST
            )
