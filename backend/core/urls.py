# backend/core/urls.py
from django.conf import settings
from django.contrib import admin
from django.urls import path, include, reverse
from django.views.generic import TemplateView
from django.conf.urls.static import static
from django.shortcuts import redirect
from django.utils.html import escape
import logging

# Попытка импортировать кастомный admin site (если есть)
try:
    from core.admin import custom_admin_site as custom_admin_site
except Exception:
    custom_admin_site = None

logger = logging.getLogger(__name__)

# --- Админ: заголовки ---
admin.site.site_header = "Positive Theta Admin"
admin.site.site_title = "Positive Theta"
admin.site.index_title = "Панель управления Positive Theta"

# --- Гарантированная регистрация User и Group (best-effort) ---
try:
    from django.contrib.auth import get_user_model
    UserModel = get_user_model()
    if UserModel and UserModel not in admin.site._registry:
        try:
            from users.admin import UserAdmin as ProjectUserAdmin
            admin.site.register(UserModel, ProjectUserAdmin)
        except Exception:
            try:
                from django.contrib.auth.admin import UserAdmin as DefaultUserAdmin
                admin.site.register(UserModel, DefaultUserAdmin)
            except Exception:
                logger.debug("Failed to register UserModel in admin.site", exc_info=True)
except Exception:
    logger.debug("Could not ensure UserModel registration", exc_info=True)

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

# --- Подключаем вспомогательные views из blog.admin (если есть) ---
admin_media_library_view = None
admin_dashboard_view = None
admin_stats_api = None
admin_post_update_view = None
admin_autosave_view = None
admin_preview_token_view = None
blog_admin = None
try:
    from blog import admin as blog_admin
    admin_media_library_view = getattr(blog_admin, "admin_media_library", None) or getattr(blog_admin, "admin_media_library_view", None)
    admin_dashboard_view = getattr(blog_admin, "admin_dashboard_view", None)
    admin_stats_api = getattr(blog_admin, "admin_dashboard_stats", None) or getattr(blog_admin, "admin_stats_api", None)
    admin_post_update_view = getattr(blog_admin, "admin_post_update_view", None)
    admin_autosave_view = getattr(blog_admin, "admin_autosave_view", None)
    admin_preview_token_view = getattr(blog_admin, "admin_preview_token_view", None)
except Exception:
    blog_admin = None
    logger.debug("blog.admin import failed or helpers missing")

# --- Утилиты: находим реально зарегистрированную модель в admin.site ---
def _get_admin_site():
    # используем кастомный admin site, если он доступен, иначе стандартный
    return custom_admin_site if custom_admin_site is not None else admin.site

def _find_registered_model(app_label_hint=None, model_name_hint=None):
    admin_site = _get_admin_site()
    for m in admin_site._registry.keys():
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

def _safe_redirect_to_admin(app_label_hint=None, model_name_hint=None, action="changelist", fallback="admin:index"):
    """
    Возвращает view, который переадресует на реально зарегистрированный admin URL.
    Защищает от self-redirect loop.
    """
    def _view(request, *args, **kwargs):
        admin_site = _get_admin_site()

        # 1) Попробуем найти реально зарегистрированную модель
        res = _find_registered_model(app_label_hint, model_name_hint)
        if res:
            app_label, model_name = res
            target_name = f"admin:{app_label}_{model_name}_{action}"
            try:
                target = reverse(target_name)
                # защита от редирект-циклов
                req_path = request.path
                req_full = request.get_full_path()
                if target == req_path or target == req_full:
                    return redirect(fallback)
                return redirect(target)
            except Exception:
                # fallthrough to other attempts
                logger.debug("reverse failed for %s", target_name, exc_info=True)

        # 2) Попробуем canonical admin namespaced name based on hints
        if app_label_hint and model_name_hint:
            try:
                cand = f"admin:{app_label_hint}_{model_name_hint}_{action}"
                target = reverse(cand)
                req_path = request.path
                req_full = request.get_full_path()
                if target == req_path or target == req_full:
                    return redirect(fallback)
                return redirect(target)
            except Exception:
                logger.debug("reverse failed for hinted candidate %s", cand, exc_info=True)

        # 3) Fallback на индекс админки
        try:
            return redirect(fallback)
        except Exception:
            # если всё упало — редирект на root
            return redirect("/")

    return _view

# Конкретные compatibility handlers
_redirect_to_users_changelist = _safe_redirect_to_admin(app_label_hint="auth", model_name_hint="user", action="changelist")
_redirect_to_users_add = _safe_redirect_to_admin(app_label_hint="auth", model_name_hint="user", action="add")
_redirect_to_blog_comment_changelist = _safe_redirect_to_admin(app_label_hint="blog", model_name_hint="comment", action="changelist")
_redirect_to_blog_post_add = _safe_redirect_to_admin(app_label_hint="blog", model_name_hint="post", action="add")

# --- Compatibility URL patterns to expose expected names under admin: namespace ---
compat_patterns = [
    path("auth/user/", _redirect_to_users_changelist, name="auth_user_changelist"),
    path("auth/user/add/", _redirect_to_users_add, name="auth_user_add"),
    path("blog/comment/", _redirect_to_blog_comment_changelist, name="blog_comment_changelist"),
    path("blog/post/add/", _redirect_to_blog_post_add, name="blog_post_add"),
]

# --- Основные urlpatterns ---
urlpatterns = [
    path("grappelli/", include("grappelli.urls")),
    path("api/blog/", include(("blog.urls", "blog"), namespace="blog")),
    path("summernote/", include("django_summernote.urls")),
    # Если у вас есть users.urls - подключите, иначе временно ставим 404 view
    path("api/auth/register/", TemplateView.as_view(template_name="404.html"), name="register"),
    path("preview/<str:token>/", (getattr(blog_admin, "preview_by_token") if blog_admin and hasattr(blog_admin, "preview_by_token") else TemplateView.as_view(template_name="404.html")), name="post-preview"),
]

# media-library до admin/
if admin_media_library_view:
    urlpatterns += [path("admin/media-library/", admin_media_library_view, name="admin-media-library")]
else:
    urlpatterns += [path("admin/media-library/", TemplateView.as_view(template_name="admin/media_library_unavailable.html"), name="admin-media-library")]

# admin-dashboard optional
if admin_dashboard_view:
    urlpatterns += [path("admin/dashboard/", admin_dashboard_view, name="admin-dashboard")]
if admin_stats_api:
    urlpatterns += [path("admin/dashboard/stats-data/", admin_stats_api, name="admin-dashboard-stats")]
if admin_post_update_view:
    urlpatterns += [path("admin/posts/update/", admin_post_update_view, name="admin-post-update")]

# Вставляем compatibility patterns в namespace 'admin'.
# include() тут формирует namespace 'admin' для этих локальных маршрутов.
urlpatterns += [
    path("admin/", include((compat_patterns, "admin"), namespace="admin")),
]

# Подключаем реальный admin site (кастомный если есть)
if custom_admin_site is not None:
    urlpatterns += [path("admin/", custom_admin_site.urls)]
else:
    urlpatterns += [path("admin/", admin.site.urls)]

# Serve media/static in DEBUG
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
