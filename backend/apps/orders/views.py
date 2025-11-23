from rest_framework import generics, permissions
from django.shortcuts import get_object_or_404
from .serializers import TakeoutOrderSerializer
from apps.stores.models import Store


class TakeoutOrderCreateView(generics.CreateAPIView):
    serializer_class = TakeoutOrderSerializer
    permission_classes = [permissions.AllowAny]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        store = get_object_or_404(Store, pk=self.request.data.get('store'))
        context['store'] = store
        return context
