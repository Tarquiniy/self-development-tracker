# backend/blog/admin.py
from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.shortcuts import render
from django.http import JsonResponse, Http404
from django.utils import timezone
from django.db.models import Count
from django.db.models.functions import TruncDate
from django.contrib.admin.views.decorators import staff_member_required
from django.views.decorators.http import require_GET, require_POST

from .models import Post, Category, Tag, Comment, PostReaction, PostView
from django_summernote.admin import SummernoteModelAdmin

CustomUser = get_user_model()

# ---------- Пользовательский админ (стандартная регистрация)
@admin.register(CustomUser)
class CustomUserAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'is_staff', 'is_active', 'date_joined')
    list_filter = ('is_staff', 'is_active', 'date_joined')
    search_fields = ('username', 'email', 'first_name', 'last_name')
    ordering = ('-date_joined',)
    fieldsets = (
        (None, {'fields': ('username', 'email', 'password')}),
        ('Personal info', {'fields': ('first_name', 'last_name')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )

    class Media:
        css = {'all': ('admin/admin-modern.css',)}


# ---------- Посты
class CommentInline(admin.TabularInline):
    model = Comment
    extra = 0
    fields = ('name', 'content', 'is_public', 'is_moderated', 'created_at')
    readonly_fields = ('created_at',)

@admin.register(Post)
class PostAdmin(SummernoteModelAdmin):
    summernote_fields = ('content', 'excerpt')
    list_display = ('admin_thumbnail', 'title', 'author', 'status', 'published_at', 'action_buttons')
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
                '<img src="{}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;" />',
                obj.featured_image
            )
        return "🖼️"
    admin_thumbnail.short_description = "Изображение"

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
    make_published.short_description = "Опубликовать выбранные посты"

    def make_draft(self, request, queryset):
        updated = queryset.update(status='draft')
        self.message_user(request, f"{updated} постов переведено в черновики.")
    make_draft.short_description = "Перевести в черновики"

    def duplicate_post(self, request, queryset):
        created = 0
        for post in queryset:
            old_slug = post.slug
            post.pk = None
            post.slug = f"{old_slug}-copy"
            post.title = f"{post.title} (копия)"
            post.status = 'draft'
            post.save()
            created += 1
        self.message_user(request, f"Создано {created} копий постов.")
    duplicate_post.short_description = "Создать копии"

    class Media:
        css = {'all': ('admin/admin-modern.css',)}
        js = ('admin/admin.js',)


# ---------- Категории
@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('title', 'slug', 'post_count', 'created_at')
    search_fields = ('title', 'description')
    prepopulated_fields = {'slug': ('title',)}
    fields = ('title', 'slug', 'description')

    def post_count(self, obj):
        return obj.posts.count()
    post_count.short_description = "Количество постов"

    class Media:
        css = {'all': ('admin/admin-modern.css',)}


# ---------- Теги
@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ('title', 'slug', 'post_count')
    search_fields = ('title',)
    prepopulated_fields = {'slug': ('title',)}

    def post_count(self, obj):
        return obj.posts.count()
    post_count.short_description = "Количество постов"

    class Media:
        css = {'all': ('admin/admin-modern.css',)}


# ---------- Комментарии
@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ('shorter_name', 'post_link', 'user', 'short_content', 'is_public', 'is_moderated', 'created_at')
    list_filter = ('is_public', 'is_moderated', 'created_at', 'post')
    search_fields = ('name', 'email', 'content', 'post__title')
    list_editable = ('is_public', 'is_moderated')
    actions = ['approve_comments', 'reject_comments', 'mark_as_spam']

    def shorter_name(self, obj):
        return obj.name[:30]
    shorter_name.short_description = "Имя"

    def post_link(self, obj):
        return format_html('<a href="{}">{}</a>',
                         reverse('admin:blog_post_change', args=[obj.post.id]),
                         obj.post.title)
    post_link.short_description = "Пост"

    def short_content(self, obj):
        return obj.content[:100] + '...' if len(obj.content) > 100 else obj.content
    short_content.short_description = "Комментарий"

    def approve_comments(self, request, queryset):
        updated = queryset.update(is_moderated=True, is_public=True)
        self.message_user(request, f"{updated} комментариев одобрено.")
    approve_comments.short_description = "Одобрить выбранные"

    def reject_comments(self, request, queryset):
        updated = queryset.update(is_moderated=True, is_public=False)
        self.message_user(request, f"{updated} комментариев отклонено.")
    reject_comments.short_description = "Отклонить выбранные"

    def mark_as_spam(self, request, queryset):
        updated = queryset.update(is_moderated=True, is_public=False)
        self.message_user(request, f"{updated} комментариев помечено как спам.")
    mark_as_spam.short_description = "Пометить как спам"

    class Media:
        css = {'all': ('admin/admin-modern.css',)}


# ---------- Реакции
@admin.register(PostReaction)
class PostReactionAdmin(admin.ModelAdmin):
    list_display = ('post', 'likes_count', 'users_count', 'anon_count', 'updated_at')
    search_fields = ('post__title',)
    readonly_fields = ('likes_count', 'users_count', 'anon_count')

    def likes_count(self, obj):
        return obj.likes_count()
    likes_count.short_description = "Всего лайков"

    def users_count(self, obj):
        return obj.users.count()
    users_count.short_description = "Лайков от пользователей"

    class Media:
        css = {'all': ('admin/admin-modern.css',)}


# ---------- DASHBOARD VIEW & API
@admin.site.admin_view
@require_GET
def admin_dashboard_view(request):
    """
    Render the enhanced admin dashboard.
    Registered in core/urls.py as /admin/dashboard/
    """
    if not request.user.is_staff:
        raise Http404

    # Base stats
    posts_count = Post.objects.count()
    published_count = Post.objects.filter(status='published').count()
    draft_count = Post.objects.filter(status='draft').count()
    today = timezone.now().date()
    today_posts = Post.objects.filter(created_at__date=today).count()
    comments_count = Comment.objects.count()
    pending_comments = Comment.objects.filter(is_moderated=False).count()
    users_count = CustomUser.objects.count()
    total_views = PostView.objects.count()

    # Recent items
    recent_posts = Post.objects.order_by('-created_at')[:8]
    recent_comments = Comment.objects.select_related('post').order_by('-created_at')[:8]

    context = {
        'title': 'Dashboard',
        'posts_count': posts_count,
        'published_count': published_count,
        'draft_count': draft_count,
        'today_posts': today_posts,
        'comments_count': comments_count,
        'pending_comments': pending_comments,
        'users_count': users_count,
        'total_views': total_views,
        'recent_posts': recent_posts,
        'recent_comments': recent_comments,
    }

    return render(request, 'admin/dashboard.html', context)


@admin.site.admin_view
@require_GET
def admin_stats_api(request):
    """
    JSON API returning time series for charts (last 30 days).
    Registered in core/urls.py as /admin/dashboard/stats-data/
    """
    if not request.user.is_staff:
        return JsonResponse({'detail': 'permission denied'}, status=403)

    days = int(request.GET.get('days', 30))
    now = timezone.now()
    start = now - timezone.timedelta(days=days - 1)

    # Posts per day
    posts_qs = (
        Post.objects.filter(created_at__date__gte=start.date())
        .annotate(day=TruncDate('created_at'))
        .values('day')
        .annotate(count=Count('id'))
        .order_by('day')
    )

    # Comments per day
    comments_qs = (
        Comment.objects.filter(created_at__date__gte=start.date())
        .annotate(day=TruncDate('created_at'))
        .values('day')
        .annotate(count=Count('id'))
        .order_by('day')
    )

    # Views per day
    views_qs = (
        PostView.objects.filter(viewed_at__date__gte=start.date())
        .annotate(day=TruncDate('viewed_at'))
        .values('day')
        .annotate(count=Count('id'))
        .order_by('day')
    )

    # Build full date series (fill zeros)
    labels = []
    posts_series = []
    comments_series = []
    views_series = []
    for i in range(days):
        d = (start + timezone.timedelta(days=i)).date()
        labels.append(d.isoformat())
        posts_series.append(0)
        comments_series.append(0)
        views_series.append(0)

    def fill_series(qs, target):
        mapping = {q['day'].isoformat(): q['count'] for q in qs}
        for idx, label in enumerate(labels):
            if label in mapping:
                target[idx] = mapping[label]

    fill_series(posts_qs, posts_series)
    fill_series(comments_qs, comments_series)
    fill_series(views_qs, views_series)

    return JsonResponse({
        'labels': labels,
        'posts': posts_series,
        'comments': comments_series,
        'views': views_series,
    })