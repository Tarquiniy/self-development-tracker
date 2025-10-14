# backend/core/urls.py
from django.conf import settings
from django.contrib import admin
from django.urls import path, include
from django.conf.urls.static import static
from django.views.generic import TemplateView, RedirectView
from django.http import HttpRequest, HttpResponse
from typing import Optional, Callable

# Если у вас есть кастомный admin объект в backend/core/admin.py — используем его.
# Импортируем локально (ошибки ловим), чтобы не ломать сборку, если файла нет.
try:
    from .admin import custom_admin_site  # noqa: F401
except Exception:
    custom_admin_site = None  # type: ignore

# Выберем site: custom_admin_site (если определён) или обычный admin.site
admin_site = custom_admin_site if custom_admin_site is not None else admin.site


# --- ленивые обёртки для опциональных view'ов из backend.blog ---
def lazy_import_view(dotted_path: str) -> Callable:
    """
    Возвращает view-обёртку, которая импортирует реальную view
    только в момент вызова (по запросу), чтобы избежать раннего импорта моделей.
    dotted_path — например "backend.blog.views.preview_by_token"
    """
    module_path, _, view_name = dotted_path.rpartition(".")
    def _view(request: HttpRequest, *args, **kwargs) -> HttpResponse:
        try:
            module = __import__(module_path, fromlist=[view_name])
            view = getattr(module, view_name)
            return view(request, *args, **kwargs)
        except Exception:
            # если не удалось импортировать — отдаём 404 / простую страницу
            return TemplateView.as_view(template_name="admin/media_library_unavailable.html")(request, *args, **kwargs)
    return _view


def lazy_admin_media_library_view() -> Callable:
    """
    Попытка получить admin_media_library_view из backend.blog.admin только при первом вызове.
    Возвращает callable view.
    """
    def _view(request: HttpRequest, *args, **kwargs) -> HttpResponse:
        try:
            module = __import__("backend.blog.admin", fromlist=["admin_media_library_view"])
            view = getattr(module, "admin_media_library_view", None)
            if view:
                # view может быть уже callable (function или result of as_view)
                return view(request, *args, **kwargs)
        except Exception:
            pass
        # fallback — шаблон уведомления
        return TemplateView.as_view(template_name="admin/media_library_unavailable.html")(request, *args, **kwargs)
    return _view


# Обёртка для других опциональных admin view'ов (dashboard, stats и т.д.)
def lazy_optional_admin_view(view_name: str) -> Optional[Callable]:
    try:
        module = __import__("backend.blog.admin", fromlist=[view_name])
        view = getattr(module, view_name, None)
        if view:
            return view
    except Exception:
        return None
    return None


# Не импортируем blog.views напрямую — используем ленивый preview view.
preview_view = lazy_import_view("backend.blog.views.preview_by_token")
admin_media_library_view = lazy_admin_media_library_view()

# Попытка получить дополнительные view'ы (если они определены в backend.blog.admin)
admin_dashboard_view = lazy_optional_admin_view("admin_dashboard_view")
admin_stats_api = lazy_optional_admin_view("admin_stats_api")
admin_post_update_view = lazy_optional_admin_view("admin_post_update_view")
admin_autosave_view = lazy_optional_admin_view("admin_autosave_view")
admin_preview_token_view = lazy_optional_admin_view("admin_preview_token_view")


urlpatterns = [
    path("grappelli/", include("grappelli.urls")),
    # Регистрируем выбранный admin site
    path("admin/", admin_site.urls),
    # API/сайты
    path("api/blog/", include(("backend.blog.urls", "blog"), namespace="blog")),
    path("summernote/", include("django_summernote.urls")),
    # Preview (лениво импортируем backend.blog.views.preview_by_token)
    path("preview/<str:token>/", preview_view, name="post-preview"),
    # Редирект корня на админку
    path("", RedirectView.as_view(url="/admin/")),
]

# Регистрируем /admin/media-library/ ДО admin.urls (чтобы не перехватывался)
# (всё равно путь выше admin/ совпадёт с admin.site, но оставляем явный маршрут)
if admin_media_library_view:
    urlpatterns = [path("admin/media-library/", admin_media_library_view, name="admin-media-library")] + urlpatterns
else:
    urlpatterns = [path("admin/media-library/", TemplateView.as_view(template_name="admin/media_library_unavailable.html"), name="admin-media-library")] + urlpatterns

# Дополнительные админ-views (если доступны)
if admin_dashboard_view:
    urlpatterns += [path("admin/dashboard/", admin_dashboard_view, name="admin-dashboard")]
if admin_stats_api:
    urlpatterns += [path("admin/dashboard/stats-data/", admin_stats_api, name="admin-dashboard-stats")]
if admin_post_update_view:
    urlpatterns += [path("admin/posts/update/", admin_post_update_view, name="admin-post-update")]
if admin_autosave_view:
    urlpatterns += [path("admin/posts/autosave/", admin_autosave_view, name="admin-autosave")]
if admin_preview_token_view:
    urlpatterns += [path("admin/posts/preview-token/", admin_preview_token_view, name="admin-preview-token")]

# CKEditor5 urls (лениво добавляем, если пакет доступен)
try:
    urlpatterns += [path("ckeditor5/", include("django_ckeditor_5.urls"))]
except Exception:
    pass

# В режиме разработки отдаём media/static
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
