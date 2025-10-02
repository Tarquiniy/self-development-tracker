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
        urls = super().get_urls()
        custom_urls = []

        try:
            # ленивый импорт: импортируем views из blog.admin только здесь чтобы избежать циклических импортов
            from blog.admin import (
                admin_dashboard_view,
                admin_stats_api,
                admin_media_library_view,
                admin_post_update_view,
                admin_autosave_view,
                admin_preview_token_view,
            )

            custom_urls = [
                # переопределяем корень админки на нашу вьюху (index)
                path("", self.admin_view(admin_dashboard_view), name="index"),

                # API для статистики (Chart.js)
                path("dashboard/stats-data/", self.admin_view(admin_stats_api), name="dashboard-stats-data"),

                # Media library UI
                path("media-library/", self.admin_view(admin_media_library_view), name="admin-media-library"),

                # AJAX endpoints
                path("post/update/", self.admin_view(admin_post_update_view), name="admin-post-update"),
                path("post/autosave/", self.admin_view(admin_autosave_view), name="admin-autosave"),
                path("preview/token/", self.admin_view(admin_preview_token_view), name="admin-preview-token"),
            ]
        except Exception as e:
            logger.exception("Failed to import blog.admin views into custom admin urls: %s", e)
            # если импорт не удался — просто возвращаем стандартные урлы

        # добавляем наши урлы перед стандартными (чтобы '' перехватывался)
        return custom_urls + urls

custom_admin_site = CustomAdminSite(name="custom_admin")
