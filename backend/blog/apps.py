# backend/blog/apps.py
from django.apps import AppConfig
import logging

logger = logging.getLogger(__name__)

class BlogConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "backend.blog"
    verbose_name = "Blog"

    def ready(self):
        # Регистрируем админ динамически, чтобы избежать ранних импортов моделей
        try:
            from django.contrib import admin
            from .admin import register_blog_admin
            register_blog_admin(admin.site)
        except Exception as exc:
            logger.exception("register_blog_admin failed in BlogConfig.ready(): %s", exc)
