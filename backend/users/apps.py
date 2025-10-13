# backend/users/apps.py
import logging
from django.apps import AppConfig

logger = logging.getLogger(__name__)

class UsersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    # **Очень важно**: полное python-имя модуля (package + submodule)
    name = 'backend.users'
    verbose_name = "Users"

    def ready(self):
        """
        Регистрация admin-прокси модели выполняется здесь, когда все приложения полностью загружены.
        Это гарантирует, что URL'ы и зависимости админа будут корректно созданы.
        """
        # Импортируем только внутри ready() чтобы избежать ранних импортов
        try:
            from django.contrib.auth import get_user_model
            from django.contrib import admin as django_admin
            # импорт admin-класса, который не регистрирует модель на уровне модуля
            from .admin import CustomUserAdmin
        except Exception as e:
            logger.exception("UsersConfig.ready(): cannot import admin pieces: %s", e)
            return

        try:
            User = get_user_model()
        except Exception as e:
            logger.exception("UsersConfig.ready(): get_user_model() failed: %s", e)
            return

        # Создаём прокси модель в рантайме, чтобы зарегистрировать её в app 'auth'
        try:
            class UserProxy(User):  # type: ignore
                class Meta:
                    proxy = True
                    app_label = "auth"
                    verbose_name = getattr(User._meta, "verbose_name", "user")
                    verbose_name_plural = getattr(User._meta, "verbose_name_plural", "users")

            try:
                django_admin.site.register(UserProxy, CustomUserAdmin)
                logger.info("UsersConfig.ready(): UserProxy registered in admin (app_label='auth').")
            except django_admin.sites.AlreadyRegistered:
                logger.info("UsersConfig.ready(): UserProxy already registered, skipping.")
        except Exception as e:
            logger.exception("UsersConfig.ready(): failed to create/register UserProxy: %s", e)
