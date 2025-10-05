# backend/core/admin.py
from django.contrib import admin
from django.urls import path
import logging

logger = logging.getLogger(__name__)


class CustomAdminSite(admin.AdminSite):
    site_header = "Positive Theta Admin"
    site_title = "Positive Theta"
    index_title = "Панель управления Positive Theta"

    def get_urls(self):
        """
        Возвращаем список URL'ов для кастомной админки.
        Пытаемся лениво импортировать view'ы из blog.admin и добавить их (без жёсткой зависимости).
        Если импорт не удался — возвращаем стандартные admin.urls.
        """
        urls = super().get_urls()
        custom_urls = []

        try:
            # ленивый импорт модуля (не отдельные имена) — безопаснее в отношении циклических импортов
            from blog import admin as blog_admin

            admin_dashboard_view = getattr(blog_admin, "admin_dashboard_view", None)
            admin_stats_api = getattr(blog_admin, "admin_stats_api", None)
            admin_media_library_view = getattr(blog_admin, "admin_media_library_view", None)
            admin_post_update_view = getattr(blog_admin, "admin_post_update_view", None)
            admin_autosave_view = getattr(blog_admin, "admin_autosave_view", None)
            admin_preview_token_view = getattr(blog_admin, "admin_preview_token_view", None)

            # index override (делаем только если view доступна)
            if admin_dashboard_view:
                custom_urls.append(path("", self.admin_view(admin_dashboard_view), name="index"))

            # API для статистики (Chart.js)
            if admin_stats_api:
                custom_urls.append(path("dashboard/stats-data/", self.admin_view(admin_stats_api), name="dashboard-stats-data"))

            # Media library UI
            if admin_media_library_view:
                custom_urls.append(path("media-library/", self.admin_view(admin_media_library_view), name="admin-media-library"))

            # AJAX endpoints (добавляем только существующие)
            if admin_post_update_view:
                custom_urls.append(path("post/update/", self.admin_view(admin_post_update_view), name="admin-post-update"))
            if admin_autosave_view:
                custom_urls.append(path("post/autosave/", self.admin_view(admin_autosave_view), name="admin-autosave"))
            if admin_preview_token_view:
                custom_urls.append(path("preview/token/", self.admin_view(admin_preview_token_view), name="admin-preview-token"))

        except Exception as e:
            # Логируем, но не падаем — вернём стандартные URL'ы
            logger.exception("Failed to import blog.admin views into custom admin urls: %s", e)

        # Добавляем кастомные урлы перед стандартными, чтобы корень '' перехватывался нашим dashboard (если он есть)
        return custom_urls + urls


# Создаём экземпляр кастомной админки
custom_admin_site = CustomAdminSite(name="custom_admin")


# Регистрируем модели и маршруты из blog.admin в custom_admin_site, если в blog.admin есть специальная функция.
# Это решает проблему циклических импортов: регистрация делается после создания custom_admin_site.
try:
    # Импортируем модуль (а не имена) и ищем register_admin_models
    from blog import admin as blog_admin_module

    register_fn = getattr(blog_admin_module, "register_admin_models", None)
    if callable(register_fn):
        try:
            register_fn(custom_admin_site)
            logger.info("Registered blog admin models into custom_admin_site via register_admin_models.")
        except Exception as inner_exc:
            logger.exception("register_admin_models exists but failed when called: %s", inner_exc)
    else:
        logger.debug("blog.admin.register_admin_models not found — skipping explicit registration.")
except Exception as e:
    logger.debug("Could not import blog.admin for explicit registration: %s", e)


# Экспортируем custom_admin_site чтобы другие модули могли импортировать его
__all__ = ["custom_admin_site", "CustomAdminSite"]
