from django.urls import path
from . import views

urlpatterns = [
    path("register/", views.register, name="register"),
    path("login/", views.login, name="login"),
    path("profile/", views.ProfileView.as_view(), name="profile"),
    path("telegram/login/", views.telegram_callback, name="telegram-login"),
]