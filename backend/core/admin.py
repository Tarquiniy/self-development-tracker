# backend/core/admin.py
import logging
from django.contrib import admin as django_admin
from django.urls import path
from django.contrib.admin.sites import AlreadyRegistered

logger = logging.getLogger(__name__)


class CustomAdminSite(django_admin.AdminSite):
    site_header = "Positive Theta Admin"
    site_title = "Positive Theta"
    index_title = "Панель управления Positive Theta"

    def get_urls(self):
        """
        Add optional blog admin views (dashboard, media library, stats) lazily.
        Import blog.admin module and attach existing views if present.
        """
        urls = super().get_urls()
        custom_urls = []

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
            # Не ломаем admin при ошибках импорта blog.admin — логируем
            logger.exception("Failed to import blog.admin views into custom admin urls: %s", e)

        return custom_urls + urls


# create custom site (keep name "admin" so URL names match expected templates)
custom_admin_site = CustomAdminSite(name="admin")


# ------------------------------------------------------------------------
# Ensure auth models (User / Group / Permission) are registered both in the
# custom admin site and in the default admin.site. This guarantees that
# template reverses like 'auth_user_changelist' resolve correctly.
#
# Registration is done safely (AlreadyRegistered handling) and does not touch DB.
# ------------------------------------------------------------------------
try:
    from django.contrib.auth import get_user_model
    from django.contrib.auth.models import Group, Permission
    from django.contrib.auth.admin import UserAdmin as DefaultUserAdmin

    UserModel = get_user_model()

    # ---- register into custom_admin_site ----
    try:
        custom_admin_site.register(Group)
    except AlreadyRegistered:
        logger.debug("Group already registered in custom_admin_site")

    try:
        custom_admin_site.register(Permission)
    except AlreadyRegistered:
        logger.debug("Permission already registered in custom_admin_site")

    try:
        custom_admin_site.register(UserModel, DefaultUserAdmin)
    except AlreadyRegistered:
        logger.debug("User model already registered in custom_admin_site")
    except Exception as e:
        logger.exception("Failed to register User in custom_admin_site with DefaultUserAdmin: %s", e)
        try:
            custom_admin_site.register(UserModel)
        except Exception:
            logger.exception("Fallback: failed to register UserModel in custom_admin_site")

    # ---- register into default django admin.site ----
    try:
        django_admin.site.register(Group)
    except AlreadyRegistered:
        logger.debug("Group already registered in django admin.site")

    try:
        django_admin.site.register(Permission)
    except AlreadyRegistered:
        logger.debug("Permission already registered in django admin.site")

    try:
        django_admin.site.register(UserModel, DefaultUserAdmin)
    except AlreadyRegistered:
        logger.debug("User model already registered in django admin.site")
    except Exception as e:
        logger.exception("Failed to register UserModel in django admin.site with DefaultUserAdmin: %s", e)
        try:
            django_admin.site.register(UserModel)
        except Exception:
            logger.exception("Fallback: failed to register UserModel in django admin.site")

except Exception as e:
    # If something fails early (e.g. apps not ready), log and continue.
    logger.exception("Auth models registration skipped due to error: %s", e)


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
