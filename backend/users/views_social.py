# backend/users/views_social.py
import os
import json
import logging
import requests

from django.http import HttpResponse
from django.views.decorators.http import require_GET
from django.views.decorators.csrf import csrf_exempt

from core.supabase_client import generate_magic_link_admin

logger = logging.getLogger(__name__)

# === ENV ===
SITE_URL = os.getenv("SITE_URL", "https://positive-theta.onrender.com")
YANDEX_CLIENT_ID = os.getenv("YANDEX_CLIENT_ID")
YANDEX_CLIENT_SECRET = os.getenv("YANDEX_CLIENT_SECRET")
EMAIL_DOMAIN = os.getenv("SOCIAL_LOGIN_EMAIL_DOMAIN", "positive-theta.local")


@csrf_exempt
@require_GET
def yandex_callback(request):
    """
    OAuth callback from Yandex.
    Flow:
      1. Receive ?code=
      2. Exchange code -> access_token
      3. Get user info (email / id)
      4. Generate Supabase magic-link (admin)
      5. Send action_link to frontend via postMessage
    """

    code = request.GET.get("code")
    if not code:
        return HttpResponse("Missing ?code", status=400)

    if not YANDEX_CLIENT_ID or not YANDEX_CLIENT_SECRET:
        logger.error("YANDEX_CLIENT_ID or YANDEX_CLIENT_SECRET not set")
        return HttpResponse("Yandex OAuth is not configured", status=500)

    # === 1. Exchange code -> token ===
    token_url = "https://oauth.yandex.com/token"
    token_payload = {
        "grant_type": "authorization_code",
        "code": code,
        "client_id": YANDEX_CLIENT_ID,
        "client_secret": YANDEX_CLIENT_SECRET,
        "redirect_uri": f"{SITE_URL}/api/auth/yandex/callback",
    }

    try:
        token_resp = requests.post(token_url, data=token_payload, timeout=10)
    except requests.RequestException as exc:
        logger.exception("Yandex token request failed")
        return HttpResponse(f"Yandex token request failed: {exc}", status=500)

    if token_resp.status_code != 200:
        logger.error("Yandex token error %s: %s", token_resp.status_code, token_resp.text)
        return HttpResponse("Failed to exchange Yandex code", status=500)

    token_data = token_resp.json()
    access_token = token_data.get("access_token")
    if not access_token:
        logger.error("No access_token in Yandex response: %s", token_data)
        return HttpResponse("No access token received", status=500)

    # === 2. Get user info ===
    info_url = "https://login.yandex.ru/info"
    headers = {"Authorization": f"OAuth {access_token}"}

    try:
        info_resp = requests.get(info_url, headers=headers, timeout=10)
    except requests.RequestException as exc:
        logger.exception("Yandex userinfo request failed")
        return HttpResponse(f"Yandex userinfo failed: {exc}", status=500)

    if info_resp.status_code != 200:
        logger.error("Yandex userinfo error %s: %s", info_resp.status_code, info_resp.text)
        return HttpResponse("Failed to fetch Yandex user info", status=500)

    info = info_resp.json()
    yandex_id = info.get("id")
    email = (
        info.get("default_email")
        or (info.get("emails") and info.get("emails")[0])
        or (f"ya_{yandex_id}@{EMAIL_DOMAIN}" if yandex_id else None)
    )

    if not email:
        logger.error("Yandex returned no email and no id: %s", info)
        return HttpResponse("Unable to determine email", status=500)

    # === 3. Generate Supabase magic-link ===
    try:
        action_link = generate_magic_link_admin(
            email=email,
            redirect_to=SITE_URL,
        )
    except Exception as exc:
        logger.exception("Supabase magic link generation failed")
        return HttpResponse(f"Supabase error: {exc}", status=500)

    # === 4. Send link back to frontend (popup flow) ===
    safe_action = action_link.replace("<", "&lt;").replace(">", "&gt;")

    html = f"""<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>Yandex login</title>
</head>
<body>
  <p>Завершаем вход…</p>
  <noscript>
    <a href="{safe_action}" target="_blank">Продолжить вход</a>
  </noscript>

  <script>
    (function () {{
      const actionLink = {json.dumps(action_link)};
      const targetOrigin = {json.dumps(SITE_URL)};
      try {{
        if (window.opener && !window.opener.closed) {{
          window.opener.postMessage(
            {{
              type: "social_auth",
              provider: "yandex",
              action_link: actionLink
            }},
            targetOrigin
          );
          setTimeout(() => window.close(), 600);
        }} else {{
          window.location.href = actionLink;
        }}
      }} catch (e) {{
        console.error(e);
        window.location.href = actionLink;
      }}
    }})();
  </script>
</body>
</html>
"""

    return HttpResponse(html, content_type="text/html")
