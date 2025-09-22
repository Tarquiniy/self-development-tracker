from django.contrib import admin
from django.utils.html import format_html
from django.urls import path
from django.shortcuts import render
from django.http import JsonResponse
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django import forms
from django.forms import widgets
from import_export import resources
from import_export.admin import ImportExportModelAdmin
from django.contrib.auth import get_user_model
from django_summernote.admin import SummernoteModelAdmin
from django_summernote.models import AbstractAttachment

from .models import Post, Category, Tag, Comment, PostReaction, PostAttachment

CustomUser = get_user_model()

# --------------------------
# Ресурсы для импорта/экспорта
# --------------------------
class PostResource(resources.ModelResource):
    class Meta:
        model = Post
        fields = ('id', 'title', 'slug', 'excerpt', 'content', 'status', 'published_at', 'author__username')
        export_order = fields

class CategoryResource(resources.ModelResource):
    class Meta:
        model = Category
        fields = ('id', 'title', 'slug', 'description')

# --------------------------
# Кастомный виджет для выбора медиа
# --------------------------
class MediaSelectorWidget(widgets.Widget):
    def render(self, name, value, attrs=None, renderer=None):
        html = f'''
        <div class="media-selector-widget">
            <input type="url" name="{name}" value="{value or ''}" id="{attrs['id']}" 
                   class="vURLField" placeholder="URL изображения или выберите из медиатеки">
            <button type="button" class="button media-selector-btn" onclick="openMediaSelector('{attrs['id']}')">
                Выбрать из медиатеки
            </button>
            <div class="media-preview" id="{attrs['id']}_preview">
                {f'<img src="{value}" style="max-height: 100px; margin-top: 10px;" />' if value else ''}
            </div>
        </div>
        '''
        return format_html(html)

# --------------------------
# Админ-форма для Post
# --------------------------
class PostAdminForm(forms.ModelForm):
    class Meta:
        model = Post
        fields = '__all__'
        widgets = {
            'featured_image': MediaSelectorWidget,
            'og_image': MediaSelectorWidget,
        }

# --------------------------
# Админка пользователей
# --------------------------
@admin.register(CustomUser)
class CustomUserAdmin(ImportExportModelAdmin, admin.ModelAdmin):
    resource_class = None
    search_fields = ['username', 'email', 'first_name', 'last_name']
    list_display = ('username', 'email', 'first_name', 'last_name', 'is_staff', 'is_active', 'date_joined')
    list_filter = ('is_staff', 'is_active', 'date_joined', 'registration_method')
    ordering = ('-date_joined',)
    readonly_fields = ('date_joined', 'last_login')
    fieldsets = (
        (None, {'fields': ('username', 'email', 'password')}),
        ('Персональная информация', {'fields': ('first_name', 'last_name')}),
        ('Права доступа', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Важные даты', {'fields': ('last_login', 'date_joined')}),
    )

    class Media:
        css = {'all': ('admin/css/admin-custom.css',)}
        js = ('admin/js/admin-custom.js',)

# --------------------------
# Админка постов
# --------------------------
@admin.register(Post)
class PostAdmin(ImportExportModelAdmin, SummernoteModelAdmin):
    form = PostAdminForm
    resource_class = PostResource
    summernote_fields = ('content', 'excerpt')

    list_display = ('admin_thumbnail', 'title_display', 'author_display', 'status_badge',
                    'published_date', 'categories_display', 'actions')
    list_display_links = ('title_display',)
    list_filter = ('status', 'published_at', 'created_at', 'categories', 'tags')
    search_fields = ('title', 'content', 'excerpt', 'slug')
    prepopulated_fields = {"slug": ("title",)}
    date_hierarchy = 'published_at'
    ordering = ('-published_at',)
    filter_horizontal = ('categories', 'tags')
    readonly_fields = ('created_at', 'updated_at', 'view_count')

    fieldsets = (
        ('Основная информация', {'fields': ('title', 'slug', 'author', 'status', 'published_at')}),
        ('Содержание', {'fields': ('excerpt', 'content')}),
        ('Медиа', {'fields': ('featured_image', 'og_image'), 'classes': ('collapse',)}),
        ('Таксономия', {'fields': ('categories', 'tags'), 'classes': ('collapse',)}),
        ('SEO настройки', {'fields': ('meta_title', 'meta_description'), 'classes': ('collapse',)}),
        ('Статистика', {'fields': ('view_count', 'created_at', 'updated_at'), 'classes': ('collapse',)}),
    )

    actions = ['make_published', 'make_draft', 'duplicate_posts']

    def admin_thumbnail(self, obj):
        if obj.featured_image:
            return format_html(
                '<img src="{}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px;" />',
                obj.featured_image
            )
        return "📷"
    admin_thumbnail.short_description = "Изображение"

    def title_display(self, obj):
        status_color = {'published': 'green', 'draft': 'orange'}.get(obj.status, 'gray')
        return format_html(
            '<strong>{}</strong><br><small style="color: {};">{}</small>',
            obj.title, status_color, obj.get_status_display()
        )
    title_display.short_description = "Заголовок и статус"

    def author_display(self, obj):
        return obj.author.username if obj.author else "Не указан"
    author_display.short_description = "Автор"

    def status_badge(self, obj):
        color = 'green' if obj.status == 'published' else 'orange'
        return format_html(
            '<span style="background: {}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">{}</span>',
            color, obj.get_status_display()
        )
    status_badge.short_description = "Статус"

    def published_date(self, obj):
        return obj.published_at.strftime("%d.%m.%Y %H:%M") if obj.published_at else "Не опубликован"
    published_date.short_description = "Дата публикации"

    def categories_display(self, obj):
        categories = obj.categories.all()[:3]
        badges = ''.join(
            f'<span style="background: #e7f3ff; color: #1e40af; padding: 2px 6px; border-radius: 8px; font-size: 11px; margin-right: 4px;">{c.title}</span>'
            for c in categories
        )
        if obj.categories.count() > 3:
            badges += f'<span style="color: #666; font-size: 11px;">+{obj.categories.count() - 3}</span>'
        return format_html(badges)
    categories_display.short_description = "Категории"

    def actions(self, obj):
        return format_html(
            '''
            <div style="display: flex; gap: 5px;">
                <a href="{}" class="button" style="padding: 4px 8px; background: #3b82f6; color: white; text-decoration: none; border-radius: 4px; font-size: 12px;">Редакт.</a>
                <a href="{}" target="_blank" class="button" style="padding: 4px 8px; background: #10b981; color: white; text-decoration: none; border-radius: 4px; font-size: 12px;">Просмотр</a>
            </div>
            ''',
            f'{obj.id}/change/',
            obj.get_absolute_url() if obj.status == 'published' else '#'
        )
    actions.short_description = "Действия"

    # Массовые действия
    def make_published(self, request, queryset):
        updated = queryset.update(status='published')
        self.message_user(request, f"{updated} постов опубликовано.")
    make_published.short_description = "Опубликовать выбранные посты"

    def make_draft(self, request, queryset):
        updated = queryset.update(status='draft')
        self.message_user(request, f"{updated} постов переведено в черновики.")
    make_draft.short_description = "Перевести в черновики"

    def duplicate_posts(self, request, queryset):
        for post in queryset:
            post.pk = None
            post.slug = f"{post.slug}-copy"
            post.title = f"{post.title} (копия)"
            post.status = 'draft'
            post.save()
        self.message_user(request, f"Создано {queryset.count()} копий постов.")
    duplicate_posts.short_description = "Создать копии постов"

    # Кастомные views
    def media_upload(self, request):
        if request.method == 'POST' and request.FILES.get('file'):
            file = request.FILES['file']
            file_name = default_storage.save(f'media_uploads/{file.name}', ContentFile(file.read()))
            file_url = default_storage.url(file_name)
            return JsonResponse({'success': True, 'url': file_url})
        return JsonResponse({'success': False, 'error': 'Invalid request'})

    def media_library(self, request):
        context = {'title': 'Медиатека'}
        return render(request, 'admin/blog/media_library.html', context)

    def get_stats(self, request):
        stats = {
            'total_posts': Post.objects.count(),
            'published_posts': Post.objects.filter(status='published').count(),
            'draft_posts': Post.objects.filter(status='draft').count(),
        }
        return JsonResponse(stats)

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('media-upload/', self.admin_site.admin_view(self.media_upload), name='blog_media_upload'),
            path('media-library/', self.admin_site.admin_view(self.media_library), name='blog_media_library'),
            path('get-stats/', self.admin_site.admin_view(self.get_stats), name='blog_get_stats'),
        ]
        return custom_urls + urls

    class Media:
        css = {'all': ('admin/css/admin-custom.css',)}
        js = ('admin/js/admin-custom.js',)

# --------------------------
# Админка категорий
# --------------------------
@admin.register(Category)
class CategoryAdmin(ImportExportModelAdmin, admin.ModelAdmin):
    resource_class = CategoryResource
    list_display = ('title', 'slug', 'post_count', 'description_preview')
    search_fields = ('title', 'description')
    prepopulated_fields = {"slug": ("title",)}
    list_filter = ('created_at',)

    def post_count(self, obj):
        return obj.posts.count()
    post_count.short_description = "Количество постов"

    def description_preview(self, obj):
        return obj.description[:100] + '...' if len(obj.description) > 100 else obj.description
    description_preview.short_description = "Описание"

    class Media:
        css = {'all': ('admin/css/admin-custom.css',)}

# --------------------------
# Админка тегов
# --------------------------
@admin.register(Tag)
class TagAdmin(ImportExportModelAdmin, admin.ModelAdmin):
    list_display = ('title', 'slug', 'post_count')
    search_fields = ('title',)
    prepopulated_fields = {"slug": ("title",)}

    def post_count(self, obj):
        return obj.posts.count()
    post_count.short_description = "Количество постов"

# --------------------------
# Админка комментариев
# --------------------------
@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ('name', 'post', 'content_preview', 'user', 'is_public', 'is_moderated', 'created_at')
    list_filter = ('is_public', 'is_moderated', 'created_at', 'post')
    search_fields = ('name', 'email', 'content', 'post__title')
    autocomplete_fields = ('post', 'parent', 'user')
    readonly_fields = ('created_at',)
    actions = ['approve_comments', 'reject_comments', 'make_public', 'make_private']

    def content_preview(self, obj):
        return obj.content[:100] + '...' if len(obj.content) > 100 else obj.content
    content_preview.short_description = "Комментарий"

    def approve_comments(self, request, queryset):
        updated = queryset.update(is_moderated=True, is_public=True)
        self.message_user(request, f"{updated} комментариев одобрено.")
    approve_comments.short_description = "Одобрить выбранные комментарии"

    def reject_comments(self, request, queryset):
        updated = queryset.update(is_moderated=True, is_public=False)
        self.message_user(request, f"{updated} комментариев отклонено.")
    reject_comments.short_description = "Отклонить выбранные комментарии"

    def make_public(self, request, queryset):
        updated = queryset.update(is_public=True)
        self.message_user(request, f"{updated} комментариев сделано публичными.")
    make_public.short_description = "Сделать публичными"

    def make_private(self, request, queryset):
        updated = queryset.update(is_public=False)
        self.message_user(request, f"{updated} комментариев скрыто.")
    make_private.short_description = "Скрыть комментарии"

# --------------------------
# Админка реакций
# --------------------------
@admin.register(PostReaction)
class PostReactionAdmin(admin.ModelAdmin):
    list_display = ('post', 'likes_count', 'anon_count', 'users_count', 'created_at')
    search_fields = ('post__title',)
    autocomplete_fields = ('post', 'users')
    readonly_fields = ('created_at', 'updated_at')
    list_filter = ('created_at',)

    def users_count(self, obj):
        return obj.users.count()
    users_count.short_description = "Пользователей"

    def likes_count(self, obj):
        return obj.likes_count()
    likes_count.short_description = "Всего лайков"

# --------------------------
# Админка вложений
# --------------------------
# Безопасная регистрация PostAttachment
from django.contrib.admin.sites import NotRegistered
try:
    admin.site.unregister(PostAttachment)
except NotRegistered:
    pass

@admin.register(PostAttachment)
class AttachmentAdmin(admin.ModelAdmin):
    list_display = ('file_name', 'post', 'file_type', 'file_size', 'uploaded_by', 'uploaded_at')
    list_filter = ('file_type', 'uploaded_at')
    search_fields = ('file_name', 'post__title')
    readonly_fields = ('file_size', 'file_type', 'uploaded_at')
    autocomplete_fields = ('post', 'uploaded_by')

    def save_model(self, request, obj, form, change):
        if not change:
            obj.uploaded_by = request.user
        super().save_model(request, obj, form, change)

# --------------------------
# Кастомные заголовки админки
# --------------------------
admin.site.site_header = "Positive Theta Administration"
admin.site.site_title = "Positive Theta Admin"
admin.site.index_title = "Добро пожаловать в панель управления Positive Theta"
