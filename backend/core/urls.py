# backend/core/urls.py
from django.urls import path
from users.views import RegisterView, LoginView

urlpatterns = [
    path('api/auth/register/', RegisterView.as_view(), name='register'),
    path('api/auth/login/', LoginView.as_view(), name='login'),
]