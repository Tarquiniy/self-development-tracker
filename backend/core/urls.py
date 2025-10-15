# backend/core/urls.py
from django.conf import settings
from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView
from users.views import RegisterView, LoginView, ProfileView
from django.conf.urls.static import static
import logging
from django.contrib import admin as _admin
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group as _Group
from django.contrib.auth.admin import UserAdmin as DefaultUserAdmin, GroupAdmin as DefaultGroupAdmin

import types
from django.http import HttpResponse
from django.template.response import TemplateResponse
from django.urls import reverse, NoReverseMatch
from django.utils.html import escape
from django.contrib import admin as _admin

def _safe_admin_index(self, request, extra_context=None):
    """
    Заменяет стандартную admin.index. Формирует app_list вручную,
    исключая модели, для которых reverse() падает.
    """
    app_list = []
    for model in list(self._registry.keys()):
        opts = model._meta
        app_label = opts.app_label
        model_name = opts.model_name
        name = f"{app_label}.{model_name}"
        # Попробуем namespaced admin url first, потом без namespace
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
            # Если не получилось, пропускаем эту модель — она вызывает NoReverseMatch
            continue
        app_list.append({
            "name": name,
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

    # Рендерим стандартный шаблон admin/index.html с безопасным app_list
    try:
        return TemplateResponse(request, "admin/index.html", context)
    except Exception as e:
        # Если даже шаблон падает, возвращаем упрощённую HTML-страницу
        items = "".join([f'<li><a href="{escape(m["models"][0]["admin_url"])}">{escape(m["name"])}</a></li>' for m in app_list])
        html = f"<html><head><title>Admin</title></head><body><h1>Admin</h1><ul>{items}</ul></body></html>"
        return HttpResponse(html, content_type="text/html")

# Привязываем метод к admin.site
_admin.site.index = types.MethodType(_safe_admin_index, _admin.site)

logger = logging.getLogger(__name__)

# ensure admin autodiscover (loads app admin.py)
admin.autodiscover()

UserModel = get_user_model()

# Попытка найти кастомный UserAdmin в users.admin, иначе использовать стандартный
try:
    from users.admin import UserAdmin as ProjectUserAdmin
except Exception:
    ProjectUserAdmin = None

try:
    if UserModel not in _admin.site._registry:
        if ProjectUserAdmin is not None:
            try:
                _admin.site.register(UserModel, ProjectUserAdmin)
            except Exception:
                # если кастомный UserAdmin несовместим — пробуем стандартный
                from django.contrib.auth.admin import UserAdmin as DefaultUserAdmin
                try:
                    _admin.site.register(UserModel, DefaultUserAdmin)
                except Exception:
                    pass
        else:
            from django.contrib.auth.admin import UserAdmin as DefaultUserAdmin
            try:
                _admin.site.register(UserModel, DefaultUserAdmin)
            except Exception:
                pass
except Exception:
    # логируем молча — регистрация не критична в рантайме здесь
    import logging
    logging.getLogger(__name__).exception("Failed to ensure user registration in admin.site")

# Ensure Group registered
try:
    from django.contrib.auth.admin import GroupAdmin as DefaultGroupAdmin
    if _Group not in _admin.site._registry:
        try:
            _admin.site.register(_Group, DefaultGroupAdmin)
        except Exception:
            pass
except Exception:
    pass

# Set admin site titles and ensure namespace name is 'admin'
admin.site.site_header = "Positive Theta Admin"
admin.site.site_title = "Positive Theta"
admin.site.index_title = "Панель управления Positive Theta"
# admin.site.name is internal, but templates expect 'admin:' namespace which admin.site.urls provides

# Optional blog admin helper views (do not replace standard admin.site)
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
    pass

urlpatterns = [
    path("grappelli/", include("grappelli.urls")),

    # API / auth
    path("api/auth/register/", RegisterView.as_view(), name="register"),
    path("api/auth/login/", LoginView.as_view(), name="login"),
    path("api/blog/", include(("blog.urls", "blog"), namespace="blog")),
    #path("api/tables/", include(("tables.urls", "tables"), namespace="tables")),
    path("summernote/", include("django_summernote.urls")),
    path("api/auth/profile/", ProfileView.as_view(), name="profile"),
    path("preview/<str:token>/", (blog_admin.preview_by_token if 'blog_admin' in locals() and hasattr(blog_admin, "preview_by_token") else TemplateView.as_view(template_name="404.html")), name="post-preview"),
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
