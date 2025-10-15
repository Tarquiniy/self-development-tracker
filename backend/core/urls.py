# backend/core/urls.py
from django.conf import settings
from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView
from django.conf.urls.static import static
from django.shortcuts import redirect
from django.utils.functional import cached_property
from django.urls import path

import logging

logger = logging.getLogger(__name__)

# --- Админ: заголовки ---
admin.site.site_header = "Positive Theta Admin"
admin.site.site_title = "Positive Theta"
admin.site.index_title = "Панель управления Positive Theta"

# --- Гарантированная регистрация модели пользователя в admin.site ---
try:
    from django.contrib.auth import get_user_model
    UserModel = get_user_model()
    if UserModel and UserModel not in admin.site._registry:
        try:
            # если в проекте есть users.admin.UserAdmin — используем его
            from users.admin import UserAdmin as ProjectUserAdmin
            admin.site.register(UserModel, ProjectUserAdmin)
        except Exception:
            try:
                # fallback на стандартный UserAdmin
                from django.contrib.auth.admin import UserAdmin as DefaultUserAdmin
                admin.site.register(UserModel, DefaultUserAdmin)
            except Exception:
                logger.exception("Failed to register UserModel in admin.site")
except Exception:
    logger.exception("Failed to ensure user registration in admin.site")

# --- Ensure Group registered ---
try:
    from django.contrib.auth.models import Group
    from django.contrib.auth.admin import GroupAdmin as DefaultGroupAdmin
    if Group not in admin.site._registry:
        try:
            admin.site.register(Group, DefaultGroupAdmin)
        except Exception:
            logger.debug("Could not register Group in admin.site")
except Exception:
    logger.debug("GroupAdmin import/registration failed")

# --- Try to import optional blog admin helpers (best-effort) ---
admin_media_library_view = None
admin_dashboard_view = None
admin_stats_api = None
admin_post_update_view = None
admin_autosave_view = None
admin_preview_token_view = None
try:
    from blog import admin as blog_admin
    admin_media_library_view = getattr(blog_admin, "admin_media_library", None) or getattr(blog_admin, "admin_media_library_view", None)
    admin_dashboard_view = getattr(blog_admin, "admin_dashboard_view", None)
    admin_stats_api = getattr(blog_admin, "admin_stats_api", None)
    admin_post_update_view = getattr(blog_admin, "admin_post_update_view", None)
    admin_autosave_view = getattr(blog_admin, "admin_autosave_view", None)
    admin_preview_token_view = getattr(blog_admin, "admin_preview_token_view", None)
except Exception:
    blog_admin = None
    logger.debug("blog.admin import failed or helpers missing")

def _redirect_to_users_changelist(request):
    # try users_customuser_changelist, fallback to admin:index
    try:
        return redirect("admin:users_customuser_changelist")
    except Exception:
        return redirect("admin:index")

def _redirect_to_users_add(request):
    try:
        return redirect("admin:users_customuser_add")
    except Exception:
        return redirect("admin:index")

# patch admin.site.get_urls to expose compatibility names inside "admin:" namespace
_original_admin_get_urls = admin.site.get_urls

def _admin_get_urls_with_compat():
    extra = [
        path("auth/user/", _redirect_to_users_changelist, name="auth_user_changelist"),
        path("auth/user/add/", _redirect_to_users_add, name="auth_user_add"),
    ]
    return extra + _original_admin_get_urls()

admin.site.get_urls = _admin_get_urls_with_compat

# --- URL patterns ---
urlpatterns = [
    path("grappelli/", include("grappelli.urls")),
    path("admin/", admin.site.urls),  # <- гарантирует namespace 'admin'
    path("api/blog/", include(("blog.urls", "blog"), namespace="blog")),
    path("summernote/", include("django_summernote.urls")),
    path("api/auth/register/", include(("users.urls", "users"), namespace="users") if False else TemplateView.as_view(template_name="404.html")),  # замените при наличии users.urls
    path("preview/<str:token>/", (getattr(blog_admin, "preview_by_token") if blog_admin and hasattr(blog_admin, "preview_by_token") else TemplateView.as_view(template_name="404.html")), name="post-preview"),
]

# optional media-library before admin/
if admin_media_library_view:
    urlpatterns += [path("admin/media-library/", admin_media_library_view, name="admin-media-library")]
else:
    urlpatterns += [path("admin/media-library/", TemplateView.as_view(template_name="admin/media_library_unavailable.html"), name="admin-media-library")]

if admin_dashboard_view:
    urlpatterns += [path("admin/dashboard/", admin_dashboard_view, name="admin-dashboard")]
if admin_stats_api:
    urlpatterns += [path("admin/dashboard/stats-data/", admin_stats_api, name="admin-dashboard-stats")]
if admin_post_update_view:
    urlpatterns += [path("admin/posts/update/", admin_post_update_view, name="admin-post-update")]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
