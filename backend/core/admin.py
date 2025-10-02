# backend/core/admin.py
from django.contrib import admin
from django.urls import path
import logging

logger = logging.getLogger(__name__)

class CustomAdminSite(admin.AdminSite):
    site_header = "Positive Theta Admin"
    site_title = "Positive Theta"
    index_title = "Добро пожаловать в админку Positive Theta"

    def get_urls(self):
        """
        Добавляем кастомные админ-урлы (dashboard API, media-library, пост-апдейты и т.д.)
        Импорт view-функций выполняем лениво внутри этой функции — чтобы избежать циклических импортов.
        """
        urls = super().get_urls()
        custom_urls = []

        try:
            # Импортируем views из blog.admin только внутри метода — чтобы не было циклического импорта
            from blog.admin import (
                admin_stats_api,
                admin_dashboard_view,
                admin_media_library_view,
                admin_post_update_view,
            )

            # Оборачиваем их в admin_view (проверка прав, CSRF и т.д.)
            custom_urls = [
                # Стартовая страница админки: переопределяем корень админки на нашу вьюху
                path("", self.admin_view(admin_dashboard_view), name="index"),

                # API для статистики (Chart.js)
                path("dashboard/stats-data/", self.admin_view(admin_stats_api), name="dashboard-stats-data"),

                # Медиа библиотека (UI)
                path("media-library/", self.admin_view(admin_media_library_view), name="admin-media-library"),

                # AJAX endpoint для inline-апдейтов поста (админский JS вызывает его)
                path("post/update/", self.admin_view(admin_post_update_view), name="admin-post-update"),
            ]
        except Exception as e:
            # Если что-то пошло не так — логируем, но возвращаем стандартные урлы чтобы админ хоть частично работал.
            logger.exception("Unable to import blog.admin views for custom admin urls: %s", e)
            # custom_urls остаются пустыми — в этом случае админ всё ещё работает, но без наших доп. url'ов.

        # Важно: добавляем кастомные урлы перед стандартными — чтобы '' (index) перехватывался нами
        return custom_urls + urls


# Создаём экспортируемый экземпляр админ-сайта, который будем импортировать в blog.admin и core.urls
custom_admin_site = CustomAdminSite(name="custom_admin")
