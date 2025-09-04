from django.urls import path
from . import views
from .views import telegram_auth

urlpatterns = [
    path('register/', views.register_user, name='register'),
    path('login/', views.login_user, name='login'),
    path('telegram/auth/', telegram_auth, name='telegram-auth'),
    path('profile/', views.get_user_profile, name='profile'),
    path('test/', views.auth_test, name='auth-test'),
]