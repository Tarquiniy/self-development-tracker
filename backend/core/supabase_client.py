# backend/core/supabase_client.py
import os
from typing import Optional
import requests

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")  # опционально, НЕ хранить в клиенте

if not SUPABASE_URL:
    # не падаем при импортe, но будем предъявлять явную ошибку при использовании
    SUPABASE_URL = None

def supabase_user_info(access_token: str, timeout: float = 5.0) -> Optional[dict]:
    """
    Запрашивает /auth/v1/user у Supabase, возвращает JSON user info или None.
    Требует, чтобы переменная SUPABASE_URL была задана в окружении.
    """
    if not SUPABASE_URL or not access_token:
        return None
    url = SUPABASE_URL.rstrip('/') + '/auth/v1/user'
    headers = {"Authorization": f"Bearer {access_token}", "apikey": os.getenv("SUPABASE_ANON_KEY","")}
    try:
        r = requests.get(url, headers=headers, timeout=timeout)
        if r.status_code == 200:
            return r.json()
        # 401/403/other -> None
    except requests.RequestException:
        pass
    return None
