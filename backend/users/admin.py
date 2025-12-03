# backend/users/admin.py
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth import get_user_model
from django import forms

from .models import CustomUser, UserProfile


User = get_user_model()


# --------------------------------------------------
#          Форма профиля (валидатор max_tables)
# --------------------------------------------------
class UserProfileForm(forms.ModelForm):
    class Meta:
        model = UserProfile
        fields = "__all__"

    def clean_max_tables(self):
        value = self.cleaned_data.get("max_tables")

        # Если пусто → выставляем минимум
        if value is None:
            return 1

        if value < 1:
            raise forms.ValidationError("Минимальное значение — 1")

        if value > 1000:
            raise forms.ValidationError("Слишком большое значение")

        return value


# --------------------------------------------------
#         Inline „Профиль пользователя”
# --------------------------------------------------
class UserProfileInline(admin.StackedInline):
    model = UserProfile
    form = UserProfileForm
    can_delete = False
    extra = 0

    fieldsets = (
        ("Ограничения", {
            # ТОЛЬКО max_tables — основной параметр
            "fields": ("max_tables", "subscription_active", "subscription_expires"),
        }),
        ("Контакты и дополнительные данные", {
            # tables_limit удалён → он больше не нужен в админке
            "fields": ("phone", "website", "location"),
        }),
        ("Настройки пользователя", {
            "fields": ("email_notifications", "language"),
        }),
    )


# --------------------------------------------------
#                Админка CustomUser
# --------------------------------------------------
@admin.register(CustomUser)
class CustomUserAdmin(DjangoUserAdmin):
    model = CustomUser

    list_display = (
        "email",
        "username",
        "is_staff",
        "is_active",
        "supabase_uid",
        "email_verified",
    )

    list_filter = ("is_staff", "is_superuser", "is_active", "email_verified")
    search_fields = ("email", "username")
    ordering = ("-date_joined",)

    readonly_fields = (
        "last_login",
        "date_joined",
        "supabase_uid",
        "verification_sent_at",
        "reset_sent_at",
    )

    fieldsets = (
        ("Основная информация", {"fields": ("email", "username", "password")}),
        ("Статусы", {"fields": ("is_active", "is_staff", "is_superuser")}),
        ("Верификация", {"fields": ("email_verified", "verification_token", "verification_sent_at")}),
        ("Сброс пароля", {"fields": ("reset_token", "reset_sent_at")}),
        ("Supabase", {"fields": ("supabase_uid", "registration_method")}),
        ("Профиль (основные поля)", {"fields": ("avatar_url", "bio")}),
        ("Системные поля", {"fields": ("last_login", "date_joined")}),
    )

    add_fieldsets = (
        ("Создание пользователя", {
            "classes": ("wide",),
            "fields": ("email", "username", "password1", "password2", "is_staff", "is_active"),
        }),
    )

    # ⬇ ВАЖНО: профиль теперь отображается прямо в админке пользователя
    inlines = [UserProfileInline]
