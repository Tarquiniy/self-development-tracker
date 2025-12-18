# backend/users/views_social.py
import json
import logging
import os
from typing import Optional, Tuple

import requests
from django.conf import settings
from django.http import HttpRequest, HttpResponse, HttpResponseBadRequest

logger = logging.getLogger(__name__)

# Required settings / env vars (recommended to put into Django settings)
# - settings.YANDEX_CLIENT_ID
# - settings.YANDEX_CLIENT_SECRET
# - settings.SUPABASE_URL                (e.g. "https://<project_ref>.supabase.co")
# - settings.SUPABASE_SERVICE_ROLE_KEY   (service_role key; MUST be kept secret server-side)
# - settings.FRONTEND_URL                (e.g. "https://positive-theta.vercel.app")  -- used as redirect_to for magic link
# Optionally:
# - settings.BACKEND_ORIGIN              (e.g. "https://positive-theta.onrender.com") - used for stricter postMessage origin

YANDEX_TOKEN_URL = "https://oauth.yandex.com/token"
YANDEX_USERINFO_URL = "https://login.yandex.ru/info?format=json"


def _get_setting(name: str, default: Optional[str] = None) -> Optional[str]:
    return getattr(settings, name, os.getenv(name, default))


def _exchange_code_for_yandex_token(code: str, redirect_uri: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Exchange authorization code for access_token at Yandex OAuth.
    Returns (access_token, error_message).
    """
    client_id = _get_setting("YANDEX_CLIENT_ID")
    client_secret = _get_setting("YANDEX_CLIENT_SECRET")
    if not client_id or not client_secret:
        return None, "YANDEX_CLIENT_ID or YANDEX_CLIENT_SECRET not configured on server."

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
        logger.exception("Failed to contact Yandex token endpoint")
        return None, f"Failed to contact Yandex token endpoint: {exc}"

    if r.status_code != 200:
        logger.warning("Yandex token endpoint returned non-200: %s, body: %s", r.status_code, r.text)
        try:
            body = r.json()
            message = body.get("error_description") or body.get("error") or r.text
        except Exception:
            message = r.text
        return None, f"Yandex token exchange failed: {message}"

    try:
        body = r.json()
        access_token = body.get("access_token")
        if not access_token:
            return None, "Yandex token response did not include access_token."
        return access_token, None
    except Exception as exc:
        logger.exception("Malformed JSON from Yandex token endpoint")
        return None, f"Malformed response from Yandex token endpoint: {exc}"


def _fetch_yandex_user_email(access_token: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Request user info from Yandex and extract an email.
    Returns (email, error_message)
    """
    if not access_token:
        return None, "No access token provided."

    headers = {
        # Yandex uses 'Authorization: OAuth <token>' for some endpoints:
        "Authorization": f"OAuth {access_token}",
        "Accept": "application/json",
    }
    try:
        r = requests.get(YANDEX_USERINFO_URL, headers=headers, timeout=8)
    except Exception as exc:
        logger.exception("Failed to call Yandex userinfo")
        return None, f"Failed to call Yandex userinfo: {exc}"

    if r.status_code != 200:
        logger.warning("Yandex userinfo returned non-200: %s, body: %s", r.status_code, r.text)
        try:
            body = r.json()
            message = body.get("error_description") or body.get("error") or r.text
        except Exception:
            message = r.text
        return None, f"Yandex userinfo failed: {message}"

    try:
        data = r.json()
    except Exception as exc:
        logger.exception("Malformed JSON from Yandex userinfo")
        return None, f"Malformed response from Yandex userinfo: {exc}"

    # Yandex historically provides email either in 'email', 'default_email' or 'emails' fields.
    email = data.get("email") or data.get("default_email")
    if not email:
        emails = data.get("emails") or data.get("emails_list") or None
        if isinstance(emails, (list, tuple)) and emails:
            email = emails[0]
    if not email:
        logger.warning("Yandex userinfo did not include email: %s", data)
        return None, "Yandex did not return an email address (app must request login:email scope)."

    return email, None


def _generate_supabase_magic_link_for_email(email: str, redirect_to: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Calls Supabase Admin generate_link endpoint to create a magic-link for the given email.
    Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in settings.
    Returns (action_link, error_message)
    """
    supabase_url = _get_setting("SUPABASE_URL")
    service_key = _get_setting("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_key:
        return None, "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured on server."

    # Ensure no trailing slash
    base = supabase_url.rstrip("/")

    endpoint = f"{base}/auth/v1/admin/generate_link"
    headers = {
        "Content-Type": "application/json",
        # both Authorization Bearer and apikey header are recommended
        "Authorization": f"Bearer {service_key}",
        "apikey": service_key,
    }

    payload = {
        "type": "magiclink",
        "email": email,
        "redirect_to": redirect_to,
    }

    try:
        r = requests.post(endpoint, headers=headers, json=payload, timeout=8)
    except Exception as exc:
        logger.exception("Failed to call Supabase admin generate_link")
        return None, f"Failed to contact Supabase admin generate_link: {exc}"

    if r.status_code not in (200, 201):
        logger.warning("Supabase admin generate_link returned %s: %s", r.status_code, r.text)
        try:
            body = r.json()
            message = body.get("msg") or body.get("error") or body
        except Exception:
            message = r.text
        return None, f"Supabase generate_link failed: {message}"

    try:
        body = r.json()
    except Exception as exc:
        logger.exception("Malformed JSON from Supabase generate_link")
        return None, f"Malformed response from Supabase generate_link: {exc}"

    # The response usually contains 'action_link' (may be absolute or relative path)
    action_link = body.get("action_link") or body.get("data", {}).get("action_link") or body.get("link")
    if not action_link:
        # older/newer variants: some responses include path under other keys
        # try to extract token-based verify path if present
        # fallback: return entire body as error
        return None, f"Supabase response did not include action_link: {body}"

    # If action_link looks like a path (starts with '/'), prefix with supabase origin
    if action_link.startswith("/"):
        action_link = base + action_link

    return action_link, None


def yandex_callback(request: HttpRequest) -> HttpResponse:
    """
    Django view to handle Yandex OAuth callback.
    Expects GET ?code=...
    Produces HTML that posts { type: 'social_auth', action_link } to window.opener (backend origin),
    then tries to close the popup. If no opener — redirects to action_link.
    """
    code = request.GET.get("code")
    if not code:
        return HttpResponseBadRequest("Missing code parameter.")

    # Build redirect_uri used for code exchange — must match the one registered in Yandex app.
    # Try to construct from settings or infer from current request.
    redirect_uri = _get_setting("YANDEX_REDIRECT_URI") or _get_setting("YANDEX_REDIRECT_URL")
    if not redirect_uri:
        # fallback: use current request full path
        scheme = "https" if request.is_secure() else "http"
        redirect_uri = f"{scheme}://{request.get_host()}{request.path}"

    # 1) exchange code -> access_token
    access_token, err = _exchange_code_for_yandex_token(code, redirect_uri=redirect_uri)
    if err:
        logger.warning("Yandex token exchange error: %s", err)
        return HttpResponse(f"Yandex token exchange failed: {err}", status=400)

    # 2) fetch yandex user info -> email
    email, err = _fetch_yandex_user_email(access_token)
    if err:
        logger.warning("Yandex userinfo error: %s", err)
        return HttpResponse(f"Could not get user email from Yandex: {err}", status=400)

    # 3) generate Supabase magic link for this email
    frontend_url = _get_setting("FRONTEND_URL") or _get_setting("SITE_ORIGIN") or getattr(settings, "SITE_ORIGIN", None)
    if not frontend_url:
        # as fallback, derive from request host (but better set FRONTEND_URL in settings)
        scheme = "https" if request.is_secure() else "http"
        frontend_url = f"{scheme}://{request.get_host()}"

    action_link, err = _generate_supabase_magic_link_for_email(email=email, redirect_to=frontend_url)
    if err:
        logger.warning("Supabase generate_link error for email %s: %s", email, err)
        return HttpResponse(f"Failed to generate Supabase magic link: {err}", status=500)

    # Determine backend_origin for secure postMessage - prefer explicit setting
    backend_origin = _get_setting("BACKEND_ORIGIN") or ("https://" + request.get_host() if request.is_secure() else "http://" + request.get_host())

    # Safe JSON encode action_link for embedding into HTML
    action_link_json = json.dumps(str(action_link))
    backend_origin_escaped = json.dumps(str(backend_origin))

    # Output HTML that posts message to opener and closes popup.
    # The script:
    #  - tries window.opener.postMessage({type:'social_auth', action_link}, backend_origin)
    #  - fallback: try postMessage with "*" if origin strict fails
    #  - fallback: try window.opener.location.href = actionLink
    #  - then setTimeout window.close()
    #  - if no opener -> window.location.replace(actionLink) (popup becomes main tab)
    html = f"""<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    <title>Завершение входа</title>
  </head>
  <body>
    <p>Завершение входа... Если окно не закроется автоматически — закройте его вручную.</p>
    <script>
    (function() {{
      var actionLink = {action_link_json};
      var backendOrigin = {backend_origin_escaped};

      function tryNotifyOpener() {{
        try {{
          if (window.opener && !window.opener.closed) {{
            try {{
              window.opener.postMessage({{ type: 'social_auth', action_link: actionLink }}, backendOrigin);
            }} catch (e) {{
              try {{ window.opener.postMessage({{ type: 'social_auth', action_link: actionLink }}, "*"); }} catch(e2){{}}
            }}
            try {{ window.opener.location.href = actionLink; }} catch(e){{ /* may be blocked */ }}
            try {{ window.opener.focus(); }} catch(e){{}}
            setTimeout(function() {{
              try {{ window.close(); }} catch(e){{}}
            }}, 300);
            return true;
          }}
        }} catch (err) {{
          // ignore
        }}
        return false;
      }}

      if (!tryNotifyOpener()) {{
        // No opener (popup opened in same tab or opener inaccessible) -> navigate popup itself to action_link.
        try {{
          window.location.replace(actionLink);
        }} catch (e) {{
          // if even this fails, show link for manual click
          var a = document.createElement('a');
          a.href = actionLink;
          a.textContent = 'Перейти вручную';
          document.body.appendChild(document.createElement('br'));
          document.body.appendChild(a);
        }}
      }}
    }})();
    </script>
  </body>
</html>
"""
    return HttpResponse(html, content_type="text/html")
