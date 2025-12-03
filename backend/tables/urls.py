# backend/tables/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProgressTableViewSet, DailyProgressViewSet

router = DefaultRouter()
router.register(r"tables", ProgressTableViewSet, basename="tables")
router.register(r"progress", DailyProgressViewSet, basename="progress")

urlpatterns = [
    path("", include(router.urls)),
]
