from django.apps import AppConfig

class UsersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'users'             # 👈 важно: соответствует пакету users при запуске из backend/
    label = 'users'            # 👈 ярлык, который используется в AUTH_USER_MODEL = "users.CustomUser"
    verbose_name = "Пользователи"  # удобочитаемое имя в админке
