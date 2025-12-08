# backend/core/admin.py
from django.contrib import admin
from django.urls import path, reverse
from django.utils.html import format_html
import logging

from users.admin_views import tables_limits_admin

logger = logging.getLogger(__name__)


# ------------------------------------------------------------
# ВИРТУАЛЬНАЯ МОДЕЛЬ ДЛЯ ЛЕВОГО МЕНЮ
# ------------------------------------------------------------
class TableLimitsDummyModel:
    """
    Пустая заглушка, чтобы пункт "Лимиты таблиц"
    появился в левом меню админки.
    """
    _meta = type("Meta", (), {"app_label": "Users", "model_name": "Table Limits"})


@admin.register(TableLimitsDummyModel, site=admin.site)
class TableLimitsAdmin(admin.ModelAdmin):
    """
    Админ-класс, который просто делает redirect в наш кастомный view.
    """
    verbose_name = "Лимиты таблиц"
    verbose_name_plural = "Лимиты таблиц"

    change_list_template = "admin/tables_limits_dummy.html"

    def changelist_view(self, request, extra_context=None):
        url = reverse("custom_admin:tables_limits_admin")
        from django.shortcuts import redirect
        return redirect(url)


# ------------------------------------------------------------
# Кастомная админка
# ------------------------------------------------------------
class CustomAdminSite(admin.AdminSite):
    site_header = "Positive Theta Admin"
    site_title = "Positive Theta"
    index_title = "Панель управления Positive Theta"

    def get_urls(self):
        """
        Добавляем кастомные админские URL.
        """
        urls = super().get_urls()
        custom_urls = [
            path(
                "tables-limits/",
                self.admin_view(tables_limits_admin),
                name="tables_limits_admin",
            ),
        ]

        # Поддержка blog.admin, как у тебя было
        try:
            from blog import admin as blog_admin

            admin_dashboard_view = getattr(blog_admin, "admin_dashboard_view", None)
            admin_stats_api = getattr(blog_admin, "admin_stats_api", None)
            admin_media_library_view = getattr(blog_admin, "admin_media_library_view", None)
            admin_post_update_view = getattr(blog_admin, "admin_post_update_view", None)
            admin_autosave_view = getattr(blog_admin, "admin_autosave_view", None)
            admin_preview_token_view = getattr(blog_admin, "admin_preview_token_view", None)

            if admin_dashboard_view:
                custom_urls.append(path("", self.admin_view(admin_dashboard_view), name="index"))
            if admin_stats_api:
                custom_urls.append(path("dashboard/stats-data/", self.admin_view(admin_stats_api), name="dashboard-stats-data"))
            if admin_media_library_view:
                custom_urls.append(path("media-library/", self.admin_view(admin_media_library_view), name="admin-media-library"))
            if admin_post_update_view:
                custom_urls.append(path("post/update/", self.admin_view(admin_post_update_view), name="admin-post-update"))
            if admin_autosave_view:
                custom_urls.append(path("post/autosave/", self.admin_view(admin_autosave_view), name="admin-post-autosave"))
            if admin_preview_token_view:
                custom_urls.append(path("preview/token/", self.admin_view(admin_preview_token_view), name="admin-preview-token"))

        except Exception as e:
            logger.exception("Failed to import blog.admin views into custom admin urls: %s", e)

        return custom_urls + urls


custom_admin_site = CustomAdminSite(name="custom_admin")


# ------------------------------------------------------------
# РЕГИСТРАЦИЯ БЛОГ-МОДЕЛЕЙ
# ------------------------------------------------------------
try:
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


__all__ = ["custom_admin_site", "CustomAdminSite"]
