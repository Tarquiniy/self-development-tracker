from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("users.urls")),
    path("api/tables/", include("tables.urls")),
    path("api/payments/", include("payments.urls")),
    path("api/analytics/", include("analytics.urls")),
    path("api/blog/", include("blog.urls")),
    
    # Serve React app for all other routes
    path('', TemplateView.as_view(template_name='index.html')),
]