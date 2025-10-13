# backend/users/admin.py
import logging
from django.contrib import admin
from django.contrib.admin.sites import AlreadyRegistered
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

logger = logging.getLogger(__name__)


def register_user_admin(site_obj):
    """
    Безопасная регистрация админ-интерфейса для кастомного юзера.
    Должна вызываться в UsersConfig.ready() — когда реестр приложений уже готов.
    Регистрируем прокси-модель с app_label='auth' чтобы сохранить стандартные URL-имена
    ('auth_user_changelist' и т.д.) и избежать NoReverseMatch на странице админа.
    """
    try:
        from django.contrib.auth import get_user_model
        User = get_user_model()
    except Exception as exc:
        logger.warning("Could not get custom user model during admin registration: %s", exc)
        return False

    if User is None:
        logger.warning("Custom user model is None — skipping admin registration.")
        return False

    try:
        # Динамически создаём прокси-класс (чтобы не менять оригинальную модель)
        ProxyName = f"{User.__name__}Proxy"
        UserProxy = type(
            ProxyName,
            (User,),
            {
                "__module__": User.__module__,
                "Meta": type("Meta", (), {
                    "proxy": True,
                    "app_label": "auth",
                    "verbose_name": getattr(User._meta, "verbose_name", "user"),
                    "verbose_name_plural": getattr(User._meta, "verbose_name_plural", "users"),
                })
            }
        )

        class CustomUserAdmin(DjangoUserAdmin):
            model = User
            list_display = (
                getattr(User, "USERNAME_FIELD", "email"),
                "username",
                "first_name",
                "last_name",
                "is_staff",
                "is_superuser",
                "is_active",
            )
            list_filter = ("is_staff", "is_superuser", "is_active")
            search_fields = ("email", "username", "first_name", "last_name")
            ordering = (getattr(User, "USERNAME_FIELD", "email"),)

        try:
            site_obj.register(UserProxy, CustomUserAdmin)
            logger.info("Registered UserProxy (app_label='auth') in admin.")
        except AlreadyRegistered:
            logger.info("UserProxy already registered in admin; skipping.")
        except Exception as exc:
            logger.exception("Failed to register UserProxy in admin: %s", exc)
            return False

        return True

    except Exception as exc:
        logger.exception("Failed to prepare/register UserProxy admin: %s", exc)
        return False
