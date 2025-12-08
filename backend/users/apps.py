# backend/users/apps.py
from django.apps import AppConfig

class UsersConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "users"

    def ready(self):
        # Импортируем signals при старте приложения
        try:
            import users.signals  # noqa: F401
        except Exception:
            pass
