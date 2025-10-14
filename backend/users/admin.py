# backend/users/admin.py
import logging
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

logger = logging.getLogger(__name__)

try:
    from django.contrib.auth import get_user_model
    User = get_user_model()
except Exception as exc:
    User = None
    logger.warning("Custom user model not available for admin registration: %s", exc)

if User is not None:
    try:
        class SimpleUserAdmin(DjangoUserAdmin):
            model = User
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

        admin.site.register(User, SimpleUserAdmin)
    except Exception:
        logger.exception("Failed to register CustomUser in admin")
