"""
Signals for users app.

Важно:
 - Не импортируем модели на уровне модуля (чтобы избежать раннего вызова get_user_model()
   или циклических импортов при старте Django).
 - Внутри обработчиков сигнала используем apps.get_model(...) — это ленивый и безопасный способ.
"""

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.conf import settings
from django.apps import apps
import logging

logger = logging.getLogger(__name__)

def _get_userprofile_model():
    """
    Возвращает модель UserProfile через apps.get_model — безопасно на этапе инициализации.
    """
    # определяем app_label — стараемся брать из settings.AUTH_USER_MODEL,
    # но fallback на 'users', если вдруг строка неожиданная.
    try:
        app_label = settings.AUTH_USER_MODEL.split('.')[0]
    except Exception:
        app_label = 'users'
    # модель UserProfile определена в том же приложении 'users'
    try:
        return apps.get_model(app_label, 'UserProfile')
    except LookupError:
        # Если модели пока нет (например, ещё не зарегистрирована) — вернём None
        logger.debug("UserProfile model not available yet (apps.get_model lookup failed)")
        return None


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_user_profile(sender, instance, created, **kwargs):
    """
    Создаёт профиль автоматически при создании пользователя.
    Использует ленивое получение модели UserProfile.
    """
    if not created:
        return

    UserProfile = _get_userprofile_model()
    if UserProfile is None:
        # модель ещё не доступна — записываем в лог и отложим создание.
        logger.warning("create_user_profile: UserProfile model not found — пропускаем создание")
        return

    try:
        UserProfile.objects.get_or_create(user=instance)
    except Exception:
        logger.exception("Failed to create user profile for user id=%s", getattr(instance, 'id', None))


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def save_user_profile(sender, instance, **kwargs):
    """
    Сохраняет профиль пользователя при сохранении пользователя (если профиль уже есть).
    """
    try:
        # используем привязанный related_name 'profile' — если есть, сохраняем
        profile = getattr(instance, 'profile', None)
        if profile is not None:
            profile.save()
    except Exception:
        # если модель/связь ещё не готовы — просто логируем это, но не падаем
        logger.exception("Failed to save user profile for user id=%s", getattr(instance, 'id', None))
