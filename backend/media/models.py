import os
import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone
from .supabase_storage import upload_file, delete_file, _generate_thumbnail_bytes, THUMB_PREFIX

def _make_path(prefix: str, filename: str) -> str:
    return f"{prefix.rstrip('/')}/{filename}"

def _random_filename(original_name: str) -> str:
    ext = os.path.splitext(original_name)[1].lower()
    return f"{uuid.uuid4().hex}{ext or '.jpg'}"

class MediaFile(models.Model):
    """
    Хранилище медиафайлов (только изображения).
    Файлы и их thumbnails лежат в Supabase Storage.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    original_filename = models.CharField(max_length=512)
    supabase_path = models.CharField(max_length=1024, help_text="Путь внутри bucket (например uploads/2025/..)")
    supabase_url = models.URLField(max_length=2048)
    thumbnail_path = models.CharField(max_length=1024, blank=True, null=True)
    thumbnail_url = models.URLField(max_length=2048, blank=True, null=True)
    content_type = models.CharField(max_length=100)
    size = models.PositiveIntegerField()
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Медиафайл"
        verbose_name_plural = "Медиафайлы"

    def __str__(self):
        return f"{self.original_filename} ({self.id})"

    @classmethod
    def create_from_bytes(cls, file_bytes: bytes, filename: str, content_type: str,
                          uploaded_by=None, prefix="uploads") -> "MediaFile":
        """
        Загружает файл в Supabase и создает запись + thumbnail.
        """
        name = _random_filename(filename)
        path = _make_path(prefix, name)
        # загрузка оригинала
        public_url = upload_file(file_bytes, path, content_type)

        # генерим thumbnail
        thumb_bytes, w, h = _generate_thumbnail_bytes(file_bytes)
        thumb_name = _random_filename(filename)
        thumb_path = _make_path(THUMB_PREFIX.rstrip('/'), thumb_name)
        thumb_url = upload_file(thumb_bytes, thumb_path, "image/jpeg")

        obj = cls.objects.create(
            original_filename=filename,
            supabase_path=path,
            supabase_url=public_url,
            thumbnail_path=thumb_path,
            thumbnail_url=thumb_url,
            content_type=content_type,
            size=len(file_bytes),
            width=w,
            height=h,
            uploaded_by=uploaded_by
        )
        return obj

    def delete(self, using=None, keep_parents=False):
        # удаляем файлы из storage
        try:
            if self.supabase_path:
                delete_file(self.supabase_path)
            if self.thumbnail_path:
                delete_file(self.thumbnail_path)
        except Exception:
            # не падаем при проблемах со storage
            pass
        super().delete(using=using, keep_parents=keep_parents)
