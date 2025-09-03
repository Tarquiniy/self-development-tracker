from django.urls import path
from . import views
from .telegram_callback import telegram_callback

urlpatterns = [
    path('register/', views.register_user, name='register'),
    path('login/', views.login_user, name='login'),
    path('telegram/login/', views.telegram_auth, name='telegram-login'),
    path('telegram/callback/', telegram_callback, name='telegram-callback'),
    path('profile/', views.get_user_profile, name='profile'),
    path('test/', views.auth_test, name='auth-test'),
]