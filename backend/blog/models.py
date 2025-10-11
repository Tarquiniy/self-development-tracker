# backend/blog/models.py
from django.db import models
from django.conf import settings
from django.utils.text import slugify
from django.urls import reverse
from django.utils import timezone
from django_summernote.models import AbstractAttachment
from .storages import SupabaseStorage

class Category(models.Model):
    title = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=140, unique=True, blank=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['title']
        verbose_name_plural = "Categories"

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.title)[:120]
            slug = base
            counter = 1
            while Category.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title

    def get_absolute_url(self):
        return reverse('blog:category-detail', kwargs={'slug': self.slug})


class Tag(models.Model):
    title = models.CharField(max_length=80, unique=True)
    slug = models.SlugField(max_length=100, unique=True, blank=True)

    class Meta:
        ordering = ['title']

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.title)[:96]
            slug = base
            counter = 1
            while Tag.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title


class PostAttachment(AbstractAttachment):
    """
    File attachments for posts — can be unattached (post nullable) to support media library.
    """
    post = models.ForeignKey('Post', on_delete=models.CASCADE, related_name='attachments', null=True, blank=True)
    file = models.FileField(
        storage=SupabaseStorage(),
        upload_to="post_attachments"
    )
    title = models.CharField(max_length=255, blank=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title or self.file.name

    class Meta:
        verbose_name = "Вложение"
        verbose_name_plural = "Вложения"


class Post(models.Model):
    STATUS_CHOICES = (
        ('draft', 'Черновик'),
        ('published', 'Опубликован'),
        ('archived', 'В архиве'),
    )

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='posts'
    )
    title = models.CharField(max_length=255, verbose_name="Заголовок")
    slug = models.SlugField(max_length=300, unique=True, blank=True, db_index=True, verbose_name="URL")
    excerpt = models.TextField(blank=True, verbose_name="Краткое описание")
    content = models.TextField(verbose_name="Содержание")  # HTML content for rendering
    featured_image = models.URLField(blank=True, null=True, verbose_name="Главное изображение")
    categories = models.ManyToManyField(Category, related_name='posts', blank=True, verbose_name="Категории")
    tags = models.ManyToManyField(Tag, related_name='posts', blank=True, verbose_name="Теги")

    # SEO / metadata
    meta_title = models.CharField(max_length=255, blank=True, verbose_name="Мета-заголовок")
    meta_description = models.CharField(max_length=320, blank=True, verbose_name="Мета-описание")
    og_image = models.URLField(blank=True, verbose_name="Open Graph изображение")

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', db_index=True, verbose_name="Статус")
    published_at = models.DateTimeField(default=timezone.now, db_index=True, verbose_name="Дата публикации")

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Создан")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Обновлен")

    class Meta:
        ordering = ['-published_at']
        indexes = [
            models.Index(fields=['slug']),
            models.Index(fields=['status', 'published_at']),
        ]
        verbose_name = "Пост"
        verbose_name_plural = "Посты"

    def save(self, *args, **kwargs):
        # Auto-generate slug if missing
        if not self.slug:
            base = slugify(self.title)[:250]
            slug = base
            counter = 1
            while Post.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base}-{counter}"
                counter += 1
            self.slug = slug

        # If meta_title missing, default to title
        if not self.meta_title:
            self.meta_title = self.title

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.title} ({self.get_status_display()})"

    def get_absolute_url(self):
        return reverse('blog:post-detail', kwargs={'slug': self.slug})

    @property
    def is_published(self):
        return self.status == 'published' and self.published_at <= timezone.now()

    @property
    def reading_time(self):
        word_count = len(self.content.split())
        return max(1, round(word_count / 200))


class Comment(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='comments')
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='replies')
    name = models.CharField(max_length=120, verbose_name="Имя")
    email = models.EmailField(blank=True, null=True, verbose_name="Email")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='comments')
    content = models.TextField(verbose_name="Комментарий")
    is_public = models.BooleanField(default=True, db_index=True, verbose_name="Публичный")
    is_moderated = models.BooleanField(default=False, verbose_name="Промодерирован")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Создан")

    class Meta:
        ordering = ['created_at']
        verbose_name = "Комментарий"
        verbose_name_plural = "Комментарии"

    def __str__(self):
        return f"Комментарий к {self.post.title} от {self.name[:20]}"


class PostReaction(models.Model):
    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name='reactions',
        null=True,
        blank=True
    )
    users = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name='liked_posts')
    anon_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('post',)
        verbose_name = "Реакция"
        verbose_name_plural = "Реакции"

    def likes_count(self):
        return self.anon_count + self.users.count()

    def __str__(self):
        return f"{self.post.slug if self.post else 'unknown'} лайков={self.likes_count()}"


class PostView(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='views')
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(blank=True)
    viewed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Просмотр"
        verbose_name_plural = "Просмотры"
        indexes = [
            models.Index(fields=['post', 'viewed_at']),
        ]

    def __str__(self):
        return f"Просмотр {self.post.title}"


# ---------------------------
# Proxy model to show "Media Library" in the Blog app list of Django admin.
# This model is a proxy of PostAttachment and does not require DB schema changes.
class MediaLibrary(PostAttachment):
    class Meta:
        proxy = True
        verbose_name = "Медиа библиотека"
        verbose_name_plural = "Медиа библиотека"


class PostRevision(models.Model):
    post = models.ForeignKey('Post', related_name='revisions', on_delete=models.CASCADE)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    content = models.TextField(blank=True)   # HTML content snapshot
    title = models.CharField(max_length=300, blank=True)
    excerpt = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    autosave = models.BooleanField(default=False)
    meta = models.JSONField(default=dict, blank=True)  # optional metadata: attachments, diff summary, etc.

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['post', 'created_at']),
        ]

    def __str__(self):
        return f"Revision {self.id} for {self.post_id} @ {self.created_at.isoformat()}"