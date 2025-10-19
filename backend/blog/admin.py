# backend/blog/admin.py
import os
import json
import logging
from pyexpat.errors import messages
from django import forms
from django.contrib import admin
from django.contrib.admin.sites import AlreadyRegistered
from django.urls import reverse, path
from django.shortcuts import render, redirect
from django.http import JsonResponse, Http404
from django.utils import timezone
from django.views.decorators.http import require_http_methods, require_POST, require_GET
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.core import signing
from django.contrib.auth import get_user_model
from django.db.models.functions import TruncDate
from django.db.models import Count
from django.db import models
from django.utils.safestring import mark_safe
from django.utils.html import escape
from django.template.loader import render_to_string

logger = logging.getLogger(__name__)

# Optional reversion support
try:
    import reversion
    from reversion.admin import VersionAdmin
except Exception:
    reversion = None
    class VersionAdmin(admin.ModelAdmin):
        pass

# Import models
try:
    from .models import (
        Post, Category, Tag, Comment,
        PostReaction, PostView, PostAttachment, MediaLibrary, PostRevision
    )
except Exception as e:
    logger.exception("Could not import blog.models: %s", e)
    Post = Category = Tag = Comment = PostReaction = PostView = PostAttachment = MediaLibrary = PostRevision = None

CustomUser = get_user_model()
PREVIEW_SALT = "post-preview-salt"

# -----------------------
# Custom Admin Form with Enhanced UX
# -----------------------
class PostAdminForm(forms.ModelForm):
    class Meta:
        model = Post
        fields = '__all__'
        widgets = {
            'excerpt': forms.Textarea(attrs={
                'rows': 4, 
                'placeholder': 'Краткое описание поста, которое будет отображаться в списках и превью...',
                'class': 'modern-textarea'
            }),
            'meta_description': forms.Textarea(attrs={
                'rows': 3,
                'placeholder': 'Описание для поисковых систем. Рекомендуется 150-160 символов...',
                'class': 'modern-textarea'
            }),
            'title': forms.TextInput(attrs={
                'class': 'modern-input',
                'placeholder': 'Введите заголовок поста...'
            }),
            'slug': forms.TextInput(attrs={
                'class': 'modern-input slug-field',
                'placeholder': 'url-slug...'
            }),
            'featured_image': forms.URLInput(attrs={
                'class': 'modern-input',
                'placeholder': 'https://example.com/image.jpg'
            }),
            'og_image': forms.URLInput(attrs={
                'class': 'modern-input',
                'placeholder': 'https://example.com/og-image.jpg'
            }),
            'meta_title': forms.TextInput(attrs={
                'class': 'modern-input',
                'placeholder': 'Мета-заголовок для SEO...'
            }),
            'status': forms.Select(attrs={'class': 'modern-select'}),
            'author': forms.Select(attrs={'class': 'modern-select'}),
            'published_at': forms.DateTimeInput(attrs={
                'type': 'datetime-local',
                'class': 'modern-datetime'
            }),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Добавляем помощь для полей
        self.fields['excerpt'].help_text = 'Краткое описание, отображаемое в превью поста'
        self.fields['meta_description'].help_text = 'Для лучшего SEO старайтесь уложиться в 150-160 символов'
        self.fields['slug'].help_text = 'Человеко-понятный URL. Оставьте пустым для автоматического создания'
        self.fields['featured_image'].help_text = 'URL главного изображения поста'
        self.fields['og_image'].help_text = 'URL изображения для социальных сетей'

# -----------------------
# Enhanced Admin Classes
# -----------------------
@admin.register(Post)
class PostAdmin(VersionAdmin):
    form = PostAdminForm
    change_form_template = 'admin/blog/post/change_form.html'
    
    # Modern list display
    list_display = ("title", "status_badge", "author", "published_at", "reading_time_display", "created_at")
    list_filter = ("status", "published_at", "categories", "tags", "created_at")
    search_fields = ("title", "excerpt", "content", "meta_description")
    prepopulated_fields = {"slug": ("title",)}
    date_hierarchy = "published_at"
    ordering = ("-published_at",)
    filter_horizontal = ("categories", "tags")
    actions = ["make_published", "make_draft", "update_seo_meta"]
    list_per_page = 25

    # Enhanced fieldsets with better grouping
    fieldsets = (
        ("Основное содержание", {
            'fields': ('title', 'slug', 'content', 'excerpt'),
            'classes': ('wide', 'main-content')
        }),
        ("Визуальные элементы", {
            'fields': ('featured_image', 'og_image'),
            'classes': ('collapse', 'visual-elements')
        }),
        ("Классификация", {
            'fields': ('categories', 'tags'),
            'classes': ('wide', 'classification')
        }),
        ("Настройки публикации", {
            'fields': ('author', 'status', 'published_at'),
            'classes': ('wide', 'publication-settings')
        }),
        ("SEO оптимизация", {
            'fields': ('meta_title', 'meta_description'),
            'classes': ('collapse', 'seo-settings')
        }),
    )

    def status_badge(self, obj):
        if not obj:
            return ""
        status_colors = {
            'draft': 'draft',
            'published': 'published',
            'archived': 'archived'
        }
        color = status_colors.get(obj.status, 'draft')
        return mark_safe(f'<span class="status-badge status-{color}">{obj.get_status_display()}</span>')
    status_badge.short_description = "Статус"
    status_badge.admin_order_field = 'status'

    def reading_time_display(self, obj):
        if not obj:
            return "0 мин"
        return f"{obj.reading_time} мин"
    reading_time_display.short_description = "Время чтения"

    def make_published(self, request, queryset):
        updated = queryset.update(status="published", published_at=timezone.now())
        self.message_user(request, f"{updated} постов опубликовано.")
    make_published.short_description = "📢 Опубликовать выбранные"

    def make_draft(self, request, queryset):
        updated = queryset.update(status="draft")
        self.message_user(request, f"{updated} постов переведено в черновики.")
    make_draft.short_description = "📝 Перевести в черновики"

    def duplicate_post(self, request, queryset):
        created = 0
        for p in queryset:
            old_slug = getattr(p, "slug", "") or ""
            p.pk = None
            p.slug = f"{old_slug}-copy"
            p.title = f"{getattr(p, 'title', '')} (копия)"
            p.status = "draft"
            try:
                p.save()
                created += 1
            except Exception as e:
                logger.error("Error duplicating post: %s", e)
        self.message_user(request, f"Создано {created} копий.", messages.SUCCESS)
    duplicate_post.short_description = "🔁 Создать копии"

    def update_seo_meta(self, request, queryset):
        updated = 0
        for post in queryset:
            if not post.meta_title:
                post.meta_title = post.title
                try:
                    post.save()
                    updated += 1
                except Exception as e:
                    logger.error("Error updating SEO meta: %s", e)
        self.message_user(request, f"SEO мета-заголовки обновлены для {updated} постов")
    update_seo_meta.short_description = "🔍 Обновить SEO мета-данные"

    def change_view(self, request, object_id=None, form_url='', extra_context=None):
        extra_context = extra_context or {}
        extra_context['show_preview'] = True
        return super().change_view(request, object_id, form_url, extra_context=extra_context)

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("title", "slug", "post_count", "created_at")
    prepopulated_fields = {"slug": ("title",)}
    search_fields = ("title", "description")
    list_per_page = 25

    def post_count(self, obj):
        if not obj:
            return 0
        count = obj.posts.count() if hasattr(obj, 'posts') else 0
        return mark_safe(f'<span class="badge badge-info">{count}</span>')
    post_count.short_description = "Постов"

@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ("title", "slug", "post_count")
    prepopulated_fields = {"slug": ("title",)}
    search_fields = ("title",)
    list_per_page = 25

    def post_count(self, obj):
        if not obj:
            return 0
        count = obj.posts.count() if hasattr(obj, 'posts') else 0
        return mark_safe(f'<span class="badge badge-info">{count}</span>')
    post_count.short_description = "Постов"

@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ("author_name", "post_link", "short_content", "status_badges", "created_at")
    list_filter = ("is_public", "is_moderated", "created_at")
    search_fields = ("name", "email", "content")
    actions = ["approve_comments", "reject_comments"]
    list_per_page = 25

    def author_name(self, obj):
        if not obj:
            return "-"
        return obj.name or f"User #{obj.user_id}" if obj.user else "Anonymous"
    author_name.short_description = "Автор"

    def post_link(self, obj):
        try:
            if not obj or not obj.post:
                return "-"
            url = reverse('admin:blog_post_change', args=[obj.post.id])
            return mark_safe(f'<a href="{url}">{obj.post.title}</a>')
        except Exception:
            return "-"
    post_link.short_description = "Пост"

    def short_content(self, obj):
        if not obj:
            return ""
        content = obj.content[:100] if obj.content else ""
        if len(obj.content) > 100:
            content += "..."
        return content
    short_content.short_description = "Комментарий"

    def status_badges(self, obj):
        if not obj:
            return ""
        badges = []
        if obj.is_public:
            badges.append('<span class="badge badge-success">Public</span>')
        else:
            badges.append('<span class="badge badge-secondary">Hidden</span>')
        if obj.is_moderated:
            badges.append('<span class="badge badge-info">Moderated</span>')
        return mark_safe(" ".join(badges))
    status_badges.short_description = "Статус"

    def approve_comments(self, request, queryset):
        updated = queryset.update(is_public=True, is_moderated=True)
        self.message_user(request, f"{updated} комментариев одобрено.", messages.SUCCESS)
    approve_comments.short_description = "✅ Одобрить выбранные"

    def reject_comments(self, request, queryset):
        updated = queryset.update(is_public=False)
        self.message_user(request, f"{updated} комментариев скрыто.", messages.SUCCESS)
    reject_comments.short_description = "❌ Скрыть выбранные"

# -----------------------
# Media Library Enhancements
# -----------------------
@admin.register(MediaLibrary)
class MediaLibraryAdmin(admin.ModelAdmin):
    list_display = ("thumbnail", "title", "file_type", "uploaded_by", "uploaded_at_display", "post_link", "file_size")
    list_filter = ("uploaded", "uploaded_by")
    search_fields = ("title", "file")
    readonly_fields = ("file_size", "file_type", "uploaded_at_display")
    list_per_page = 25

    def thumbnail(self, obj):
        if not obj or not obj.file:
            return "📄"
        if obj.file.name.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp')):
            try:
                url = obj.file.url
                return mark_safe(f'<img src="{url}" style="width: 50px; height: 50px; object-fit: cover;" />')
            except Exception:
                return "🖼️"
        return "📄"
    thumbnail.short_description = ""

    def file_type(self, obj):
        if not obj or not obj.file:
            return "📄"
        ext = os.path.splitext(obj.file.name)[1].lower()
        type_icons = {
            '.jpg': '🖼️', '.jpeg': '🖼️', '.png': '🖼️', '.gif': '🖼️', '.webp': '🖼️',
            '.pdf': '📕', '.doc': '📘', '.docx': '📘',
            '.mp4': '🎥', '.mov': '🎥', '.avi': '🎥',
        }
        return type_icons.get(ext, '📄')
    file_type.short_description = "Тип"

    def file_size(self, obj):
        try:
            if not obj or not obj.file:
                return "N/A"
            size = obj.file.size
            for unit in ['B', 'KB', 'MB', 'GB']:
                if size < 1024.0:
                    return f"{size:.1f} {unit}"
                size /= 1024.0
            return f"{size:.1f} TB"
        except Exception:
            return "N/A"
    file_size.short_description = "Размер"

    def uploaded_at_display(self, obj):
        if not obj:
            return ""
        return obj.uploaded_at
    uploaded_at_display.short_description = "Дата загрузки"

    def post_link(self, obj):
        if obj and obj.post:
            try:
                url = reverse('admin:blog_post_change', args=[obj.post.id])
                return mark_safe(f'<a href="{url}">{obj.post.title}</a>')
            except Exception:
                return mark_safe('<span class="text-muted">Ошибка ссылки</span>')
        return mark_safe('<span class="text-muted">Не прикреплен</span>')
    post_link.short_description = "Пост"

@admin.register(PostRevision)
class PostRevisionAdmin(admin.ModelAdmin):
    list_display = ("post", "author", "created_at", "autosave")
    list_filter = ("created_at", "autosave")
    search_fields = ("post__title", "title", "content")
    readonly_fields = ("created_at",)
    list_per_page = 25

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

# Регистрация остальных моделей
admin.site.register(PostReaction)
admin.site.register(PostView)