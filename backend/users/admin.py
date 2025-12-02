# backend/users/admin.py
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth import get_user_model
from django.urls import path
from django.shortcuts import redirect, render
from django.contrib import messages
from django.utils.html import format_html

from .models import CustomUser, UserProfile

User = get_user_model()


class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    verbose_name = "Профиль пользователя"
    verbose_name_plural = "Профиль"
    fk_name = "user"
    extra = 0
    fields = ("subscription_active", "subscription_expires", "tables_limit")


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    change_form_template = "admin/users/change_user_with_modal.html"

    inlines = (UserProfileInline,)

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                "<id>/set_tables_limit/",
                self.admin_site.admin_view(self.set_tables_limit),
                name="set_tables_limit",
            ),
        ]
        return custom_urls + urls

    def set_tables_limit(self, request, id):
        user = CustomUser.objects.get(pk=id)
        profile = UserProfile.objects.get(user=user)

        if request.method == "POST":
            new_limit = request.POST.get("tables_limit")
            try:
                profile.tables_limit = int(new_limit)
                profile.save()
                messages.success(request, "Лимит успешно обновлён!")
                return redirect(f"../change/")
            except Exception as e:
                messages.error(request, f"Ошибка: {e}")

        return render(
            request,
            "admin/users/set_tables_limit_modal.html",
            {
                "user_obj": user,
                "profile": profile,
                "title": "Изменить лимит таблиц",
            },
        )
