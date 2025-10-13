# backend/users/apps.py
from django.apps import AppConfig
import logging

logger = logging.getLogger(__name__)

class UsersConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "backend.users"
    verbose_name = "Users"

    def ready(self):
        # Импорт сигналов (если есть) — не фатально если их нет/они ломаются
        try:
            import backend.users.signals  # noqa: F401
        except Exception as exc:
            logger.debug("users.signals import failed or absent: %s", exc)

        # Регистрируем админ безопасно (делаем локальный импорт)
        try:
            from django.contrib import admin
            from .admin import register_user_admin
            register_user_admin(admin.site)
        except Exception as exc:
            # Не падаем — ready() не должен ломать старт и миграции
            logger.exception("register_user_admin failed in UsersConfig.ready(): %s", exc)
