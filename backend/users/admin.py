import logging

from django.contrib import admin
from django.contrib.admin.sites import AlreadyRegistered
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

logger = logging.getLogger(__name__)

try:
    from django.contrib.auth import get_user_model

    CustomUserModel = get_user_model()
except Exception as exc:
    CustomUserModel = None
    logger.warning("Custom user model is not ready for admin registration: %s", exc)


if CustomUserModel is not None:
    try:
        class User(CustomUserModel):  # type: ignore
            class Meta:
                proxy = True
                app_label = "auth"
                verbose_name = getattr(CustomUserModel._meta, "verbose_name", "user")
                verbose_name_plural = getattr(CustomUserModel._meta, "verbose_name_plural", "users")

        class CustomUserAdmin(DjangoUserAdmin):
            model = CustomUserModel
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

        try:
            admin.site.register(User, CustomUserAdmin)
            logger.info("Registered User proxy (app_label='auth') in admin.")
        except AlreadyRegistered:
            logger.info("User proxy already registered in admin; skipping.")
    except Exception as e:
        logger.exception("Failed to register User proxy admin: %s", e)
else:
    logger.debug("Skipping User proxy registration because CustomUserModel is not available.")
