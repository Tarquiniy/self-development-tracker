# backend/blog/storages.py
import logging
from typing import Optional
from django.conf import settings
from storages.backends.s3boto3 import S3Boto3Storage

logger = logging.getLogger(__name__)


class SupabaseStorage(S3Boto3Storage):
    """
    S3Boto3Storage wrapper tuned for Supabase storage.

    - Формирует публичный URL вида:
      https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
    - Аккуратно убирает дублирование "bucket/" или "post_attachments/" при построении URL.
    """

    def __init__(self, *args, **kwargs):
        # allow passing bucket_name explicitly or fallback to settings
        self.bucket_name = kwargs.pop('bucket_name', None) or getattr(settings, 'AWS_STORAGE_BUCKET_NAME', None)
        # ensure parent init gets the bucket_name
        super().__init__(bucket_name=self.bucket_name, *args, **kwargs)

    def _public_base(self) -> Optional[str]:
        base = getattr(settings, "SUPABASE_URL", None)
        if not base:
            return None
        return base.rstrip('/')

    def _normalize_name(self, name: str) -> str:
        if not name:
            return ''
        # remove leading slash
        n = name.lstrip('/')
        # If name accidentally contains bucket prefix, strip it
        if self.bucket_name and n.startswith(self.bucket_name + '/'):
            n = n[len(self.bucket_name) + 1:]
        # Normalize double 'post_attachments/post_attachments' -> 'post_attachments/...'
        n = n.replace('post_attachments/post_attachments/', 'post_attachments/')
        return n

    def url(self, name: str, expire: Optional[int] = None) -> str:
        """
        Return public Supabase URL for 'name' when SUPABASE_URL + bucket available.
        Fallback to parent S3Boto3Storage.url() when not.
        """
        try:
            if not name:
                return super().url(name, expire)
        except Exception:
            # parent might throw if name falsy — fall through
            pass

        try:
            normalized = self._normalize_name(name)
            public_base = self._public_base()
            bucket = self.bucket_name or getattr(settings, 'AWS_STORAGE_BUCKET_NAME', None)
            if public_base and bucket:
                # Build the canonical Supabase public URL
                return f"{public_base}/storage/v1/object/public/{bucket}/{normalized}"
        except Exception as e:
            logger.exception("SupabaseStorage.url build error: %s", e)

        # fallback: try parent implementation (may produce presigned URL)
        try:
            return super().url(name, expire)
        except Exception as e:
            logger.exception("SupabaseStorage.url fallback failed for %s: %s", name, e)
            # final fallback: return normalized path (not a URL) to avoid crash
            return normalized
