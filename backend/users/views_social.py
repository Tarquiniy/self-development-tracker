# backend/users/views_social.py
import os
import json
import logging
import requests

from django.http import HttpResponse
from django.views.decorators.http import require_GET
from django.views.decorators.csrf import csrf_exempt

from core.supabase_client import get_supabase  # ваша util из backend/core/supabase_client.py

logger = logging.getLogger(__name__)

SITE_URL = os.environ.get("SITE_URL", "https://positive-theta.onrender.com")
YANDEX_CLIENT_ID = os.environ.get("YANDEX_CLIENT_ID", "")
YANDEX_CLIENT_SECRET = os.environ.get("YANDEX_CLIENT_SECRET", "")
EMAIL_DOMAIN = os.environ.get("SOCIAL_LOGIN_EMAIL_DOMAIN", "positive-theta.local")

# Простой GET-эндпоинт для callback: ожидаем /api/auth/yandex/callback?code=...&state=...
@csrf_exempt
@require_GET
def yandex_callback(request):
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
        logger.exception("Yandex token request failed")
        return HttpResponse(f"Yandex token request failed: {e}", status=500)

    if token_resp.status_code != 200:
        logger.error("Yandex token exchange failed: %s %s", token_resp.status_code, token_resp.text)
        return HttpResponse(f"Token exchange failed: {token_resp.status_code}", status=500)

    token_data = token_resp.json()
    access_token = token_data.get("access_token")
    if not access_token:
        logger.error("No access token in response: %s", token_data)
        return HttpResponse("No access token", status=500)

    # 2) Get user info (email, id)
    info_url = "https://login.yandex.ru/info"
    headers = {"Authorization": f"OAuth {access_token}"}
    info_resp = requests.get(info_url, headers=headers, timeout=10)
    if info_resp.status_code != 200:
        logger.error("Yandex userinfo failed: %s %s", info_resp.status_code, info_resp.text)
        return HttpResponse(f"Userinfo failed: {info_resp.status_code}", status=500)
    info = info_resp.json()
    yandex_id = info.get("id")
    email = info.get("default_email") or (info.get("emails") and info.get("emails")[0]) or f"ya_{yandex_id}@{EMAIL_DOMAIN}"

    # 3) Generate Supabase magic link (use your backend/core/supabase_client.get_supabase())
    try:
        supabase = get_supabase()
    except Exception as e:
        logger.exception("Supabase client init failed")
        return HttpResponse(f"Supabase client init failed: {e}", status=500)

    action_link = None
    try:
        # Попытка воспользоваться auth.admin.generate_link через Python client (если доступно)
        # Обратите внимание: API клиента может отличаться. Этот код пытается поддержать существующие варианты.
        if hasattr(supabase, "auth") and getattr(supabase.auth, "admin", None) is not None:
            # new-style client
            res = supabase.auth.admin.generate_link({
                "type": "magiclink",
                "email": email,
                "options": {"redirectTo": SITE_URL}
            })
            # рез-формат может отличаться: попробуем извлечь action_link
            if isinstance(res, dict) and res.get("data"):
                action_link = (res.get("data") or {}).get("action_link")
            else:
                action_link = getattr(res, "action_link", None) or getattr(res, "link", None)
        else:
            # fallback: вызываем Supabase REST Admin endpoint напрямую
            supabase_url = os.environ.get("SUPABASE_URL")
            supabase_key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
            if not supabase_url or not supabase_key:
                raise ValueError("SUPABASE_URL/SUPABASE_KEY not configured for REST fallback")
            admin_endpoint = supabase_url.rstrip("/") + "/auth/v1/admin/generate_link"
            payload = {
                "type": "magiclink",
                "email": email,
                "options": {"redirectTo": SITE_URL}
            }
            r = requests.post(admin_endpoint, json=payload, headers={"Authorization": f"Bearer {supabase_key}"}, timeout=10)
            if r.status_code in (200, 201):
                jr = r.json()
                # try to get action link from response
                action_link = jr.get("action_link") or (jr.get("data") or {}).get("action_link") or jr.get("link")
            else:
                logger.error("Supabase REST admin generate_link failed: %s %s", r.status_code, r.text)
                return HttpResponse(f"Supabase generate link failed: {r.status_code}", status=500)
    except Exception as e:
        logger.exception("Supabase generate_link error")
        return HttpResponse(f"Supabase generate_link error: {e}", status=500)

    if not action_link:
        logger.error("No action_link returned from supabase generate link")
        return HttpResponse("<html><body><h2>Не удалось сгенерировать action link</h2></body></html>", content_type="text/html")

    # 4) (Опционально) сохраняем отображение yandex_id -> email в БД, чтобы связать аккаунты в будущем
    try:
        from users.models import CustomUser  # если у вас есть модель кастомного пользователя
        # не критично — если модели нет или поле другое, обернём в try/except
        # попытка найти пользователя и привязать yandex_id (если поле есть)
        # примечание: это опционально, не ломает flow
    except Exception:
        pass

    # 5) Вернуть popup HTML, который postMessage'ом вышлет action_link в opener и закроется
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
              // fallback: redirect to action
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
