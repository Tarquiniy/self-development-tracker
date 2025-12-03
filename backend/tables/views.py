# backend/tables/views.py (фрагменты — замените класс ProgressTableViewSet)
from rest_framework import viewsets, status, permissions
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly, SAFE_METHODS
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db import IntegrityError, transaction
from django.core.exceptions import ObjectDoesNotExist

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

    def create(self, request, *args, **kwargs):
        """
        Перед созданием проверяем лимит таблиц пользователя.
        Если лимит исчерпан — возвращаем 409 с телом { error: "user_has_table", existing: <существующая таблица> }
        """
        user = request.user
        if not user or not user.is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)

        # Получаем профиль и лимит (поддерживаем оба имени)
        tables_limit = 1
        try:
            profile = getattr(user, "profile", None)
            if profile is not None:
                # prefer max_tables, fallback to tables_limit
                tables_limit = getattr(profile, "max_tables", None) or getattr(profile, "tables_limit", 1) or 1
            else:
                tables_limit = 1
        except Exception:
            tables_limit = 1

        # сколько таблиц уже у пользователя?
        current_count = ProgressTable.objects.filter(user=user).count()

        if current_count >= int(tables_limit):
            # вернём существующую первую таблицу (для фронта)
            existing = ProgressTable.objects.filter(user=user).first()
            existing_serialized = ProgressTableSerializer(existing).data if existing is not None else None
            return Response({"error": "user_has_table", "existing": existing_serialized}, status=status.HTTP_409_CONFLICT)

        # лимит не исчерпан — продолжаем
        try:
            with transaction.atomic():
                # serializer.save(user=user) — но используем стандартный create flow
                serializer = self.get_serializer(data=request.data)
                serializer.is_valid(raise_exception=True)
                self.perform_create(serializer)
                headers = self.get_success_headers(serializer.data)
                return Response({"data": {"table": serializer.data}}, status=status.HTTP_201_CREATED, headers=headers)
        except IntegrityError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def perform_create(self, serializer):
        # пользователь должен быть авторизован
        user = self.request.user
        serializer.save(user=user)

    @action(detail=True, methods=['get'], permission_classes=[IsAuthenticated])
    def progress(self, request, id=None):
        """
        /api/tables/tables/<id>/progress/ - вернуть progress_entries для таблицы
        """
        table = get_object_or_404(self.get_queryset(), pk=id)
        serializer = DailyProgressSerializer(table.progress_entries.all(), many=True)
        return Response(serializer.data)
