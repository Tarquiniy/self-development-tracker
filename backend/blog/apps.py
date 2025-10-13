# backend/blog/apps.py
import logging
from django.apps import AppConfig

logger = logging.getLogger(__name__)

class BlogConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'blog'
    verbose_name = "Blog"

    def ready(self):
        """
        Регистрируем admin-модели динамически после того, как приложения загружены.
        blog.admin.register_admin_models ожидает получить admin.site и зарегистрировать
        модели уже в корректный момент жизни приложения (когда пользовательская модель уже доступна).
        """
        try:
            # Импортируем и вызываем функцию регистрации админ-моделей,
            # которая спроектирована так, чтобы безопасно попытаться создать ModelForm и зарегистрировать модели.
            from django.contrib import admin as django_admin
            from . import admin as blog_admin

            # blog.admin.register_admin_models(site_obj)
            if hasattr(blog_admin, "register_admin_models"):
                blog_admin.register_admin_models(django_admin.site)
            else:
                logger.warning("blog.admin.register_admin_models not found; skipping admin dynamic registration.")
        except Exception as e:
            # Не останавливаем загрузку приложения — логируем для дальнейшего дебага.
            logger.exception("Failed to register blog admin models in BlogConfig.ready(): %s", e)
