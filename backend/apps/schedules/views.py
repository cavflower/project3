from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.http import HttpResponse
from django.utils import timezone
from django.conf import settings
from django.db import transaction
from django.utils.dateparse import parse_date
import csv
from .models import Staff, Shift, ShiftApplication
from .serializers import StaffSerializer, ShiftSerializer, ScheduleDataSerializer, ShiftApplicationSerializer


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


class ShiftApplicationViewSet(viewsets.ModelViewSet):
    """排班申請 ViewSet"""
    
    serializer_class = ShiftApplicationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """根據用戶角色返回不同的申請列表"""
        user = self.request.user
        
        # 檢查是否是員工（有 staff_profile，且取第一筆）
        staff = None
        if hasattr(user, 'staff_profile'):
            staff = user.staff_profile.first()
        if staff:
            # 員工只能看到自己的申請
            return ShiftApplication.objects.filter(staff=staff)
        
        # 檢查是否是店長（有 merchant_profile）
        elif hasattr(user, 'merchant_profile'):
            merchant = user.merchant_profile
            if hasattr(merchant, 'store') and merchant.store:
                # 店長可以看到該店所有排班的申請
                return ShiftApplication.objects.filter(shift__store=merchant.store)
        
        # 其他情況返回空
        return ShiftApplication.objects.none()
    
    def perform_create(self, serializer):
        """員工申請排班"""
        user = self.request.user
        
        # 檢查用戶是否是員工
        staff = user.staff_profile.first() if hasattr(user, 'staff_profile') else None
        if not staff:
            raise PermissionDenied("只有員工可以申請排班")
        shift_id = self.request.data.get('shift')
        
        if not shift_id:
            raise ValidationError("請選擇要申請的排班時段")
        
        try:
            shift = Shift.objects.get(id=shift_id)
        except Shift.DoesNotExist:
            raise ValidationError("排班時段不存在")
        
        # 檢查員工是否屬於該店
        if staff.store != shift.store:
            raise PermissionDenied("您只能申請所屬店家的排班")
        
        # 檢查是否已經申請過
        if ShiftApplication.objects.filter(shift=shift, staff=staff).exists():
            raise ValidationError("您已經申請過這個排班時段")
        
        # 檢查排班是否已經被確認（assigned_staff 中已包含該員工）
        if shift.assigned_staff.filter(id=staff.id).exists():
            raise ValidationError("您已經被指派到這個排班時段")
        
        # 保存申請
        serializer.save(staff=staff, shift=shift)
        
        # 更新排班狀態為「已申請」（如果還是「待排班」）
        if shift.status == 'pending':
            shift.status = 'applied'
            shift.save()
    
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """店長確認申請"""
        user = request.user
        
        # 檢查是否是店長
        if not hasattr(user, 'merchant_profile'):
            raise PermissionDenied("只有店長可以確認申請")
        
        merchant = user.merchant_profile
        if not hasattr(merchant, 'store') or not merchant.store:
            raise PermissionDenied("您必須先建立店家才能確認申請")
        
        try:
            application = self.get_object()
        except ShiftApplication.DoesNotExist:
            return Response(
                {'error': '申請不存在'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # 檢查申請是否屬於該店
        if application.shift.store != merchant.store:
            raise PermissionDenied("您只能確認所屬店家的申請")
        
        # 檢查申請狀態
        if application.status != 'pending':
            return Response(
                {'error': f'申請狀態為「{application.get_status_display()}」，無法確認'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 檢查排班是否還有空缺
        shift = application.shift
        current_assigned_count = shift.assigned_staff.count()
        if current_assigned_count >= shift.staff_needed:
            return Response(
                {'error': '該排班時段已滿員'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 確認申請
        with transaction.atomic():
            application.status = 'approved'
            application.reviewed_at = timezone.now()
            application.save()
            
            # 將員工加入排班
            shift.assigned_staff.add(application.staff)
            
            # 如果排班已滿員，更新狀態為「準備就緒」
            if shift.assigned_staff.count() >= shift.staff_needed:
                shift.status = 'ready'
            else:
                # 如果還有其他待確認的申請，保持「已申請」狀態
                if shift.applications.filter(status='pending').exists():
                    shift.status = 'applied'
                else:
                    shift.status = 'pending'
            shift.save()
        
        serializer = self.get_serializer(application)
        return Response({
            'message': '申請已確認',
            'application': serializer.data
        })
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """店長拒絕申請"""
        user = request.user
        
        # 檢查是否是店長
        if not hasattr(user, 'merchant_profile'):
            raise PermissionDenied("只有店長可以拒絕申請")
        
        merchant = user.merchant_profile
        if not hasattr(merchant, 'store') or not merchant.store:
            raise PermissionDenied("您必須先建立店家才能拒絕申請")
        
        try:
            application = self.get_object()
        except ShiftApplication.DoesNotExist:
            return Response(
                {'error': '申請不存在'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # 檢查申請是否屬於該店
        if application.shift.store != merchant.store:
            raise PermissionDenied("您只能拒絕所屬店家的申請")
        
        # 檢查申請狀態
        if application.status != 'pending':
            return Response(
                {'error': f'申請狀態為「{application.get_status_display()}」，無法拒絕'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 拒絕申請
        application.status = 'rejected'
        application.reviewed_at = timezone.now()
        application.save()
        
        # 更新排班狀態（如果沒有其他待確認的申請，改回「待排班」）
        shift = application.shift
        if not shift.applications.filter(status='pending').exists():
            if shift.assigned_staff.count() > 0:
                shift.status = 'ready'
            else:
                shift.status = 'pending'
            shift.save()
        
        serializer = self.get_serializer(application)
        return Response({
            'message': '申請已拒絕',
            'application': serializer.data
        })
    
    @action(detail=False, methods=['get'])
    def my_applications(self, request):
        """員工查看自己的申請列表"""
        user = request.user
        
        staff = user.staff_profile.first() if hasattr(user, 'staff_profile') else None
        if not staff:
            return Response(
                {'error': '只有員工可以查看申請列表'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        applications = ShiftApplication.objects.filter(staff=staff).order_by('-created_at')
        serializer = self.get_serializer(applications, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def available_shifts(self, request):
        """員工查看可申請的排班時段"""
        user = request.user
        
        staff = user.staff_profile.first() if hasattr(user, 'staff_profile') else None
        if not staff:
            return Response(
                {'error': '只有員工可以查看可申請的排班'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        store = staff.store
        
        # 獲取該店所有未滿員且未過期的排班
        today = timezone.now().date()
        shifts = Shift.objects.filter(
            store=store,
            date__gte=today
        ).prefetch_related('assigned_staff', 'applications')
        
        # 過濾出可申請的排班（未滿員且員工未申請過）
        available_shifts = []
        for shift in shifts:
            # 檢查是否已滿員
            if shift.assigned_staff.count() >= shift.staff_needed:
                continue
            
            # 檢查員工是否已經申請過
            if ShiftApplication.objects.filter(shift=shift, staff=staff).exists():
                continue
            
            # 檢查員工是否已經被指派
            if shift.assigned_staff.filter(id=staff.id).exists():
                continue
            
            available_shifts.append(shift)
        
        serializer = ShiftSerializer(available_shifts, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def propose_shift(self, request):
        """
        員工自行填寫排班時段，讓店長在店家帳號查看/管理
        """
        user = request.user

        staff = user.staff_profile.first() if hasattr(user, 'staff_profile') else None
        if not staff:
            return Response(
                {'error': '只有員工可以新增排班提案'},
                status=status.HTTP_403_FORBIDDEN
            )
        store = staff.store

        data = request.data

        # 允許前端只提交日期與時間，其他欄位給預設值
        date_str = data.get('date')
        parsed_date = parse_date(date_str) if date_str else None
        if not parsed_date:
            return Response({'error': '缺少必填欄位: date，或日期格式錯誤（需 YYYY-MM-DD）'}, status=status.HTTP_400_BAD_REQUEST)

        def parse_time(prefix):
            """接收 start_time / end_time (HH:MM) 或 start_hour/start_minute 等組合"""
            time_str = data.get(f'{prefix}_time')
            hour = data.get(f'{prefix}_hour')
            minute = data.get(f'{prefix}_minute')
            if time_str:
                try:
                    parts = str(time_str).split(':')
                    h = int(parts[0])
                    m = int(parts[1]) if len(parts) > 1 else 0
                    return h, m
                except Exception:
                    return None, None
            try:
                h = int(hour) if hour is not None else None
                m = int(minute) if minute is not None else None
                return h, m
            except Exception:
                return None, None

        start_hour, start_minute = parse_time('start')
        end_hour, end_minute = parse_time('end')

        if start_hour is None or end_hour is None:
            return Response({'error': '請提供開始與結束時間 (格式 HH:MM 或欄位 start_hour/start_minute)'}, status=status.HTTP_400_BAD_REQUEST)

        # 預設值
        shift_type = data.get('shift_type') or 'morning'
        role = data.get('role') or '通用班別'
        staff_needed = int(data.get('staff_needed') or 1)

        try:
            with transaction.atomic():
                shift = Shift.objects.create(
                    store=store,
                    date=parsed_date,
                    shift_type=shift_type,
                    role=role,
                    staff_needed=staff_needed,
                    start_hour=start_hour,
                    start_minute=start_minute or 0,
                    end_hour=end_hour,
                    end_minute=end_minute or 0,
                    status='pending',  # 待店長確認
                )
                # 預設將提交者加入已指派名單，方便店長確認
                shift.assigned_staff.add(staff)

                # 同步建立一筆申請紀錄，狀態設為 pending，讓店長可在申請列表看到
                ShiftApplication.objects.create(
                    shift=shift,
                    staff=staff,
                    status='pending',
                    message=data.get('message', '')
                )

                serializer = ShiftSerializer(shift)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response(
                {'error': f'新增排班提案失敗: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def all_shifts(self, request):
        """員工查看該店的所有排班時段"""
        user = request.user
        
        if not hasattr(user, 'staff_profile'):
            return Response(
                {'error': '只有員工可以查看排班'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        staff = user.staff_profile
        store = staff.store
        
        # 獲取該店所有未過期的排班
        today = timezone.now().date()
        shifts = Shift.objects.filter(
            store=store,
            date__gte=today
        ).prefetch_related('assigned_staff', 'applications').order_by('date', 'start_hour', 'start_minute')
        
        serializer = ShiftSerializer(shifts, many=True)
        return Response(serializer.data)

