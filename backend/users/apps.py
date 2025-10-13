# backend/users/apps.py
from django.apps import AppConfig

class UsersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    # Здесь указываем полный импортируемый путь до пакета приложения
    name = 'backend.users'
    verbose_name = "Users"
    
    def ready(self):
        # Import signals here to avoid circular imports
        try:
            import backend.users.signals  # импорт через полный путь — безопаснее в проде
        except Exception:
            # не падаем, просто игнорируем если сигналов нет или что-то не ок
            pass
