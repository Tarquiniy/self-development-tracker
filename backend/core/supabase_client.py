# backend/core/supabase_client.py
import os
import logging
from typing import Optional, Dict, Any

import requests

logger = logging.getLogger(__name__)

# Env vars
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY") or os.getenv("SERVICE_ROLE_KEY")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

# Try to import supabase python client (optional)
_create_supabase_client = None
try:
    from supabase import create_client as _create_supabase_client  # type: ignore
except Exception:
    _create_supabase_client = None
    logger.debug("supabase.create_client not available in runtime; REST fallbacks will be used if necessary.")


def get_supabase():
    """
    Возвращает подключённый supabase client, созданный через SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY.
    Бросает RuntimeError, если не удалось создать клиент (отсутствует библиотека или переменные окружения).
    """
    if _create_supabase_client is None:
        raise RuntimeError("supabase python client not installed. Install 'supabase' package or use REST fallback.")
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured in environment.")
    try:
        client = _create_supabase_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        return client
    except Exception as e:
        logger.exception("Failed to create supabase client")
        raise RuntimeError(f"Failed to create supabase client: {e}") from e


def supabase_user_info(access_token: str, timeout: float = 5.0) -> Optional[Dict[str, Any]]:
    """
    Запрашивает /auth/v1/user у Supabase, возвращает JSON user info или None.
    Требует, чтобы переменная SUPABASE_URL была задана в окружении.
    Использует access_token (Bearer) и SUPABASE_ANON_KEY в заголовках.
    """
    if not SUPABASE_URL or not access_token:
        return None
    url = SUPABASE_URL.rstrip("/") + "/auth/v1/user"
    headers = {
        "Authorization": f"Bearer {access_token}",
    }
    if SUPABASE_ANON_KEY:
        headers["apikey"] = SUPABASE_ANON_KEY
    try:
        r = requests.get(url, headers=headers, timeout=timeout)
        if r.status_code == 200:
            return r.json()
        logger.debug("supabase_user_info: status=%s text=%s", r.status_code, r.text)
    except requests.RequestException as ex:
        logger.debug("supabase_user_info request exception: %s", ex)
    return None


def generate_magic_link_admin(email: str, redirect_to: str, timeout: float = 10.0) -> str:
    """
    Сгенерировать magic-link для email через Admin API Supabase.
    Попытки (в порядке приоритета):
      1) Если установлен python supabase клиент и он поддерживает auth.admin.generate_link — использовать его.
      2) REST fallback: POST {SUPABASE_URL}/auth/v1/admin/generate_link с Service Role Key.

    Возвращает action_link (строку) при успехе.
    Бросает RuntimeError при ошибке / отсутствии конфигурации.
    """
    # 1) Попытка через клиент
    last_err = None
    if _create_supabase_client is not None and SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
        try:
            client = _create_supabase_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
            # try typical location
            if hasattr(client, "auth") and getattr(client.auth, "admin", None) is not None:
                resp = client.auth.admin.generate_link({
                    "type": "magiclink",
                    "email": email,
                    "options": {"redirectTo": redirect_to}
                })
                # Разные формы ответа: пытаемся извлечь action_link
                if isinstance(resp, dict):
                    # new-style client may return {"data": {"action_link": "..."}}
                    data = resp.get("data") or {}
                    action_link = data.get("action_link") or data.get("link") or resp.get("action_link") or resp.get("link")
                    if action_link:
                        return action_link
                else:
                    # object-like response
                    action_link = getattr(resp, "action_link", None) or getattr(resp, "link", None)
                    if action_link:
                        return action_link
            else:
                logger.debug("supabase client does not have auth.admin, will try REST fallback")
        except Exception as e:
            last_err = e
            logger.exception("supabase client call to admin.generate_link failed")

    # 2) REST fallback
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured - cannot generate admin magic link") from last_err

    admin_endpoint = SUPABASE_URL.rstrip("/") + "/auth/v1/admin/generate_link"
    payload = {
        "type": "magiclink",
        "email": email,
        "options": {"redirectTo": redirect_to},
    }
    # IMPORTANT: include both Authorization AND apikey headers for Supabase admin endpoints.
    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
    }
    try:
        r = requests.post(admin_endpoint, json=payload, headers=headers, timeout=timeout)
        logger.debug("generate_magic_link_admin: status=%s body=%s", r.status_code, r.text)
        if r.status_code in (200, 201):
            jr = r.json()
            # try to extract
            action_link = jr.get("action_link") or (jr.get("data") or {}).get("action_link") or jr.get("link")
            if action_link:
                return action_link
            # maybe nested differently
            logger.error("generate_magic_link_admin: unexpected response body: %s", jr)
            raise RuntimeError("generate_magic_link_admin: unexpected response from Supabase admin endpoint")
        else:
            logger.error("generate_magic_link_admin: status=%s text=%s", r.status_code, r.text)
            raise RuntimeError(f"Supabase admin endpoint returned {r.status_code}: {r.text}")
    except requests.RequestException as e:
        logger.exception("generate_magic_link_admin: REST request failed")
        raise RuntimeError(f"generate_magic_link_admin: REST request failed: {e}") from e
