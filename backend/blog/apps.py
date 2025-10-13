# backend/blog/apps.py
from django.apps import AppConfig
import logging

logger = logging.getLogger(__name__)

class BlogConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    # полное имя пакета
    name = 'backend.blog'
    verbose_name = "Blog"

    def ready(self):
        # Здесь безопасно вызывать регистрацию админов — реестр приложений готов.
        try:
            from django.contrib import admin
            # Импортируем модуль admin нашего приложения и вызываем функцию регистрации
            from . import admin as blog_admin_module
            blog_admin_module.register_admin_models(admin.site)
        except Exception as e:
            # Не падаем — логируем для дебага
            logger.exception("Error registering blog admin models in ready(): %s", e)
