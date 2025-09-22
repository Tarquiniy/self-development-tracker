from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.contrib import messages
from django.utils import timezone
from django.db.models import Count
from django.http import HttpResponseRedirect
from django.template.response import TemplateResponse
from django.contrib.admin.views.decorators import staff_member_required
from django.utils.decorators import method_decorator
from django.views.generic import TemplateView

from .models import Post, Category, Tag, Comment, PostReaction
from django_summernote.admin import SummernoteModelAdmin
from django.contrib.auth import get_user_model

CustomUser = get_user_model()


class WordPressStyleAdminSite(admin.AdminSite):
    site_header = "Positive Theta Admin"
    site_title = "Positive Theta Admin"
    index_title = "Добро пожаловать в панель управления"
    
    def get_app_list(self, request):
        app_list = super().get_app_list(request)
        for app in app_list:
            if app['app_label'] == 'blog':
                model_order = ['post', 'category', 'tag', 'comment']
                app['models'].sort(key=lambda x: model_order.index(x['object_name'].lower()) 
                                 if x['object_name'].lower() in model_order else 999)
        return app_list


@admin.register(CustomUser)
class CustomUserAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'post_count', 'is_staff', 'is_active', 'last_login')
    list_filter = ('is_staff', 'is_active', 'date_joined')
    search_fields = ('username', 'email', 'first_name', 'last_name')
    readonly_fields = ('date_joined', 'last_login')
    
    def post_count(self, obj):
        return obj.posts.count()
    post_count.short_description = 'Постов'


class MediaLibraryAdmin(admin.ModelAdmin):
    list_display = ('preview', 'filename', 'file_type', 'uploaded_by', 'uploaded_at')
    list_filter = ('file_type', 'uploaded_at')
    search_fields = ('filename',)
    
    def preview(self, obj):
        if obj.file_type.startswith('image'):
            return format_html('<img src="{}" style="max-height: 50px;" />', obj.file.url)
        return "📄"
    preview.short_description = "Превью"


@admin.register(Post)
class PostAdmin(SummernoteModelAdmin):
    summernote_fields = ('content', 'excerpt')
    list_display = ('title', 'author', 'status_badge', 'published_at', 'comment_count', 'view_count', 'action_buttons')
    list_filter = ('status', 'categories', 'tags', 'published_at', 'created_at')
    search_fields = ('title', 'content', 'excerpt')
    prepopulated_fields = {"slug": ("title",)}
    date_hierarchy = 'published_at'
    filter_horizontal = ('categories', 'tags')
    readonly_fields = ('view_count', 'created_at', 'updated_at')
    actions = ['make_published', 'make_draft', 'duplicate_posts']
    
    fieldsets = (
        ('Основное', {'fields': ('title', 'slug', 'author', 'content')}),
        ('Эксперт', {'fields': ('excerpt', 'featured_image', 'categories', 'tags'), 'classes': ('collapse',)}),
        ('Настройки публикации', {'fields': ('status', 'published_at'), 'classes': ('collapse',)}),
        ('SEO', {'fields': ('meta_title', 'meta_description', 'og_image'), 'classes': ('collapse',)}),
        ('Статистика', {'fields': ('view_count', 'created_at', 'updated_at'), 'classes': ('collapse',)}),
    )
    
    def status_badge(self, obj):
        color = 'green' if obj.status == 'published' else 'orange'
        return format_html(
            '<span style="background: {}; color: white; padding: 2px 8px; border-radius: 10px; font-size: 12px;">{}</span>',
            color, obj.get_status_display()
        )
    status_badge.short_description = 'Статус'
    
    def comment_count(self, obj):
        count = obj.comments.count()
        url = reverse('admin:blog_comment_changelist') + f'?post__id__exact={obj.id}'
        return format_html('<a href="{}">{} комментариев</a>', url, count)
    comment_count.short_description = 'Комментарии'
    
    def view_count(self, obj):
        return getattr(obj, 'view_count', 0)
    
    # Переименовал конфликтную функцию actions
    def action_buttons(self, obj):
        edit_url = reverse('admin:blog_post_change', args=[obj.id])
        view_url = obj.get_absolute_url()
        duplicate_url = reverse('admin:blog_post_duplicate', args=[obj.id])
        return format_html('''
            <div class="action-buttons">
                <a href="{}" class="button">Редактировать</a>
                <a href="{}" target="_blank" class="button">Просмотр</a>
                <a href="{}" class="button">Дублировать</a>
            </div>
        ''', edit_url, view_url, duplicate_url)
    action_buttons.short_description = 'Действия'
    
    def make_published(self, request, queryset):
        updated = queryset.update(status='published', published_at=timezone.now())
        self.message_user(request, f"{updated} постов опубликовано.")
    make_published.short_description = "Опубликовать выбранные посты"
    
    def make_draft(self, request, queryset):
        updated = queryset.update(status='draft')
        self.message_user(request, f"{updated} постов переведены в черновики.")
    make_draft.short_description = "Перевести в черновики"
    
    def duplicate_posts(self, request, queryset):
        for post in queryset:
            new_post = Post(
                title=f"{post.title} (Копия)",
                slug=f"{post.slug}-copy-{timezone.now().timestamp()}",
                content=post.content,
                excerpt=post.excerpt,
                featured_image=post.featured_image,
                status='draft',
                author=post.author
            )
            new_post.save()
            new_post.categories.set(post.categories.all())
            new_post.tags.set(post.tags.all())
        self.message_user(request, f"{queryset.count()} постов дублировано.")
    duplicate_posts.short_description = "Дублировать посты"
    
    def get_list_display_links(self, request, list_display):
        return ['title']
    
    class Media:
        css = {'all': ('admin/wordpress-style.css',)}
        js = ('admin/wordpress-admin.js',)


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('title', 'slug', 'post_count', 'description_preview')
    search_fields = ('title', 'description')
    prepopulated_fields = {"slug": ("title",)}
    
    def post_count(self, obj):
        count = obj.posts.count()
        url = reverse('admin:blog_post_changelist') + f'?categories__id__exact={obj.id}'
        return format_html('<a href="{}">{} постов</a>', url, count)
    post_count.short_description = 'Количество постов'
    
    def description_preview(self, obj):
        return obj.description[:100] + '...' if len(obj.description) > 100 else obj.description
    description_preview.short_description = 'Описание'


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ('title', 'slug', 'post_count')
    search_fields = ('title',)
    prepopulated_fields = {"slug": ("title",)}
    
    def post_count(self, obj):
        count = obj.posts.count()
        url = reverse('admin:blog_post_changelist') + f'?tags__id__exact={obj.id}'
        return format_html('<a href="{}">{} постов</a>', url, count)
    post_count.short_description = 'Количество постов'


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ('author_name', 'post_link', 'content_preview', 'status_badge', 'created_at', 'action_buttons')
    list_filter = ('is_public', 'is_moderated', 'created_at')
    search_fields = ('name', 'email', 'content', 'post__title')
    readonly_fields = ('created_at',)
    actions = ['approve_comments', 'spam_comments']
    
    def author_name(self, obj):
        return obj.user.username if obj.user else obj.name
    author_name.short_description = 'Автор'
    
    def post_link(self, obj):
        url = reverse('admin:blog_post_change', args=[obj.post.id])
        return format_html('<a href="{}">{}</a>', url, obj.post.title)
    post_link.short_description = 'Пост'
    
    def content_preview(self, obj):
        return obj.content[:100] + '...' if len(obj.content) > 100 else obj.content
    content_preview.short_description = 'Комментарий'
    
    def status_badge(self, obj):
        if not obj.is_public:
            return format_html('<span style="background: red; color: white; padding: 2px 6px; border-radius: 10px; font-size: 11px;">Спам</span>')
        elif not obj.is_moderated:
            return format_html('<span style="background: orange; color: white; padding: 2px 6px; border-radius: 10px; font-size: 11px;">На модерации</span>')
        else:
            return format_html('<span style="background: green; color: white; padding: 2px 6px; border-radius: 10px; font-size: 11px;">Одобрен</span>')
    status_badge.short_description = 'Статус'
    
    def action_buttons(self, obj):
        approve_url = reverse('admin:blog_comment_approve', args=[obj.id])
        spam_url = reverse('admin:blog_comment_spam', args=[obj.id])
        return format_html('''
            <div class="action-buttons">
                <a href="{}" class="button">Одобрить</a>
                <a href="{}" class="button">Спам</a>
            </div>
        ''', approve_url, spam_url)
    action_buttons.short_description = 'Действия'
    
    def approve_comments(self, request, queryset):
        queryset.update(is_moderated=True, is_public=True)
        self.message_user(request, f"{queryset.count()} комментариев одобрено.")
    approve_comments.short_description = "Одобрить выбранные"
    
    def spam_comments(self, request, queryset):
        queryset.update(is_public=False)
        self.message_user(request, f"{queryset.count()} комментариев помечено как спам.")
    spam_comments.short_description = "Пометить как спам"


@admin.register(PostReaction)
class PostReactionAdmin(admin.ModelAdmin):
    list_display = ('post', 'likes_count', 'users_count', 'anon_count', 'updated_at')
    readonly_fields = ('created_at', 'updated_at')
    search_fields = ('post__title',)
    
    def likes_count(self, obj):
        return obj.likes_count()
    likes_count.short_description = 'Всего лайков'
    
    def users_count(self, obj):
        return obj.users.count()
    users_count.short_description = 'Лайков от пользователей'


@staff_member_required
def wordpress_dashboard(request):
    stats = {
        'total_posts': Post.objects.count(),
        'published_posts': Post.objects.filter(status='published').count(),
        'draft_posts': Post.objects.filter(status='draft').count(),
        'total_comments': Comment.objects.count(),
        'pending_comments': Comment.objects.filter(is_moderated=False).count(),
        'recent_posts': Post.objects.all().order_by('-created_at')[:5],
        'recent_comments': Comment.objects.all().order_by('-created_at')[:5],
    }
    return TemplateResponse(request, 'admin/wordpress_dashboard.html', {
        'title': 'Панель управления',
        'stats': stats,
    })


def get_admin_urls():
    from django.urls import path
    return [
        path('wordpress-dashboard/', wordpress_dashboard, name='wordpress_dashboard'),
    ]
