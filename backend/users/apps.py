# backend/users/apps.py

from django.apps import AppConfig
import importlib
import traceback

class UsersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    # 👇 Полный импортируемый путь к модулю приложения — важно для однозначности
    name = 'backend.users'
    # 👇 Ярлык приложения, используемый в AUTH_USER_MODEL (users.CustomUser)
    label = 'users'
    verbose_name = "Пользователи"

    def ready(self):
        """
        Гарантируем раннюю загрузку модуля users.models сразу при регистрации приложения.
        Мы используем полный путь self.name (backend.users) — это делает импорт однозначным.
        """
        try:
            importlib.import_module(f"{self.name}.models")
        except Exception:
            # Печатаем traceback в stdout/stderr — это упростит отладку, если импорт упадёт.
            traceback.print_exc()
