# backend/users/admin.py
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth import get_user_model
from django import forms
from django.urls import reverse
from django.utils.html import format_html

from .models import CustomUser, UserProfile

User = get_user_model()


class UserProfileForm(forms.ModelForm):
    class Meta:
        model = UserProfile
        fields = "__all__"

    def clean_max_tables(self):
        # Если в модели нет поля max_tables, просто пропускаем
        if "max_tables" not in self.fields:
            return self.cleaned_data.get("max_tables", None)

        value = self.cleaned_data.get("max_tables")
        if value is None:
            return 1
        if value < 1:
            raise forms.ValidationError("Минимальное значение — 1")
        if value > 1000:
            raise forms.ValidationError("Слишком большое значение")
        return value


class UserProfileInline(admin.StackedInline):
    model = UserProfile
    form = UserProfileForm
    can_delete = False
    extra = 0
    fk_name = "user"

    # Если у вас другое имя поля для лимита (например tables_limit), покажем его тоже
    def get_fields(self, request, obj=None):
        fields = []
        # Секция "Ограничения"
        if hasattr(self.model, "max_tables"):
            fields.append("max_tables")
        if hasattr(self.model, "tables_limit"):
            fields.append("tables_limit")

        # Добавляем остальные удобные поля
        extra = ["subscription_active", "subscription_expires", "phone", "website", "location", "email_notifications", "language"]
        for f in extra:
            if hasattr(self.model, f):
                fields.append(f)
        return fields


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
        "get_max_tables",
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

    inlines = [UserProfileInline]

    def get_max_from_profile(self, user):
        try:
            profile = getattr(user, "profile", None)
            if not profile:
                return None
            # сначала смотрим на max_tables, иначе на tables_limit
            if hasattr(profile, "max_tables") and profile.max_tables is not None:
                return profile.max_tables
            if hasattr(profile, "tables_limit") and profile.tables_limit is not None:
                return profile.tables_limit
            return None
        except Exception:
            return None

    def get_max_tables(self, obj):
        val = self.get_max_from_profile(obj)
        if val is None:
            return format_html('<span style="color: #9ca3af;">{}</span>', "—")
        return val
    get_max_tables.short_description = "Лимит таблиц"

    # Ensure profile exists when opening change page — this forces inline to appear
    def change_view(self, request, object_id, form_url='', extra_context=None):
        try:
            user = User.objects.get(pk=object_id)
            # create profile if missing
            UserProfile.objects.get_or_create(user=user)
        except User.DoesNotExist:
            pass
        return super().change_view(request, object_id, form_url, extra_context)

    # also ensure it's created when creating user via admin (post save)
    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        try:
            UserProfile.objects.get_or_create(user=obj)
        except Exception:
            pass
