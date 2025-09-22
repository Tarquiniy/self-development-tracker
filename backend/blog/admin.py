from django.contrib import admin
from django.utils.html import format_html
from .models import Post, Category, Tag, Comment, PostReaction
from django_summernote.admin import SummernoteModelAdmin


@admin.register(Post)
class PostAdmin(SummernoteModelAdmin):
    list_display = ('title', 'slug', 'published_at', 'is_published', 'preview_image')
    list_filter = ('is_published', 'published_at', 'categories', 'tags')
    search_fields = ('title', 'slug', 'excerpt', 'content')
    prepopulated_fields = {"slug": ("title",)}
    summernote_fields = ('content',)
    date_hierarchy = 'published_at'
    ordering = ('-published_at',)

    fieldsets = (
        ("Основное", {
            'fields': ('title', 'slug', 'excerpt', 'content', 'featured_image', 'is_published')
        }),
        ("Категории и теги", {
            'fields': ('categories', 'tags')
        }),
        ("SEO", {
            'fields': ('meta_title', 'meta_description', 'og_image')
        }),
        ("Дата публикации", {
            'fields': ('published_at',)
        }),
    )

    filter_horizontal = ('categories', 'tags')

    def preview_image(self, obj):
        if obj.featured_image:
            return format_html('<img src="{}" style="max-height: 60px;" />', obj.featured_image.url)
        return "—"
    preview_image.short_description = "Обложка"


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('title', 'slug')
    search_fields = ('title',)
    prepopulated_fields = {"slug": ("title",)}


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ('title', 'slug')
    search_fields = ('title',)
    prepopulated_fields = {"slug": ("title",)}


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ('name', 'post', 'parent', 'created_at')
    list_filter = ('created_at', 'post')
    search_fields = ('name', 'email', 'content')
    autocomplete_fields = ('post', 'parent')


@admin.register(PostReaction)
class PostReactionAdmin(admin.ModelAdmin):
    list_display = ('post', 'likes_count', 'created_at', 'updated_at')
    search_fields = ('post__title',)
    autocomplete_fields = ('post', 'users')
