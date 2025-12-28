# backend/users/signals.py
import os
import logging
from typing import Optional, Iterable, Set

import requests
from django.conf import settings
from django.db import connection
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model

from .models import UserProfile

logger = logging.getLogger(__name__)

# Supabase service-role credentials (optional)
SUPABASE_URL = getattr(settings, "SUPABASE_URL", os.getenv("SUPABASE_URL"))
SUPABASE_SERVICE_ROLE_KEY = getattr(
    settings, "SUPABASE_SERVICE_ROLE_KEY", os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)


def _normalize_tables_limit(tables_limit_value) -> Optional[int]:
    if tables_limit_value is None:
        return None
    try:
        if isinstance(tables_limit_value, str) and tables_limit_value.lower() in ("infinity", "inf"):
            return -1
        if tables_limit_value == float("inf"):
            return -1
        return int(tables_limit_value)
    except Exception:
        logger.debug("Could not normalize tables_limit value: %r", tables_limit_value)
        return None


def _update_supabase_profile(supabase_uid: str, tables_limit_value) -> bool:

    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        logger.debug("Supabase credentials not configured — skipping supabase profile sync.")
        return False

    if not supabase_uid:
        logger.debug("No supabase_uid provided — skipping supabase profile sync.")
        return False

    payload_value = _normalize_tables_limit(tables_limit_value)

    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/profiles"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        # no risky preferences, but in fallback we may use resolution=merge-duplicates
    }

    params = {"id": f"eq.{supabase_uid}"}
    # Only these keys will be sent — no accidental 'about' or другие поля
    data = {"tables_limit": payload_value}

    try:
        # PATCH existing row(s) matching id
        r = requests.patch(url, headers=headers, params=params, json=data, timeout=10)
        if r.status_code in (200, 204):
            logger.debug("Supabase profile patched for id=%s (status=%s)", supabase_uid, r.status_code)
            return True

        logger.warning("Supabase patch returned %s for id=%s: %s", r.status_code, supabase_uid, r.text)

        # fallback: try upsert via POST but still only with safe fields (id + tables_limit)
        if r.status_code in (400, 404) or r.status_code >= 500:
            try:
                headers2 = dict(headers)
                headers2["Prefer"] = "resolution=merge-duplicates,return=representation"
                post_payload = {"id": supabase_uid, "tables_limit": payload_value}
                r2 = requests.post(url, headers=headers2, json=post_payload, timeout=10)
                if r2.status_code in (200, 201):
                    logger.debug("Supabase profile upsert succeeded for id=%s (status=%s)", supabase_uid, r2.status_code)
                    return True
                logger.warning("Supabase upsert returned %s for id=%s: %s", r2.status_code, supabase_uid, r2.text)
            except Exception as exc:
                logger.exception("Supabase upsert POST failed for id=%s: %s", supabase_uid, exc)

        return False
    except Exception as e:
        logger.exception("Failed to sync tables_limit to Supabase for uid=%s: %s", supabase_uid, e)
        return False


@receiver(post_save, sender=UserProfile)
def sync_usersprofile_to_supabase(sender, instance: UserProfile, created, **kwargs):

    try:
        user = getattr(instance, "user", None)
        if not user:
            return

        supabase_uid = getattr(user, "supabase_uid", None)
        if not supabase_uid:
            logger.debug("User %s has no supabase_uid — skipping profile sync", getattr(user, "id", None))
            return

        val = instance.tables_limit
        ok = _update_supabase_profile(supabase_uid, val)
        if not ok:
            logger.debug("Supabase sync returned failure for uid=%s", supabase_uid)
    except Exception as e:
        logger.exception("Error in sync_usersprofile_to_supabase signal: %s", e)


# ---- Helpers to safely copy fields to profile only if those columns exist in DB ----
def _get_table_columns(table_name: str) -> Set[str]:

    try:
        with connection.cursor() as cursor:
            # get_table_description возвращает список описаний колонок
            desc = connection.introspection.get_table_description(cursor, table_name)
            cols = {col.name for col in desc}
            return cols
    except Exception as exc:

        logger.exception("Could not get table columns for %s: %s", table_name, exc)
        return set()


def _copy_fields_from_user_to_profile_if_columns_exist(user, profile, candidate_fields: Iterable[str]) -> None:
    try:
        columns = _get_table_columns(UserProfile._meta.db_table)
        if not columns:
            logger.debug("No columns discovered for %s — skipping field copy", UserProfile._meta.db_table)
            return

        changed = False
        update_fields = []
        for field in candidate_fields:
            if field not in columns:
                # колонка отсутствует в БД — пропускаем
                continue
            if not hasattr(user, field) or not hasattr(profile, field):
                continue
            try:
                val = getattr(user, field)
            except Exception:
                continue
            # Skip overwriting non-empty profile with None
            if val is None and getattr(profile, field, None) is not None:
                continue
            if getattr(profile, field, None) != val:
                setattr(profile, field, val)
                changed = True
                update_fields.append(field)
        if changed:
            try:
                profile.save(update_fields=update_fields)
            except Exception:
                # fallback full save if update_fields fails
                profile.save()
    except Exception as exc:
        logger.exception("Error copying fields from user to profile: %s", exc)


# Receiver: при создании User — создаём UserProfile и копируем безопасные поля
User = get_user_model()


@receiver(post_save, sender=User)
def create_user_profile_on_user_create(sender, instance, created, **kwargs):
    """
    При создании User создаёт UserProfile (если его ещё нет) и копирует строго
    контролируемый набор полей только если соответствующие колонки реально есть в БД.
    Это предотвращает ошибки типа "Could not find the 'about' column".
    """
    try:
        if not created:
            return

        profile, _ = UserProfile.objects.get_or_create(user=instance)


        candidate_fields = [
            "supabase_uid",
            "avatar_url",
            "bio",
            "email_verified",
            "registration_method",
            "reset_token",
            "reset_sent_at",
            "verification_token",
            "verification_sent_at",
            "first_name",
            "last_name",
            "username",
        ]

        _copy_fields_from_user_to_profile_if_columns_exist(instance, profile, candidate_fields)
    except Exception as exc:
        logger.exception("Failed to auto-create/populate UserProfile for user id=%s: %s", getattr(instance, "id", None), exc)
