# backend/users/__init__.py
"""
Users package init — НЕ импортируем модели здесь.

Импорт моделей на уровне пакета вызывает попытки доступа к Django-моделям
до того, как реестр приложений будет инициализирован, и приводит к
ошибке `AppRegistryNotReady: Apps aren't loaded yet.`

Если вам нужно получить модели — импортируйте их внутри функций или в AppConfig.ready().
"""

# Не импортируем: from .models import CustomUser, UserProfile
# Экспортируем минимально необходимое:
__all__ = []
