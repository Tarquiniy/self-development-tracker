# backend/tables/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProgressTableViewSet, DailyProgressViewSet

router = DefaultRouter()
router.register(r"tables", ProgressTableViewSet, basename="tables")
router.register(r"progress", DailyProgressViewSet, basename="progress")

urlpatterns = [
    # основной набор маршрутов (с трейлинг-слеш)
    path("", include(router.urls)),

    # дополнительные маршруты без завершающего слеша, чтобы POST /api/tables/tables (без /) тоже работал
    path("tables", ProgressTableViewSet.as_view({"get": "list", "post": "create"}), name="tables-no-slash"),
    path("tables/<str:id>", ProgressTableViewSet.as_view({"get": "retrieve", "put": "update", "delete": "destroy"}), name="tables-detail-no-slash"),
    path("progress", DailyProgressViewSet.as_view({"get": "list", "post": "create"}), name="progress-no-slash"),
    path("progress/<str:id>", DailyProgressViewSet.as_view({"get": "retrieve", "put": "update", "delete": "destroy"}), name="progress-detail-no-slash"),
]
