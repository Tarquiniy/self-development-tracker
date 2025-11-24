from rest_framework.routers import DefaultRouter
from django.urls import path, include

from .views import ProgressTableViewSet, DailyProgressViewSet, CalendarView

app_name = "tables"

router = DefaultRouter()
router.register(r'tables', ProgressTableViewSet, basename='table')
router.register(r'progress', DailyProgressViewSet, basename='progress')

urlpatterns = [
    path('', include(router.urls)),
    # Новые эндпоинты для календаря
    path('calendar/events/', CalendarView.as_view(), name='calendar-events'),
    path('calendar/stats/<uuid:table_id>/', CalendarView.as_view(), name='calendar-stats'),
]