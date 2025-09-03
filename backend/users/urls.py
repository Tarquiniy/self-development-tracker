from django.urls import path

from backend.users import telegram_callback
from . import views

urlpatterns = [
    path('register/', views.register_user, name='register'),
    path('login/', views.login_user, name='login'),
    path('telegram/login/', views.telegram_auth, name='telegram-login'),
    path('telegram/callback/', telegram_callback, name='telegram-callback'),  # НОВЫЙ URL
    path('profile/', views.get_user_profile, name='profile'),
    path('test/', views.auth_test, name='auth-test'),
]