from django.apps import AppConfig

class UsersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'backend.users'     # 👈 полное имя пакета (ВАЖНО)
    label = 'users'            # 👈 ярлык, используемый в AUTH_USER_MODEL
    verbose_name = "Пользователи"
