from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils import timezone
from django.contrib import messages
from django.http import HttpResponseRedirect
from .models import Post, Category, Tag, Comment, PostReaction, PostAttachment, PostView
from django_summernote.admin import SummernoteModelAdmin
from django.contrib.auth import get_user_model
from import_export.admin import ImportExportModelAdmin
from import_export import resources

CustomUser = get_user_model()


# ----------------------------------------
# Ресурсы для импорта/экспорта
# ----------------------------------------
class PostResource(resources.ModelResource):
    class Meta:
        model = Post
        fields = ('id', 'title', 'slug', 'status', 'published_at', 'author__username')
        export_order = fields


class CategoryResource(resources.ModelResource):
    class Meta:
        model = Category
        fields = ('id', 'title', 'slug', 'description')


# ----------------------------------------
# Inline для вложений
# ----------------------------------------
class PostAttachmentInline(admin.TabularInline):
    model = PostAttachment
    extra = 1
    fields = ('file', 'title', 'uploaded_by', 'uploaded_at')
    readonly_fields = ('uploaded_by', 'uploaded_at')

    def save_model(self, request, obj, form, change):
        if not obj.uploaded_by:
            obj.uploaded_by = request.user
        super().save_model(request, obj, form, change)


# ----------------------------------------
# Фильтры для админки
# ----------------------------------------
class StatusFilter(admin.SimpleListFilter):
    title = 'Статус'
    parameter_name = 'status'

    def lookups(self, request, model_admin):
        return (
            ('published', 'Опубликованные'),
            ('draft', 'Черновики'),
            ('archived', 'В архиве'),
            ('scheduled', 'Запланированные'),
        )

    def queryset(self, request, queryset):
        if self.value() == 'published':
            return queryset.filter(status='published', published_at__lte=timezone.now())
        elif self.value() == 'draft':
            return queryset.filter(status='draft')
        elif self.value() == 'archived':
            return queryset.filter(status='archived')
        elif self.value() == 'scheduled':
            return queryset.filter(status='published', published_at__gt=timezone.now())
        return queryset


class CategoryFilter(admin.SimpleListFilter):
    title = 'Категория'
    parameter_name = 'category'

    def lookups(self, request, model_admin):
        categories = Category.objects.all()
        return [(c.id, c.title) for c in categories]

    def queryset(self, request, queryset):
        if self.value():
            return queryset.filter(categories__id=self.value())
        return queryset


# ----------------------------------------
# POST ADMIN - современный интерфейс как в WordPress
# ----------------------------------------
@admin.register(Post)
class PostAdmin(SummernoteModelAdmin, ImportExportModelAdmin):
    resource_class = PostResource
    summernote_fields = ('content', 'excerpt')
    list_display = ('title_preview', 'author', 'status_badge', 'published_date', 'categories_list', 'view_count', 'actions')
    list_display_links = ('title_preview',)
    list_filter = (StatusFilter, CategoryFilter, 'tags', 'created_at')
    search_fields = ('title', 'content', 'excerpt', 'slug')
    prepopulated_fields = {"slug": ("title",)}
    date_hierarchy = 'published_at'
    ordering = ('-published_at',)
    filter_horizontal = ('categories', 'tags')
    readonly_fields = ('created_at', 'updated_at', 'view_count_display')
    actions = ['make_published', 'make_draft', 'make_archived', 'duplicate_posts']
    inlines = [PostAttachmentInline]
    
    # Поля для формы редактирования
    fieldsets = (
        ('Основная информация', {
            'fields': ('title', 'slug', 'author', 'status', 'published_at')
        }),
        ('Содержание', {
            'fields': ('excerpt', 'content', 'featured_image')
        }),
        ('Таксономия', {
            'fields': ('categories', 'tags')
        }),
        ('SEO', {
            'classes': ('collapse',),
            'fields': ('meta_title', 'meta_description', 'og_image')
        }),
        ('Статистика', {
            'classes': ('collapse',),
            'fields': ('view_count_display', 'created_at', 'updated_at')
        }),
    )

    def title_preview(self, obj):
        return format_html(
            '<strong>{}</strong><br><small style="color: #666;">{}</small>',
            obj.title[:60] + '...' if len(obj.title) > 60 else obj.title,
            obj.slug
        )
    title_preview.short_description = "Заголовок"
    title_preview.admin_order_field = 'title'

    def status_badge(self, obj):
        status_colors = {
            'published': 'green',
            'draft': 'orange',
            'archived': 'red'
        }
        color = status_colors.get(obj.status, 'gray')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">{}</span>',
            color, obj.get_status_display()
        )
    status_badge.short_description = "Статус"
    status_badge.admin_order_field = 'status'

    def published_date(self, obj):
        if obj.status == 'published':
            if obj.published_at > timezone.now():
                return format_html(
                    '<span style="color: orange;" title="Запланирован на {}">⏰ {}</span>',
                    obj.published_at.strftime('%d.%m.%Y %H:%M'),
                    obj.published_at.strftime('%d.%m.%Y')
                )
            else:
                return format_html(
                    '<span style="color: green;">✓ {}</span>',
                    obj.published_at.strftime('%d.%m.%Y')
                )
        return format_html('<span style="color: gray;">—</span>')
    published_date.short_description = "Дата публикации"
    published_date.admin_order_field = 'published_at'

    def categories_list(self, obj):
        categories = obj.categories.all()[:3]
        return format_html(
            '{}'.format(', '.join([c.title for c in categories])) + 
            ('...' if obj.categories.count() > 3 else '')
        )
    categories_list.short_description = "Категории"

    def view_count(self, obj):
        return obj.views.count()
    view_count.short_description = "Просмотры"
    view_count.admin_order_field = 'views_count'

    def view_count_display(self, obj):
        return obj.views.count()
    view_count_display.short_description = "Количество просмотров"

    def actions(self, obj):
        return format_html(
            '<div style="display: flex; gap: 5px;">'
            '<a href="{}" class="button" style="padding: 2px 6px; background: #4CAF50; color: white; text-decoration: none; border-radius: 3px;">Просмотр</a>'
            '<a href="{}" class="button" style="padding: 2px 6px; background: #2196F3; color: white; text-decoration: none; border-radius: 3px;">Изменить</a>'
            '</div>',
            obj.get_absolute_url(),
            reverse('admin:blog_post_change', args=[obj.id])
        )
    actions.short_description = "Действия"

    # Массовые действия
    def make_published(self, request, queryset):
        updated = queryset.update(status='published')
        self.message_user(request, f"{updated} постов опубликовано.")
    make_published.short_description = "Опубликовать выбранные посты"

    def make_draft(self, request, queryset):
        updated = queryset.update(status='draft')
        self.message_user(request, f"{updated} постов переведены в черновики.")
    make_draft.short_description = "Перевести в черновики"

    def make_archived(self, request, queryset):
        updated = queryset.update(status='archived')
        self.message_user(request, f"{updated} постов перемещены в архив.")
    make_archived.short_description = "Переместить в архив"

    def duplicate_posts(self, request, queryset):
        for post in queryset:
            post.pk = None
            post.slug = f"{post.slug}-copy-{timezone.now().strftime('%Y%m%d%H%M%S')}"
            post.title = f"{post.title} (Копия)"
            post.status = 'draft'
            post.save()
            # Копируем категории и теги
            post.categories.set(post.categories.all())
            post.tags.set(post.tags.all())
        self.message_user(request, f"Создано {queryset.count()} копий постов.")
    duplicate_posts.short_description = "Создать копии постов"

    # Сохранение автора по умолчанию
    def save_model(self, request, obj, form, change):
        if not obj.author:
            obj.author = request.user
        super().save_model(request, obj, form, change)

    class Media:
        css = {
            'all': ('admin/css/custom_admin.css',)
        }
        js = ('admin/js/custom_admin.js',)


# ----------------------------------------
# CATEGORIES & TAGS с улучшенным интерфейсом
# ----------------------------------------
@admin.register(Category)
class CategoryAdmin(ImportExportModelAdmin):
    resource_class = CategoryResource
    list_display = ('title', 'slug', 'post_count', 'description_preview')
    search_fields = ('title', 'description')
    prepopulated_fields = {"slug": ("title",)}
    list_per_page = 20

    def post_count(self, obj):
        return obj.posts.count()
    post_count.short_description = "Количество постов"

    def description_preview(self, obj):
        return obj.description[:100] + '...' if len(obj.description) > 100 else obj.description
    description_preview.short_description = "Описание"

    class Media:
        css = {
            'all': ('admin/css/custom_admin.css',)
        }


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ('title', 'slug', 'post_count')
    search_fields = ('title',)
    prepopulated_fields = {"slug": ("title",)}
    list_per_page = 20

    def post_count(self, obj):
        return obj.posts.count()
    post_count.short_description = "Количество постов"

    class Media:
        css = {
            'all': ('admin/css/custom_admin.css',)
        }


# ----------------------------------------
# COMMENTS с модерацией
# ----------------------------------------
@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ('name', 'post_link', 'user', 'content_preview', 'status_badge', 'created_at')
    list_filter = ('is_public', 'is_moderated', 'created_at', 'post')
    search_fields = ('name', 'email', 'content', 'post__title')
    autocomplete_fields = ('post', 'parent', 'user')
    actions = ['approve_comments', 'reject_comments', 'make_public', 'make_private']
    readonly_fields = ('created_at',)

    def post_link(self, obj):
        return format_html(
            '<a href="{}">{}</a>',
            reverse('admin:blog_post_change', args=[obj.post.id]),
            obj.post.title[:30] + '...' if len(obj.post.title) > 30 else obj.post.title
        )
    post_link.short_description = "Пост"

    def content_preview(self, obj):
        return obj.content[:50] + '...' if len(obj.content) > 50 else obj.content
    content_preview.short_description = "Комментарий"

    def status_badge(self, obj):
        if obj.is_moderated:
            return format_html('<span style="color: red;">⛔ Отклонен</span>')
        elif obj.is_public:
            return format_html('<span style="color: green;">✓ Опубликован</span>')
        else:
            return format_html('<span style="color: orange;">⏳ На модерации</span>')
    status_badge.short_description = "Статус"

    def approve_comments(self, request, queryset):
        updated = queryset.update(is_moderated=False, is_public=True)
        self.message_user(request, f"{updated} комментариев одобрены.")
    approve_comments.short_description = "Одобрить выбранные комментарии"

    def reject_comments(self, request, queryset):
        updated = queryset.update(is_moderated=True, is_public=False)
        self.message_user(request, f"{updated} комментариев отклонены.")
    reject_comments.short_description = "Отклонить выбранные комментарии"

    def make_public(self, request, queryset):
        updated = queryset.update(is_public=True)
        self.message_user(request, f"{updated} комментариев сделаны публичными.")
    make_public.short_description = "Сделать публичными"

    def make_private(self, request, queryset):
        updated = queryset.update(is_public=False)
        self.message_user(request, f"{updated} комментариев скрыты.")
    make_private.short_description = "Скрыть комментарии"

    class Media:
        css = {
            'all': ('admin/css/custom_admin.css',)
        }


# ----------------------------------------
# POST REACTIONS
# ----------------------------------------
@admin.register(PostReaction)
class PostReactionAdmin(admin.ModelAdmin):
    list_display = ('post', 'likes_count', 'anon_count', 'created_at', 'updated_at')
    search_fields = ('post__title',)
    autocomplete_fields = ('post', 'users')
    ordering = ('-created_at',)
    list_per_page = 20

    class Media:
        css = {
            'all': ('admin/css/custom_admin.css',)
        }


# ----------------------------------------
# POST ATTACHMENTS
# ----------------------------------------
@admin.register(PostAttachment)
class PostAttachmentAdmin(admin.ModelAdmin):
    list_display = ('title', 'post', 'uploaded_by', 'uploaded_at')
    search_fields = ('title', 'post__title')
    autocomplete_fields = ('post', 'uploaded_by')
    list_filter = ('uploaded_at',)
    readonly_fields = ('uploaded_by', 'uploaded_at')

    def save_model(self, request, obj, form, change):
        if not obj.uploaded_by_id:
            obj.uploaded_by = request.user
        super().save_model(request, obj, form, change)


# ----------------------------------------
# POST VIEWS
# ----------------------------------------
@admin.register(PostView)
class PostViewAdmin(admin.ModelAdmin):
    list_display = ('post', 'ip_address', 'viewed_at')
    search_fields = ('post__title', 'ip_address')
    autocomplete_fields = ('post',)
    list_filter = ('viewed_at',)
    readonly_fields = ('viewed_at',)


# ----------------------------------------
# Регистрация пользователей
# ----------------------------------------
@admin.register(CustomUser)
class CustomUserAdmin(admin.ModelAdmin):
    search_fields = ['username', 'email']
    list_display = ('username', 'email', 'is_staff', 'is_active', 'date_joined')
    list_filter = ('is_staff', 'is_active', 'date_joined')
    ordering = ('-date_joined',)
    
    class Media:
        css = {
            'all': ('admin/css/custom_admin.css',)
        }