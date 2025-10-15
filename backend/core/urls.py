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


# bind safe index
admin.site.index = types.MethodType(_safe_admin_index, admin.site)

# autodiscover admin modules
try:
    admin.autodiscover()
except Exception:
    logger.exception("admin.autodiscover() failed")

# best-effort user/group setup (no proxies)
try:
    UserModel = get_user_model()
except Exception:
    UserModel = None
    logger.exception("Failed to get user model")

try:
    from django.contrib.auth.admin import GroupAdmin as DefaultGroupAdmin
    if Group not in admin.site._registry:
        try:
            admin.site.register(Group, DefaultGroupAdmin)
        except Exception:
            logger.debug("Could not register Group in admin.site")
except Exception:
    logger.debug("GroupAdmin import/registration failed")

# admin titles
admin.site.site_header = "Positive Theta Admin"
admin.site.site_title = "Positive Theta"
admin.site.index_title = "Панель управления Positive Theta"

# optional blog admin helper views
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

# -----------------------
# Dynamic resolver used by compatibility redirects
# -----------------------
def _find_registered_model(app_label_hint=None, model_name_hint=None, model_class_hint=None):
    for m in admin.site._registry.keys():
        try:
            ma = m._meta
        except Exception:
            continue
        if model_class_hint is not None and m is model_class_hint:
            return ma.app_label, ma.model_name
        if model_name_hint and ma.model_name == model_name_hint:
            if app_label_hint:
                if ma.app_label == app_label_hint:
                    return ma.app_label, ma.model_name
                else:
                    continue
            return ma.app_label, ma.model_name
        if app_label_hint and ma.app_label == app_label_hint and not model_name_hint:
            return ma.app_label, ma.model_name
    return None

def _redirect_to_computed_admin(app_label_hint=None, model_name_hint=None, action="changelist", fallback="/admin/"):
    def _view(request, *args, **kwargs):
        # try preferred namespaced candidate
        if app_label_hint and model_name_hint:
            cand = f"admin:{app_label_hint}_{model_name_hint}_{action}"
            try:
                return redirect(reverse(cand))
            except Exception:
                pass
        # try to discover actual registered model
        target = None
        if model_name_hint == "user":
            try:
                real_user = get_user_model()
            except Exception:
                real_user = None
            if real_user:
                res = _find_registered_model(model_class_hint=real_user)
                if res:
                    target = res
        if not target:
            res = _find_registered_model(app_label_hint, model_name_hint)
            if res:
                target = res
        if target:
            app_label, model_name = target
            cand = f"admin:{app_label}_{model_name}_{action}"
            try:
                return redirect(reverse(cand))
            except Exception:
                pass
        return redirect(fallback)
    return _view

# compatibility URL targets (root-level paths that templates may call without namespace)
compat_paths = [
    path("admin/auth/user/", _redirect_to_computed_admin(app_label_hint="auth", model_name_hint="user", action="changelist"), name="auth_user_changelist"),
    path("admin/blog/comment/", _redirect_to_computed_admin(app_label_hint="blog", model_name_hint="comment", action="changelist"), name="blog_comment_changelist"),
    path("admin/blog/post/add/", _redirect_to_computed_admin(app_label_hint="blog", model_name_hint="post", action="add"), name="blog_post_add"),
]

# ALSO register these names inside the 'admin' namespace so reverse(..., current_app='admin') works.
# We include compat_paths under namespace 'admin' before mounting real admin.site.urls.
compat_namespace = (compat_paths, "compat_admin")  # app_name doesn't matter; we set instance namespace 'admin' via include
# -----------------------
# Main urlpatterns
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

# mount compatibility patterns into the 'admin' namespace (so admin templates that call names without explicit namespace
# and set current_app='admin' will resolve).
urlpatterns += [
    path("", include(compat_namespace, namespace="admin")),
]

# also keep root-level compatibility (some templates may call un-namespaced names)
urlpatterns += compat_paths

# finally mount the real admin
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
