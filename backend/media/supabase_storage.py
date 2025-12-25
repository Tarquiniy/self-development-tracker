import os
import io
import uuid
import logging
from typing import Optional, Tuple
from PIL import Image, UnidentifiedImageError
from supabase import create_client
from django.conf import settings

logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL", settings.SUPABASE_URL)
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", settings.SUPABASE_KEY)
BUCKET = os.environ.get("SUPABASE_BUCKET", getattr(settings, "SUPABASE_BUCKET", "media"))
THUMB_PREFIX = os.environ.get("SUPABASE_THUMB_PREFIX", getattr(settings, "SUPABASE_THUMB_PREFIX", "thumbnails/"))

_client = None
def client():
    global _client
    if _client is None:
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _client

def _generate_thumbnail_bytes(file_bytes: bytes, max_size=(400, 400)) -> Tuple[bytes, int, int]:
    """
    Возвращает (thumbnail_bytes, width, height)
    Использует Pillow.
    """
    try:
        with Image.open(io.BytesIO(file_bytes)) as im:
            im.convert("RGB")
            im.thumbnail(max_size, Image.LANCZOS)
            buf = io.BytesIO()
            im.save(buf, format="JPEG", quality=85)
            buf.seek(0)
            return buf.read(), im.width, im.height
    except UnidentifiedImageError:
        raise

def upload_file(file_bytes: bytes, dest_path: str, content_type: str, public=True) -> str:
    """
    Загружает bytes в Supabase Storage и возвращает публичный URL.
    dest_path — например "uploads/2025/uuid.jpg"
    """
    c = client()
    # supabase python storage API: storage.from_(BUCKET).upload(path, file)
    res = c.storage.from_(BUCKET).upload(dest_path, io.BytesIO(file_bytes), {"content-type": content_type})
    # проверка ошибок:
    if "error" in res and res["error"]:
        raise RuntimeError(f"Supabase upload error: {res['error']}")
    public_url = c.storage.from_(BUCKET).get_public_url(dest_path)
    return public_url.get("publicURL") if isinstance(public_url, dict) else public_url

def delete_file(dest_path: str) -> None:
    c = client()
    res = c.storage.from_(BUCKET).remove([dest_path])
    if "error" in res and res["error"]:
        logger.warning("Supabase delete error: %s", res["error"])
