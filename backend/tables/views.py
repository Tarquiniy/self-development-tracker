from rest_framework import viewsets, status, permissions
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly, SAFE_METHODS
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from datetime import datetime, timedelta
import json

from .models import ProgressTable, DailyProgress
from .serializers import ProgressTableSerializer, DailyProgressSerializer

class IsOwnerOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        return hasattr(obj, 'user') and obj.user == request.user

class ProgressTableViewSet(viewsets.ModelViewSet):
    queryset = ProgressTable.objects.all().prefetch_related('progress_entries')
    serializer_class = ProgressTableSerializer
    permission_classes = [IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
    lookup_field = 'id'

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if user.is_authenticated and user.is_staff:
            return qs
        if user.is_authenticated:
            return qs.filter(user=user)
        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        if not user or not user.is_authenticated:
            raise permissions.PermissionDenied("Authentication required")
        serializer.save(user=user)

    @action(detail=True, methods=['get'])
    def calendar_data(self, request, id=None):
        """Получить данные для календаря конкретной таблицы"""
        table = get_object_or_404(self.get_queryset(), pk=id)
        
        # Параметры фильтрации
        start_date = request.GET.get('start')
        end_date = request.GET.get('end')
        
        entries = table.progress_entries.all()
        
        if start_date:
            entries = entries.filter(date__gte=start_date)
        if end_date:
            entries = entries.filter(date__lte=end_date)
            
        calendar_events = []
        for entry in entries:
            # Вычисляем общий прогресс
            total_progress = sum(int(value) for value in entry.data.values()) / len(entry.data) if entry.data else 0
            
            event = {
                'id': entry.id,
                'title': f'Прогресс: {total_progress:.0f}%',
                'start': entry.date.isoformat(),
                'end': entry.date.isoformat(),
                'allDay': True,
                'backgroundColor': self._get_progress_color(total_progress),
                'borderColor': self._get_progress_color(total_progress),
                'extendedProps': {
                    'progress': total_progress,
                    'mood': entry.mood,
                    'notes': entry.notes,
                    'data': entry.data
                }
            }
            calendar_events.append(event)
            
        return Response(calendar_events)
    
    def _get_progress_color(self, progress):
        """Цвет в зависимости от прогресса"""
        if progress >= 80:
            return '#10B981'  # green
        elif progress >= 60:
            return '#34D399'  # emerald
        elif progress >= 40:
            return '#F59E0B'  # yellow
        elif progress >= 20:
            return '#F97316'  # orange
        else:
            return '#EF4444'  # red

class DailyProgressViewSet(viewsets.ModelViewSet):
    queryset = DailyProgress.objects.all().select_related('table')
    serializer_class = DailyProgressSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        table_id = self.request.query_params.get('table')
        date = self.request.query_params.get('date')
        
        if user.is_authenticated and user.is_staff:
            if table_id:
                qs = qs.filter(table__id=table_id)
            if date:
                qs = qs.filter(date=date)
            return qs
            
        if not user.is_authenticated:
            return qs.none()
            
        # Обычный пользователь — только свои таблицы
        qs = qs.filter(table__user=user)
        if table_id:
            qs = qs.filter(table__id=table_id)
        if date:
            qs = qs.filter(date=date)
            
        return qs

    def perform_create(self, serializer):
        table = serializer.validated_data.get('table')
        user = self.request.user
        if table.user != user and not user.is_staff:
            raise permissions.PermissionDenied("You don't own that table")
        try:
            with transaction.atomic():
                serializer.save()
        except IntegrityError as e:
            from . import serializers as ser
            raise ser.ValidationError({"detail": str(e)})

class CalendarView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, table_id=None):
        if table_id:
            return self._get_table_stats(request, table_id)
        return self._get_calendar_events(request)
    
    def _get_calendar_events(self, request):
        """Получить события календаря для всех таблиц пользователя"""
        user = request.user
        start_date = request.GET.get('start')
        end_date = request.GET.get('end')
        
        tables = ProgressTable.objects.filter(user=user, calendar_enabled=True)
        all_events = []
        
        for table in tables:
            entries = table.progress_entries.all()
            if start_date:
                entries = entries.filter(date__gte=start_date)
            if end_date:
                entries = entries.filter(date__lte=end_date)
                
            for entry in entries:
                total_progress = sum(int(value) for value in entry.data.values()) / len(entry.data) if entry.data else 0
                
                event = {
                    'id': f"{table.id}-{entry.id}",
                    'title': f'{table.title}: {total_progress:.0f}%',
                    'start': entry.date.isoformat(),
                    'end': entry.date.isoformat(),
                    'allDay': True,
                    'backgroundColor': self._get_table_color(table.id),
                    'borderColor': self._get_table_color(table.id),
                    'extendedProps': {
                        'table_id': str(table.id),
                        'table_title': table.title,
                        'progress': total_progress,
                        'mood': entry.mood,
                        'data': entry.data
                    }
                }
                all_events.append(event)
                
        return JsonResponse(all_events, safe=False)
    
    def _get_table_stats(self, request, table_id):
        """Статистика по таблице для календаря"""
        table = get_object_or_404(ProgressTable, id=table_id, user=request.user)
        
        # Статистика по месяцам
        from django.db.models import Count, Avg
        from django.utils import timezone
        from datetime import timedelta
        
        six_months_ago = timezone.now().date() - timedelta(days=180)
        
        stats = table.progress_entries.filter(
            date__gte=six_months_ago
        ).extra({
            'month': "EXTRACT(month FROM date)",
            'year': "EXTRACT(year FROM date)"
        }).values('year', 'month').annotate(
            entries_count=Count('id'),
            avg_progress=Avg('data')
        ).order_by('-year', '-month')
        
        return JsonResponse(list(stats), safe=False)
    
    def _get_table_color(self, table_id):
        """Генерируем цвет на основе ID таблицы"""
        colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316']
        return colors[hash(str(table_id)) % len(colors)]