# backend/users/views_social.py
import os
import logging
from typing import Optional, Tuple

import requests
from django.conf import settings
from django.http import HttpRequest, HttpResponse, HttpResponseBadRequest
from django.shortcuts import redirect

logger = logging.getLogger(__name__)

# ========= ENV / SETTINGS =========

SUPABASE_URL = getattr(settings, "SUPABASE_URL", os.getenv("SUPABASE_URL"))
SUPABASE_SERVICE_ROLE_KEY = getattr(
    settings,
    "SUPABASE_SERVICE_ROLE_KEY",
    os.getenv("SUPABASE_SERVICE_ROLE_KEY"),
)

FRONTEND_URL = getattr(settings, "FRONTEND_URL", os.getenv("FRONTEND_URL"))

YANDEX_CLIENT_ID = getattr(settings, "YANDEX_CLIENT_ID", os.getenv("YANDEX_CLIENT_ID"))
YANDEX_CLIENT_SECRET = getattr(
    settings,
    "YANDEX_CLIENT_SECRET",
    os.getenv("YANDEX_CLIENT_SECRET"),
)

YANDEX_TOKEN_URL = "https://oauth.yandex.com/token"
YANDEX_USERINFO_URL = "https://login.yandex.ru/info?format=json"


# ========= HELPERS =========

def _redirect_uri(request: HttpRequest) -> str:
    """Must EXACTLY match Yandex app settings"""
    return getattr(
        settings,
        "YANDEX_REDIRECT_URI",
        os.getenv("YANDEX_REDIRECT_URI"),
    )


def _exchange_code_for_token(code: str, redirect_uri: str) -> Tuple[Optional[str], Optional[str]]:
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "client_id": YANDEX_CLIENT_ID,
        "client_secret": YANDEX_CLIENT_SECRET,
        "redirect_uri": redirect_uri,
    }

    try:
        r = requests.post(YANDEX_TOKEN_URL, data=data, timeout=8)
        payload = r.json()
    except Exception as e:
        logger.exception("Yandex token exchange failed")
        return None, str(e)

    if r.status_code != 200:
        return None, payload.get("error_description") or str(payload)

    return payload.get("access_token"), None


def _fetch_yandex_email(token: str) -> Tuple[Optional[str], Optional[str]]:
    headers = {"Authorization": f"OAuth {token}"}

    try:
        r = requests.get(YANDEX_USERINFO_URL, headers=headers, timeout=8)
        payload = r.json()
    except Exception as e:
        logger.exception("Yandex userinfo failed")
        return None, str(e)

    if r.status_code != 200:
        return None, payload.get("error_description") or str(payload)

    email = payload.get("default_email") or payload.get("email")
    if not email:
        emails = payload.get("emails")
        if emails:
            email = emails[0]

    return email, None if email else "Email not provided by Yandex"


def _generate_magiclink(email: str) -> Tuple[Optional[str], Optional[str]]:
    url = SUPABASE_URL.rstrip("/") + "/auth/v1/admin/generate_link"

    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
    }

    payload = {
        "type": "magiclink",
        "email": email,
        "options": {
            "redirectTo": FRONTEND_URL,
        },
    }

    try:
        r = requests.post(url, headers=headers, json=payload, timeout=8)
        data = r.json()
    except Exception as e:
        logger.exception("Supabase generate_link failed")
        return None, str(e)

    if r.status_code not in (200, 201):
        return None, str(data)

    action_link = (
        data.get("action_link")
        or data.get("data", {}).get("action_link")
    )

    if not action_link:
        return None, "No action_link returned by Supabase"

    return action_link, None


# ========= VIEW =========

def yandex_callback(request: HttpRequest) -> HttpResponse:
    code = request.GET.get("code")
    if not code:
        return HttpResponseBadRequest("Missing ?code")

    redirect_uri = _redirect_uri(request)

    # 1. code → yandex token
    token, err = _exchange_code_for_token(code, redirect_uri)
    if err:
        return HttpResponse(f"OAuth error: {err}", status=400)

    # 2. token → email
    email, err = _fetch_yandex_email(token)
    if err:
        return HttpResponse(f"Yandex error: {err}", status=400)

    # 3. email → magiclink
    action_link, err = _generate_magiclink(email)
    if err:
        return HttpResponse(f"Supabase magiclink error: {err}", status=500)

    # 4. redirect popup to Supabase
    return redirect(action_link)
