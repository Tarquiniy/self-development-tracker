import os
import json
import logging
from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.shortcuts import render, redirect
from django.http import JsonResponse, Http404
from django.utils import timezone
from django.db.models import Count
from django.db.models.functions import TruncDate
from django.views.decorators.http import require_GET, require_POST
from django.utils.safestring import mark_safe

from .models import (
    Post, Category, Tag, Comment, PostReaction, PostView,
    PostAttachment, MediaLibrary
)
from django_summernote.admin import SummernoteModelAdmin
from core.admin import custom_admin_site  # ✅ импортируем наш кастомный AdminSite

logger = logging.getLogger(__name__)
CustomUser = get_user_model()


# ---------- Пользовательский админ
@admin.register(CustomUser, site=custom_admin_site)
class CustomUserAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'is_staff', 'is_active', 'date_joined')
    list_filter = ('is_staff', 'is_active', 'date_joined')
    search_fields = ('username', 'email', 'first_name', 'last_name')
    ordering = ('-date_joined',)

    class Media:
        css = {'all': ('admin/admin-modern.css',)}


# ---------- Inline для комментариев
class CommentInline(admin.TabularInline):
    model = Comment
    extra = 0
    fields = ('name', 'content', 'is_public', 'is_moderated', 'created_at')
    readonly_fields = ('created_at',)


# ---------- PostAdmin
@admin.register(Post, site=custom_admin_site)
class PostAdmin(SummernoteModelAdmin):
    change_form_template = 'admin/blog/post/change_form.html'
    summernote_fields = ('content', 'excerpt')
    list_display = ('admin_thumbnail', 'editable_title', 'editable_status', 'author', 'published_at', 'action_buttons')
    list_filter = ('status', 'published_at', 'categories', 'tags')
    search_fields = ('title', 'content', 'excerpt')
    prepopulated_fields = {'slug': ('title',)}
    date_hierarchy = 'published_at'
    ordering = ('-published_at',)
    filter_horizontal = ('categories', 'tags')

    fieldsets = (
        ('Основная информация', {'fields': ('title', 'slug', 'author', 'status', 'published_at')}),
        ('Содержание', {'fields': ('excerpt', 'content', 'featured_image')}),
        ('Категории и теги', {'fields': ('categories', 'tags')}),
        ('SEO', {'fields': ('meta_title', 'meta_description', 'og_image'), 'classes': ('collapse',)}),
    )

    inlines = [CommentInline]
    actions = ['make_published', 'make_draft', 'duplicate_post']

    def admin_thumbnail(self, obj):
        if obj.featured_image:
            return format_html(
                '<img src="{}" style="width: 56px; height: 42px; object-fit: cover; border-radius: 6px; border:1px solid #e6edf3;" />',
                obj.featured_image
            )
        return "🖼️"
    admin_thumbnail.short_description = "Изображение"

    def editable_title(self, obj):
        title = obj.title or ''
        html = format_html(
            '<input class="inline-title-input" data-post-id="{}" value="{}" />',
            obj.id,
            title.replace('"', '&quot;')
        )
        return mark_safe(html)
    editable_title.short_description = "Заголовок"
    editable_title.admin_order_field = 'title'

    def editable_status(self, obj):
        options = []
        choices = getattr(self.model, 'STATUS_CHOICES', [])
        for value, label in choices:
            selected = 'selected' if obj.status == value else ''
            options.append(f'<option value="{value}" {selected}>{label}</option>')
        select_html = f'<select class="inline-status-select" data-post-id="{obj.id}">{"".join(options)}</select>'
        return mark_safe(select_html)
    editable_status.short_description = "Статус"
    editable_status.admin_order_field = 'status'

    def action_buttons(self, obj):
        return format_html(
            '<div class="action-icons">'
            '<a href="{}" class="action-icon" title="Редактировать">✏️</a>'
            '<a href="{}" target="_blank" class="action-icon" title="Просмотреть">👁️</a>'
            '</div>',
            reverse('admin:blog_post_change', args=[obj.id]),
            obj.get_absolute_url()
        )
    action_buttons.short_description = "Действия"

    def make_published(self, request, queryset):
        updated = queryset.update(status='published')
        self.message_user(request, f"{updated} постов опубликовано.")

    def make_draft(self, request, queryset):
        updated = queryset.update(status='draft')
        self.message_user(request, f"{updated} постов переведено в черновики.")

    def duplicate_post(self, request, queryset):
        created = 0
        for post in queryset:
            old_slug = post.slug or ''
            post.pk = None
            post.slug = f"{old_slug}-copy"
            post.title = f"{post.title} (копия)"
            post.status = 'draft'
            post.save()
            created += 1
        self.message_user(request, f"Создано {created} копий постов.")

    class Media:
        css = {'all': ('admin/admin-modern.css',)}
        js = (
            'admin/admin-core.js',
            'admin/admin-post-form.js',
            'admin/admin-list-inline.js',
            'admin/media-library.js',
        )


# ---------- Остальные админы
@admin.register(Category, site=custom_admin_site)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('title', 'slug', 'post_count', 'created_at')
    search_fields = ('title', 'description')
    prepopulated_fields = {'slug': ('title',)}

    def post_count(self, obj):
        return obj.posts.count()
    post_count.short_description = "Количество постов"


@admin.register(Tag, site=custom_admin_site)
class TagAdmin(admin.ModelAdmin):
    list_display = ('title', 'slug', 'post_count')
    search_fields = ('title',)
    prepopulated_fields = {'slug': ('title',)}

    def post_count(self, obj):
        return obj.posts.count()
    post_count.short_description = "Количество постов"


@admin.register(Comment, site=custom_admin_site)
class CommentAdmin(admin.ModelAdmin):
    list_display = ('shorter_name', 'post_link', 'user', 'short_content', 'is_public', 'is_moderated', 'created_at')
    list_filter = ('is_public', 'is_moderated', 'created_at', 'post')
    search_fields = ('name', 'email', 'content', 'post__title')
    list_editable = ('is_public', 'is_moderated')

    def shorter_name(self, obj):
        return obj.name[:30]

    def post_link(self, obj):
        return format_html('<a href="{}">{}</a>',
                         reverse('admin:blog_post_change', args=[obj.post.id]),
                         obj.post.title)

    def short_content(self, obj):
        return obj.content[:100] + '...' if len(obj.content) > 100 else obj.content


@admin.register(PostReaction, site=custom_admin_site)
class PostReactionAdmin(admin.ModelAdmin):
    list_display = ('post', 'likes_count', 'users_count', 'anon_count', 'updated_at')
    search_fields = ('post__title',)

    def likes_count(self, obj):
        return obj.likes_count()

    def users_count(self, obj):
        return obj.users.count()


# ---------- MediaLibrary proxy
@admin.register(MediaLibrary, site=custom_admin_site)
class MediaLibraryAdmin(admin.ModelAdmin):
    list_display = ('title', 'uploaded_by', 'uploaded_at', 'post_link')

    def post_link(self, obj):
        if obj.post:
            return format_html('<a href="{}">{}</a>', reverse('admin:blog_post_change', args=[obj.post.id]), obj.post.title)
        return '-'

    def changelist_view(self, request, extra_context=None):
        return redirect('admin-media-library')
