from django.apps import AppConfig

class UsersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    # полный import path помогает убрать неоднозначности при импорте
    name = 'backend.users'
    # метка приложения остаётся 'users' — важно для AUTH_USER_MODEL = "users.CustomUser"
    label = 'users'

    def ready(self):
        # импортируем сигналы тут по полному пути; сигналы сами не будут делать "тяжёлых" импортов
        try:
            import backend.users.signals  # noqa: F401
        except Exception:
            # если при импорте сигналов возникла ошибка - логируем как минимум,
            # но не ломаем загрузку приложения (в проде вы сможете увидеть причину в логах)
            import logging
            logger = logging.getLogger(__name__)
            logger.exception("Failed to import backend.users.signals in AppConfig.ready()")
