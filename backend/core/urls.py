# backend/core/urls.py
from django.conf import settings
from django.contrib import admin
from django.urls import path, include, reverse
from django.views.generic import TemplateView
from users.views import RegisterView, LoginView, ProfileView
from django.conf.urls.static import static
import logging
import types
from django.http import HttpResponse
from django.template.response import TemplateResponse
from django.utils.html import escape
from django.shortcuts import redirect
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.contrib.auth.admin import UserAdmin as DefaultUserAdmin, GroupAdmin as DefaultGroupAdmin

logger = logging.getLogger(__name__)

# -----------------------
# Safe admin index to avoid NoReverseMatch during rendering
# -----------------------
def _safe_admin_index(self, request, extra_context=None):
    app_list = []
    for model in list(self._registry.keys()):
        opts = model._meta
        app_label = opts.app_label
        model_name = opts.model_name
        candidates = [
            f"admin:{app_label}_{model_name}_changelist",
            f"{app_label}_{model_name}_changelist",
        ]
        url = None
        for cand in candidates:
            try:
                url = reverse(cand)
                break
            except Exception:
                continue
        if not url:
            continue
        app_list.append({
            "name": f"{opts.verbose_name.title()}" if hasattr(opts, "verbose_name") else f"{model_name}",
            "app_label": app_label,
            "models": [{
                "name": opts.verbose_name_plural.title() if hasattr(opts, "verbose_name_plural") else model_name,
                "object_name": opts.object_name,
                "admin_url": url,
                "perms": {"change": True},
            }],
        })

    context = dict(self.each_context(request))
    if extra_context:
        context.update(extra_context)
    context["app_list"] = app_list

    try:
        return TemplateResponse(request, "admin/index.html", context)
    except Exception:
        items = "".join([f'<li><a href="{escape(m["models"][0]["admin_url"])}">{escape(m["name"])}</a></li>' for m in app_list])
        html = f"<html><head><title>Admin</title></head><body><h1>Admin</h1><ul>{items}</ul></body></html>"
        return HttpResponse(html, content_type="text/html")


# Привязываем безопасный index к admin.site
admin.site.index = types.MethodType(_safe_admin_index, admin.site)

# -----------------------
# Ensure admin autodiscover
# -----------------------
try:
    admin.autodiscover()
except Exception:
    logger.exception("admin.autodiscover() failed")

# -----------------------
# Ensure User/Group registration and create AUTH proxy under 'auth' app label
# -----------------------
try:
    UserModel = get_user_model()
except Exception:
    UserModel = None
    logger.exception("Failed to get user model")

# Try to use project-specific UserAdmin if exists
try:
    from users.admin import UserAdmin as ProjectUserAdmin
except Exception:
    ProjectUserAdmin = None

# Register the real UserModel if not already registered (best-effort)
if UserModel:
    try:
        if UserModel not in admin.site._registry:
            if ProjectUserAdmin is not None:
                try:
                    admin.site.register(UserModel, ProjectUserAdmin)
                except Exception:
                    try:
                        admin.site.register(UserModel, DefaultUserAdmin)
                    except Exception:
                        logger.debug("Failed to register UserModel with both ProjectUserAdmin and DefaultUserAdmin.")
            else:
                try:
                    admin.site.register(UserModel, DefaultUserAdmin)
                except Exception:
                    logger.debug("Failed to register UserModel with DefaultUserAdmin.")
    except Exception:
        logger.exception("Error while registering UserModel in admin.site")

# Ensure Group registered
try:
    if Group not in admin.site._registry:
        try:
            admin.site.register(Group, DefaultGroupAdmin)
        except Exception:
            logger.debug("Failed to register Group with DefaultGroupAdmin.")
except Exception:
    logger.exception("Error while registering Group in admin.site")

# --- Create proxy model named 'User' with app_label='auth' if ('auth','user') missing ---
try:
    try:
        has_auth_user = any((m._meta.app_label == "auth" and m._meta.model_name == "user") for m in admin.site._registry.keys())
    except Exception:
        has_auth_user = False
        logger.exception("Failed while checking existing admin registrations for auth.user")

    if not has_auth_user and UserModel:
        try:
            ProxyAttrs = {
                "__module__": "backend.core._auth_proxy",
                "Meta": type("Meta", (), {"proxy": True, "app_label": "auth",
                                         "verbose_name": getattr(UserModel._meta, "verbose_name", "user"),
                                         "verbose_name_plural": getattr(UserModel._meta, "verbose_name_plural", "users")})
            }
            ProxyModel = type("User", (UserModel,), ProxyAttrs)
            try:
                if ProjectUserAdmin is not None:
                    admin.site.register(ProxyModel, ProjectUserAdmin)
                else:
                    admin.site.register(ProxyModel, DefaultUserAdmin)
            except Exception:
                try:
                    admin.site.unregister(ProxyModel)
                except Exception:
                    pass
                try:
                    admin.site.register(ProxyModel, DefaultUserAdmin)
                except Exception:
                    logger.exception("Failed to register auth proxy model 'User' in admin.site")
        except Exception:
            logger.exception("Failed to create/register auth proxy model")
except Exception:
    logger.exception("Unexpected error during auth-proxy setup")

# Set admin titles
admin.site.site_header = "Positive Theta Admin"
admin.site.site_title = "Positive Theta"
admin.site.index_title = "Панель управления Positive Theta"

# -----------------------
# Optional blog admin helper views
# -----------------------
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
    logger.debug("blog.admin import failed or blog_admin helpers missing")

# -----------------------
# Helper redirect for templates that call bare names (temporary)
# -----------------------
def _redirect_to_admin(namespaced_name, fallback="/admin/"):
    def _view(request, *args, **kwargs):
        try:
            return redirect(reverse(namespaced_name))
        except Exception:
            return redirect(fallback)
    return _view

# -----------------------
# URL patterns
# -----------------------
urlpatterns = [
    path("grappelli/", include("grappelli.urls")),

    # API / auth
    path("api/auth/register/", RegisterView.as_view(), name="register"),
    path("api/auth/login/", LoginView.as_view(), name="login"),
    path("api/blog/", include(("blog.urls", "blog"), namespace="blog")),
    path("summernote/", include("django_summernote.urls")),
    path("api/auth/profile/", ProfileView.as_view(), name="profile"),
    path("preview/<str:token>/", (blog_admin.preview_by_token if blog_admin and hasattr(blog_admin, "preview_by_token") else TemplateView.as_view(template_name="404.html")), name="post-preview"),
]

# media-library route before admin/ if provided by blog.admin
if admin_media_library_view:
    urlpatterns += [
        path("admin/media-library/", admin_media_library_view, name="admin-media-library"),
    ]
else:
    urlpatterns += [
        path("admin/media-library/", TemplateView.as_view(template_name="admin/media_library_unavailable.html"), name="admin-media-library"),
    ]

# Compatibility aliases for templates calling bare names (temporary)
urlpatterns += [
    path("admin/auth/user/", _redirect_to_admin("admin:auth_user_changelist"), name="auth_user_changelist"),
    path("admin/blog/comment/", _redirect_to_admin("admin:blog_comment_changelist"), name="blog_comment_changelist"),
    path("admin/blog/post/add/", _redirect_to_admin("admin:blog_post_add"), name="blog_post_add"),
]

# Use standard admin.site (ensures expected "admin:" namespace and URL names)
urlpatterns += [
    path("admin/", admin.site.urls),
]

# Additional optional admin views (kept outside admin.site)
if admin_dashboard_view:
    urlpatterns += [path("admin/dashboard/", admin_dashboard_view, name="admin-dashboard")]

if admin_stats_api:
    urlpatterns += [path("admin/dashboard/stats-data/", admin_stats_api, name="admin-dashboard-stats")]

if admin_post_update_view:
    urlpatterns += [path("admin/posts/update/", admin_post_update_view, name="admin-post-update")]

# Serve media/static in DEBUG
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
