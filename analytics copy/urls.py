from django.urls import path
from . import views

urlpatterns = [
    path('test/', views.analytics_test, name='analytics-test'),
]