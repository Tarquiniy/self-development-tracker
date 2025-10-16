from django.db import models
from django.conf import settings
from django.utils.text import slugify

class Post(models.Model):
    STATUS_CHOICES = (('draft','Draft'),('published','Published'))
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    excerpt = models.TextField(blank=True)
    content = models.TextField()  # HTML from CKEditor5
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    featured_image = models.URLField(blank=True)
    seo_title = models.CharField(max_length=255, blank=True)
    seo_description = models.CharField(max_length=300, blank=True)
    meta = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)[:240]
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title
