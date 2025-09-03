import hashlib
import hmac
import os
from urllib.parse import urlencode

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")

def check_telegram_auth(data: dict) -> bool:
    """Проверка подписи Telegram Login Widget"""
    if not BOT_TOKEN:
        return False

    check_hash = data.get("hash")
    auth_data = {k: v for k, v in data.items() if k != "hash"}
    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(auth_data.items()))
    secret_key = hashlib.sha256(BOT_TOKEN.encode()).digest()
    hmac_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    return hmac_hash == check_hash
