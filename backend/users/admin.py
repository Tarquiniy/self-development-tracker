# backend/users/admin.py

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, UserProfile


# Inline для отображения/редактирования профиля прямо на странице CustomUser
class UserProfileInline(admin.StackedInline):
    model = UserProfile
    fk_name = "user"            # поле в UserProfile, ссылающееся на CustomUser
    can_delete = False
    verbose_name = "User profile"
    verbose_name_plural = "User profile"
    extra = 1                   # показывает пустую форму для создания профиля, если его нет
    max_num = 1                 # всего максимум 1 профиль на пользователя
    fields = (
        "subscription_active",
        "subscription_expires",
        "tables_limit",
    )


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display = (
        "email",
        "username",
        "supabase_uid",
        "registration_method",
        "is_staff",
    )
    list_filter = ("registration_method", "is_staff", "is_superuser")
    search_fields = ("email", "username", "supabase_uid")

    fieldsets = UserAdmin.fieldsets + (
        ("Additional Info", {"fields": ("supabase_uid", "registration_method")}),
    )

    inlines = [UserProfileInline]   # <-- вот тут добавлен inline


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "subscription_active", "subscription_expires", "tables_limit")
    search_fields = ("user__email", "user__username")
    fields = ("user", "subscription_active", "subscription_expires", "tables_limit")
    readonly_fields = ("user",)
