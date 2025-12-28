# backend/users/signals.py
import os
import logging
from typing import Optional, Iterable

import requests
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model

from .models import UserProfile

logger = logging.getLogger(__name__)

# Supabase credentials (service role) — optional
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
    base_headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }

    params = {"id": f"eq.{supabase_uid}"}
    data = {"tables_limit": payload_value}

    try:
        r = requests.patch(url, headers=base_headers, params=params, json=data, timeout=10)
        if r.status_code in (200, 204):
            logger.debug("Supabase profile patched for id=%s (status=%s)", supabase_uid, r.status_code)
            return True
        logger.warning(
            "Supabase profiles update returned status %s for id=%s: %s", r.status_code, supabase_uid, r.text
        )

        # fallback upsert via POST (merge-duplicates)
        if r.status_code in (400, 404) or r.status_code >= 500:
            try:
                headers = dict(base_headers)
                headers["Prefer"] = "resolution=merge-duplicates,return=representation"
                post_payload = {"id": supabase_uid, "tables_limit": payload_value}
                r2 = requests.post(url, headers=headers, json=post_payload, timeout=10)
                if r2.status_code in (200, 201):
                    logger.debug("Supabase profile upsert POST succeeded for id=%s (status=%s)", supabase_uid, r2.status_code)
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


@receiver(post_save, sender=UserProfile)
def sync_usersprofile_to_supabase(sender, instance: UserProfile, created, **kwargs):
    """
    После сохранения UserProfile синхронизируем tables_limit в Supabase (если есть supabase_uid у user).
    """
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
            logger.debug("Supabase sync reported failure for uid=%s", supabase_uid)
    except Exception as e:
        logger.exception("Error in sync_usersprofile_to_supabase signal: %s", e)


# Ensure profile exists and populated with sensible fields copied from user on creation.
User = get_user_model()


def _copy_fields_from_user_to_profile(user, profile, fields: Iterable[str]) -> bool:
    """
    Копирует список полей из user в profile если оба атрибута существуют.
    Возвращает True если были изменения.
    """
    changed = False
    update_fields = []
    for field in fields:
        if not hasattr(user, field):
            continue
        if not hasattr(profile, field):
            continue
        try:
            val = getattr(user, field)
            # Avoid overwriting non-empty profile values with None
            if val is None:
                # if profile already has a value — skip
                if getattr(profile, field, None) is not None:
                    continue
            # Only set if different to reduce unnecessary writes
            if getattr(profile, field, None) != val:
                setattr(profile, field, val)
                changed = True
                update_fields.append(field)
        except Exception:
            logger.exception("Failed to copy field %s from user %s to profile", field, getattr(user, "id", None))
    if changed:
        try:
            # Save only when there were changes
            profile.save(update_fields=update_fields)
        except Exception:
            # fallback full save
            profile.save()
    return changed


@receiver(post_save, sender=User)
def create_user_profile_on_user_create(sender, instance, created, **kwargs):
    """
    При создании User — создаём UserProfile и копируем релевантные поля из User в профиль.
    Копируем только те поля, которые присутствуют и в user и в profile — это безопасно при отличающихся схемах.
    """
    try:
        if not created:
            return

        profile, _ = UserProfile.objects.get_or_create(user=instance)

        # Список полей, которые логично синхронизировать из users_customuser -> users_userprofile
        # (основан на предоставленной тобой схеме users_customuser).
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
            # also copy basic name/username if profile stores them
            "first_name",
            "last_name",
            "username",
        ]

        _copy_fields_from_user_to_profile(instance, profile, candidate_fields)

    except Exception as exc:
        # Не даём провалу создания пользователя из-за ошибок синхронизации профиля
        logger.exception("Failed to auto-create/populate UserProfile for user id=%s: %s", getattr(instance, "id", None), exc)
