# backend/core/urls.py
from django.conf import settings
from django.urls import path, include
from django.contrib import admin as django_admin
from django.views.generic import TemplateView, RedirectView
from django.conf.urls.static import static
from .admin import custom_admin_site
from backend.users.views import RegisterView, LoginView, ProfileView
from blog import views as blog_views
from .views import cors_test

import importlib.util
import logging

logger = logging.getLogger(__name__)

# Попытка импортировать админ-views из blog.admin (dashboard, stats, post update, media library)
admin_dashboard_view = None
admin_stats_api = None
admin_post_update_view = None
admin_media_library_view = None
admin_autosave_view = None
admin_preview_token_view = None

try:
    from blog.admin import (
        admin_media_library_view,
        admin_dashboard_view,
        admin_post_update_view,
        admin_stats_api,
        admin_autosave_view,
        admin_preview_token_view,
    )
except Exception:
    admin_media_library_view = None
    admin_dashboard_view = None
    admin_post_update_view = None
    admin_stats_api = None
    admin_autosave_view = None
    admin_preview_token_view = None

# Если admin_media_library_view не предоставлен из blog.admin, попробуем взять MediaLibraryView из blog.views
if admin_media_library_view is None:
    try:
        from blog.views import MediaLibraryView
        admin_media_library_view = MediaLibraryView.as_view()
    except Exception:
        admin_media_library_view = None


urlpatterns = [
    path('grappelli/', include('grappelli.urls')),

    # Стандартная админка (нужна, чтобы корневые имена роутов admin присутствовали)
    path("admin/", django_admin.site.urls),

    # Дополнительная кастомная админка (если нужна) — отдельно
    path("custom-admin/", custom_admin_site.urls),

    # Auth endpoints (явные view-классы)
    path('api/auth/register/', RegisterView.as_view(), name='register'),
    path('api/auth/login/', LoginView.as_view(), name='login'),

    # Остальные API
    path('api/blog/', include(('blog.urls', 'blog'), namespace='blog')),

    # Подключаем tables гибко — сначала backend.tables, потом tables, иначе пропустить
]

# Попытка безопасно подключить tables.urls (варианты: backend.tables или tables)
try:
    if importlib.util.find_spec("backend.tables.urls"):
        urlpatterns += [path('api/tables/', include(('backend.tables.urls', 'tables'), namespace='tables'))]
    elif importlib.util.find_spec("tables.urls"):
        urlpatterns += [path('api/tables/', include(('tables.urls', 'tables'), namespace='tables'))]
    else:
        logger.debug("tables.urls not found — skipping tables API include")
except Exception:
    logger.exception("Error while attempting to include tables.urls; skipping")

# Summernote (подключаем без дублирования)
try:
    if importlib.util.find_spec("django_summernote"):
        urlpatterns += [path('summernote/', include('django_summernote.urls'))]
    else:
        logger.debug("django_summernote not installed — skipping include")
except Exception:
    logger.exception("Error while attempting to include django_summernote.urls")

# Profile endpoint
urlpatterns += [
    path('api/auth/profile/', ProfileView.as_view(), name='profile'),
    path('preview/<str:token>/', blog_views.preview_by_token, name='post-preview'),
    path('api/cors-test/', cors_test, name='cors-test'),
    path('', RedirectView.as_view(url='/admin/')),
]

# CKEditor5 include (если установлен)
try:
    if importlib.util.find_spec("django_ckeditor_5"):
        urlpatterns += [path('ckeditor5/', include('django_ckeditor_5.urls'))]
    else:
        logger.debug("django_ckeditor_5 not installed — skipping include")
except Exception:
    logger.exception("Error while attempting to include django_ckeditor_5.urls")

# Регистрируем /admin/media-library/ ДО admin.urls, чтобы не перехватывался
if admin_media_library_view:
    urlpatterns = [
        path('admin/media-library/', admin_media_library_view, name='admin-media-library'),
    ] + urlpatterns
else:
    urlpatterns = [
        path('admin/media-library/', TemplateView.as_view(template_name='admin/media_library_unavailable.html'), name='admin-media-library'),
    ] + urlpatterns

# Дополнительные админ-views (если доступны)
if admin_dashboard_view:
    urlpatterns += [ path('admin/dashboard/', admin_dashboard_view, name='admin-dashboard'), ]
if admin_stats_api:
    urlpatterns += [ path('admin/dashboard/stats-data/', admin_stats_api, name='admin-dashboard-stats'), ]
if admin_post_update_view:
    urlpatterns += [ path('admin/posts/update/', admin_post_update_view, name='admin-post-update'), ]
if admin_autosave_view:
    urlpatterns += [ path('admin/posts/autosave/', admin_autosave_view, name='admin-autosave'), ]
if admin_preview_token_view:
    urlpatterns += [ path('admin/posts/preview-token/', admin_preview_token_view, name='admin-preview-token'), ]

# В режиме разработки отдаём media/static
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
