# backend/blog/admin.py
import os
import logging
from django import forms
from django.contrib import admin
from django.urls import reverse
from django.utils import timezone
from django.utils.safestring import mark_safe

logger = logging.getLogger(__name__)

try:
    from reversion.admin import VersionAdmin
except ImportError:
    class VersionAdmin(admin.ModelAdmin):
        pass

from .models import (
    Post, Category, Tag, Comment,
    PostReaction, PostView, PostAttachment, MediaLibrary, PostRevision
)

class PostAdminForm(forms.ModelForm):
    class Meta:
        model = Post
        fields = '__all__'
        widgets = {
            'excerpt': forms.Textarea(attrs={'rows': 3, 'placeholder': 'Краткое описание поста...'}),
            'meta_description': forms.Textarea(attrs={'rows': 2, 'placeholder': 'Мета-описание для SEO...'}),
        }

@admin.register(Post)
class PostAdmin(VersionAdmin):
    form = PostAdminForm
    change_form_template = 'admin/blog/post/change_form.html'
    
    list_display = ("title", "status_badge", "author", "published_at", "created_at")
    list_filter = ("status", "published_at", "categories", "tags", "created_at")
    search_fields = ("title", "excerpt", "content", "meta_description")
    prepopulated_fields = {"slug": ("title",)}
    date_hierarchy = "published_at"
    ordering = ("-published_at",)
    filter_horizontal = ("categories", "tags")
    actions = ["make_published", "make_draft"]
    list_per_page = 25

    # Улучшенная группировка полей
    fieldsets = (
        ("📝 Основное содержание", {
            'fields': (
                'title', 
                'slug',
                'content',
                'excerpt'
            ),
            'classes': ('grp-module', 'grp-collapse', 'grp-open')
        }),
        
        ("🖼️ Медиа", {
            'fields': (
                'featured_image',
                'og_image'
            ),
            'classes': ('grp-module', 'grp-collapse', 'grp-closed')
        }),
        
        ("🏷️ Классификация", {
            'fields': (
                'categories',
                'tags'
            ),
            'classes': ('grp-module', 'grp-collapse', 'grp-open')
        }),
        
        ("⚙️ Настройки публикации", {
            'fields': (
                'author',
                'status', 
                'published_at'
            ),
            'classes': ('grp-module', 'grp-collapse', 'grp-open')
        }),
        
        ("🔍 SEO настройки", {
            'fields': (
                'meta_title',
                'meta_description'
            ),
            'classes': ('grp-module', 'grp-collapse', 'grp-closed')
        }),
    )

    def status_badge(self, obj):
        if not obj:
            return ""
        status_colors = {
            'draft': 'orange',
            'published': 'green', 
            'archived': 'gray'
        }
        color = status_colors.get(obj.status, 'gray')
        return mark_safe(f'<span style="padding: 4px 8px; background: {color}; color: white; border-radius: 3px; font-size: 12px;">{obj.get_status_display()}</span>')
    status_badge.short_description = "Статус"

    def make_published(self, request, queryset):
        updated = queryset.update(status="published", published_at=timezone.now())
        self.message_user(request, f"{updated} постов опубликовано.")
    make_published.short_description = "Опубликовать выбранные"

    def make_draft(self, request, queryset):
        updated = queryset.update(status="draft")
        self.message_user(request, f"{updated} постов переведено в черновики.")
    make_draft.short_description = "Перевести в черновики"

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("title", "slug", "post_count", "created_at")
    prepopulated_fields = {"slug": ("title",)}
    search_fields = ("title", "description")
    list_per_page = 25

    def post_count(self, obj):
        count = obj.posts.count()
        return mark_safe(f'<span style="background: #4CAF50; color: white; padding: 2px 6px; border-radius: 10px; font-size: 12px;">{count}</span>')
    post_count.short_description = "Постов"

@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ("title", "slug", "post_count")
    prepopulated_fields = {"slug": ("title",)}
    search_fields = ("title",)
    list_per_page = 25

    def post_count(self, obj):
        count = obj.posts.count()
        return mark_safe(f'<span style="background: #2196F3; color: white; padding: 2px 6px; border-radius: 10px; font-size: 12px;">{count}</span>')
    post_count.short_description = "Постов"

@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ("name", "post_link", "short_content", "is_public", "is_moderated", "created_at")
    list_filter = ("is_public", "is_moderated", "created_at")
    search_fields = ("name", "email", "content")
    actions = ["approve_comments", "reject_comments"]
    list_per_page = 25

    def post_link(self, obj):
        if obj and obj.post:
            try:
                url = reverse('admin:blog_post_change', args=[obj.post.id])
                return mark_safe(f'<a href="{url}">{obj.post.title}</a>')
            except Exception:
                return "-"
        return "-"
    post_link.short_description = "Пост"

    def short_content(self, obj):
        content = obj.content[:100] if obj.content else ""
        if len(obj.content) > 100:
            content += "..."
        return content
    short_content.short_description = "Комментарий"

    def approve_comments(self, request, queryset):
        updated = queryset.update(is_public=True, is_moderated=True)
        self.message_user(request, f"{updated} комментариев одобрено.")
    approve_comments.short_description = "Одобрить выбранные"

    def reject_comments(self, request, queryset):
        updated = queryset.update(is_public=False)
        self.message_user(request, f"{updated} комментариев скрыто.")
    reject_comments.short_description = "Скрыть выбранные"

@admin.register(MediaLibrary)
class MediaLibraryAdmin(admin.ModelAdmin):
    list_display = ("title", "file_type", "uploaded_by", "uploaded_at", "post_link", "file_size")
    list_filter = ("uploaded_at", "uploaded_by")
    search_fields = ("title", "file")
    readonly_fields = ("file_size", "file_type")
    list_per_page = 25

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

    def post_link(self, obj):
        if obj and obj.post:
            try:
                url = reverse('admin:blog_post_change', args=[obj.post.id])
                return mark_safe(f'<a href="{url}">{obj.post.title}</a>')
            except Exception:
                return "Ошибка ссылки"
        return "Не прикреплен"
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

@admin.register(PostReaction)
class PostReactionAdmin(admin.ModelAdmin):
    list_display = ("post", "likes_count", "created_at")
    readonly_fields = ("created_at", "updated_at")
    list_per_page = 25

    def likes_count(self, obj):
        return obj.likes_count()
    likes_count.short_description = "Лайков"

@admin.register(PostView)
class PostViewAdmin(admin.ModelAdmin):
    list_display = ("post", "ip_address", "viewed_at")
    list_filter = ("viewed_at",)
    readonly_fields = ("viewed_at",)
    list_per_page = 25