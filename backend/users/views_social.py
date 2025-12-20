# backend/users/views_social.py
import json
import logging
import os
from typing import Optional, Tuple

import requests
from django.conf import settings
from django.http import HttpRequest, HttpResponse, HttpResponseBadRequest

logger = logging.getLogger(__name__)

SUPABASE_URL = getattr(settings, "SUPABASE_URL", os.getenv("SUPABASE_URL"))
SUPABASE_SERVICE_ROLE_KEY = getattr(
    settings, "SUPABASE_SERVICE_ROLE_KEY", os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

YANDEX_TOKEN_URL = "https://oauth.yandex.com/token"
YANDEX_USERINFO_URL = "https://login.yandex.ru/info?format=json"


def _get_redirect_uri(request: HttpRequest) -> str:
    red = getattr(settings, "YANDEX_REDIRECT_URI", os.getenv("YANDEX_REDIRECT_URI"))
    if red:
        return red
    scheme = "https" if request.is_secure() else "http"
    return f"{scheme}://{request.get_host()}{request.path}"


def _exchange_code_for_yandex_token(code: str, redirect_uri: str) -> str:
    client_id = getattr(settings, "YANDEX_CLIENT_ID", os.getenv("YANDEX_CLIENT_ID"))
    client_secret = getattr(
        settings, "YANDEX_CLIENT_SECRET", os.getenv("YANDEX_CLIENT_SECRET")
    )

    payload = {
        "grant_type": "authorization_code",
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
    }

    r = requests.post(YANDEX_TOKEN_URL, data=payload, timeout=8)
    data = r.json()

    if r.status_code != 200:
        raise RuntimeError(f"Yandex token exchange failed: {data}")

    return data["access_token"]


def _fetch_yandex_email(access_token: str) -> str:
    r = requests.get(
        YANDEX_USERINFO_URL,
        headers={"Authorization": f"OAuth {access_token}"},
        timeout=8,
    )
    data = r.json()

    email = data.get("email") or data.get("default_email")
    if not email:
        raise RuntimeError("Yandex did not return email")

    return email


def _supabase_sign_in_with_oauth_token(
    provider_access_token: str,
) -> dict:
    """
    Official Supabase OAuth token exchange
    """
    endpoint = f"{SUPABASE_URL.rstrip('/')}/auth/v1/token?grant_type=id_token"

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
    }

    payload = {
        "provider": "yandex",
        "access_token": provider_access_token,
    }

    r = requests.post(endpoint, headers=headers, json=payload, timeout=8)
    data = r.json()

    if r.status_code != 200:
        raise RuntimeError(f"Supabase OAuth failed: {data}")

    return data


def yandex_callback(request: HttpRequest) -> HttpResponse:
    code = request.GET.get("code")
    if not code:
        return HttpResponseBadRequest("Missing code")

    try:
        redirect_uri = _get_redirect_uri(request)
        yandex_token = _exchange_code_for_yandex_token(code, redirect_uri)
        _fetch_yandex_email(yandex_token)  # validates email exists
        session = _supabase_sign_in_with_oauth_token(yandex_token)
    except Exception as e:
        logger.exception("OAuth failed")
        return HttpResponse(f"OAuth error: {e}", status=400)

    html = f"""<!doctype html>
<html>
  <head><meta charset="utf-8"/></head>
  <body>
    <h2>Вход успешен</h2>
    <p>Вы можете закрыть это окно.</p>
    <script>
      try {{
        if (window.opener && !window.opener.closed) {{
          window.opener.postMessage(
            {{
              type: "social_auth_session",
              session: {json.dumps(session)}
            }},
            "*"
          );
        }}
      }} catch (e) {{}}
    </script>
  </body>
</html>
"""
    return HttpResponse(html, content_type="text/html")
