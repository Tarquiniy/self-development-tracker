# backend/blog/storages.py
import logging
from typing import Optional
from django.conf import settings

# Оборачиваем импорт, чтобы не падать при ранней инициализации (migrations, tests)
try:
    from storages.backends.s3boto3 import S3Boto3Storage
except Exception:
    S3Boto3Storage = None

logger = logging.getLogger(__name__)


class SupabaseStorage(object):
    """
    Легковесный адаптер для использования Supabase public storage как DEFAULT_FILE_STORAGE.
    Не выполняет жёсткой инициализации boto3 при импорте проекта.
    Рекомендуется установить в settings:
        DEFAULT_FILE_STORAGE = 'blog.storages.SupabaseStorage'
    и задать SUPABASE_URL и AWS_STORAGE_BUCKET_NAME в окружении/settings.

    Поведение:
    - Если S3Boto3Storage доступен и AWS_* настройки заданы, использует его поведение как fallback.
    - Если SUPABASE_URL и бакет заданы, формирует публичный URL:
        {SUPABASE_URL}/storage/v1/object/public/{bucket}/{normalized_name}
    - В любом случае не будет вызывать исключение при импорте модуля.
    """

    def __init__(self, *args, **kwargs):
        # Отложенная инициализация реального backend'а.
        self._delegate = None
        self._delegate_initialized = False
        self._delegate_kwargs = kwargs.copy()
        # Возможность передать bucket_name напрямую
        self.bucket_name = kwargs.pop('bucket_name', None) or getattr(settings, 'AWS_STORAGE_BUCKET_NAME', None)
        self._s3_available = S3Boto3Storage is not None
        # Не вызывать super() здесь, отложим инициализацию до момента необходимости.
        # Логируем конфигурацию для дебага.
        logger.debug("SupabaseStorage initialized (lazy). bucket=%s s3_available=%s", self.bucket_name, self._s3_available)

    def _public_base(self) -> Optional[str]:
        base = getattr(settings, "SUPABASE_URL", None) or getattr(settings, "SUPABASE_PUBLIC_URL", None)
        if not base:
            return None
        return base.rstrip('/')

    def _normalize_name(self, name: str) -> str:
        if not name:
            return ''
        n = name.lstrip('/')
        if self.bucket_name and n.startswith(self.bucket_name + '/'):
            n = n[len(self.bucket_name) + 1:]
        # некоторые случаи дублирования
        n = n.replace('post_attachments/post_attachments/', 'post_attachments/')
        return n

    def _ensure_delegate(self):
        """
        Попытаться инициализировать S3Boto3Storage delegate, если это возможно и необходимо.
        Не бросает исключений.
        """
        if self._delegate_initialized:
            return
        self._delegate_initialized = True
        if not self._s3_available:
            logger.debug("S3Boto3Storage not available; will not initialize delegate.")
            return
        try:
            # Формируем kwargs с bucket_name, если надо
            init_kwargs = self._delegate_kwargs.copy()
            if 'bucket_name' not in init_kwargs and self.bucket_name:
                init_kwargs['bucket_name'] = self.bucket_name
            # lazy import/use
            self._delegate = S3Boto3Storage(**init_kwargs)
            logger.debug("SupabaseStorage delegate (S3Boto3Storage) initialized.")
        except Exception as e:
            logger.exception("Failed to initialize S3Boto3Storage delegate: %s", e)
            self._delegate = None

    # Основные методы, которые Django ожидает от storage backend
    def url(self, name: str, expire: Optional[int] = None) -> str:
        """
        Возвращает публичный URL:
        - если SUPABASE_URL + bucket настроены — построит стабильный публичный URL,
        - иначе попытается использовать delegate (S3Boto3Storage) если он инициализирован,
        - в крайнем случае вернёт нормализованный путь без протокола.
        """
        name = name or ''
        normalized = self._normalize_name(name)
        public_base = self._public_base()
        bucket = self.bucket_name or getattr(settings, 'AWS_STORAGE_BUCKET_NAME', None)
        if public_base and bucket:
            try:
                return f"{public_base}/storage/v1/object/public/{bucket}/{normalized}"
            except Exception as e:
                logger.exception("Error building supabase public url: %s", e)

        # fallback на delegate
        try:
            self._ensure_delegate()
            if self._delegate:
                # delegate.url может ожидать expire аргумент
                try:
                    return self._delegate.url(name, expire)
                except TypeError:
                    return self._delegate.url(name)
        except Exception as e:
            logger.exception("SupabaseStorage fallback delegate.url failed: %s", e)

        # последний fallback: относительный путь
        return normalized

    # Некоторые вспомогательные методы, которые Django может потребовать
    def exists(self, name):
        self._ensure_delegate()
        if self._delegate:
            try:
                return self._delegate.exists(name)
            except Exception:
                logger.exception("delegate.exists failed for %s", name)
                return False
        # Без delegate считаем, что файл может быть в внешнем публичном бакете
        return False

    def save(self, name, content, max_length=None):
        """
        Если delegate есть, пересылаем на него. Иначе пробуем сохранить через default_storage (может упасть).
        """
        self._ensure_delegate()
        if self._delegate:
            try:
                return self._delegate.save(name, content, max_length=max_length)
            except Exception:
                logger.exception("delegate.save failed for %s", name)
                raise
        raise NotImplementedError("SupabaseStorage save() not implemented when S3 backend unavailable")

    def delete(self, name):
        self._ensure_delegate()
        if self._delegate:
            try:
                return self._delegate.delete(name)
            except Exception:
                logger.exception("delegate.delete failed for %s", name)
                return False
        return False

    # Поддержка контрактов S3Boto3Storage (частичная)
    @property
    def location(self):
        try:
            self._ensure_delegate()
            if self._delegate:
                return getattr(self._delegate, 'location', '')
        except Exception:
            pass
        return ''

    # Django иногда ожидает атрибут bucket_name
    @property
    def bucket_name_attr(self):
        return self.bucket_name
