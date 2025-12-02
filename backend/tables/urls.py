# backend/tables/urls.py
from rest_framework.routers import DefaultRouter
from django.urls import path, include

from .views import ProgressTableViewSet, DailyProgressViewSet

app_name = "tables"

router = DefaultRouter()
router.register(r'tables', ProgressTableViewSet, basename='table')   # -> /api/tables/tables/
router.register(r'progress', DailyProgressViewSet, basename='progress')  # -> /api/tables/progress/

urlpatterns = [
    path('', include(router.urls)),
]
