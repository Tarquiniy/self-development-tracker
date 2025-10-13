# backend/users/apps.py
import logging
from django.apps import AppConfig

logger = logging.getLogger(__name__)

class UsersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'users'  # ОСТАВЬТЕ именно 'users' — совпадает с AUTH_USER_MODEL = 'users.CustomUser'
    verbose_name = "Users"

    def ready(self):
        # Импорт сигналов (если есть) — безопасно здесь
        try:
            import users.signals  # noqa: F401
        except Exception:
            pass

        # Регистрируем прокси-модель в app_label='auth' в момент, когда всё загружено.
        try:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            # Импорт админ-класса из нашего admin.py (он не выполняет регистрации)
            from .admin import CustomUserAdmin

            # Определяем прокси класс **на лету**
            class UserProxy(User):  # type: ignore
                class Meta:
                    proxy = True
                    app_label = "auth"  # ключевой момент — зарегистрировать как модель из 'auth'
                    verbose_name = getattr(User._meta, "verbose_name", "user")
                    verbose_name_plural = getattr(User._meta, "verbose_name_plural", "users")

            from django.contrib import admin as _admin
            try:
                _admin.site.register(UserProxy, CustomUserAdmin)
                logger.info("Registered UserProxy (app_label='auth') in UsersConfig.ready().")
            except _admin.sites.AlreadyRegistered:
                logger.info("UserProxy already registered in admin; skipping.")
        except Exception as e:
            # Логируем, но не ломаем стартап — это важно, чтобы deploy не упал из-за мелочи.
            logger.exception("Could not register UserProxy in UsersConfig.ready(): %s", e)
