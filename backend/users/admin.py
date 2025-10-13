# backend/users/admin.py
import logging

from django.contrib import admin
from django.contrib.admin.sites import AlreadyRegistered
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.core.exceptions import ImproperlyConfigured

logger = logging.getLogger(__name__)

# Попытка получить пользовательскую модель без падения в ранних этапах запуска (migrate/build).
try:
    from django.contrib.auth import get_user_model
    User = get_user_model()
except Exception as exc:  # ImproperlyConfigured или другое
    User = None
    logger.warning("Custom user model is not ready for admin proxy registration: %s", exc)


if User is not None:
    try:
        # Создаём прокси-модель, которая будет "лежать" в приложении 'auth'.
        # Это важно: многие шаблоны и части админа ожидают url'ы вида 'auth_user_*'.
        class UserProxy(User):  # type: ignore
            class Meta:
                proxy = True
                app_label = "auth"  # ключевой момент — зарегистрировать прокси в app 'auth'
                verbose_name = getattr(User._meta, "verbose_name", "user")
                verbose_name_plural = getattr(User._meta, "verbose_name_plural", "users")

        # Подкласс админа — можно тонко подстроить под поля вашей CustomUser
        class CustomUserAdmin(DjangoUserAdmin):
            """
            Базовый UserAdmin, использующий вашу модель.
            Подкорректируйте list_display / fieldsets / add_fieldsets при необходимости.
            """
            model = User
            # Примерные настройки — при необходимости измените под вашу модель
            list_display = (
                "email",
                "username",
                "first_name",
                "last_name",
                "is_staff",
                "is_superuser",
                "is_active",
            )
            list_filter = ("is_staff", "is_superuser", "is_active")
            search_fields = ("email", "username", "first_name", "last_name")
            ordering = ("email",)

        # Регистрируем прокси-модель в стандартном админ-сайте под app_label 'auth'.
        try:
            admin.site.register(UserProxy, CustomUserAdmin)
            logger.info("Registered UserProxy (app_label='auth') in admin.")
        except AlreadyRegistered:
            logger.info("UserProxy already registered in admin; skipping.")
    except Exception as e:
        logger.exception("Failed to register UserProxy admin: %s", e)
else:
    logger.debug("Skipping UserProxy registration because CustomUser is not available yet.")
