# backend/users/admin.py
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, UserProfile

@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display = ('email', 'username', 'supabase_uid', 'registration_method', 'is_staff')
    list_filter = ('registration_method', 'is_staff', 'is_superuser')
    search_fields = ('email', 'username', 'supabase_uid')

    fieldsets = UserAdmin.fieldsets + (
        ('Additional Info', {
            'fields': ('supabase_uid', 'registration_method'),
        }),
    )


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = (
        'user',
        'subscription_active',
        'subscription_expires',
        'tables_limit',
    )
    search_fields = ('user__email', 'user__username')

    # ❗ ЭТО ГЛАВНОЕ — поля, доступные для редактирования:
    fields = (
        'user',
        'subscription_active',
        'subscription_expires',
        'tables_limit',
    )

    # Если нужно запретить менять user:
    readonly_fields = ('user',)


# -----------------------------
# Сигналы создания профиля (как у тебя)
# -----------------------------
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.conf import settings

@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.get_or_create(user=instance)
