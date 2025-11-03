# backend/blog/storages.py
import os
import mimetypes
import uuid
import requests
from django.core.files.storage import Storage
from django.core.files.base import ContentFile
from django.conf import settings

# Конфиг через env
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")  # https://<project>.supabase.co
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")  # service_role ключ, нужен для записи
BUCKET = os.environ.get("SUPABASE_BUCKET", "post_attachments")

if not SUPABASE_URL:
    # если не настроено, не ломаем импорт — но операции _save будут падать
    SUPABASE_URL = None

class SupabaseStorage(Storage):
    """
    Простая реализация хранения в Supabase Storage через REST API.
    Использует PUT /storage/v1/object/{bucket}/{path} чтобы задать точный ключ.
    Генерирует уникальный путь uploads/<uuid4><ext>.
    """

    def _generate_path(self, original_name):
        _, ext = os.path.splitext(original_name or "")
        # оставляем только точную hex-строку + расширение
        return f"uploads/{uuid.uuid4().hex}{ext.lower()}"

    def _save(self, name, content):
        """
        Сохраняет content в Supabase и возвращает имя/ключ (без ведущего '/').
        """
        if not SUPABASE_URL or not SERVICE_ROLE_KEY:
            raise RuntimeError("Supabase storage not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")

        # Попытка взять расширение из исходного имени файла, если оно есть
        original_name = getattr(content, "name", None) or name or "file"
        path = self._generate_path(original_name)

        # Подготовим тело и mime
        # Если content — file-like object, убедимся в начале
        try:
            content.seek(0)
        except Exception:
            pass

        data = content.read() if hasattr(content, "read") else content
        if isinstance(data, str):
            data = data.encode("utf-8")

        mimetype = mimetypes.guess_type(path)[0] or "application/octet-stream"

        put_url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}"
        headers = {
            "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
            # Supabase рекомендует также передавать apikey, но service role в Authorization достаточно
            "Content-Type": mimetype,
        }
        params = {
            "cacheControl": "max-age=86400, public"
        }

        resp = requests.put(put_url, data=data, headers=headers, params=params, timeout=30)
        # ожидаемые коды: 200/201/204
        if resp.status_code not in (200, 201, 204):
            # подробный текст для логов/диагностики
            raise RuntimeError(f"Supabase upload failed: status={resp.status_code} body={resp.text}")

        return path

    def url(self, name):
        if not SUPABASE_URL:
            raise RuntimeError("SUPABASE_URL not configured")
        # возвращаем публичный путь
        return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{name}"

    def exists(self, name):
        # не проверяем существование, считаем, что имена уникальны
        return False

    def open(self, name, mode='rb'):
        if not SUPABASE_URL:
            raise RuntimeError("SUPABASE_URL not configured")
        url = self.url(name)
        r = requests.get(url, stream=True, timeout=30)
        r.raise_for_status()
        return ContentFile(r.content)

    def get_available_name(self, name, max_length=None):
        return name
