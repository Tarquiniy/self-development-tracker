from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
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
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
    
    @action(detail=True, methods=['post'])
    def update_progress(self, request, pk=None):
        table = self.get_object()
        date = request.data.get('date', timezone.now().date().isoformat())
        progress_data = request.data.get('data', {})
        
        # Validate progress data
        for category_id, value in progress_data.items():
            if not any(cat['id'] == category_id for cat in table.categories):
                return Response(
                    {'error': f'Категория {category_id} не найдена в таблице'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if not (0 <= int(value) <= 99):
                return Response(
                    {'error': 'Значение прогресса должно быть между 0 и 99'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Create or update daily progress
        daily_progress, created = DailyProgress.objects.update_or_create(
            table=table,
            date=date,
            defaults={'data': progress_data}
        )
        
        serializer = DailyProgressSerializer(daily_progress)
        return Response(serializer.data)
    
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
        
        # Prepare data for radar chart
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
    
    