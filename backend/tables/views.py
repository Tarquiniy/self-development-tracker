from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.core.exceptions import ValidationError
from .models import ProgressTable, DailyProgress
from .serializers import ProgressTableSerializer, DailyProgressSerializer

from rest_framework.decorators import api_view, permission_classes
from rest_framework import permissions

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def tables_test(request):
    return Response({"message": "Tables API is working"})


class ProgressTableViewSet(viewsets.ModelViewSet):
    serializer_class = ProgressTableSerializer

    def get_queryset(self):
        return ProgressTable.objects.filter(user=self.request.user)

    def list(self, request, *args, **kwargs):
        # Переопределяем метод list для возврата простого массива без пагинации
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def perform_create(self, serializer):
        # Добавляем предустановленные категории по умолчанию
        default_categories = [
            {"id": "cat_1", "name": "Обучение"},
            {"id": "cat_2", "name": "Финансы"},
            {"id": "cat_3", "name": "Спорт / Здоровье"},
            {"id": "cat_4", "name": "Семья / Духовное развитие / Личная жизнь"},
            {"id": "cat_5", "name": "Проекты"}
        ]
        
        # Если пользователь не предоставил свои категории, используем предустановленные
        if not self.request.data.get('categories'):
            serializer.validated_data['categories'] = default_categories
            
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def update_progress(self, request, pk=None):
        table = self.get_object()
        date = request.data.get('date', timezone.now().date().isoformat())
        progress_data = request.data.get('data', {})

        try:
            daily_progress, created = DailyProgress.objects.update_or_create(
                table=table,
                date=date,
                defaults={'data': progress_data}
            )

            serializer = DailyProgressSerializer(daily_progress)
            return Response(serializer.data)
            
        except ValidationError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['get'])
    def progress_chart_data(self, request, pk=None):
        table = self.get_object()
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date', timezone.now().date().isoformat())

        progress_entries = DailyProgress.objects.filter(table=table)

        if start_date:
            progress_entries = progress_entries.filter(date__gte=start_date)

        if end_date:
            progress_entries = progress_entries.filter(date__lte=end_date)

        chart_data = []
        for entry in progress_entries:
            chart_data.append({
                'date': entry.date.isoformat(),
                **entry.data
            })

        return Response({
            'categories': table.categories,
            'progress_data': chart_data
        })

    @action(detail=True, methods=['post'])
    def add_category(self, request, pk=None):
        table = self.get_object()
        category_name = request.data.get('name')
        
        if not category_name:
            return Response(
                {'error': 'Имя категории обязательно'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if len(table.categories) >= 12:
            return Response(
                {'error': 'Максимум 12 категорий'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        new_category_id = f"cat_{len(table.categories) + 1}"
        new_category = {'id': new_category_id, 'name': category_name}
        
        table.categories.append(new_category)
        
        try:
            table.save()
            return Response(ProgressTableSerializer(table).data)
        except ValidationError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def remove_category(self, request, pk=None):
        table = self.get_object()
        category_id = request.data.get('category_id')
        
        if not category_id:
            return Response(
                {'error': 'ID категории обязательно'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if len(table.categories) <= 3:
            return Response(
                {'error': 'Минимум 3 категории'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        table.categories = [cat for cat in table.categories if cat['id'] != category_id]
        
        try:
            table.save()
            return Response(ProgressTableSerializer(table).data)
        except ValidationError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def rename_category(self, request, pk=None):
        table = self.get_object()
        category_id = request.data.get('category_id')
        new_name = request.data.get('new_name')
        
        if not category_id or not new_name:
            return Response(
                {'error': 'ID категории и новое имя обязательны'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        for category in table.categories:
            if category['id'] == category_id:
                category['name'] = new_name
                break
        
        try:
            table.save()
            return Response(ProgressTableSerializer(table).data)
        except ValidationError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )