# backend/blog/storages.py
"""
Supabase-aware storage backend for Django.

- Для публичного бакета Supabase выдает прямые public URL в формате:
  https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>

- Для приватного бакета fallback делается на стандартный S3Boto3Storage.url()
  (который может возвращать presigned URL, если настроено).
"""
from typing import Optional
from django.conf import settings
from storages.backends.s3boto3 import S3Boto3Storage


class SupabaseStorage(S3Boto3Storage):
    """
    Наследник S3Boto3Storage, который:
     * использует settings.AWS_STORAGE_BUCKET_NAME как имя бакета;
     * для публичных бакетов строит URL в формате Supabase public URL;
     * для приватных бакетов — вызывает родительский метод (обычно presigned URL).
    """

    # bucket_name унаследуется из настроек S3Boto3Storage, но делаем явное значение
    bucket_name = getattr(settings, "AWS_STORAGE_BUCKET_NAME", None)

    # Не навязываем старый ACL, управляем через bucket policy
    default_acl = None

    # Отключим перезапись по умолчанию чтобы сохранить уникальные имена
    file_overwrite = False

    def __init__(self, *args, **kwargs):
        # У S3Boto3Storage есть множество настроек, оставляем их дефолтными
        super().__init__(*args, **kwargs)

    def _public_base(self) -> Optional[str]:
        """
        Возвращает базовый URL проекта Supabase (без завершающего слэша),
        если он указан в settings.SUPABASE_URL.
        """
        base = getattr(settings, "SUPABASE_URL", None)
        if not base:
            return None
        return base.rstrip("/")

    def _is_public_bucket(self) -> bool:
        """
        Флаг: бакет публичный? (по умолчанию True).
        Можно переопределить в settings: SUPABASE_PUBLIC_BUCKET = False
        """
        return getattr(settings, "SUPABASE_PUBLIC_BUCKET", True)

    def url(self, name: str, expire: Optional[int] = None) -> str:
        """
        Возвращает URL для объекта:
        - Если SUPABASE_URL определён и SUPABASE_PUBLIC_BUCKET=True — строим
          public URL в формате Supabase.
        - Иначе — делегируем реализации S3Boto3Storage (signed URL / presigned).
        """
        # Нормализуем имя
        if not name:
            return super().url(name, expire)

        normalized = name.lstrip("/")

        public_base = self._public_base()
        if public_base and self._is_public_bucket() and self.bucket_name:
            # Формируем публичный URL Supabase Storage
            # Пример: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
            return f"{public_base}/storage/v1/object/public/{self.bucket_name}/{normalized}"

        # fallback на стандартный сервис (вернёт presigned URL, если настроено)
        return super().url(name, expire)
