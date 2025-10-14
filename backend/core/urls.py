# backend/core/urls.py
from django.conf import settings
from django.contrib import admin
from django.urls import path, include
from users.views import RegisterView, LoginView, ProfileView
from django.conf.urls.static import static
from django.views.generic import TemplateView

# Попытка импортировать админ-views из blog.admin (dashboard, stats, post update, media library)
admin_dashboard_view = None
admin_stats_api = None
admin_post_update_view = None
admin_media_library_view = None
admin_autosave_view = None
admin_preview_token_view = None
try:
    from blog import admin as blog_admin
    admin_dashboard_view = getattr(blog_admin, "admin_dashboard_view", None)
    admin_stats_api = getattr(blog_admin, "admin_stats_api", None)
    admin_media_library_view = getattr(blog_admin, "admin_media_library_view", None)
    admin_post_update_view = getattr(blog_admin, "admin_post_update_view", None)
    admin_autosave_view = getattr(blog_admin, "admin_autosave_view", None)
    admin_preview_token_view = getattr(blog_admin, "admin_preview_token_view", None)
except Exception:
    admin_dashboard_view = admin_stats_api = admin_post_update_view = admin_media_library_view = admin_autosave_view = admin_preview_token_view = None

urlpatterns = [
    path('grappelli/', include('grappelli.urls')),

    # API / auth
    path('api/auth/register/', RegisterView.as_view(), name='register'),
    path('api/auth/login/', LoginView.as_view(), name='login'),
    path('api/blog/', include(('blog.urls', 'blog'), namespace='blog')),
    path('api/tables/', include(('tables.urls', 'tables'), namespace='tables')),
    path('summernote/', include('django_summernote.urls')),
    path('api/auth/profile/', ProfileView.as_view(), name='profile'),
    path('preview/<str:token>/', lambda req, token: blog_admin.preview_by_token(req, token) if hasattr(blog_admin, "preview_by_token") else TemplateView.as_view(template_name='404.html')(req), name='post-preview'),
]

# Регистрируем media-library route до admin/, если он предоставлен модулем blog.admin
if admin_media_library_view:
    urlpatterns += [
        path('admin/media-library/', admin_media_library_view, name='admin-media-library'),
    ]
else:
    urlpatterns += [
        path('admin/media-library/', TemplateView.as_view(template_name='admin/media_library_unavailable.html'), name='admin-media-library'),
    ]

# Подключаем стандартную админку (admin.site)
urlpatterns += [
    path('admin/', admin.site.urls),
]

# Регистрация дополнительных admin-views, если доступны (не входят в стандартный admin.site)
if admin_dashboard_view:
    urlpatterns += [ path('admin/dashboard/', admin_dashboard_view, name='admin-dashboard') ]

if admin_stats_api:
    urlpatterns += [ path('admin/dashboard/stats-data/', admin_stats_api, name='admin-dashboard-stats') ]

if admin_post_update_view:
    urlpatterns += [ path('admin/posts/update/', admin_post_update_view, name='admin-post-update') ]

# В режиме разработки отдать media/static
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
