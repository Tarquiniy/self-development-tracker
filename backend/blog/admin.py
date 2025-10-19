# backend/blog/admin.py
import os
import json
import logging
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
            'excerpt': forms.Textarea(attrs={'rows': 3, 'placeholder': 'Краткое описание поста...'}),
            'meta_description': forms.Textarea(attrs={'rows': 2, 'placeholder': 'Мета-описание для SEO...'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Add CSS classes for styling
        self.fields['title'].widget.attrs.update({
            'class': 'post-title-field',
            'placeholder': 'Введите заголовок поста...'
        })
        self.fields['slug'].widget.attrs.update({
            'class': 'post-slug-field',
            'placeholder': 'url-slug...'
        })

# -----------------------
# Enhanced Admin Classes
# -----------------------
class BasePostAdmin(VersionAdmin):
    form = PostAdminForm
    change_form_template = 'admin/blog/post/change_form_modern.html'

    # Modern list display
    list_display = ("title", "status_badge", "author", "published_at", "reading_time_display", "actions_column")
    list_filter = ("status", "published_at", "categories", "tags") if Post is not None else ()
    search_fields = ("title", "excerpt", "content", "meta_description")
    prepopulated_fields = {"slug": ("title",)} if Post is not None else {}
    date_hierarchy = "published_at"
    ordering = ("-published_at",)
    filter_horizontal = ("categories", "tags") if Post is not None else ()
    actions = ["make_published", "make_draft", "duplicate_post", "update_seo_meta"]

    # Enhanced fieldsets with better grouping
    fieldsets = (
        ("Основное содержание", {
            'fields': ('title', 'slug', 'content', 'excerpt'),
            'classes': ('main-content',)
        }),
        ("Визуальные элементы", {
            'fields': ('featured_image', 'og_image'),
            'classes': ('visual-elements', 'collapse')
        }),
        ("Классификация", {
            'fields': ('categories', 'tags'),
            'classes': ('classification',)
        }),
        ("Настройки публикации", {
            'fields': ('author', 'status', 'published_at'),
            'classes': ('publication-settings',)
        }),
        ("SEO оптимизация", {
            'fields': ('meta_title', 'meta_description'),
            'classes': ('seo-settings', 'collapse')
        }),
    )

    def status_badge(self, obj):
        if not obj:
            return ""
        status_colors = {
            'draft': 'gray',
            'published': 'green',
            'archived': 'orange'
        }
        color = status_colors.get(obj.status, 'gray')
        return mark_safe(f'<span class="status-badge status-{color}">{obj.get_status_display()}</span>')
    status_badge.short_description = "Статус"
    status_badge.admin_order_field = 'status'

    def reading_time_display(self, obj):
        if not obj:
            return "0 мин"
        return f"{obj.reading_time} мин"
    reading_time_display.short_description = "Время чтения"

    def actions_column(self, obj):
        if not obj:
            return ""
        return mark_safe(f'''
            <div class="action-buttons">
                <a href="{reverse('admin:blog_post_change', args=[obj.id])}" class="button edit-btn">✏️</a>
                <a href="{obj.get_absolute_url() if hasattr(obj, 'get_absolute_url') else '#'}" target="_blank" class="button view-btn">👁️</a>
            </div>
        ''')
    actions_column.short_description = "Действия"

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
        self.message_user(request, f"Создано {created} копий.")
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


class CategoryAdmin(admin.ModelAdmin):
    list_display = ("title", "slug", "post_count", "created_at")
    prepopulated_fields = {"slug": ("title",)}
    search_fields = ("title", "description")

    def post_count(self, obj):
        if not obj:
            return 0
        count = obj.posts.count() if hasattr(obj, 'posts') else 0
        return mark_safe(f'<span class="badge">{count}</span>')
    post_count.short_description = "Постов"


class TagAdmin(admin.ModelAdmin):
    list_display = ("title", "slug", "post_count")
    prepopulated_fields = {"slug": ("title",)}
    search_fields = ("title",)

    def post_count(self, obj):
        if not obj:
            return 0
        count = obj.posts.count() if hasattr(obj, 'posts') else 0
        return mark_safe(f'<span class="badge">{count}</span>')
    post_count.short_description = "Постов"


class CommentAdmin(admin.ModelAdmin):
    list_display = ("author_name", "post_link", "short_content", "status_badges", "created_at")
    list_filter = ("is_public", "is_moderated", "created_at")
    search_fields = ("name", "email", "content")
    actions = ["approve_comments", "reject_comments"]

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
            badges.append('<span class="badge badge-green">Public</span>')
        else:
            badges.append('<span class="badge badge-gray">Hidden</span>')
        if obj.is_moderated:
            badges.append('<span class="badge badge-blue">Moderated</span>')
        return mark_safe(" ".join(badges))
    status_badges.short_description = "Статус"

    def approve_comments(self, request, queryset):
        updated = queryset.update(is_public=True, is_moderated=True)
        self.message_user(request, f"{updated} комментариев одобрено.")
    approve_comments.short_description = "✅ Одобрить выбранные"

    def reject_comments(self, request, queryset):
        updated = queryset.update(is_public=False)
        self.message_user(request, f"{updated} комментариев скрыто.")
    reject_comments.short_description = "❌ Скрыть выбранные"


# -----------------------
# Media Library Enhancements
# -----------------------
class MediaLibraryAdmin(admin.ModelAdmin):
    list_display = ("thumbnail", "title", "file_type", "uploaded_by", "uploaded_at_display", "post_link", "file_size")
    list_filter = ("uploaded", "uploaded_by")  # Используем реальное поле 'uploaded'
    search_fields = ("title", "file")
    readonly_fields = ("file_size", "file_type", "uploaded_at_display")  # Убрали uploaded_at, добавили свойство

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
        """Отображение uploaded_at для readonly_fields"""
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


class PostRevisionAdmin(admin.ModelAdmin):
    list_display = ("post", "author", "created_at", "autosave")
    list_filter = ("created_at", "autosave")
    search_fields = ("post__title", "title", "content")
    readonly_fields = ("created_at",)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


# -----------------------
# Registration
# -----------------------
def register_admin_models(site_obj):
    """
    Register all admin models into provided admin site.
    """
    try:
        if Post is not None:
            site_obj.register(Post, BasePostAdmin)
        if Category is not None:
            site_obj.register(Category, CategoryAdmin)
        if Tag is not None:
            site_obj.register(Tag, TagAdmin)
        if Comment is not None:
            site_obj.register(Comment, CommentAdmin)
        if PostReaction is not None:
            site_obj.register(PostReaction)
        if PostView is not None:
            site_obj.register(PostView)
        if PostRevision is not None:
            site_obj.register(PostRevision, PostRevisionAdmin)

        if PostAttachment is not None:
            site_obj.register(MediaLibrary, MediaLibraryAdmin)

    except Exception as e:
        logger.exception("Admin registration failed: %s", e)

    return True


# Auto-register with default admin site
try:
    if Post is not None:
        admin.site.register(Post, BasePostAdmin)
    if Category is not None:
        admin.site.register(Category, CategoryAdmin)
    if Tag is not None:
        admin.site.register(Tag, TagAdmin)
    if Comment is not None:
        admin.site.register(Comment, CommentAdmin)
    if MediaLibrary is not None:
        admin.site.register(MediaLibrary, MediaLibraryAdmin)
    if PostRevision is not None:
        admin.site.register(PostRevision, PostRevisionAdmin)
except AlreadyRegistered:
    pass
except Exception as e:
    logger.exception("Default admin registration failed: %s", e)