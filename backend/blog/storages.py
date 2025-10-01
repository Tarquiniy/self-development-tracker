# backend/blog/storages.py
import logging
import os
from typing import Optional
from django.conf import settings
from storages.backends.s3boto3 import S3Boto3Storage

logger = logging.getLogger(__name__)


class SupabaseStorage(S3Boto3Storage):
    """
    S3Boto3Storage wrapper for Supabase storage.
    - Uses settings AWS_* and AWS_S3_ENDPOINT_URL to connect.
    - url(name) builds robust public URL: <SUPABASE_URL>/storage/v1/object/public/<bucket>/<path>
    - It will not duplicate bucket/prefix.
    """

    def __init__(self, *args, **kwargs):
        # fallback to bucket in settings
        self.bucket_name = kwargs.pop('bucket_name', None) or getattr(settings, 'AWS_STORAGE_BUCKET_NAME', None)
        super().__init__(bucket_name=self.bucket_name, *args, **kwargs)

    def _public_base(self) -> Optional[str]:
        base = getattr(settings, "SUPABASE_URL", None)
        return base.strip().rstrip("/") if base else None

    def _normalize_name(self, name: str) -> str:
        # remove leading slashes
        return name.lstrip("/") if isinstance(name, str) else ""

    def url(self, name: str, expire: Optional[int] = None) -> str:
        """
        Return a public (Supabase) URL for the given 'name'.
        Works safely with name that may already contain bucket or 'post_attachments/' prefix.
        """
        if not name:
            try:
                return super().url(name, expire)
            except Exception:
                return ""

        normalized = self._normalize_name(name)
        public_base = self._public_base()
        bucket = self.bucket_name or getattr(settings, "AWS_STORAGE_BUCKET_NAME", None)

        # If normalized starts with 'bucket/' strip it
        if bucket and normalized.startswith(bucket + "/"):
            normalized = normalized[len(bucket) + 1 :]

        # If normalized already contains the post_attachments prefix and bucket *is* something else,
        # keep it as-is; otherwise make sure path is inside bucket.
        # Build URL when possible
        if public_base and bucket:
            return f"{public_base}/storage/v1/object/public/{bucket}/{normalized}"

        # fallback to parent
        try:
            return super().url(name, expire)
        except Exception as e:
            logger.exception("SupabaseStorage.url fallback failed for %s: %s", name, e)
            return normalized
