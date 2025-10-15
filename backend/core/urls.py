# backend/core/urls.py
from django.conf import settings
from django.contrib import admin
from django.urls import path, include, reverse
from django.views.generic import TemplateView
from django.conf.urls.static import static
import logging
import types
from django.http import HttpResponse
from django.utils.html import escape
from django.shortcuts import redirect
from django.utils.module_loading import import_string
from django.template.response import TemplateResponse

logger = logging.getLogger(__name__)

# -----------------------
# lazy loader for class-based views (prevents imports at URLConf import time)
# -----------------------
def lazy_class_view(dotted_path):
    def _call(request, *args, **kwargs):
        view_cls = import_string(dotted_path)
        return view_cls.as_view()(request, *args, **kwargs)
    return _call

# -----------------------
# Safe admin index: не вызывает self.each_context.
# Возвращает TemplateResponse('admin/index.html') с минимальным контекстом.
# -----------------------
def _safe_admin_index(self, request, extra_context=None):
    app_list = []
    for model in list(self._registry.keys()):
        try:
            opts = model._meta
            app_label = opts.app_label
            model_name = opts.model_name
        except Exception:
            continue

        admin_url = None
        add_url = None
        for cand in (f"admin:{app_label}_{model_name}_changelist", f"{app_label}_{model_name}_changelist"):
            try:
                admin_url = reverse(cand)
                break
            except Exception:
                admin_url = None
        for cand in (f"admin:{app_label}_{model_name}_add", f"{app_label}_{model_name}_add"):
            try:
                add_url = reverse(cand)
                break
            except Exception:
                add_url = None

        if not admin_url and not add_url:
            continue

        app_list.append({
            "name": getattr(opts, "verbose_name", app_label).title(),
            "app_label": app_label,
            "models": [{
                "name": getattr(opts, "verbose_name_plural", model_name).title(),
                "object_name": opts.object_name,
                "admin_url": admin_url or "#",
                "add_url": add_url or None,
                "perms": {"change": True},
            }],
        })

    context = {
        "site_title": self.site_title,
        "site_header": self.site_header,
        "title": self.index_title,
        "app_list": app_list,
        "available_apps": app_list,
        "has_permission": True,
    }
    if extra_context:
        context.update(extra_context)

    return TemplateResponse(request, "admin/index.html", context)


# Привязываем безопасный index к admin.site
admin.site.index = types.MethodType(_safe_admin_index, admin.site)

# НЕ вызываем admin.autodiscover() здесь чтобы не форсировать ранние импорты

# Попробуем зарегистрировать модель пользователя в admin.site, если ещё не зарегистрирована.
# Это устраняет ошибки с отсутствующими admin url-именами (например auth_user_changelist).
try:
    from django.contrib.auth import get_user_model
    UserModel = get_user_model()
    if UserModel and UserModel not in admin.site._registry:
        try:
            # Попытка использовать project-specific UserAdmin, если есть
            from users.admin import UserAdmin as ProjectUserAdmin  # may raise
            admin.site.register(UserModel, ProjectUserAdmin)
        except Exception:
            try:
                from django.contrib.auth.admin import UserAdmin as DefaultUserAdmin
                admin.site.register(UserModel, DefaultUserAdmin)
            except Exception:
                logger.exception("Failed to register UserModel in admin.site with DefaultUserAdmin")
except Exception:
    logger.debug("Failed to get/register user model in URLConf")

# Ensure Group registered if not present
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

# Admin titles
admin.site.site_header = "Positive Theta Admin"
admin.site.site_title = "Positive Theta"
admin.site.index_title = "Панель управления Positive Theta"

# Try to import optional blog admin helpers (best-effort)
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

# Helpers: поиск зарегистрированных моделей и редирект к ним
def _find_registered_model(app_label_hint=None, model_name_hint=None):
    for m in admin.site._registry.keys():
        try:
            ma = m._meta
        except Exception:
            continue
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
        if app_label_hint and model_name_hint:
            cand = f"admin:{app_label_hint}_{model_name_hint}_{action}"
            try:
                return redirect(reverse(cand))
            except Exception:
                pass
        res = _find_registered_model(app_label_hint, model_name_hint)
        if res:
            app_label, model_name = res
            cand = f"admin:{app_label}_{model_name}_{action}"
            try:
                return redirect(reverse(cand))
            except Exception:
                pass
        return redirect(fallback)
    return _view

# URL patterns
urlpatterns = [
    path("grappelli/", include("grappelli.urls")),
    path("api/auth/register/", lazy_class_view("users.views.RegisterView"), name="register"),
    path("api/auth/login/", lazy_class_view("users.views.LoginView"), name="login"),
    path("api/blog/", include(("blog.urls", "blog"), namespace="blog")),
    path("summernote/", include("django_summernote.urls")),
    path("api/auth/profile/", lazy_class_view("users.views.ProfileView"), name="profile"),
    path("preview/<str:token>/", (getattr(blog_admin, "preview_by_token") if blog_admin and hasattr(blog_admin, "preview_by_token") else TemplateView.as_view(template_name="404.html")), name="post-preview"),
]

if admin_media_library_view:
    urlpatterns += [path("admin/media-library/", admin_media_library_view, name="admin-media-library")]
else:
    urlpatterns += [path("admin/media-library/", TemplateView.as_view(template_name="admin/media_library_unavailable.html"), name="admin-media-library")]

urlpatterns += [
    path("admin/auth/user/", _redirect_to_computed_admin(app_label_hint="auth", model_name_hint="user", action="changelist"), name="auth_user_changelist"),
    path("admin/blog/comment/", _redirect_to_computed_admin(app_label_hint="blog", model_name_hint="comment", action="changelist"), name="blog_comment_changelist"),
    path("admin/blog/post/add/", _redirect_to_computed_admin(app_label_hint="blog", model_name_hint="post", action="add"), name="blog_post_add"),
]

urlpatterns += [path("admin/", admin.site.urls)]

if admin_dashboard_view:
    urlpatterns += [path("admin/dashboard/", admin_dashboard_view, name="admin-dashboard")]
if admin_stats_api:
    urlpatterns += [path("admin/dashboard/stats-data/", admin_stats_api, name="admin-dashboard-stats")]
if admin_post_update_view:
    urlpatterns += [path("admin/posts/update/", admin_post_update_view, name="admin-post-update")]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
