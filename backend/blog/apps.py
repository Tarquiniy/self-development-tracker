# backend/blog/apps.py
from django.apps import AppConfig
import logging

logger = logging.getLogger(__name__)

class BlogConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'blog'
    verbose_name = "Blog"

    def ready(self):
        # Здесь безопасно вызывать регистрацию админов — реестр приложений готов.
        try:
            from django.contrib import admin
            from . import admin as blog_admin_module
            # Вызываем функцию регистрации — она построит форму через modelform_factory
            blog_admin_module.register_admin_models(admin.site)
        except Exception as e:
            # Логирование, но не падение — важно для стабильности деплоя.
            logger.exception("Error registering blog admin models in ready(): %s", e)
