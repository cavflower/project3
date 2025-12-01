from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.http import HttpResponse
from django.utils import timezone
from django.conf import settings
import csv
from .models import Staff, Shift
from .serializers import StaffSerializer, ShiftSerializer, ScheduleDataSerializer


class StaffViewSet(viewsets.ModelViewSet):
    """員工管理 ViewSet"""
    
    serializer_class = StaffSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """只返回當前商家的員工"""
        user = self.request.user
        
        if not hasattr(user, 'merchant_profile'):
            return Staff.objects.none()
        
        merchant = user.merchant_profile
        if not hasattr(merchant, 'store') or not merchant.store:
            return Staff.objects.none()
        
        return Staff.objects.filter(store=merchant.store)
    
    def perform_create(self, serializer):
        """建立員工時自動設定店家"""
        user = self.request.user
        
        if not hasattr(user, 'merchant_profile'):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("您必須是商家才能新增員工")
        
        merchant = user.merchant_profile
        if not hasattr(merchant, 'store') or not merchant.store:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("您必須先建立店家才能新增員工")
        
        serializer.save(store=merchant.store)


class ShiftViewSet(viewsets.ModelViewSet):
    """排班管理 ViewSet"""
    
    serializer_class = ShiftSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """只返回當前商家的排班"""
        user = self.request.user
        
        if not hasattr(user, 'merchant_profile'):
            return Shift.objects.none()
        
        merchant = user.merchant_profile
        if not hasattr(merchant, 'store') or not merchant.store:
            return Shift.objects.none()
        
        return Shift.objects.filter(store=merchant.store).prefetch_related('assigned_staff')
    
    def perform_create(self, serializer):
        """建立排班時自動設定店家"""
        user = self.request.user
        
        if not hasattr(user, 'merchant_profile'):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("您必須是商家才能新增排班")
        
        merchant = user.merchant_profile
        if not hasattr(merchant, 'store') or not merchant.store:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("您必須先建立店家才能新增排班")
        
        serializer.save(store=merchant.store)
    
    @action(detail=False, methods=['get', 'post'])
    def save_all(self, request):
        """批次儲存所有排班資料"""
        user = request.user
        
        if not hasattr(user, 'merchant_profile'):
            return Response(
                {'error': '您必須是商家才能儲存排班資料'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        merchant = user.merchant_profile
        if not hasattr(merchant, 'store') or not merchant.store:
            return Response(
                {'error': '您必須先建立店家才能儲存排班資料'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        store = merchant.store
        
        if request.method == 'GET':
            try:
                # 取得所有資料
                shifts = Shift.objects.filter(store=store).prefetch_related('assigned_staff')
                staff = Staff.objects.filter(store=store)
                
                shift_serializer = ShiftSerializer(shifts, many=True)
                staff_serializer = StaffSerializer(staff, many=True)
                
                return Response({
                    'shifts': shift_serializer.data,
                    'staff': staff_serializer.data
                })
            except Exception as e:
                # 如果資料表不存在，返回空資料而不是錯誤
                import traceback
                error_trace = traceback.format_exc()
                if 'does not exist' in str(e) or 'relation' in str(e).lower():
                    # 資料表不存在，返回空資料
                    return Response({
                        'shifts': [],
                        'staff': []
                    })
                else:
                    # 其他錯誤，記錄並返回錯誤
                    print(f"載入排班資料時發生錯誤: {e}")
                    print(f"錯誤堆疊: {error_trace}")
                    return Response(
                        {'error': f'載入資料失敗: {str(e)}'}, 
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )
        
        elif request.method == 'POST':
            try:
                # 檢查資料表是否存在
                try:
                    # 嘗試查詢來檢查資料表是否存在
                    Staff.objects.filter(store=store).exists()
                except Exception as table_error:
                    if 'does not exist' in str(table_error) or 'relation' in str(table_error).lower():
                        return Response(
                            {'error': '資料表尚未建立，請先執行資料庫遷移: python manage.py migrate schedules'}, 
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR
                        )
                    else:
                        raise
                
                # 批次儲存資料
                serializer = ScheduleDataSerializer(data=request.data)
                if not serializer.is_valid():
                    return Response(
                        {'error': '資料格式錯誤', 'details': serializer.errors}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # 取得前端發送的所有資料
                staff_data = serializer.validated_data.get('staff', [])
                shifts_data = serializer.validated_data.get('shifts', [])
                
                print(f"收到前端資料：員工 {len(staff_data)} 個，排班 {len(shifts_data)} 個")
                
                # 簡單策略：先刪除該店家的所有舊資料，再創建新資料
                # 這樣可以避免複雜的更新/創建/刪除邏輯，確保資料一致性
                
                # 1. 刪除該店家的所有舊資料
                deleted_staff_count = Staff.objects.filter(store=store).delete()[0]
                deleted_shift_count = Shift.objects.filter(store=store).delete()[0]
                print(f"已刪除舊資料：員工 {deleted_staff_count} 個，排班 {deleted_shift_count} 個")
                
                # 2. 創建所有新員工
                staff_ids_map = {}  # 用於映射前端 ID 到資料庫 ID
                
                for staff_item in staff_data:
                    try:
                        if not isinstance(staff_item, dict):
                            continue
                        
                        # 提取員工資料（排除不需要的欄位）
                        staff_item_copy = {
                            k: v for k, v in staff_item.items() 
                            if k not in ['id', 'store', 'created_at', 'updated_at']
                        }
                        
                        frontend_id = staff_item.get('id')
                        
                        # 創建新員工
                        staff_obj = Staff.objects.create(store=store, **staff_item_copy)
                        
                        # 記錄映射關係（用於後續排班的 assigned_staff_ids 映射）
                        # 無論前端 ID 是什麼，都記錄映射關係
                        if frontend_id:
                            staff_ids_map[frontend_id] = staff_obj.id
                            print(f"創建員工：前端 ID {frontend_id} -> 資料庫 ID {staff_obj.id}, 姓名: {staff_item_copy.get('name')}")
                        else:
                            print(f"創建員工：資料庫 ID {staff_obj.id}, 姓名: {staff_item_copy.get('name')}")
                            
                    except Exception as e:
                        print(f"儲存員工資料時發生錯誤: {e}")
                        print(f"員工資料: {staff_item}")
                        return Response(
                            {'error': f'儲存員工資料失敗: {str(e)}'}, 
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR
                        )
                
                # 打印所有員工映射關係，用於調試
                print(f"員工 ID 映射表: {staff_ids_map}")
                
                # 3. 創建所有新排班
                for shift_item in shifts_data:
                    try:
                        if not isinstance(shift_item, dict):
                            continue
                        
                        # 提取排班資料（排除不需要的欄位）
                        assigned_staff_ids = shift_item.get('assigned_staff_ids', [])
                        shift_item_copy = {
                            k: v for k, v in shift_item.items() 
                            if k not in ['id', 'assigned_staff', 'assigned_staff_ids', 'store', 'shift_name', 'created_at', 'updated_at']
                        }
                        
                        # 創建新排班
                        shift_obj = Shift.objects.create(store=store, **shift_item_copy)
                        
                        # 處理指派員工（將前端 ID 映射到資料庫 ID）
                        if assigned_staff_ids and isinstance(assigned_staff_ids, list) and len(assigned_staff_ids) > 0:
                            # 將前端員工 ID 映射到資料庫 ID
                            mapped_staff_ids = []
                            for frontend_id in assigned_staff_ids:
                                if not frontend_id:
                                    continue
                                # 先嘗試從映射表查找（新創建的員工）
                                if frontend_id in staff_ids_map:
                                    mapped_staff_ids.append(staff_ids_map[frontend_id])
                                    print(f"  映射員工 ID: {frontend_id} -> {staff_ids_map[frontend_id]}")
                                else:
                                    # 如果映射表中沒有，可能是資料庫 ID（已存在的員工）
                                    # 直接使用原 ID，稍後會驗證是否存在
                                    mapped_staff_ids.append(frontend_id)
                                    print(f"  使用原員工 ID: {frontend_id}（未在映射表中）")
                            
                            # 過濾出在資料庫中存在的員工 ID
                            valid_staff_ids = list(
                                Staff.objects.filter(id__in=mapped_staff_ids, store=store)
                                .values_list('id', flat=True)
                            )
                            
                            print(f"  排班 ID {shift_obj.id} 的 assigned_staff_ids: {assigned_staff_ids}")
                            print(f"  映射後的 ID: {mapped_staff_ids}")
                            print(f"  有效的員工 ID: {valid_staff_ids}")
                            
                            if valid_staff_ids:
                                shift_obj.assigned_staff.set(
                                    Staff.objects.filter(id__in=valid_staff_ids, store=store)
                                )
                                actual_count = shift_obj.assigned_staff.count()
                                print(f"創建排班 ID {shift_obj.id}，指派員工 {actual_count} 個（有效 ID: {valid_staff_ids}）")
                            else:
                                print(f"創建排班 ID {shift_obj.id}，無有效指派員工（映射後的 ID 都不存在於資料庫）")
                        else:
                            print(f"創建排班 ID {shift_obj.id}，無指派員工（assigned_staff_ids 為空或無效）")
                            
                    except Exception as e:
                        print(f"儲存排班資料時發生錯誤: {e}")
                        print(f"排班資料: {shift_item}")
                        return Response(
                            {'error': f'儲存排班資料失敗: {str(e)}'}, 
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR
                        )
                
                # 4. 重新查詢所有資料並返回
                shifts = Shift.objects.filter(store=store).prefetch_related('assigned_staff').order_by('date', 'start_hour', 'start_minute')
                staff = Staff.objects.filter(store=store).order_by('name')
                
                print(f"最終資料：排班 {shifts.count()} 個，員工 {staff.count()} 個")
                
                shift_serializer = ShiftSerializer(shifts, many=True)
                staff_serializer = StaffSerializer(staff, many=True)
                
                # 調試：檢查序列化後的資料
                for i, shift_data in enumerate(shift_serializer.data):
                    assigned_staff_data = shift_data.get('assigned_staff', [])
                    print(f"序列化後的排班 {i} (ID: {shift_data.get('id')}) 的 assigned_staff: {len(assigned_staff_data)} 個員工")
                    if assigned_staff_data:
                        print(f"  員工資料: {[s.get('id') for s in assigned_staff_data]}")
                
                return Response({
                    'message': '排班資料已成功儲存',
                    'shifts': shift_serializer.data,
                    'staff': staff_serializer.data
                }, status=status.HTTP_200_OK)
            except Exception as e:
                import traceback
                error_trace = traceback.format_exc()
                print(f"儲存排班資料時發生未預期的錯誤: {e}")
                print(f"錯誤堆疊: {error_trace}")
                return Response(
                    {'error': f'伺服器內部錯誤: {str(e)}', 'trace': error_trace if settings.DEBUG else None}, 
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
    
    @action(detail=False, methods=['get'])
    def export_csv(self, request):
        """匯出班表為 CSV"""
        user = request.user
        
        if not hasattr(user, 'merchant_profile'):
            return Response(
                {'error': '您必須是商家才能匯出班表'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        merchant = user.merchant_profile
        if not hasattr(merchant, 'store') or not merchant.store:
            return Response(
                {'error': '您必須先建立店家才能匯出班表'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        store = merchant.store
        shifts = Shift.objects.filter(store=store).prefetch_related('assigned_staff')
        
        # 建立 CSV response
        response = HttpResponse(content_type='text/csv; charset=utf-8-sig')
        today = timezone.now().strftime('%Y-%m-%d')
        response['Content-Disposition'] = f'attachment; filename="排班表_{today}.csv"'
        
        # 加入 UTF-8 BOM 以支援 Excel 正確顯示中文
        response.write('\ufeff')
        
        writer = csv.writer(response)
        
        # 寫入標題
        writer.writerow([
            '日期',
            '時段',
            '職務',
            '需求人數',
            '已排人員',
            '狀態',
        ])
        
        # 寫入資料
        for shift in shifts:
            assigned_names = ', '.join([staff.name for staff in shift.assigned_staff.all()])
            status_display = dict(Shift.STATUS_CHOICES).get(shift.status, shift.status)
            
            writer.writerow([
                shift.date.strftime('%Y-%m-%d'),
                shift.shift_name,
                shift.role,
                shift.staff_needed,
                assigned_names or '-',
                status_display,
            ])
        
        return response

