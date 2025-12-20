# backend/users/views_social.py
"""
Unified OAuth callback handler (example: Yandex).
Flow:
 - exchange provider code -> provider access token -> email
 - admin.generate_link(type='magiclink') -> extract hashed token
 - call Supabase /auth/v1/verify (type=magiclink, token=hashed_token) using ANON key
   -> receive access_token + refresh_token
 - return HTML which postMessage's { type: 'social_auth_session', access_token, refresh_token }
   to window.opener (origin restricted) and then closes the popup.
"""
import json
import logging
import os
from typing import Optional, Tuple

import requests
from django.conf import settings
from django.http import HttpRequest, HttpResponse, HttpResponseBadRequest

logger = logging.getLogger(__name__)

# Config via settings or env
SUPABASE_URL = getattr(settings, "SUPABASE_URL", os.getenv("SUPABASE_URL"))
SUPABASE_SERVICE_ROLE_KEY = getattr(settings, "SUPABASE_SERVICE_ROLE_KEY", os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
SUPABASE_ANON_KEY = getattr(settings, "SUPABASE_ANON_KEY", os.getenv("SUPABASE_ANON_KEY"))
FRONTEND_URL = getattr(settings, "FRONTEND_URL", os.getenv("FRONTEND_URL", None))
BACKEND_ORIGIN = getattr(settings, "BACKEND_ORIGIN", os.getenv("BACKEND_ORIGIN", None))

# Also allow explicit SITE_ORIGIN for targetOrigin in postMessage
SITE_ORIGIN = (
    getattr(settings, "SITE_ORIGIN", None)
    or os.getenv("NEXT_PUBLIC_SITE_ORIGIN")
    or FRONTEND_URL
)

# Yandex endpoints (example provider). You can add provider-based branching later.
YANDEX_TOKEN_URL = "https://oauth.yandex.com/token"
YANDEX_USERINFO_URL = "https://login.yandex.ru/info?format=json"


def _get_redirect_uri(request: HttpRequest) -> str:
    # Prefer explicit setting; otherwise infer from request
    red = getattr(settings, "YANDEX_REDIRECT_URI", os.getenv("YANDEX_REDIRECT_URI"))
    if red:
        return red
    scheme = "https" if request.is_secure() else "http"
    return f"{scheme}://{request.get_host()}{request.path}"


def _exchange_code_for_yandex_token(code: str, redirect_uri: str) -> Tuple[Optional[str], Optional[str], dict]:
    client_id = getattr(settings, "YANDEX_CLIENT_ID", os.getenv("YANDEX_CLIENT_ID"))
    client_secret = getattr(settings, "YANDEX_CLIENT_SECRET", os.getenv("YANDEX_CLIENT_SECRET"))
    if not client_id or not client_secret:
        return None, "YANDEX_CLIENT_ID or YANDEX_CLIENT_SECRET not configured", {}

    payload = {
        "grant_type": "authorization_code",
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
    }
    try:
        r = requests.post(YANDEX_TOKEN_URL, data=payload, timeout=8)
    except Exception as exc:
        logger.exception("Yandex token request failed")
        return None, f"Failed to contact Yandex token endpoint: {exc}", {}

    raw = {}
    try:
        raw = r.json()
    except Exception:
        raw = {"status_text": r.text}

    if r.status_code != 200:
        msg = raw.get("error_description") or raw.get("error") or r.text
        return None, f"Yandex token exchange failed: {msg}", raw

    token = raw.get("access_token")
    if not token:
        return None, "Yandex response did not include access_token", raw
    return token, None, raw


def _fetch_yandex_email(access_token: str) -> Tuple[Optional[str], Optional[str], dict]:
    headers = {"Authorization": f"OAuth {access_token}", "Accept": "application/json"}
    try:
        r = requests.get(YANDEX_USERINFO_URL, headers=headers, timeout=8)
    except Exception as exc:
        logger.exception("Yandex userinfo request failed")
        return None, f"Failed to contact Yandex userinfo: {exc}", {}

    raw = {}
    try:
        raw = r.json()
    except Exception:
        raw = {"status_text": r.text}

    if r.status_code != 200:
        msg = raw.get("error_description") or raw.get("error") or r.text
        return None, f"Yandex userinfo failed: {msg}", raw

    email = raw.get("email") or raw.get("default_email")
    if not email:
        emails = raw.get("emails")
        if isinstance(emails, (list, tuple)) and emails:
            email = emails[0]
    if not email:
        return None, "Yandex did not return email (scope login:email is required)", raw
    return email, None, raw


def _admin_generate_magiclink_for_email(email: str, redirect_to: str) -> Tuple[Optional[str], Optional[str], dict]:
    """
    Calls Supabase admin/generate_link to produce a magiclink and returns a token we can verify.
    Returns (token, error, raw_response).
    The response format varies slightly across versions; we attempt to extract hashed_token robustly.
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return None, "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured", {}

    endpoint = SUPABASE_URL.rstrip("/") + "/auth/v1/admin/generate_link"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
    }
    payload = {"type": "magiclink", "email": email, "options": {"redirectTo": redirect_to}}
    try:
        r = requests.post(endpoint, headers=headers, json=payload, timeout=8)
    except Exception as exc:
        logger.exception("Supabase admin.generate_link failed")
        return None, f"Failed to contact Supabase admin.generate_link: {exc}", {}

    raw = {}
    try:
        raw = r.json()
    except Exception:
        raw = {"status_text": r.text}

    if r.status_code not in (200, 201):
        return None, f"Supabase generate_link returned error: {raw}", raw

    # Try several places where token/hash might be present
    token = None
    try:
        token = raw.get("data", {}).get("properties", {}).get("hashed_token")
    except Exception:
        token = None
    if not token:
        token = raw.get("properties", {}).get("hashed_token")
    if not token:
        token = raw.get("hashed_token")
    if not token:
        action_link = raw.get("action_link") or raw.get("data", {}).get("action_link") or raw.get("link")
        if isinstance(action_link, str) and "token=" in action_link:
            try:
                from urllib.parse import urlparse, parse_qs
                q = urlparse(action_link).query
                token = parse_qs(q).get("token", [None])[0] or parse_qs(q).get("hashed_token", [None])[0]
            except Exception:
                token = None
    if not token:
        token = raw.get("data", {}).get("token")
    if not token:
        return None, f"Could not find hashed_token in generate_link response: {raw}", raw

    return token, None, raw


def _verify_magic_token_and_get_session(token: str) -> Tuple[Optional[dict], Optional[str], dict]:
    """
    Call Supabase /auth/v1/verify (POST) with type=magiclink and token=... to receive JSON with access_token + refresh_token.
    Use ANON key in apikey header (as a separate client).
    """
    if not SUPABASE_URL:
        return None, "SUPABASE_URL not configured", {}
    endpoint = SUPABASE_URL.rstrip("/") + "/auth/v1/verify"
    headers = {"Content-Type": "application/json"}
    if SUPABASE_ANON_KEY:
        headers["apikey"] = SUPABASE_ANON_KEY

    payload = {"type": "magiclink", "token": token}
    try:
        r = requests.post(endpoint, headers=headers, json=payload, timeout=8)
    except Exception as exc:
        logger.exception("Supabase /auth/v1/verify request failed")
        return None, f"Failed to contact Supabase /auth/v1/verify: {exc}", {}

    raw = {}
    try:
        raw = r.json()
    except Exception:
        raw = {"status_text": r.text}

    if r.status_code not in (200, 201):
        return None, f"Supabase verify returned error: {raw}", raw

    # Expect access_token and refresh_token in response
    access = raw.get("access_token")
    refresh = raw.get("refresh_token")
    if not access or not refresh:
        access = access or raw.get("data", {}).get("access_token")
        refresh = refresh or raw.get("data", {}).get("refresh_token")

    if not access or not refresh:
        return None, f"No access_token/refresh_token in verify response: {raw}", raw

    return {"access_token": access, "refresh_token": refresh, "raw": raw}, None, raw


def yandex_callback(request: HttpRequest) -> HttpResponse:
    """
    Django view to handle Yandex callback.
    Expects ?code=... . Returns a small HTML page that posts session tokens to opener and closes the popup.
    """
    code = request.GET.get("code")
    if not code:
        return HttpResponseBadRequest("Missing code parameter.")

    redirect_uri = _get_redirect_uri(request)
    # 1) exchange code -> provider access token
    provider_token, err, raw = _exchange_code_for_yandex_token(code, redirect_uri=redirect_uri)
    if err:
        logger.warning("Yandex token exchange error: %s; raw=%s", err, raw)
        return HttpResponse(f"Yandex token exchange failed: {err}", status=400)

    # 2) fetch user email from provider
    email, err, raw = _fetch_yandex_email(provider_token)
    if err:
        logger.warning("Yandex userinfo error: %s; raw=%s", err, raw)
        return HttpResponse(f"Could not get user email from Yandex: {err}", status=400)

    # 3) admin.generate_link -> token
    frontend_target = FRONTEND_URL or getattr(settings, "SITE_ORIGIN", None) or (
        ("https://" + request.get_host()) if request.is_secure() else ("http://" + request.get_host())
    )
    token, err, raw_gen = _admin_generate_magiclink_for_email(email=email, redirect_to=frontend_target)
    if err:
        logger.error("generate_link error: %s; raw=%s", err, raw_gen)
        return HttpResponse(f"Failed to generate login token for {email}: {err}", status=500)

    # 4) call /auth/v1/verify to get access+refresh tokens
    session, err, raw_verify = _verify_magic_token_and_get_session(token)
    if err:
        logger.error("verify token error: %s; raw=%s", err, raw_verify)
        # Fallback behavior: fallback to action_link redirect (old behavior)
        action_link = raw_gen.get("action_link") or raw_gen.get("data", {}).get("action_link") or None
        if action_link:
            # Return old-style postMessage with action_link (main window can navigate)
            backend_origin = BACKEND_ORIGIN or (("https://" + request.get_host()) if request.is_secure() else ("http://" + request.get_host()))
            site_origin = SITE_ORIGIN or frontend_target
            html = f"""<!doctype html>
<html>
  <head><meta charset="utf-8"/><title>Завершение входа</title></head>
  <body>
    <script>
      (function() {{
        var siteOrigin = {json.dumps(site_origin)};
        var payload = {{ type: "social_auth", action_link: {json.dumps(action_link)} }};
        try {{
          if (window.opener && !window.opener.closed) {{
            try {{ window.opener.postMessage(payload, siteOrigin); }} catch(e){{ try{{ window.opener.postMessage(payload, "*"); }}catch(e){{}} }}
            setTimeout(function(){{ try{{ window.close(); }}catch(e){{}} }}, 250);
            return;
          }}
        }} catch(e){{ }}
        try {{ window.location.replace({json.dumps(action_link)}); }} catch(e){{}}
      }})();
    </script>
    <p>Завершаем вход...</p>
  </body>
</html>"""
            return HttpResponse(html, content_type="text/html")
        return HttpResponse(f"Could not obtain session tokens: {err}", status=500)

    # 5) success: send tokens to opener and close popup
    access = session["access_token"]
    refresh = session["refresh_token"]
    backend_origin = BACKEND_ORIGIN or (("https://" + request.get_host()) if request.is_secure() else ("http://" + request.get_host()))
    site_origin = SITE_ORIGIN or frontend_target

    # Minimal HTML/JS: postMessage tokens to opener then close popup
    # NOTE: We use `site_origin` (frontend) as the targetOrigin so the main window (frontend) receives the message.
    html = f"""<!doctype html>
<html>
  <head><meta charset="utf-8"/><title>Завершение входа</title></head>
  <body>
    <script>
      (function() {{
        var siteOrigin = {json.dumps(site_origin)};
        var payload = {{
          type: 'social_auth_session',
          provider: 'yandex',
          access_token: {json.dumps(access)},
          refresh_token: {json.dumps(refresh)}
        }};
        try {{
          if (window.opener && !window.opener.closed) {{
            try {{ window.opener.postMessage(payload, siteOrigin); }} catch(e) {{ try {{ window.opener.postMessage(payload, "*"); }} catch(e2){{}} }}
          }}
        }} catch (e) {{ /* ignore */ }}
        // Give opener a moment to process then close
        setTimeout(function() {{
          try {{ window.close(); }} catch(e) {{ }}
        }}, 220);
      }})();
    </script>
    <p>Завершаем вход… Если окно не закрылось автоматически — закройте его вручную.</p>
  </body>
</html>"""
    return HttpResponse(html, content_type="text/html")
