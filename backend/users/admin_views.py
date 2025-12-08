# backend/users/admin_views.py

from django.shortcuts import render, redirect
from django.contrib.admin.views.decorators import staff_member_required
from django.urls import reverse
from django.contrib import messages

from .models import CustomUser, UserProfile


@staff_member_required
def tables_limits_admin(request):
    """Отдельная админ-страница для редактирования tables_limit."""

    if request.method == "POST":
        user_id = request.POST.get("user_id")
        new_limit = request.POST.get("tables_limit")

        if user_id and new_limit is not None:
            try:
                profile = UserProfile.objects.get(user_id=user_id)
                profile.tables_limit = int(new_limit)
                profile.save()
                messages.success(request, f"Лимит обновлён для пользователя ID {user_id}")
            except Exception as e:
                messages.error(request, f"Ошибка обновления: {e}")

        return redirect(reverse("tables_limits_admin"))

    users = CustomUser.objects.all().select_related("profile")

    return render(
        request,
        "admin/tables_limits.html",
        {"users": users},
    )
