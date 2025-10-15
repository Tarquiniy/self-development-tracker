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
from django.utils.html import escape
from django.shortcuts import redirect
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group

logger = logging.getLogger(__name__)

# -----------------------
# Safe admin index: не вызывает self.each_context, чтобы избежать NoReverseMatch
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

        # Попытка получить changelist/add URL для модели.
        # Если не получается — пропускаем модель.
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
            "name": opts.app_label,
            "app_label": app_label,
            "models": [{
                "name": getattr(opts, "verbose_name_plural", model_name).title(),
                "object_name": opts.object_name,
                "admin_url": admin_url or "#",
                "add_url": add_url or None,
                "perms": {"change": True},
            }],
        })

    # Простая безопасная HTML-страница, использующая заранее разрешённые URL.
    items = []
    for a in app_list:
        m = a["models"][0]
        link = f'<a href="{escape(m["admin_url"])}">{escape(a["name"])} — {escape(m["name"])}</a>' if m["admin_url"] != "#" else f'{escape(a["name"])} — {escape(m["name"])}'
        if m.get("add_url"):
            link += f' &nbsp; <a href="{escape(m["add_url"])}">add</a>'
        items.append(f"<li>{link}</li>")
    body = f"""
    <html>
      <head><title>{escape(self.index_title or 'Admin')}</title></head>
      <body>
        <h1>{escape(self.site_header or 'Admin')}</h1>
        <ul>
          {''.join(items) or '<li>(нет доступных моделей)</li>'}
        </ul>
        <p><a href="/admin/login/">Войти в админку</a></p>
      </body>
    </html>
    """
    return HttpResponse(body, content_type="text/html")


# Привязываем безопасный index к admin.site
admin.site.index = types.MethodType(_safe_admin_index, admin.site)

# Загружаем admin.py в приложениях (best-effort)
try:
    admin.autodiscover()
except Exception:
    logger.exception("admin.autodiscover() failed")

# Best-effort получить user model и зарегистрировать Group если нужно
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

# Установки заголовков админки
admin.site.site_header = "Positive Theta Admin"
admin.site.site_title = "Positive Theta"
admin.site.index_title = "Панель управления Positive Theta"

# Подключаем вспомогательные views из blog.admin (если есть)
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

# Простые редиректы-совместимости для шаблонов, которые ожидают конкретные имена URL.
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
        # пробуем стандартное namespaced имя
        if app_label_hint and model_name_hint:
            cand = f"admin:{app_label_hint}_{model_name_hint}_{action}"
            try:
                return redirect(reverse(cand))
            except Exception:
                pass
        # ищем реально зарегистрированную модель
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

    path("api/auth/register/", RegisterView.as_view(), name="register"),
    path("api/auth/login/", LoginView.as_view(), name="login"),
    path("api/blog/", include(("blog.urls", "blog"), namespace="blog")),
    path("summernote/", include("django_summernote.urls")),
    path("api/auth/profile/", ProfileView.as_view(), name="profile"),
    path("preview/<str:token>/", (blog_admin.preview_by_token if blog_admin and hasattr(blog_admin, "preview_by_token") else TemplateView.as_view(template_name="404.html")), name="post-preview"),
]

# media-library до admin/
if admin_media_library_view:
    urlpatterns += [path("admin/media-library/", admin_media_library_view, name="admin-media-library")]
else:
    urlpatterns += [path("admin/media-library/", TemplateView.as_view(template_name="admin/media_library_unavailable.html"), name="admin-media-library")]

# небольшие совместимость-редиректы (root-level)
urlpatterns += [
    path("admin/auth/user/", _redirect_to_computed_admin(app_label_hint="auth", model_name_hint="user", action="changelist"), name="auth_user_changelist"),
    path("admin/blog/comment/", _redirect_to_computed_admin(app_label_hint="blog", model_name_hint="comment", action="changelist"), name="blog_comment_changelist"),
    path("admin/blog/post/add/", _redirect_to_computed_admin(app_label_hint="blog", model_name_hint="post", action="add"), name="blog_post_add"),
]

# стандартный админ
urlpatterns += [path("admin/", admin.site.urls)]

# дополнительные admin views вне admin.site
if admin_dashboard_view:
    urlpatterns += [path("admin/dashboard/", admin_dashboard_view, name="admin-dashboard")]
if admin_stats_api:
    urlpatterns += [path("admin/dashboard/stats-data/", admin_stats_api, name="admin-dashboard-stats")]
if admin_post_update_view:
    urlpatterns += [path("admin/posts/update/", admin_post_update_view, name="admin-post-update")]

# serve static/media in debug
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
