# backend/tables/views.py
from rest_framework import viewsets, status, permissions
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly, SAFE_METHODS
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db import IntegrityError, transaction

from .models import ProgressTable, DailyProgress
from .serializers import ProgressTableSerializer, DailyProgressSerializer

class IsOwnerOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        return hasattr(obj, "user") and obj.user == request.user

class ProgressTableViewSet(viewsets.ModelViewSet):
    queryset = ProgressTable.objects.all().prefetch_related("progress_entries")
    serializer_class = ProgressTableSerializer
    permission_classes = [IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
    lookup_field = "id"

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if user.is_authenticated and user.is_staff:
            return qs
        if user.is_authenticated:
            return qs.filter(user=user)
        return qs.none()

    def create(self, request, *args, **kwargs):
        user = request.user
        if not user or not user.is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)

        # получаем лимит (поддерживаем max_tables и tables_limit)
        try:
            profile = getattr(user, "profile", None)
            limit = None
            if profile is not None:
                limit = getattr(profile, "max_tables", None) or getattr(profile, "tables_limit", None)
            if limit is None:
                limit = 1
            limit = int(limit)
        except Exception:
            limit = 1

        current_count = ProgressTable.objects.filter(user=user).count()
        if current_count >= limit:
            existing = ProgressTable.objects.filter(user=user).first()
            existing_serialized = ProgressTableSerializer(existing).data if existing else None
            return Response({"error": "user_has_table", "existing": existing_serialized}, status=status.HTTP_409_CONFLICT)

        try:
            with transaction.atomic():
                serializer = self.get_serializer(data=request.data)
                serializer.is_valid(raise_exception=True)
                self.perform_create(serializer)
                headers = self.get_success_headers(serializer.data)
                return Response({"data": {"table": serializer.data}}, status=status.HTTP_201_CREATED, headers=headers)
        except IntegrityError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["get"], permission_classes=[IsAuthenticated])
    def progress(self, request, id=None):
        table = get_object_or_404(self.get_queryset(), pk=id)
        data = DailyProgressSerializer(table.progress_entries.all(), many=True).data
        return Response(data)

class DailyProgressViewSet(viewsets.ModelViewSet):
    queryset = DailyProgress.objects.all().select_related("table")
    serializer_class = DailyProgressSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        table_id = self.request.query_params.get("table")
        if user.is_authenticated and user.is_staff:
            return qs.filter(table__id=table_id) if table_id else qs
        if not user.is_authenticated:
            return qs.none()
        return qs.filter(table__user=user) if not table_id else qs.filter(table__id=table_id, table__user=user)

    def perform_create(self, serializer):
        table = serializer.validated_data.get("table")
        user = self.request.user
        if table.user != user and not user.is_staff:
            raise permissions.PermissionDenied("You don't own that table")
        serializer.save()
