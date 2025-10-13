# backend/users/admin.py
import logging
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

logger = logging.getLogger(__name__)

class CustomUserAdmin(DjangoUserAdmin):
    """
    Админ-класс для CustomUser.
    **ВАЖНО**: здесь мы **не регистрируем** модель на уровне модуля —
    регистрация прокси-модели выполняется в UsersConfig.ready().
    """
    # НЕ указываем `model = ...` — Django autodetects через прокси при регистрации
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
