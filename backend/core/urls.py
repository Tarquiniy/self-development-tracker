# backend/core/urls.py
from django.conf import settings
from django.contrib import admin
from django.urls import path, include
from users.views import RegisterView, LoginView, ProfileView
from django.conf.urls.static import static

# Импорт админ-views из blog.admin (dashboard, stats, post update, media library)
admin_dashboard_view = None
admin_stats_api = None
admin_post_update_view = None
admin_media_library_view = None
try:
    from blog.admin import admin_dashboard_view as _dashboard_view
    from blog.admin import admin_stats_api as _stats_api
    from blog.admin import admin_post_update_view as _post_update
    from blog.admin import admin_media_library_view as _media_lib
    admin_dashboard_view = _dashboard_view
    admin_stats_api = _stats_api
    admin_post_update_view = _post_update
    admin_media_library_view = _media_lib
except Exception:
    admin_dashboard_view = None
    admin_stats_api = None
    admin_post_update_view = None
    admin_media_library_view = None

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

# Регистрация админ-views если они доступны
if admin_dashboard_view:
    urlpatterns += [
        path('admin/dashboard/', admin_dashboard_view, name='admin-dashboard'),
    ]

if admin_stats_api:
    urlpatterns += [
        path('admin/dashboard/stats-data/', admin_stats_api, name='admin-dashboard-stats'),
    ]

if admin_post_update_view:
    urlpatterns += [
        path('admin/posts/update/', admin_post_update_view, name='admin-post-update'),
    ]

if admin_media_library_view:
    urlpatterns += [
        path('admin/media-library/', admin_media_library_view, name='admin-media-library'),
    ]

if settings.DEBUG:  # только в dev
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
