# backend/tables/views.py
from rest_framework import viewsets, status, permissions
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly, SAFE_METHODS
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db import IntegrityError, transaction

from .models import ProgressTable, DailyProgress
from .serializers import ProgressTableSerializer, DailyProgressSerializer
from . import serializers

class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Позволяет редактировать объект только владельцу.
    Чтение разрешено всем (если другой permission не запрещает).
    """
    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        return hasattr(obj, 'user') and obj.user == request.user

class ProgressTableViewSet(viewsets.ModelViewSet):
    """
    /api/tables/tables/
    - list: возвращает таблицы текущего пользователя (если не staff)
    - retrieve/create/update/destroy: только владелец или staff
    """
    queryset = ProgressTable.objects.all().prefetch_related('progress_entries')
    serializer_class = ProgressTableSerializer
    permission_classes = [IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
    lookup_field = 'id'

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if user.is_authenticated and user.is_staff:
            return qs  # staff видит всё
        if user.is_authenticated:
            return qs.filter(user=user)
        # анонимным — пустой список
        return qs.none()

    def perform_create(self, serializer):
        # пользователь должен быть авторизован
        user = self.request.user
        if not user or not user.is_authenticated:
            raise permissions.PermissionDenied("Authentication required")
        serializer.save(user=user)

    @action(detail=True, methods=['get'], permission_classes=[IsAuthenticated])
    def progress(self, request, id=None):
        """
        /api/tables/tables/<id>/progress/ - вернуть progress_entries для таблицы
        """
        table = get_object_or_404(self.get_queryset(), pk=id)
        serializer = DailyProgressSerializer(table.progress_entries.all(), many=True)
        return Response(serializer.data)


class DailyProgressViewSet(viewsets.ModelViewSet):
    """
    /api/tables/progress/
    - Этот ViewSet позволяет создавать/редактировать записи прогресса.
    - Для создания: необходимо поле 'table' (uuid) + date + data
    """
    queryset = DailyProgress.objects.all().select_related('table')
    serializer_class = DailyProgressSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        table_id = self.request.query_params.get('table')
        if user.is_authenticated and user.is_staff:
            if table_id:
                return qs.filter(table__id=table_id)
            return qs
        if not user.is_authenticated:
            return qs.none()
        # обычный пользователь — только свои
        if table_id:
            return qs.filter(table__id=table_id, table__user=user)
        return qs.filter(table__user=user)

    def perform_create(self, serializer):
        # проверяем, что пользователь владеет таблицей
        table = serializer.validated_data.get('table')
        user = self.request.user
        if table.user != user and not user.is_staff:
            raise permissions.PermissionDenied("You don't own that table")
        try:
            with transaction.atomic():
                serializer.save()
        except IntegrityError as e:
            raise serializers.ValidationError({"detail": str(e)})
