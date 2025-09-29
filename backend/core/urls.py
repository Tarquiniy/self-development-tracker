# backend/core/urls.py
from django.conf import settings
from django.contrib import admin
from django.urls import path, include
from users.views import RegisterView, LoginView, ProfileView
from django.conf.urls.static import static

# Импортируем админ-views из blog.admin
try:
    from blog.admin import admin_dashboard_view, admin_stats_api
except Exception:
    # безопасный fallback — если импорт не прошёл, admin dashboard не будет доступен
    admin_dashboard_view = None
    admin_stats_api = None

urlpatterns = [
    path('grappelli/', include('grappelli.urls')),
    path('api/auth/register/', RegisterView.as_view(), name='register'),
    path('api/auth/login/', LoginView.as_view(), name='login'),
    # подключаем API блога
    path('api/blog/', include(('blog.urls', 'blog'), namespace='blog')),
    # подключаем API tables (важно для фронтенда: /api/tables/tables/)
    path('api/tables/', include(('tables.urls', 'tables'), namespace='tables')),
    path('admin/', admin.site.urls),
    path('summernote/', include('django_summernote.urls')),
    path('api/auth/profile/', ProfileView.as_view(), name='profile'),
]

# Регистрируем админ дашборд и API, если они доступны
if admin_dashboard_view:
    urlpatterns += [
        path('admin/dashboard/', admin_dashboard_view, name='admin-dashboard'),
    ]

if admin_stats_api:
    urlpatterns += [
        path('admin/dashboard/stats-data/', admin_stats_api, name='admin-dashboard-stats'),
    ]

if settings.DEBUG:  # только в dev
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
