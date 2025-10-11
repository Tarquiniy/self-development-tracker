# backend/core/urls.py
from django.conf import settings
from django.contrib import admin
from django.urls import path, include, reverse_lazy
from django.shortcuts import redirect
from django.views.generic import TemplateView
from django.views.generic.base import RedirectView
from users.views import RegisterView, LoginView, ProfileView
from django.conf.urls.static import static
from .admin import custom_admin_site
from blog import views as blog_views

# Импортируем модуль blog.admin целиком (не отдельные имена) — это более надёжно.
# Если blog.admin при импорте упадёт, мы поймаем исключение и продолжим без совместимых путей.
try:
    import blog.admin as blog_admin_mod
except Exception:
    blog_admin_mod = None

# Получаем возможные view-алиасы из blog.admin через getattr (без падения, если их нет)
def _get_attr(mod, name):
    if not mod:
        return None
    return getattr(mod, name, None)

admin_media_library_view = _get_attr(blog_admin_mod, "admin_media_library_view") or _get_attr(blog_admin_mod, "admin_media_library")
admin_dashboard_view = _get_attr(blog_admin_mod, "admin_dashboard_view")
admin_post_update_view = _get_attr(blog_admin_mod, "admin_post_update_view")
admin_stats_api = _get_attr(blog_admin_mod, "admin_stats_api") or _get_attr(blog_admin_mod, "admin_dashboard_stats")
admin_autosave_view = _get_attr(blog_admin_mod, "admin_autosave_view") or _get_attr(blog_admin_mod, "admin_autosave")
admin_preview_token_view = _get_attr(blog_admin_mod, "admin_preview_token_view") or _get_attr(blog_admin_mod, "admin_preview_token")

# Compatibility: explicit post-admin views (names that templates may reverse)
blog_post_add_view = _get_attr(blog_admin_mod, "blog_post_add")
blog_post_change_view = _get_attr(blog_admin_mod, "blog_post_change")
blog_post_changelist_view = _get_attr(blog_admin_mod, "blog_post_changelist")

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
    path('api/auth/register/', RegisterView.as_view(), name='register'),
    path('api/auth/login/', LoginView.as_view(), name='login'),
    path('api/blog/', include(('blog.urls', 'blog'), namespace='blog')),
    path('api/tables/', include(('tables.urls', 'tables'), namespace='tables')),
    path('summernote/', include('django_summernote.urls')),
    path('api/auth/profile/', ProfileView.as_view(), name='profile'),
    path('preview/<str:token>/', blog_views.preview_by_token, name='post-preview'),

    # Root — редиректим на админ (чтобы "/" не возвращал 404).
    path('', RedirectView.as_view(url=reverse_lazy('admin:index'))),
]

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

# --- Добавляем совместимые маршруты для admin постов, если алиасы доступны в blog.admin ---
# Это именно те имена, которые шаблон пытается реверсить: 'blog_post_add', 'blog_post_change', 'blog_post_changelist'.
if callable(blog_post_add_view):
    urlpatterns += [ path('admin/blog/post/add/', blog_post_add_view, name='blog_post_add') ]
if callable(blog_post_change_view):
    urlpatterns += [ path('admin/blog/post/<int:object_id>/change/', blog_post_change_view, name='blog_post_change') ]
if callable(blog_post_changelist_view):
    urlpatterns += [ path('admin/blog/post/', blog_post_changelist_view, name='blog_post_changelist') ]

# В режиме разработки отдаём media/static
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
