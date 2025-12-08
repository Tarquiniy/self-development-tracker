# backend/core/admin.py
from django.contrib import admin
from django.urls import path, reverse
from django.shortcuts import redirect
import logging

logger = logging.getLogger(__name__)


class CustomAdminSite(admin.AdminSite):
    site_header = "Positive Theta Admin"
    site_title = "Positive Theta"
    index_title = "Панель управления Positive Theta"

    def get_urls(self):
        """
        Add optional blog admin views (dashboard, media library, stats) lazily.
        Import blog.admin module and attach existing views if present.
        Also add our tables-limits view into the admin site (import inside to avoid circular imports).
        """
        urls = super().get_urls()
        custom_urls = []

        # add tables-limits route (import inside to avoid circular imports)
        try:
            from users.admin_views import tables_limits_admin
            custom_urls.append(path("tables-limits/", self.admin_view(tables_limits_admin), name="tables_limits_admin"))
        except Exception as e:
            logger.debug("Could not import tables_limits_admin: %s", e)

        try:
            from blog import admin as blog_admin

            admin_dashboard_view = getattr(blog_admin, "admin_dashboard_view", None)
            admin_stats_api = getattr(blog_admin, "admin_stats_api", None)
            admin_media_library_view = getattr(blog_admin, "admin_media_library_view", None)
            admin_post_update_view = getattr(blog_admin, "admin_post_update_view", None)
            admin_autosave_view = getattr(blog_admin, "admin_autosave_view", None)
            admin_preview_token_view = getattr(blog_admin, "admin_preview_token_view", None)

            if admin_dashboard_view:
                custom_urls.append(path("", self.admin_view(admin_dashboard_view), name="index"))
            if admin_stats_api:
                custom_urls.append(path("dashboard/stats-data/", self.admin_view(admin_stats_api), name="dashboard-stats-data"))
            if admin_media_library_view:
                custom_urls.append(path("media-library/", self.admin_view(admin_media_library_view), name="admin-media-library"))
            if admin_post_update_view:
                custom_urls.append(path("post/update/", self.admin_view(admin_post_update_view), name="admin-post-update"))
            if admin_autosave_view:
                custom_urls.append(path("post/autosave/", self.admin_view(admin_autosave_view), name="admin-post-autosave"))
            if admin_preview_token_view:
                custom_urls.append(path("preview/token/", self.admin_view(admin_preview_token_view), name="admin-preview-token"))

        except Exception as e:
            logger.exception("Failed to import blog.admin views into custom admin urls: %s", e)

        return custom_urls + urls


# create site
custom_admin_site = CustomAdminSite(name="custom_admin")


# -----------------------------
# Register proxy admin AFTER custom_admin_site is created.
# This avoids import cycles and ensures the item appears in the left menu.
# -----------------------------
try:
    # import proxy model lazily
    from users.models import UserTableLimitsProxy

    class UserTableLimitsProxyAdmin(admin.ModelAdmin):
        list_display = ("__str__",)

        # When clicking the model in left menu, redirect to our admin view
        def changelist_view(self, request, extra_context=None):
            try:
                url = reverse("custom_admin:tables_limits_admin")
                return redirect(url)
            except Exception:
                return redirect("/admin/")

    # Register into our custom admin site so it appears in the left menu of custom_admin_site
    try:
        custom_admin_site.register(UserTableLimitsProxy, UserTableLimitsProxyAdmin)
        logger.info("Registered UserTableLimitsProxy in custom_admin_site")
    except Exception as e:
        # fallback: register in default admin if custom site fails
        admin.site.register(UserTableLimitsProxy, UserTableLimitsProxyAdmin)
        logger.debug("Registered UserTableLimitsProxy in default admin (fallback): %s", e)

except Exception as e:
    logger.debug("Could not register UserTableLimitsProxy admin (models may not be loaded yet): %s", e)


# TRY to register blog models into custom_admin_site using blog.admin.register_admin_models
try:
    from blog import admin as blog_admin_module
    register_fn = getattr(blog_admin_module, "register_admin_models", None)
    if callable(register_fn):
        try:
            register_fn(custom_admin_site)
            logger.info("Registered blog admin models into custom_admin_site via register_admin_models.")
        except Exception as inner_exc:
            logger.exception("register_admin_models exists but failed when called: %s", inner_exc)
    else:
        logger.debug("blog.admin.register_admin_models not found — skipping explicit registration.")
except Exception as e:
    logger.debug("Could not import blog.admin for explicit registration: %s", e)


__all__ = ["custom_admin_site", "CustomAdminSite"]
