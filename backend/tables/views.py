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
    Чтение — всем.
    """
    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        return hasattr(obj, "user") and obj.user == request.user


# ----------------------------------------------------------------------
#   ProgressTableViewSet
# ----------------------------------------------------------------------
class ProgressTableViewSet(viewsets.ModelViewSet):
    """
    Маршруты:
      /api/tables/tables/
      /api/tables/tables/<id>/

    staff видит ВСЕ таблицы
    обычный пользователь видит только свои
    анонимный — ничего

    create/update/delete доступны только владельцу (или staff)
    """
    queryset = ProgressTable.objects.all().prefetch_related("progress_entries")
    serializer_class = ProgressTableSerializer
    permission_classes = [IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
    lookup_field = "id"

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()

        if user.is_authenticated and user.is_staff:
            return qs                     # staff — всё
        if user.is_authenticated:
            return qs.filter(user=user)   # обычный — свои
        return qs.none()                  # анонимы — ничего

    def perform_create(self, serializer):
        """
        При создании таблицы автоматически привязываем user.
        """
        user = self.request.user
        if not user or not user.is_authenticated:
            raise permissions.PermissionDenied("Authentication required")
        serializer.save(user=user)

    @action(detail=True, methods=["get"], permission_classes=[IsAuthenticated])
    def progress(self, request, id=None):
        """
        GET /api/tables/tables/<id>/progress/

        Возвращает все DailyProgress для этой таблицы.
        """
        table = get_object_or_404(self.get_queryset(), pk=id)
        data = DailyProgressSerializer(table.progress_entries.all(), many=True).data
        return Response(data)


# ----------------------------------------------------------------------
#   DailyProgressViewSet
# ----------------------------------------------------------------------
class DailyProgressViewSet(viewsets.ModelViewSet):
    """
    Маршруты:
      /api/tables/progress/
      /api/tables/progress/<id>/

    Позволяет создавать / обновлять записи прогресса.

    create требует:
        - table: UUID
        - date: YYYY-MM-DD
        - data: любая структура (JSONField)
    """
    queryset = DailyProgress.objects.all().select_related("table")
    serializer_class = DailyProgressSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        """
        staff → всё  
        пользователь → только записи его таблиц  
        аноним → ничего  
        """
        qs = super().get_queryset()
        user = self.request.user

        # фильтр по конкретной таблице
        table_id = self.request.query_params.get("table")

        if user.is_authenticated and user.is_staff:
            if table_id:
                return qs.filter(table__id=table_id)
            return qs

        if not user.is_authenticated:
            return qs.none()

        # обычный пользователь
        if table_id:
            return qs.filter(table__id=table_id, table__user=user)

        return qs.filter(table__user=user)

    def perform_create(self, serializer):
        """
        Проверяем: принадлежит ли таблица текущему пользователю.
        """
        table = serializer.validated_data.get("table")
        user = self.request.user

        if table.user != user and not user.is_staff:
            raise permissions.PermissionDenied("You don't own that table")

        try:
            with transaction.atomic():
                serializer.save()
        except IntegrityError as e:
            raise serializers.ValidationError({"detail": str(e)})
