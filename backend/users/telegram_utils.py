import hmac
import hashlib
import time
import logging
from django.conf import settings
from .exceptions import TelegramDataIsOutdatedError, NotTelegramDataError

logger = logging.getLogger(__name__)

def verify_telegram_authentication(bot_token, request_data):
    """
    Verify Telegram authentication data using HMAC-SHA256 signature validation
    """
    logger.debug("Verifying Telegram authentication data")

    if not bot_token:
        logger.error("Telegram bot token is not configured")
        raise NotTelegramDataError("Telegram bot token is not configured")

    received_hash = request_data.get('hash')
    auth_date = request_data.get('auth_date')

    if not received_hash or not auth_date:
        logger.warning("Missing hash or auth_date in Telegram data")
        raise NotTelegramDataError("Missing hash or auth_date in Telegram data")

    # Check if data is outdated (older than 24 hours)
    current_time = time.time()
    if current_time - int(auth_date) > 86400:  # 24 hours
        logger.warning("Telegram authentication data is outdated")
        raise TelegramDataIsOutdatedError("Authentication data is outdated")

    # Prepare data check string
    data_check_list = []
    for key, value in request_data.items():
        if key != 'hash':
            data_check_list.append(f"{key}={value}")

    # Sort alphabetically
    data_check_list.sort()
    data_check_string = "\n".join(data_check_list)

    # Calculate secret key
    secret_key = hashlib.sha256(bot_token.encode()).digest()

    # Calculate HMAC
    computed_hash = hmac.new(
        secret_key,
        data_check_string.encode(),
        hashlib.sha256
    ).hexdigest()

    # Compare hashes
    if computed_hash != received_hash:
        logger.warning("Invalid Telegram data signature")
        raise NotTelegramDataError("Invalid Telegram data signature")

    logger.debug("Telegram authentication data verified successfully")
    return request_data

# Ensure the function is available for import
__all__ = ['verify_telegram_authentication', 'TelegramDataIsOutdatedError', 'NotTelegramDataError']