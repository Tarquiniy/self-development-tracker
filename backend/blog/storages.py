# backend/blog/storages.py
from typing import Optional
import logging

from django.conf import settings
from storages.backends.s3boto3 import S3Boto3Storage

logger = logging.getLogger(__name__)


class SupabaseStorage(S3Boto3Storage):
    bucket_name = getattr(settings, "AWS_STORAGE_BUCKET_NAME", None)

    def _public_base(self) -> Optional[str]:
        base = getattr(settings, "SUPABASE_URL", None)
        return base.strip().rstrip("/") if base else None

    def _normalize_name(self, name: str) -> str:
        return name.lstrip("/") if isinstance(name, str) else ""

    def url(self, name: str, expire: Optional[int] = None) -> str:
        # Defensive: keep parent behaviour if no name
        if not name:
            try:
                return super().url(name, expire)
            except Exception:
                return ""

        normalized = self._normalize_name(name)
        public_base = self._public_base()
        bucket = self.bucket_name or getattr(settings, "AWS_STORAGE_BUCKET_NAME", None)

        # If normalized already starts with "<bucket>/" then strip it,
        # because Supabase expects path *inside* bucket.
        if bucket and normalized.startswith(bucket + "/"):
            normalized = normalized[len(bucket) + 1 :]

        # Build public URL when possible
        if public_base and bucket:
            # normalized is the path inside the bucket (e.g. "photo.jpg" or "2025/09/photo.jpg")
            return f"{public_base}/storage/v1/object/public/{bucket}/{normalized}"

        # Fallback to parent implementation
        try:
            return super().url(name, expire)
        except Exception as e:
            logger.exception("SupabaseStorage.url fallback failed for %s: %s", name, e)
            return normalized

__all__ = ("SupabaseStorage",)
