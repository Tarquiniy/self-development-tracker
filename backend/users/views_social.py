# backend/users/views_social.py
"""
Unified OAuth callback handler (Yandex).

Flow:
 1. code -> Yandex access_token
 2. access_token -> email
 3. Supabase admin.generate_link (magiclink)
 4. Supabase /auth/v1/verify -> session created
 5. Show SUCCESS PAGE in popup (NO redirect, NO auto-close)
"""

import json
import logging
import os
from typing import Optional, Tuple

import requests
from django.conf import settings
from django.http import HttpRequest, HttpResponse, HttpResponseBadRequest

logger = logging.getLogger(__name__)

SUPABASE_URL = getattr(settings, "SUPABASE_URL", os.getenv("SUPABASE_URL"))
SUPABASE_SERVICE_ROLE_KEY = getattr(settings, "SUPABASE_SERVICE_ROLE_KEY", os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
SUPABASE_ANON_KEY = getattr(settings, "SUPABASE_ANON_KEY", os.getenv("SUPABASE_ANON_KEY"))

YANDEX_TOKEN_URL = "https://oauth.yandex.com/token"
YANDEX_USERINFO_URL = "https://login.yandex.ru/info?format=json"


def _get_redirect_uri(request: HttpRequest) -> str:
    red = getattr(settings, "YANDEX_REDIRECT_URI", os.getenv("YANDEX_REDIRECT_URI"))
    if red:
        return red
    scheme = "https" if request.is_secure() else "http"
    return f"{scheme}://{request.get_host()}{request.path}"


def _exchange_code_for_yandex_token(code: str, redirect_uri: str):
    client_id = getattr(settings, "YANDEX_CLIENT_ID", os.getenv("YANDEX_CLIENT_ID"))
    client_secret = getattr(settings, "YANDEX_CLIENT_SECRET", os.getenv("YANDEX_CLIENT_SECRET"))

    if not client_id or not client_secret:
        return None, "YANDEX_CLIENT_ID / YANDEX_CLIENT_SECRET not configured"

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
        return None, data.get("error_description", "Yandex token error")

    return data.get("access_token"), None


def _fetch_yandex_email(access_token: str):
    headers = {"Authorization": f"OAuth {access_token}"}
    r = requests.get(YANDEX_USERINFO_URL, headers=headers, timeout=8)
    data = r.json()

    email = data.get("email") or data.get("default_email")
    if not email:
        return None, "Email not returned by Yandex"

    return email, None


def _generate_magiclink(email: str):
    endpoint = SUPABASE_URL.rstrip("/") + "/auth/v1/admin/generate_link"
    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
    }

    payload = {"type": "magiclink", "email": email}

    r = requests.post(endpoint, headers=headers, json=payload, timeout=8)
    data = r.json()

    token = (
        data.get("data", {})
        .get("properties", {})
        .get("hashed_token")
    )

    if not token:
        return None, "Failed to extract hashed_token"

    return token, None


def _verify_magiclink(token: str):
    endpoint = SUPABASE_URL.rstrip("/") + "/auth/v1/verify"
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
    }

    payload = {"type": "magiclink", "token": token}
    r = requests.post(endpoint, headers=headers, json=payload, timeout=8)

    if r.status_code not in (200, 201):
        return False

    return True


def yandex_callback(request: HttpRequest) -> HttpResponse:
    code = request.GET.get("code")
    if not code:
        return HttpResponseBadRequest("Missing code")

    redirect_uri = _get_redirect_uri(request)

    access_token, err = _exchange_code_for_yandex_token(code, redirect_uri)
    if err:
        return HttpResponse(f"Yandex token error: {err}", status=400)

    email, err = _fetch_yandex_email(access_token)
    if err:
        return HttpResponse(f"Yandex userinfo error: {err}", status=400)

    token, err = _generate_magiclink(email)
    if err:
        return HttpResponse(f"Supabase magiclink error: {err}", status=500)

    ok = _verify_magiclink(token)
    if not ok:
        return HttpResponse("Supabase verify failed", status=500)

    # ✅ SUCCESS PAGE — NO redirect, NO auto-close
    html = """<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>Вход выполнен</title>
  <style>
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      background: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
    }
    .card {
      background: #ffffff;
      padding: 32px;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.08);
      text-align: center;
      max-width: 420px;
    }
    h1 {
      font-size: 20px;
      margin-bottom: 12px;
      color: #0f172a;
    }
    p {
      font-size: 14px;
      color: #334155;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Вход выполнен успешно ✅</h1>
    <p>Вы можете закрыть это окно и вернуться в приложение.</p>
  </div>
</body>
</html>"""

    return HttpResponse(html, content_type="text/html")
