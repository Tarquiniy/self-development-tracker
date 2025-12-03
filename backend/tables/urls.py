# backend/tables/urls.py
from django.urls import path, include, re_path
from rest_framework.routers import DefaultRouter
from .views import ProgressTableViewSet, DailyProgressViewSet

router = DefaultRouter()
router.register(r"tables", ProgressTableViewSet, basename="tables")
router.register(r"progress", DailyProgressViewSet, basename="progress")

# Основные маршруты через router (с завершающим слэшем DRF)
urlpatterns = [
    path("", include(router.urls)),
]

# Дополнительные явные маршруты без завершающего слеша (на всякий случай)
# map list/create and detail endpoints to the same viewset actions
urlpatterns += [
    # list / create (no trailing slash)
    path("tables", ProgressTableViewSet.as_view({"get": "list", "post": "create"}), name="tables-no-slash"),
    path("tables/<str:id>", ProgressTableViewSet.as_view({"get": "retrieve", "put": "update", "delete": "destroy"}), name="tables-detail-no-slash"),

    # progress endpoints (no trailing slash)
    path("progress", DailyProgressViewSet.as_view({"get": "list", "post": "create"}), name="progress-no-slash"),
    path("progress/<str:id>", DailyProgressViewSet.as_view({"get": "retrieve", "put": "update", "delete": "destroy"}), name="progress-detail-no-slash"),
]
