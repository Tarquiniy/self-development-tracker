# backend/users/signals.py
import os
import json
import logging
import requests

from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import UserProfile

logger = logging.getLogger(__name__)

# Получаем переменные окружения для Supabase (Service Role key)
SUPABASE_URL = getattr(settings, "SUPABASE_URL", os.getenv("SUPABASE_URL"))
SUPABASE_SERVICE_ROLE_KEY = getattr(settings, "SUPABASE_SERVICE_ROLE_KEY", os.getenv("SUPABASE_SERVICE_ROLE_KEY"))

def _update_supabase_profile(supabase_uid: str, tables_limit_value):
    """
    Обновляет поле tables_limit в таблице profiles у записи с id = supabase_uid
    Использует Supabase REST API с service_role ключом (апдейты без ограничений).
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        logger.debug("Supabase credentials not configured — skipping supabase profile sync.")
        return False

    if not supabase_uid:
        logger.debug("No supabase_uid provided — skipping supabase profile sync.")
        return False

    # Normalize: if None -> send null; if Infinity -> send -1 (we treat -1 as unlimited)
    payload_value = None
    if tables_limit_value is None:
        payload_value = None
    else:
        try:
            if tables_limit_value == float("inf") or str(tables_limit_value).lower() in ("infinity", "inf"):
                payload_value = -1
            else:
                payload_value = int(tables_limit_value)
        except Exception:
            payload_value = None

    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/profiles"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        # Prefer to return nothing; not necessary
        "Prefer": "return=representation",
    }

    # Build filter: id=eq.<supabase_uid>
    params = {"id": f"eq.{supabase_uid}"}

    data = {"tables_limit": payload_value}

    try:
        # Use PATCH to update existing row(s)
        r = requests.patch(url, headers=headers, params=params, data=json.dumps(data), timeout=10)
        if r.status_code not in (200, 204):
            logger.warning("Supabase profiles update returned status %s: %s", r.status_code, r.text)
            # if 404 or others — maybe profile not exist; try insert via POST (upsert)
            if r.status_code == 404 or r.status_code == 400:
                # try upsert (POST with on_conflict not available via REST easily) — skip for now
                return False
        return True
    except Exception as e:
        logger.exception("Failed to sync tables_limit to Supabase for uid=%s: %s", supabase_uid, e)
        return False


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
            logger.debug("User %s has no supabase_uid — skipping profile sync", getattr(user, "id", None))
            return

        # Determine value to write: instance.tables_limit. If None -> null, if negative -> -1 (=unlimited)
        val = instance.tables_limit
        _update_supabase_profile(supabase_uid, val)
    except Exception as e:
        logger.exception("Error in sync_usersprofile_to_supabase signal: %s", e)
