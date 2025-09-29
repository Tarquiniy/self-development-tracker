# backend/blog/admin.py
import json
from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.shortcuts import render, redirect
from django.http import JsonResponse, Http404
from django.utils import timezone
from django.db.models import Count
from django.db.models.functions import TruncDate
from django.contrib.admin.views.decorators import staff_member_required
from django.views.decorators.http import require_GET, require_POST
from django.utils.safestring import mark_safe

from .models import (
    Post, Category, Tag, Comment, PostReaction, PostView,
    PostAttachment, MediaLibrary
)
from django_summernote.admin import SummernoteModelAdmin

CustomUser = get_user_model()

# ---------- Пользовательский админ
@admin.register(CustomUser)
class CustomUserAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'is_staff', 'is_active', 'date_joined')
    list_filter = ('is_staff', 'is_active', 'date_joined')
    search_fields = ('username', 'email', 'first_name', 'last_name')
    ordering = ('-date_joined',)

    class Media:
        css = {'all': ('blog/admin-modern.css',)}


# ---------- Inline для комментариев
class CommentInline(admin.TabularInline):
    model = Comment
    extra = 0
    fields = ('name', 'content', 'is_public', 'is_moderated', 'created_at')
    readonly_fields = ('created_at',)


# ---------- PostAdmin (inline editing UI already present)
@admin.register(Post)
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
            '<input class="inline-title-input" data-post-id="{}" value="{}" title="Нажмите Enter или уйдите с поля для сохранения" />',
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
    make_published.short_description = "Опубликовать выбранные посты"

    def make_draft(self, request, queryset):
        updated = queryset.update(status='draft')
        self.message_user(request, f"{updated} постов переведено в черновики.")
    make_draft.short_description = "Перевести в черновики"

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
    duplicate_post.short_description = "Создать копии"

    class Media:
        css = {'all': ('blog/admin-modern.css',)}
        js = (
            'blog/admin-core.js',
            'blog/admin-post-form.js',
            'blog/admin-list-inline.js',
            'blog/admin-media-library.js',
        )


# ---------- CategoryAdmin, TagAdmin, CommentAdmin, PostReactionAdmin
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
        css = {'all': ('blog/admin-modern.css',)}


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ('title', 'slug', 'post_count')
    search_fields = ('title',)
    prepopulated_fields = {'slug': ('title',)}

    def post_count(self, obj):
        return obj.posts.count()
    post_count.short_description = "Количество постов"

    class Media:
        css = {'all': ('blog/admin-modern.css',)}


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
        css = {'all': ('blog/admin-modern.css',)}


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
        css = {'all': ('blog/admin-modern.css',)}


# ---------- Dashboard & stats views (kept)
@admin.site.admin_view
@require_GET
def admin_dashboard_view(request):
    if not request.user.is_staff:
        raise Http404

    posts_count = Post.objects.count()
    published_count = Post.objects.filter(status='published').count()
    draft_count = Post.objects.filter(status='draft').count()
    today = timezone.now().date()
    today_posts = Post.objects.filter(created_at__date=today).count()
    comments_count = Comment.objects.count()
    pending_comments = Comment.objects.filter(is_moderated=False).count()
    users_count = CustomUser.objects.count()
    total_views = PostView.objects.count()

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
    if not request.user.is_staff:
        return JsonResponse({'detail': 'permission denied'}, status=403)

    days = int(request.GET.get('days', 30))
    now = timezone.now()
    start = now - timezone.timedelta(days=days - 1)

    posts_qs = (
        Post.objects.filter(created_at__date__gte=start.date())
        .annotate(day=TruncDate('created_at'))
        .values('day')
        .annotate(count=Count('id'))
        .order_by('day')
    )

    comments_qs = (
        Comment.objects.filter(created_at__date__gte=start.date())
        .annotate(day=TruncDate('created_at'))
        .values('day')
        .annotate(count=Count('id'))
        .order_by('day')
    )

    views_qs = (
        PostView.objects.filter(viewed_at__date__gte=start.date())
        .annotate(day=TruncDate('viewed_at'))
        .values('day')
        .annotate(count=Count('id'))
        .order_by('day')
    )

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


# ---------- Post inline AJAX update endpoint
@admin.site.admin_view
@require_POST
def admin_post_update_view(request):
    if not request.user.is_staff:
        return JsonResponse({'success': False, 'message': 'permission denied'}, status=403)

    try:
        data = json.loads(request.body.decode('utf-8'))
    except Exception as e:
        return JsonResponse({'success': False, 'message': f'Invalid JSON: {e}'}, status=400)

    post_id = data.get('post_id')
    field = data.get('field')
    value = data.get('value')

    if not post_id or not field:
        return JsonResponse({'success': False, 'message': 'Missing post_id or field'}, status=400)

    ALLOWED = {'title', 'status', 'published_at'}
    if field not in ALLOWED:
        return JsonResponse({'success': False, 'message': 'Field not allowed'}, status=400)

    try:
        post = Post.objects.get(pk=post_id)
    except Post.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Post not found'}, status=404)

    if field == 'published_at':
        from django.utils.dateparse import parse_datetime, parse_date
        dt = parse_datetime(value) or parse_date(value)
        if not dt:
            return JsonResponse({'success': False, 'message': 'Invalid datetime format'}, status=400)
        post.published_at = dt
    else:
        setattr(post, field, value)

    try:
        post.save()
    except Exception as e:
        return JsonResponse({'success': False, 'message': f'Error saving: {e}'}, status=500)

    return JsonResponse({'success': True, 'post_id': post.id, 'field': field, 'value': getattr(post, field)})


# ---------- Media library admin view
@admin.site.admin_view
@require_GET
def admin_media_library_view(request):
    if not request.user.is_staff:
        raise Http404
    # provide initial attachments to template (so server-rendered grid shows files immediately)
    attachments = list(PostAttachment.objects.order_by('-uploaded_at')[:48].values(
        'id', 'title', 'filename', 'uploaded_at', 'file'
    ))
    # convert 'file' field to url if possible
    for a in attachments:
        a['url'] = a.get('file') or ''
    context = {'attachments': attachments, 'title': 'Media Library'}
    return render(request, 'admin/media_library.html', context)


# ---------- Register proxy model "MediaLibrary" that redirects to the media library page
@admin.register(MediaLibrary)
class MediaLibraryAdmin(admin.ModelAdmin):
    list_display = ('title', 'uploaded_by', 'uploaded_at', 'post_link')

    def post_link(self, obj):
        if obj.post:
            return format_html('<a href="{}">{}</a>', reverse('admin:blog_post_change', args=[obj.post.id]), obj.post.title)
        return '-'
    post_link.short_description = "Привязка к посту"

    def changelist_view(self, request, extra_context=None):
        """
        Redirect changelist clicks in the admin app list to the full media-library page.
        This makes "Media Library" appear as a normal item under the Blog app and open the media UI.
        """
        return redirect('admin-media-library')

    class Media:
        css = {'all': ('blog/admin-modern.css',)}
