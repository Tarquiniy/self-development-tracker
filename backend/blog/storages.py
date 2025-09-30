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
    Хранилище для Supabase через S3Boto3Storage:
     * имя бакета берём из settings.AWS_STORAGE_BUCKET_NAME;
     * если бакет публичный — строим прямой public URL Supabase;
     * если приватный — используем стандартный presigned URL.
    """

    bucket_name = getattr(settings, "AWS_STORAGE_BUCKET_NAME", None)
    default_acl = None
    file_overwrite = False

    def _public_base(self) -> Optional[str]:
        """
        Возвращает базовый URL Supabase (без завершающего /).
        """
        base = getattr(settings, "SUPABASE_URL", None)
        return base.rstrip("/") if base else None

    def _is_public_bucket(self) -> bool:
        """
        По умолчанию считаем бакет публичным, если явно не указано иное.
        """
        return getattr(settings, "SUPABASE_PUBLIC_BUCKET", True)

    def url(self, name: str, expire: Optional[int] = None) -> str:
        """
        Возвращает URL для объекта в бакете Supabase.
        """
        if not name:
            return super().url(name, expire)

        normalized = name.lstrip("/")

        public_base = self._public_base()
        if public_base and self._is_public_bucket() and self.bucket_name:
            # Прямой public URL (без двойного добавления bucket или upload_to)
            return f"{public_base}/storage/v1/object/public/{self.bucket_name}/{normalized}"

        # fallback — стандартное поведение S3Boto3Storage
        return super().url(name, expire)
