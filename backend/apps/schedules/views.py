from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.http import HttpResponse
from django.utils import timezone
from django.conf import settings
import csv
from .models import Staff, Shift, EmployeeScheduleRequest, JobRole
from .serializers import (
    StaffSerializer,
    ShiftSerializer,
    ScheduleDataSerializer,
    EmployeeScheduleRequestSerializer,
    JobRoleSerializer,
)
from apps.users.models import Company, User
from apps.stores.models import Store
from datetime import datetime, timedelta


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
            raise PermissionDenied("您必須是商家才能新增員工")
        
        merchant = user.merchant_profile
        if not hasattr(merchant, 'store') or not merchant.store:
            raise PermissionDenied("您必須先建立店家才能新增員工")
        
        serializer.save(store=merchant.store)


class JobRoleViewSet(viewsets.ModelViewSet):
    """店家職務管理 ViewSet"""

    serializer_class = JobRoleSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        if not hasattr(user, 'merchant_profile'):
            return JobRole.objects.none()

        merchant = user.merchant_profile
        if not hasattr(merchant, 'store') or not merchant.store:
            return JobRole.objects.none()

        return JobRole.objects.filter(store=merchant.store)

    def perform_create(self, serializer):
        user = self.request.user

        if not hasattr(user, 'merchant_profile'):
            raise PermissionDenied("您必須是商家才能新增職務")

        merchant = user.merchant_profile
        if not hasattr(merchant, 'store') or not merchant.store:
            raise PermissionDenied("您必須先建立店家才能新增職務")

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
            raise PermissionDenied("您必須是商家才能新增排班")
        
        merchant = user.merchant_profile
        if not hasattr(merchant, 'store') or not merchant.store:
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

                existing_employee_user_ids = set(
                    Staff.objects.filter(store=store)
                    .exclude(employee_user_id__isnull=True)
                    .values_list('employee_user_id', flat=True)
                )
                incoming_employee_user_ids = set()
                for staff_item in staff_data:
                    employee_user_id = staff_item.get('employee_user_id') if isinstance(staff_item, dict) else None
                    if employee_user_id:
                        try:
                            incoming_employee_user_ids.add(int(employee_user_id))
                        except (TypeError, ValueError):
                            continue

                removed_employee_user_ids = sorted(existing_employee_user_ids - incoming_employee_user_ids)
                if removed_employee_user_ids:
                    store_company_tax_id = (getattr(store.merchant, 'company_account', '') or '').strip().upper()
                    users_to_unbind = User.objects.filter(id__in=removed_employee_user_ids)
                    if store_company_tax_id:
                        users_to_unbind = users_to_unbind.filter(company_tax_id=store_company_tax_id)

                    unbound_user_ids = list(users_to_unbind.values_list('id', flat=True))
                    if unbound_user_ids:
                        users_to_unbind.update(company_tax_id=None)
                        Staff.objects.filter(employee_user_id__in=unbound_user_ids).delete()
                        print(f"已解除 {len(unbound_user_ids)} 位員工公司綁定: {unbound_user_ids}")
                
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
            '排班方式',
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
                shift.get_period_type_display(),
                shift.shift_name,
                shift.role,
                shift.staff_needed,
                assigned_names or '-',
                status_display,
            ])
        
        return response


class EmployeeScheduleRequestViewSet(viewsets.ModelViewSet):
    """員工排班申請 ViewSet"""
    
    serializer_class = EmployeeScheduleRequestSerializer
    permission_classes = [IsAuthenticated]
    allowed_shift_types = {choice[0] for choice in EmployeeScheduleRequest.SHIFT_TYPE_CHOICES}
    allowed_actual_slots = {
        choice[0]
        for choice in EmployeeScheduleRequest.SHIFT_TYPE_CHOICES
        if choice[0] != 'full_day'
    }
    allowed_attendance_statuses = {
        choice[0] for choice in EmployeeScheduleRequest.ATTENDANCE_STATUS_CHOICES
    }
    allowed_off_duty_statuses = {
        choice[0] for choice in EmployeeScheduleRequest.OFF_DUTY_STATUS_CHOICES
    }
    
    def get_queryset(self):
        """根據用戶類型返回不同的查詢集"""
        user = self.request.user
        
        # 如果是店家，返回該店家所有員工的申請
        if hasattr(user, 'merchant_profile') and hasattr(user.merchant_profile, 'store'):
            store = user.merchant_profile.store
            return EmployeeScheduleRequest.objects.filter(store=store).select_related('employee', 'company', 'store')
        
        # 如果是員工（有 company_tax_id），返回該員工的申請
        elif user.company_tax_id:
            return EmployeeScheduleRequest.objects.filter(employee=user).select_related('employee', 'company', 'store')
        
        return EmployeeScheduleRequest.objects.none()
    
    def perform_create(self, serializer):
        """建立申請時自動設定員工和公司"""
        user = self.request.user
        
        # 檢查是否為員工（有 company_tax_id）
        if not user.company_tax_id:
            raise PermissionDenied("只有公司員工才能提交排班申請")
        
        # 獲取公司（如果不存在則創建）
        try:
            company = Company.objects.get(tax_id=user.company_tax_id)
        except Company.DoesNotExist:
            # 如果公司不存在，自動創建一個（使用統編作為名稱）
            company = Company.objects.create(
                tax_id=user.company_tax_id,
                name=f"公司 {user.company_tax_id}"
            )
        
        # 獲取店家
        store_id = self.request.data.get('store')
        if not store_id:
            raise ValidationError("必須選擇店家")
        
        try:
            store = Store.objects.get(id=store_id)
        except Store.DoesNotExist:
            raise ValidationError("找不到指定的店家")

        request_date = serializer.validated_data.get('date')
        period_type = serializer.validated_data.get('period_type', 'day')

        if not request_date:
            raise ValidationError("必須提供日期")

        # day: 該日; week: 該週週一; month: 該月 1 號
        if period_type == 'week':
            week_start = request_date
        elif period_type == 'month':
            week_start = request_date.replace(day=1)
        else:
            week_start = request_date - timedelta(days=request_date.weekday())
        
        serializer.save(
            employee=user,
            company=company,
            store=store,
            week_start_date=week_start,
            role=serializer.validated_data.get('role') or '',
            shift_type=serializer.validated_data.get('shift_type') or 'full_day',
            assignment_status='pending',
            assigned_shift_types=[],
            assigned_slot_roles={}
        )

    def perform_update(self, serializer):
        """更新申請：員工不可自行設定職務，職務由店家安排"""
        user = self.request.user
        instance = serializer.instance

        is_merchant = hasattr(user, 'merchant_profile') and hasattr(user.merchant_profile, 'store')

        restricted_fields = {
            'role',
            'assignment_status',
            'assigned_shift_types',
            'assigned_slot_roles',
            'actual_slot_work_times',
            'actual_slot_attendance',
            'actual_slot_off_duty_status',
            'actual_slot_actual_end_times',
        }
        if not is_merchant and any(field in self.request.data for field in restricted_fields):
            raise PermissionDenied("店家安排欄位不可由員工自行設定")

        assigned_shift_types = serializer.validated_data.get('assigned_shift_types', instance.assigned_shift_types)
        if assigned_shift_types is None:
            assigned_shift_types = []

        assigned_slot_roles = serializer.validated_data.get('assigned_slot_roles', instance.assigned_slot_roles)
        if assigned_slot_roles is None:
            assigned_slot_roles = {}

        actual_slot_work_times = serializer.validated_data.get(
            'actual_slot_work_times',
            instance.actual_slot_work_times,
        )
        if actual_slot_work_times is None:
            actual_slot_work_times = {}

        actual_slot_attendance = serializer.validated_data.get(
            'actual_slot_attendance',
            instance.actual_slot_attendance,
        )
        if actual_slot_attendance is None:
            actual_slot_attendance = {}

        actual_slot_off_duty_status = serializer.validated_data.get(
            'actual_slot_off_duty_status',
            instance.actual_slot_off_duty_status,
        )
        if actual_slot_off_duty_status is None:
            actual_slot_off_duty_status = {}

        actual_slot_actual_end_times = serializer.validated_data.get(
            'actual_slot_actual_end_times',
            instance.actual_slot_actual_end_times,
        )
        if actual_slot_actual_end_times is None:
            actual_slot_actual_end_times = {}

        if not isinstance(assigned_shift_types, list):
            raise ValidationError("assigned_shift_types 必須是陣列")

        if not isinstance(assigned_slot_roles, dict):
            raise ValidationError("assigned_slot_roles 必須是物件")

        if not isinstance(actual_slot_work_times, dict):
            raise ValidationError("actual_slot_work_times 必須是物件")

        if not isinstance(actual_slot_attendance, dict):
            raise ValidationError("actual_slot_attendance 必須是物件")

        if not isinstance(actual_slot_off_duty_status, dict):
            raise ValidationError("actual_slot_off_duty_status 必須是物件")

        if not isinstance(actual_slot_actual_end_times, dict):
            raise ValidationError("actual_slot_actual_end_times 必須是物件")

        invalid_slots = [slot for slot in assigned_shift_types if slot not in self.allowed_shift_types]
        if invalid_slots:
            raise ValidationError(f"無效的時段類型: {', '.join(invalid_slots)}")

        invalid_slot_role_keys = [slot for slot in assigned_slot_roles.keys() if slot not in self.allowed_shift_types]
        if invalid_slot_role_keys:
            raise ValidationError(f"assigned_slot_roles 包含無效時段: {', '.join(invalid_slot_role_keys)}")

        invalid_work_time_slots = [
            slot for slot in actual_slot_work_times.keys() if slot not in self.allowed_actual_slots
        ]
        if invalid_work_time_slots:
            raise ValidationError(f"actual_slot_work_times 包含無效時段: {', '.join(invalid_work_time_slots)}")

        invalid_attendance_slots = [
            slot for slot in actual_slot_attendance.keys() if slot not in self.allowed_actual_slots
        ]
        if invalid_attendance_slots:
            raise ValidationError(f"actual_slot_attendance 包含無效時段: {', '.join(invalid_attendance_slots)}")

        invalid_off_duty_slots = [
            slot for slot in actual_slot_off_duty_status.keys() if slot not in self.allowed_actual_slots
        ]
        if invalid_off_duty_slots:
            raise ValidationError(f"actual_slot_off_duty_status 包含無效時段: {', '.join(invalid_off_duty_slots)}")

        invalid_actual_end_time_slots = [
            slot for slot in actual_slot_actual_end_times.keys() if slot not in self.allowed_actual_slots
        ]
        if invalid_actual_end_time_slots:
            raise ValidationError(f"actual_slot_actual_end_times 包含無效時段: {', '.join(invalid_actual_end_time_slots)}")

        def _validate_time_text(value):
            if value in (None, ''):
                return ''
            text = str(value).strip()
            try:
                parsed_time = datetime.strptime(text, '%H:%M')
            except ValueError:
                raise ValidationError(f"時間格式錯誤: {text}，需為 HH:MM")

            if parsed_time.minute not in (0, 30):
                raise ValidationError(f"時間格式錯誤: {text}，上下班時間需以半小時為單位（分鐘只能是 00 或 30）")
            return text

        normalized_work_times = {}
        for slot, time_payload in actual_slot_work_times.items():
            if not isinstance(time_payload, dict):
                raise ValidationError(f"{slot} 的上下班時間格式錯誤，必須為物件")

            start_time = _validate_time_text(time_payload.get('start_time', ''))
            end_time = _validate_time_text(time_payload.get('end_time', ''))

            if start_time and end_time and start_time >= end_time:
                raise ValidationError(f"{slot} 的下班時間必須晚於上班時間")

            if start_time or end_time:
                normalized_work_times[slot] = {
                    'start_time': start_time,
                    'end_time': end_time,
                }

        normalized_attendance = {}
        for slot, attendance_status in actual_slot_attendance.items():
            status_value = str(attendance_status or '').strip()
            if not status_value:
                continue
            if status_value not in self.allowed_attendance_statuses:
                raise ValidationError(f"{slot} 的到班狀況無效: {status_value}")
            normalized_attendance[slot] = status_value

        normalized_off_duty_status = {}
        for slot, off_duty_status in actual_slot_off_duty_status.items():
            status_value = str(off_duty_status or '').strip()
            if not status_value:
                continue
            if status_value not in self.allowed_off_duty_statuses:
                raise ValidationError(f"{slot} 的下班狀況無效: {status_value}")
            normalized_off_duty_status[slot] = status_value

        normalized_actual_end_times = {}
        for slot, value in actual_slot_actual_end_times.items():
            time_text = _validate_time_text(value)
            if not time_text:
                continue
            normalized_actual_end_times[slot] = time_text

        for slot, status_value in normalized_off_duty_status.items():
            if status_value in {'left_early', 'overtime'} and not normalized_actual_end_times.get(slot):
                raise ValidationError(f"{slot} 的下班狀況為早退或加班時，必須填寫實際下班時間")

            if status_value in {'on_time', 'unmarked'} and slot in normalized_actual_end_times:
                del normalized_actual_end_times[slot]

        next_assignment_status = serializer.validated_data.get('assignment_status', instance.assignment_status)

        # 非整天申請，店家排班時預設沿用員工原始時段與職務
        if instance.shift_type != 'full_day' and next_assignment_status == 'scheduled':
            if not assigned_shift_types:
                assigned_shift_types = [instance.shift_type]

            if not assigned_slot_roles:
                fallback_role = (serializer.validated_data.get('role', instance.role) or '').strip()
                assigned_slot_roles = {instance.shift_type: fallback_role} if fallback_role else {}

        # 整天申請：排班時每個店家排班時段都必須有對應職務
        if instance.shift_type == 'full_day' and next_assignment_status == 'scheduled':
            if not assigned_shift_types:
                raise ValidationError("整天申請排班時，請至少選擇一個店家排班時段")

            missing_role_slots = [slot for slot in assigned_shift_types if not (assigned_slot_roles.get(slot) or '').strip()]
            if missing_role_slots:
                raise ValidationError(f"以下時段尚未選擇職務: {', '.join(missing_role_slots)}")

            # 保留已選時段對應的職務，避免過期鍵值殘留
            assigned_slot_roles = {
                slot: str(assigned_slot_roles.get(slot, '')).strip()
                for slot in assigned_shift_types
                if str(assigned_slot_roles.get(slot, '')).strip()
            }

            # 主 role 欄位保留摘要字串，兼容舊畫面
            unique_roles = list(dict.fromkeys(assigned_slot_roles.values()))
            serializer.validated_data['role'] = ' / '.join(unique_roles)

        # 排休時清空排班結果
        if next_assignment_status == 'rejected':
            assigned_shift_types = []
            assigned_slot_roles = {}
            normalized_work_times = {}
            normalized_attendance = {}
            normalized_off_duty_status = {}
            normalized_actual_end_times = {}
            serializer.validated_data['role'] = ''

        if next_assignment_status != 'scheduled':
            normalized_work_times = {}
            normalized_attendance = {}
            normalized_off_duty_status = {}
            normalized_actual_end_times = {}

        effective_slots = {
            slot
            for slot in assigned_shift_types
            if slot in self.allowed_actual_slots
        }
        normalized_work_times = {
            slot: value
            for slot, value in normalized_work_times.items()
            if slot in effective_slots
        }
        normalized_attendance = {
            slot: value
            for slot, value in normalized_attendance.items()
            if slot in effective_slots
        }
        normalized_off_duty_status = {
            slot: value
            for slot, value in normalized_off_duty_status.items()
            if slot in effective_slots
        }
        normalized_actual_end_times = {
            slot: value
            for slot, value in normalized_actual_end_times.items()
            if slot in effective_slots
        }

        period_type = serializer.validated_data.get('period_type', instance.period_type)
        request_date = serializer.validated_data.get('date', instance.date)

        if period_type == 'week':
            week_start = request_date
        elif period_type == 'month':
            week_start = request_date.replace(day=1)
        else:
            week_start = request_date - timedelta(days=request_date.weekday())

        serializer.save(
            week_start_date=week_start,
            assigned_shift_types=assigned_shift_types,
            assigned_slot_roles=assigned_slot_roles,
            actual_slot_work_times=normalized_work_times,
            actual_slot_attendance=normalized_attendance,
            actual_slot_off_duty_status=normalized_off_duty_status,
            actual_slot_actual_end_times=normalized_actual_end_times,
        )
    
    @action(detail=False, methods=['get'])
    def my_requests(self, request):
        """獲取當前員工的所有申請"""
        user = request.user
        
        if not user.company_tax_id:
            return Response(
                {'error': '只有公司員工才能查看申請'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            requests = EmployeeScheduleRequest.objects.filter(employee=user).select_related('store', 'company', 'employee')
            serializer = self.get_serializer(requests, many=True)
            return Response(serializer.data)
        except Exception as e:
            import traceback
            print(f"獲取員工申請時發生錯誤: {e}")
            print(traceback.format_exc())
            return Response(
                {'error': f'載入申請記錄失敗: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def company_stores(self, request):
        """獲取員工所屬公司相關的店家列表"""
        user = request.user
        
        if not user.company_tax_id:
            return Response(
                {'error': '只有公司員工才能查看店家列表'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            # 統一統編格式（去除空格、轉為大寫）
            employee_tax_id = user.company_tax_id.strip().upper()
            print(f"[DEBUG] 員工統編: '{employee_tax_id}' (原始: '{user.company_tax_id}')")
            
            # 直接通過統編匹配 Merchant
            # Merchant.company_account 就是統編，應該與員工的 company_tax_id 匹配
            from apps.users.models import Merchant
            from apps.stores.models import Store
            
            # 先獲取所有 Merchant 並檢查統編格式
            all_merchants = Merchant.objects.all()
            print(f"[DEBUG] 資料庫中共有 {all_merchants.count()} 個商家")
            
            # 列出所有商家的統編（用於調試）
            for m in all_merchants:
                merchant_tax_id = m.company_account.strip().upper() if m.company_account else ''
                print(f"[DEBUG] 商家 {m.user.username} 的統編: '{merchant_tax_id}' (原始: '{m.company_account}')")
            
            # 精確匹配（統編格式已統一）
            merchants = Merchant.objects.filter(company_account=employee_tax_id)
            print(f"[DEBUG] 精確匹配找到 {merchants.count()} 個商家")
            
            # 如果精確匹配失敗，嘗試不區分大小寫和空格的匹配
            if merchants.count() == 0:
                matching_merchants = []
                for merchant in all_merchants:
                    merchant_tax_id = merchant.company_account.strip().upper() if merchant.company_account else ''
                    if merchant_tax_id == employee_tax_id:
                        matching_merchants.append(merchant)
                if matching_merchants:
                    merchants = Merchant.objects.filter(id__in=[m.id for m in matching_merchants])
                    print(f"[DEBUG] 模糊匹配後找到 {merchants.count()} 個商家")
            
            # 獲取這些商家對應的店家
            stores = Store.objects.filter(merchant__in=merchants)
            print(f"[DEBUG] 找到 {stores.count()} 個店家")
            
            # 列出所有店家的名稱（用於調試）
            for store in stores:
                print(f"[DEBUG] 店家: {store.name} (ID: {store.id}, 商家統編: {store.merchant.company_account})")
            
            store_list = [{
                'id': store.id,
                'name': store.name,
                'address': store.address,
            } for store in stores]
            
            return Response(store_list)
        except Exception as e:
            # 處理所有可能的錯誤
            import traceback
            print(f"[ERROR] 載入店家列表時發生錯誤: {e}")
            print(traceback.format_exc())
            # 返回空列表而不是錯誤，讓員工仍然可以使用功能
            return Response([])

