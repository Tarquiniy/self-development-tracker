from django.apps import AppConfig


class UsersConfig(AppConfig):
    name = "backend.users"
    label = "users"  # важно: чтобы AUTH_USER_MODEL = "users.CustomUser" работал
    default_auto_field = "django.db.models.BigAutoField"
