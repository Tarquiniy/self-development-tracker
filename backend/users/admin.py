# backend/users/admin.py
import logging

from django.contrib import admin
from django.contrib.admin.sites import AlreadyRegistered
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.core.exceptions import ImproperlyConfigured

logger = logging.getLogger(__name__)

# Берём модель пользователя безопасно — если она ещё не готова, пропускаем регистрацию.
try:
    from django.contrib.auth import get_user_model
    User = get_user_model()
except Exception as exc:  # ImproperlyConfigured / AppRegistryNotReady и т.п.
    User = None
    logger.warning("Custom user model is not available for admin registration: %s", exc)


if User is not None:
    try:
        # Кастомный админ-класс — можно подправить поля/поле отображения под вашу модель.
        class CustomUserAdmin(DjangoUserAdmin):
            model = User
            # минимальный безопасный набор отображаемых полей — измените при необходимости
            list_display = (
                getattr(User, "USERNAME_FIELD", "username"),
                "email",
                "first_name",
                "last_name",
                "is_staff",
                "is_active",
            )
            search_fields = ("email", "username", "first_name", "last_name")
            ordering = ("email",)

        # Регистрируем в стандартном site
        try:
            admin.site.register(User, CustomUserAdmin)
            logger.info("Registered CustomUser in admin.site.")
        except AlreadyRegistered:
            logger.info("CustomUser already registered in admin.site; skipping.")

        # Попробуем также зарегистрировать в кастомном admin site, если он у вас есть
        try:
            # импорт локального кастомного admin site (не обязателен)
            from backend.core.admin import custom_admin_site  # type: ignore
        except Exception:
            custom_admin_site = None

        if custom_admin_site:
            try:
                custom_admin_site.register(User, CustomUserAdmin)
                logger.info("Registered CustomUser in custom_admin_site.")
            except AlreadyRegistered:
                logger.info("CustomUser already registered in custom_admin_site; skipping.")
            except Exception as e:
                logger.exception("Failed registering CustomUser in custom_admin_site: %s", e)

    except Exception as e:
        logger.exception("Failed to setup CustomUserAdmin: %s", e)
else:
    logger.debug("Skipping CustomUser admin registration because CustomUser model is not available.")
