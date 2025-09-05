from django.urls import path
from .views import RegisterView, LoginView, ProfileView
from . import views

urlpatterns = [
    path("register/", views.register, name="register"),
    path("login/", views.login, name="login"),
    path("profile/", ProfileView.as_view(), name="profile"),
]
