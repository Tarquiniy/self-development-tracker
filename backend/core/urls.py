from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("users.urls")),
    path("api/tables/", include("tables.urls")),
    path("api/payments/", include("payments.urls")),
    path("api/analytics/", include("analytics.urls")),
    path("api/blog/", include("blog.urls")),
]
