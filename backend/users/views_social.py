# backend/users/views_social.py
import os
import json
import logging
import requests

from django.http import HttpResponse
from django.views.decorators.http import require_GET
from django.views.decorators.csrf import csrf_exempt

logger = logging.getLogger(__name__)

SITE_URL = os.environ.get("SITE_URL", "https://positive-theta.onrender.com")
YANDEX_CLIENT_ID = os.environ.get("YANDEX_CLIENT_ID", "")
YANDEX_CLIENT_SECRET = os.environ.get("YANDEX_CLIENT_SECRET", "")
EMAIL_DOMAIN = os.environ.get("SOCIAL_LOGIN_EMAIL_DOMAIN", "positive-theta.local")

# Попытка импортировать вашу утилиту get_supabase, если она есть.
supabase = None
_supabase_fallback_mode = None
try:
    from core.supabase_client import get_supabase  # если у вас есть такая функция
    try:
        supabase = get_supabase()
        _supabase_fallback_mode = "util"
    except Exception:
        logger.exception("get_supabase() exists but failed; will fallback to create_client or REST.")
        supabase = None
except Exception:
    # не беда — попытаемся создать клиент напрямую из env
    try:
        from supabase import create_client as create_supabase_client
        SUPABASE_URL = os.environ.get("SUPABASE_URL")
        SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY") or os.environ.get("SERVICE_ROLE_KEY")
        if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
            supabase = create_supabase_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
            _supabase_fallback_mode = "direct"
        else:
            supabase = None
    except Exception:
        # если библиотеки нет или что-то пошло не так, оставим supabase = None и будем использовать REST fallback
        supabase = None
        logger.info("supabase.create_client not available; will use REST fallback for admin endpoints.")


@csrf_exempt
@require_GET
def yandex_callback(request):
    """
    Callback for Yandex OAuth.
    Flow:
      - receive ?code=...
      - exchange code -> token (server-side)
      - call login.yandex.ru/info with access_token to get email/id
      - generate Supabase magic-link (admin.generate_link) using either:
          * supabase client (preferred)
          * REST endpoint POST {SUPABASE_URL}/auth/v1/admin/generate_link with Service Role key
      - return popup HTML which postMessage's action_link to opener and closes.
    """
    code = request.GET.get("code")
    state = request.GET.get("state")
    if not code:
        return HttpResponse("Missing code", status=400)

    # 1) Exchange code -> token
    token_url = "https://oauth.yandex.com/token"
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "client_id": YANDEX_CLIENT_ID,
        "client_secret": YANDEX_CLIENT_SECRET,
        "redirect_uri": f"{SITE_URL}/api/auth/yandex/callback",
    }
    try:
        token_resp = requests.post(token_url, data=data, timeout=10)
    except Exception as e:
        logger.exception("Yandex token request error")
        return HttpResponse(f"Yandex token request failed: {e}", status=500)

    if token_resp.status_code != 200:
        logger.error("Yandex token exchange failed: %s %s", token_resp.status_code, token_resp.text)
        return HttpResponse(f"Token exchange failed: {token_resp.status_code}", status=500)

    token_data = token_resp.json()
    access_token = token_data.get("access_token")
    if not access_token:
        logger.error("No access token; token_data=%s", token_data)
        return HttpResponse("No access token received from Yandex", status=500)

    # 2) Get user info (email, id)
    info_url = "https://login.yandex.ru/info"
    headers = {"Authorization": f"OAuth {access_token}"}
    try:
        info_resp = requests.get(info_url, headers=headers, timeout=10)
    except Exception as e:
        logger.exception("Yandex userinfo request failed")
        return HttpResponse(f"Userinfo request failed: {e}", status=500)

    if info_resp.status_code != 200:
        logger.error("Yandex userinfo failed: %s %s", info_resp.status_code, info_resp.text)
        return HttpResponse(f"Userinfo failed: {info_resp.status_code}", status=500)

    info = info_resp.json()
    yandex_id = info.get("id")
    email = info.get("default_email") or (info.get("emails") and info.get("emails")[0]) or (f"ya_{yandex_id}@{EMAIL_DOMAIN}" if yandex_id else None)

    if not email:
        logger.error("No email and no id returned from Yandex info: %s", info)
        return HttpResponse("No email returned by Yandex and cannot synthesize one", status=500)

    # 3) Generate Supabase magic link (try client first, then REST fallback)
    action_link = None
    # prefer supabase client if available and supports admin.generate_link
    try:
        if supabase is not None:
            # Some clients expose auth.admin.generate_link, others may differ.
            if hasattr(supabase, "auth") and getattr(supabase.auth, "admin", None) is not None:
                logger.debug("Using supabase.auth.admin.generate_link via client")
                res = supabase.auth.admin.generate_link({
                    "type": "magiclink",
                    "email": email,
                    "options": {"redirectTo": SITE_URL}
                })
                # handle different shapes
                if isinstance(res, dict) and res.get("data"):
                    action_link = (res.get("data") or {}).get("action_link") or (res.get("data") or {}).get("link")
                else:
                    action_link = getattr(res, "action_link", None) or getattr(res, "link", None)
            else:
                # some python clients use different signatures; try generic admin invoke
                try:
                    # try calling rest admin endpoint via client if client has post method
                    logger.debug("Attempting generic REST via supabase client")
                    supabase_url = os.environ.get("SUPABASE_URL")
                    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")
                    if supabase_url and supabase_key:
                        admin_endpoint = supabase_url.rstrip("/") + "/auth/v1/admin/generate_link"
                        r = requests.post(admin_endpoint, json={
                            "type": "magiclink",
                            "email": email,
                            "options": {"redirectTo": SITE_URL}
                        }, headers={"Authorization": f"Bearer {supabase_key}"}, timeout=10)
                        if r.status_code in (200, 201):
                            jr = r.json()
                            action_link = jr.get("action_link") or (jr.get("data") or {}).get("action_link") or jr.get("link")
                except Exception:
                    logger.exception("Generic REST via client failed")
        # if we still don't have action_link, try REST fallback directly
        if not action_link:
            SUPABASE_URL = os.environ.get("SUPABASE_URL")
            SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY") or os.environ.get("SERVICE_ROLE_KEY")
            if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
                admin_endpoint = SUPABASE_URL.rstrip("/") + "/auth/v1/admin/generate_link"
                r = requests.post(admin_endpoint, json={
                    "type": "magiclink",
                    "email": email,
                    "options": {"redirectTo": SITE_URL}
                }, headers={"Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"}, timeout=10)
                if r.status_code in (200, 201):
                    jr = r.json()
                    action_link = jr.get("action_link") or (jr.get("data") or {}).get("action_link") or jr.get("link")
                else:
                    logger.error("Supabase REST admin generate_link failed: %s %s", r.status_code, r.text)
            else:
                logger.error("No SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY set; cannot generate magic link")
    except Exception as e:
        logger.exception("Exception while generating supabase magic link")
        return HttpResponse(f"Supabase generate_link error: {e}", status=500)

    if not action_link:
        logger.error("Failed to obtain action_link for email=%s", email)
        return HttpResponse("<html><body><h2>Не удалось сгенерировать action link</h2></body></html>", content_type="text/html")

    # 4) Optionally: here you can persist mapping (yandex_id -> email) in DB if desired.
    # (omitted — safe to add later)

    # 5) Return popup HTML that posts message to opener with action_link
    safe_action = action_link.replace("<", "&lt;").replace(">", "&gt;")
    html = f"""<!doctype html><html><head><meta charset="utf-8"></head><body>
      <h2>Завершите вход</h2>
      <p>Если окно не закроется автоматически, нажмите кнопку ниже.</p>
      <p><a id="finish" href="{safe_action}" target="_blank">Завершить вход</a></p>
      <script>
        (function() {{
          const action = {json.dumps(action_link)};
          const origin = {json.dumps(SITE_URL)};
          try {{
            if (window.opener && !window.opener.closed) {{
              window.opener.postMessage({{ type: 'social_auth', provider: 'yandex', action_link: action }}, origin);
              setTimeout(()=>window.close(),700);
            }} else {{
              // fallback: redirect to action link directly
              window.location.href = action;
            }}
          }} catch (e) {{
            console.warn(e);
            window.location.href = action;
          }}
        }})();
      </script>
    </body></html>"""
    return HttpResponse(html, content_type="text/html")
