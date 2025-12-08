# backend/users/admin.py
from django.contrib import admin
from .models import CustomUser, UserProfile


class UserProfileInline(admin.StackedInline):
    model = UserProfile
    extra = 0
    fk_name = "user"
    can_delete = False

    fields = (
        "subscription_active",
        "subscription_expires",
        "tables_limit",
        "email_notifications",
        "language",
        "location",
        "phone",
        "website",
    )


@admin.register(CustomUser)
class CustomUserAdmin(admin.ModelAdmin):
    list_display = ("id", "email", "username", "is_active")
    search_fields = ("email", "username")
    inlines = [UserProfileInline]


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "tables_limit", "subscription_active")
    search_fields = ("user__email", "user__username")
