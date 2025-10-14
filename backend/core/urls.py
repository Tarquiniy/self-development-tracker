# backend/core/urls.py
from django.conf import settings
from django.contrib import admin
from django.urls import path, include
#from users.views import RegisterView, LoginView, ProfileView
from django.conf.urls.static import static
from .admin import custom_admin_site
from backend.blog import views as blog_views

from django.views.generic import TemplateView
from django.views.generic import RedirectView

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
    # Регистрируем кастомную админку (только один раз)
    path("admin/", custom_admin_site.urls),
    #path('api/auth/register/', RegisterView.as_view(), name='register'),
    #path('api/auth/login/', LoginView.as_view(), name='login'),
    path('api/blog/', include(('blog.urls', 'blog'), namespace='blog')),
    #path('api/tables/', include(('tables.urls', 'tables'), namespace='tables')),
    path('summernote/', include('django_summernote.urls')),
    #path('api/auth/profile/', ProfileView.as_view(), name='profile'),
    path('preview/<str:token>/', blog_views.preview_by_token, name='post-preview'),
    path('', RedirectView.as_view(url='/admin/')),
]

# Добавляем CKEditor 5 URLs
try:
    urlpatterns += [
        path('ckeditor5/', include('django_ckeditor_5.urls')),
    ]
except Exception:
    pass

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