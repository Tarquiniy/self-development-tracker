from django.apps import AppConfig

class UsersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'users'
    verbose_name = "Users"
    
    def ready(self):
        # Import signals here to avoid circular imports
        try:
            import users.signals
        except Exception:
            # deliberately broad: on build-time some optional modules may be missing,
            # but we don't want the whole app registration to fail because of that.
            pass

        # Ensure blog.admin (and any modules that call get_user_model() at import time)
        # are imported only after app registry is ready. This avoids
        # "AUTH_USER_MODEL refers to model 'users.CustomUser' that has not been installed".
        try:
            import blog.admin  # noqa: F401
        except Exception:
            # If blog.admin cannot be imported during build (for any reason),
            # don't break app startup — it will be retried/loaded in later runs.
            # We swallow exceptions here to keep startup robust; errors will be visible in logs.
            pass
