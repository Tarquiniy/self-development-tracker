from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProgressTableViewSet, tables_test

router = DefaultRouter()
router.register(r'tables', ProgressTableViewSet, basename='table')

urlpatterns = [
    path('', include(router.urls)),
    path('test/', tables_test, name='tables-test'),
]