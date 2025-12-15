from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import StoreReviewViewSet, ProductReviewViewSet, ReviewSubmissionViewSet

router = DefaultRouter()
router.register(r'store-reviews', StoreReviewViewSet, basename='store-review')
router.register(r'product-reviews', ProductReviewViewSet, basename='product-review')
router.register(r'submissions', ReviewSubmissionViewSet, basename='review-submission')

urlpatterns = [
    path('', include(router.urls)),
]
