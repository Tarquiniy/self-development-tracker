from django.apps import AppConfig
import logging

logger = logging.getLogger(__name__)


class BlogConfig(AppConfig):
    name = "backend.blog"
    label = "blog"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self):
        # Отложенная регистрация admin — выполняется только когда apps готовы
        try:
            from django.contrib import admin
            from .admin import register_admin_models
            # register_admin_models должен быть безопасен и идемпотентен
            register_admin_models(admin.site)
            logger.info("register_admin_models executed from BlogConfig.ready()")
        except Exception as e:
            logger.exception("register_blog_admin failed in BlogConfig.ready(): %s", e)
    