# backend/users/admin.py
from django.contrib import admin
from django.shortcuts import redirect
from django.urls import reverse
import logging

from .models import CustomUser, UserProfile, UserTableLimitsProxy

# импорт custom_admin_site через модуль core.admin, чтобы зарегистрировать туда
try:
    from core.admin import custom_admin_site
except Exception:
    # fallback — если импорт по каким-то причинам не сработает, регистрируем в default admin.site
    from django.contrib import admin as default_admin
    custom_admin_site = default_admin.site

logger = logging.getLogger(__name__)


# Keep existing CustomUser admin if you have one; otherwise register a basic one to appear.
# We avoid overriding existing registrations here.

# Inline Profile to show when editing CustomUser (optional)
class UserProfileInline(admin.StackedInline):
    model = UserProfile
    fk_name = "user"
    extra = 0
    can_delete = False
    fields = ("tables_limit", "subscription_active", "subscription_expires", "email_notifications", "language", "location", "phone", "website")


# Ensure CustomUser is available in custom admin site as well (if you want)
try:
    # If CustomUser already registered elsewhere for default admin.site, registering to custom_admin_site is safe.
    custom_admin_site.register(CustomUser, admin.ModelAdmin)
except Exception:
    # ignore if already registered
    pass


# Register proxy model in custom admin site so it shows in the left menu.
class UserTableLimitsProxyAdmin(admin.ModelAdmin):
    list_display = ("__str__",)
    change_list_template = "admin/tables_limits_proxy_changelist.html"

    def changelist_view(self, request, extra_context=None):
        # Redirect to the actual admin view where limits are edited
        try:
            url = reverse("custom_admin:tables_limits_admin")
            return redirect(url)
        except Exception:
            # fallback to default admin index if reverse fails
            return redirect("/admin/")

# Use custom_admin_site.register to ensure it appears in your custom admin
try:
    custom_admin_site.register(UserTableLimitsProxy, UserTableLimitsProxyAdmin)
except Exception as e:
    logger.debug("Failed to register UserTableLimitsProxy in custom_admin_site: %s", e)
    try:
        admin.site.register(UserTableLimitsProxy, UserTableLimitsProxyAdmin)
    except Exception:
        pass
