# backend/users/signals.py
import os
import json
import logging
from typing import Optional

import requests
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model

from .models import UserProfile

logger = logging.getLogger(__name__)

# Получаем переменные окружения для Supabase (Service Role key)
SUPABASE_URL = getattr(settings, "SUPABASE_URL", os.getenv("SUPABASE_URL"))
SUPABASE_SERVICE_ROLE_KEY = getattr(
    settings, "SUPABASE_SERVICE_ROLE_KEY", os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)


def _normalize_tables_limit(tables_limit_value) -> Optional[int]:
    """
    Нормализует значение tables_limit для отправки в Supabase:
    - None -> None (NULL)
    - numeric -> int
    - 'inf' / float('inf') -> -1 (мы трактуем -1 как 'неограниченно')
    """
    if tables_limit_value is None:
        return None
    try:
        # handle string-ish 'inf'
        if isinstance(tables_limit_value, str) and tables_limit_value.lower() in ("infinity", "inf"):
            return -1
        # handle float('inf')
        if tables_limit_value == float("inf"):
            return -1
        return int(tables_limit_value)
    except Exception:
        logger.debug("Could not normalize tables_limit value: %r", tables_limit_value)
        return None


def _update_supabase_profile(supabase_uid: str, tables_limit_value) -> bool:
    """
    Обновляет поле tables_limit в таблице profiles у записи с id = supabase_uid
    Использует Supabase REST API с service_role ключом (апдейты без ограничений).
    Возвращает True если операция успешна или False в противном случае.
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        logger.debug("Supabase credentials not configured — skipping supabase profile sync.")
        return False

    if not supabase_uid:
        logger.debug("No supabase_uid provided — skipping supabase profile sync.")
        return False

    payload_value = _normalize_tables_limit(tables_limit_value)

    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/profiles"
    # Common headers for Supabase REST with service_role
    base_headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }

    params = {"id": f"eq.{supabase_uid}"}
    data = {"tables_limit": payload_value}

    try:
        # PATCH existing row(s) matching id
        headers = dict(base_headers)
        # Prefer no special return; keep default
        r = requests.patch(url, headers=headers, params=params, json=data, timeout=10)
        if r.status_code in (200, 204):
            logger.debug("Supabase profile patched for id=%s (status=%s)", supabase_uid, r.status_code)
            return True
        logger.warning(
            "Supabase profiles update returned status %s for id=%s: %s", r.status_code, supabase_uid, r.text
        )

        # fallback: attempt upsert via POST with resolution=merge-duplicates
        if r.status_code in (400, 404) or r.status_code >= 500:
            try:
                headers = dict(base_headers)
                # Tell Supabase to merge duplicates (upsert-like behavior)
                headers["Prefer"] = "resolution=merge-duplicates,return=representation"
                # POST body with id ensures insert or merge by primary key
                post_payload = {"id": supabase_uid, "tables_limit": payload_value}
                r2 = requests.post(url, headers=headers, json=post_payload, timeout=10)
                if r2.status_code in (200, 201):
                    logger.debug(
                        "Supabase profile upsert POST succeeded for id=%s (status=%s)", supabase_uid, r2.status_code
                    )
                    return True
                logger.warning(
                    "Supabase profiles upsert POST returned status %s for id=%s: %s",
                    r2.status_code,
                    supabase_uid,
                    r2.text,
                )
            except Exception as exc:
                logger.exception("Supabase profiles upsert POST failed for id=%s: %s", supabase_uid, exc)

        return False
    except Exception as e:
        logger.exception("Failed to sync tables_limit to Supabase for uid=%s: %s", supabase_uid, e)
        return False


# Receiver: при сохранении UserProfile — синхронизируем в Supabase (если user.supabase_uid задан)
@receiver(post_save, sender=UserProfile)
def sync_usersprofile_to_supabase(sender, instance: UserProfile, created, **kwargs):
    """
    После сохранения UserProfile в Django — синхронизируем tables_limit в Supabase profiles.
    Требует, чтобы у связанного CustomUser был заполнен supabase_uid (uuid).
    """
    try:
        user = getattr(instance, "user", None)
        if not user:
            return

        supabase_uid = getattr(user, "supabase_uid", None)
        if not supabase_uid:
            # нет внешнего uid — ничего не делаем
            logger.debug(
                "User %s has no supabase_uid — skipping profile sync", getattr(user, "id", None)
            )
            return

        val = instance.tables_limit
        ok = _update_supabase_profile(supabase_uid, val)
        if not ok:
            logger.debug("Supabase sync reported failure for uid=%s", supabase_uid)
    except Exception as e:
        logger.exception("Error in sync_usersprofile_to_supabase signal: %s", e)


# Receiver: при создании User — гарантированно создаём UserProfile (защита от пропущенных мест)
User = get_user_model()


@receiver(post_save, sender=User)
def create_user_profile_on_user_create(sender, instance, created, **kwargs):
    """
    Если пользователь был создан (created=True) — удостоверяемся, что у него есть UserProfile.
    Это защищает регистрацию из разных мест (admin, social login, API) от ситуации без профиля.
    """
    try:
        if not created:
            return
        # get_or_create безопасен при гонках и не вызовет IntegrityError
        UserProfile.objects.get_or_create(user=instance)
    except Exception as exc:
        # Никогда не даём провалиться созданию пользователя из-за проблем с профилем.
        logger.exception("Failed to auto-create UserProfile for user id=%s: %s", getattr(instance, "id", None), exc)
