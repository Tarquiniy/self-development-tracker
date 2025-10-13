# backend/users/admin.py
import logging

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

logger = logging.getLogger(__name__)

class CustomUserAdmin(DjangoUserAdmin):
    """
    Админ-класс для вашей CustomUser. Здесь НЕ выполняется регистрация модели,
    чтобы избежать проблем с порядком загрузки приложений при старте.
    """
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
