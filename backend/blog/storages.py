# backend/blog/storages.py
"""
Supabase-aware storage backend for Django (2025-ready).

This storage subclasses S3Boto3Storage (from django-storages) and provides a
clean, deterministic public URL for objects stored in a *public* Supabase
bucket. For private buckets it falls back to the parent S3Boto3Storage.url()
which may produce presigned URLs if configured.

Usage (settings.py):

    SUPABASE_URL = "https://<project>.supabase.co"
    AWS_STORAGE_BUCKET_NAME = "post_attachments"  # your supabase bucket name
    SUPABASE_PUBLIC_BUCKET = True  # whether the bucket is public (default True)
    DEFAULT_FILE_STORAGE = "backend.blog.storages.SupabaseStorage"

Notes:
 - When SUPABASE_PUBLIC_BUCKET is True we return direct public URLs in the
   format:
       https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
 - If the Supabase settings are missing or the bucket marked as private we
   fallback to S3Boto3Storage.url(name) behaviour.

The implementation is defensive and logs useful warnings instead of raising
errors in production.
"""
from typing import Optional
import logging

from django.conf import settings
from storages.backends.s3boto3 import S3Boto3Storage

logger = logging.getLogger(__name__)


class SupabaseStorage(S3Boto3Storage):
    """Supabase-aware storage backend.

    Inherits from S3Boto3Storage so that all standard S3 features (upload,
    delete, presigned urls, etc.) remain available. When configured for a
    public Supabase bucket it returns direct public URLs which don't expire.
    """

    # sensible defaults — can be overridden in settings
    bucket_name = getattr(settings, "AWS_STORAGE_BUCKET_NAME", None)
    default_acl = None
    file_overwrite = False

    def _public_base(self) -> Optional[str]:
        """Return SUPABASE_URL without trailing slash, or None if not configured."""
        base = getattr(settings, "SUPABASE_URL", None)
        if not base:
            return None
        # strip whitespace and trailing slash
        return base.strip().rstrip("/")

    def _is_public_bucket(self) -> bool:
        """Whether we should treat the configured bucket as public.

        Default: True (to preserve previous behaviour). Override with
        SUPABASE_PUBLIC_BUCKET = False in settings to force fallback to
        S3Boto3Storage behaviour.
        """
        return bool(getattr(settings, "SUPABASE_PUBLIC_BUCKET", True))

    @staticmethod
    def _normalize_name(name: str) -> str:
        # Remove any leading slashes to avoid double-slashes in URLs
        return name.lstrip("/") if isinstance(name, str) else ""

    def url(self, name: str, expire: Optional[int] = None) -> str:
        """Return a URL for the given storage object name.

        If Supabase public base and public bucket are configured, build a
        direct public URL. Otherwise fall back to the S3Boto3Storage.url()
        behaviour (which may return presigned URLs).
        """
        if not name:
            # name empty or None — delegate to parent (keeps behaviour consistent)
            try:
                return super().url(name, expire)
            except Exception:
                # last resort — return empty string
                logger.debug("SupabaseStorage.url called with empty name")
                return ""

        normalized = self._normalize_name(name)
        public_base = self._public_base()

        # If we have everything required to build a public Supabase URL — do it
        if public_base and self._is_public_bucket() and self.bucket_name:
            try:
                # Example:
                # https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
                return f"{public_base}/storage/v1/object/public/{self.bucket_name}/{normalized}"
            except Exception as e:
                # In the unlikely case string formatting fails — log and fallback
                logger.exception("Error building Supabase public URL for %s: %s", name, e)

        # Fallback to parent implementation (may raise if misconfigured)
        try:
            return super().url(name, expire)
        except Exception as e:
            # As a defensive last resort, try to use MEDIA_URL if available
            media_url = getattr(settings, "MEDIA_URL", None)
            if media_url:
                try:
                    media_base = str(media_url).rstrip("/")
                    return f"{media_base}/{normalized}"
                except Exception:
                    logger.exception("Fallback building MEDIA_URL for %s failed", name)
            # Log and return normalized path to avoid crashing admin UI
            logger.exception("SupabaseStorage.url: fallback failed for %s: %s", name, e)
            return f"{normalized}"


__all__ = ("SupabaseStorage",)
