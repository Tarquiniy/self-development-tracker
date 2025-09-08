from django.contrib import admin
from django.urls import path, include

from users.views import LoginView, RegisterView, ProfileView
from users.telegram_callback import telegram_callback

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/register/", RegisterView.as_view(), name="register"),
    path("api/auth/login/", LoginView.as_view(), name="login"),
    path("api/auth/profile/", ProfileView.as_view(), name="profile"),
    path("api/auth/telegram/login/", telegram_callback, name="telegram-login"),
    path("api/tables/", include("tables.urls")),
    path("api/payments/", include("payments.urls")),
    path("api/analytics/", include("analytics.urls")),
    path("api/blog/", include("blog.urls")),
]
