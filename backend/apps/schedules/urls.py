from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import StaffViewSet, ShiftViewSet, EmployeeScheduleRequestViewSet, JobRoleViewSet

router = DefaultRouter()
router.register(r'staff', StaffViewSet, basename='staff')
router.register(r'shifts', ShiftViewSet, basename='shift')
router.register(r'job-roles', JobRoleViewSet, basename='job-role')
router.register(r'employee-requests', EmployeeScheduleRequestViewSet, basename='employee-request')

urlpatterns = [
    path('', include(router.urls)),
]

