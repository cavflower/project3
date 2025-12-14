from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import PaymentCard
from .payment_serializers import PaymentCardSerializer


class PaymentCardViewSet(viewsets.ModelViewSet):
    """信用卡管理 ViewSet"""
    serializer_class = PaymentCardSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """只返回當前用戶的卡片"""
        return PaymentCard.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        """創建卡片時自動關聯當前用戶"""
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def set_default(self, request, pk=None):
        """設定為預設卡片"""
        card = self.get_object()
        card.is_default = True
        card.save()
        return Response({'status': '已設定為預設卡片'})

    def destroy(self, request, *args, **kwargs):
        """刪除卡片"""
        instance = self.get_object()
        
        # 如果刪除的是預設卡片，需要警告
        if instance.is_default:
            remaining_cards = PaymentCard.objects.filter(
                user=request.user
            ).exclude(id=instance.id).first()
            
            if remaining_cards:
                # 將第一張卡設為預設
                remaining_cards.is_default = True
                remaining_cards.save()
        
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)
