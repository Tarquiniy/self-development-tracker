# backend/blog/admin.py
import os
import json
import logging
from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.shortcuts import render, redirect
from django.http import JsonResponse, Http404, HttpResponseRedirect
from django.utils import timezone
from django.db.models import Count
from django.db.models.functions import TruncDate
from django.views.decorators.http import require_GET, require_POST
from django.utils.safestring import mark_safe
from django.core import signing
from django.conf import settings

import reversion
from reversion.admin import VersionAdmin

from .models import (
    Post, Category, Tag, Comment, PostReaction, PostView,
    PostAttachment, MediaLibrary
)
from django_summernote.admin import SummernoteModelAdmin

# Импортуем custom_admin_site лениво — core.admin не импортирует blog.admin -> нет цикла
from core.admin import custom_admin_site

logger = logging.getLogger(__name__)
CustomUser = get_user_model()

PREVIEW_SALT = "post-preview-salt"
PREVIEW_MAX_AGE = 60 * 60  # 1 час

# ---------- CustomUser admin ----------
@admin.register(CustomUser, site=custom_admin_site)
class CustomUserAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'is_staff', 'is_active', 'date_joined')
    search_fields = ('username', 'email')
    class Media:
        css = {'all': ('admin/admin-modern.css',)}


# ---------- Comment inline ----------
class CommentInline(admin.TabularInline):
    model = Comment
    extra = 0
    readonly_fields = ('created_at',)
    fields = ('name', 'content', 'is_public', 'is_moderated', 'created_at')


# ---------- PostAdmin (VersionAdmin + Summernote) ----------
@admin.register(Post, site=custom_admin_site)
class PostAdmin(VersionAdmin, SummernoteModelAdmin):
    change_form_template = 'admin/blog/post/change_form.html'
    summernote_fields = ('content', 'excerpt')
    list_display = ('admin_thumbnail', 'title', 'status', 'author', 'published_at')
    list_filter = ('status', 'published_at', 'categories', 'tags')
    search_fields = ('title', 'content', 'excerpt')
    prepopulated_fields = {'slug': ('title',)}
    date_hierarchy = 'published_at'
    ordering = ('-published_at',)
    filter_horizontal = ('categories', 'tags')
    inlines = [CommentInline]
    actions = ['make_published', 'make_draft', 'duplicate_post']

    fieldsets = (
        ('Основная информация', {'fields': ('title', 'slug', 'author', 'status', 'published_at')}),
        ('Содержание', {'fields': ('excerpt', 'content', 'featured_image')}),
        ('Категории и теги', {'fields': ('categories', 'tags')}),
        ('SEO', {'fields': ('meta_title', 'meta_description', 'og_image'), 'classes': ('collapse',)}),
    )

    class Media:
        css = {'all': ('admin/admin-modern.css',)}
        js = (
            'admin/admin-core.js',
            'admin/admin-post-form.js',
            'admin/media-library.js',
        )

    def admin_thumbnail(self, obj):
        if obj.featured_image:
            return format_html(
                '<img src="{}" style="width:56px;height:42px;object-fit:cover;border-radius:6px;border:1px solid #e6edf3" />',
                obj.featured_image
            )
        return "—"
    admin_thumbnail.short_description = "Изображение"

    def make_published(self, request, queryset):
        updated = queryset.update(status='published')
        self.message_user(request, f"{updated} постов опубликовано.")
    make_published.short_description = "Опубликовать выбранные"

    def make_draft(self, request, queryset):
        updated = queryset.update(status='draft')
        self.message_user(request, f"{updated} постов переведено в черновики.")
    make_draft.short_description = "Перевести в черновики"

    def duplicate_post(self, request, queryset):
        created = 0
        for p in queryset:
            old_slug = p.slug or ''
            p.pk = None
            p.slug = f"{old_slug}-copy"
            p.title = f"{p.title} (копия)"
            p.status = 'draft'
            p.save()
            created += 1
        self.message_user(request, f"Создано {created} копий.")
    duplicate_post.short_description = "Создать копии"


# ---------- Category, Tag, Comment, PostReaction ----------
@admin.register(Category, site=custom_admin_site)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('title', 'slug', 'post_count')
    prepopulated_fields = {'slug': ('title',)}
    def post_count(self, obj): return obj.posts.count()
    post_count.short_description = "Постов"


@admin.register(Tag, site=custom_admin_site)
class TagAdmin(admin.ModelAdmin):
    list_display = ('title', 'slug', 'post_count')
    prepopulated_fields = {'slug': ('title',)}
    def post_count(self, obj): return obj.posts.count()
    post_count.short_description = "Постов"


@admin.register(Comment, site=custom_admin_site)
class CommentAdmin(admin.ModelAdmin):
    list_display = ('shorter_name', 'post_link', 'user', 'short_content', 'is_public', 'is_moderated', 'created_at')
    list_editable = ('is_public', 'is_moderated')
    def shorter_name(self, obj): return obj.name[:30]
    def post_link(self, obj):
        return format_html('<a href="{}">{}</a>', reverse('admin:blog_post_change', args=[obj.post.id]), obj.post.title)
    def short_content(self, obj): return obj.content[:100] + ('...' if len(obj.content) > 100 else '')


@admin.register(PostReaction, site=custom_admin_site)
class PostReactionAdmin(admin.ModelAdmin):
    list_display = ('post', 'likes_count', 'updated_at')
    def likes_count(self, obj): return obj.likes_count()


# ---------- MediaLibrary proxy ----------
@admin.register(MediaLibrary, site=custom_admin_site)
class MediaLibraryAdmin(admin.ModelAdmin):
    list_display = ('title', 'uploaded_by', 'uploaded_at', 'post_link')
    def post_link(self, obj):
        if obj.post: return format_html('<a href="{}">{}</a>', reverse('admin:blog_post_change', args=[obj.post.id]), obj.post.title)
        return '-'
    def changelist_view(self, request, extra_context=None):
        return redirect('admin-media-library')


# ---------- Custom admin views (routes hooked from core.admin.get_urls) ----------
@custom_admin_site.admin_view
@require_GET
def admin_dashboard_view(request):
    """Renders admin/index.html (custom dashboard)."""
    if not request.user.is_staff:
        raise Http404
    context = custom_admin_site.each_context(request)

    posts_qs = Post.objects.all()
    posts_count = posts_qs.count()
    published_count = posts_qs.filter(status='published').count()
    draft_count = posts_qs.filter(status='draft').count()
    today = timezone.now().date()
    today_posts = Post.objects.filter(created_at__date=today).count()
    comments_count = Comment.objects.count()
    pending_comments = Comment.objects.filter(is_moderated=False).count()
    users_count = CustomUser.objects.count()
    total_views = PostView.objects.count()

    recent_posts = Post.objects.order_by('-created_at')[:8]
    recent_comments = Comment.objects.select_related('post').order_by('-created_at')[:8]

    context.update({
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
    })
    return render(request, 'admin/index.html', context)


@custom_admin_site.admin_view
@require_GET
def admin_stats_api(request):
    """JSON API with series for last N days (posts/comments/views)."""
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


@custom_admin_site.admin_view
@require_POST
def admin_post_update_view(request):
    """AJAX inline update for fields like title/status/published_at."""
    if not request.user.is_staff:
        return JsonResponse({'success': False, 'message': 'permission denied'}, status=403)
    try:
        data = json.loads(request.body.decode('utf-8') or '{}')
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
        logger.exception("Error saving post inline update")
        return JsonResponse({'success': False, 'message': f'Error saving: {e}'}, status=500)

    return JsonResponse({'success': True, 'post_id': post.id, 'field': field, 'value': getattr(post, field)})


@custom_admin_site.admin_view
@require_POST
def admin_autosave_view(request):
    """Autosave endpoint: принимает JSON и сохраняет черновик; возвращает id."""
    if not request.user.is_staff:
        return JsonResponse({'success': False, 'message': 'permission denied'}, status=403)
    try:
        data = json.loads(request.body.decode('utf-8') or '{}')
        post_id = data.get('id')
        if post_id:
            post = Post.objects.filter(pk=post_id).first()
            if not post:
                post = Post(author=request.user, status='draft')
        else:
            post = Post(author=request.user, status='draft')

        for f in ('title', 'excerpt', 'content', 'status', 'featured_image'):
            if f in data:
                setattr(post, f, data[f])

        if data.get('published_at'):
            from django.utils.dateparse import parse_datetime, parse_date
            dt = parse_datetime(data['published_at']) or parse_date(data['published_at'])
            if dt:
                post.published_at = dt

        post.save()
        # make reversion note
        try:
            with reversion.create_revision():
                reversion.set_user(request.user)
                reversion.set_comment("Autosave")
                # already saved; reversion will store snapshot
        except Exception:
            # reversion optional; ignore if not configured
            pass

        return JsonResponse({'success': True, 'id': post.id})
    except Exception as e:
        logger.exception("Autosave failed")
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@custom_admin_site.admin_view
@require_POST
def admin_preview_token_view(request):
    """Generates signed token for previewing unsaved content. Accepts JSON with title/content/excerpt/featured_image."""
    if not request.user.is_staff:
        return JsonResponse({'detail': 'permission denied'}, status=403)
    try:
        data = json.loads(request.body.decode('utf-8') or '{}')
        payload = {
            'title': data.get('title', ''),
            'content': data.get('content', ''),
            'excerpt': data.get('excerpt', ''),
            'featured_image': data.get('featured_image', ''),
            'generated_by': request.user.pk,
            'generated_at': timezone.now().isoformat(),
        }
        token = signing.dumps(payload, salt=PREVIEW_SALT)
        return JsonResponse({'token': token})
    except Exception as e:
        logger.exception("Preview token generation failed")
        return JsonResponse({'detail': str(e)}, status=500)


@custom_admin_site.admin_view
@require_GET
def admin_media_library_view(request):
    """Renders media-library page (uses PostAttachment model)."""
    if not request.user.is_staff:
        raise Http404

    context = custom_admin_site.each_context(request)

    attachments = []
    try:
        qs = PostAttachment.objects.all().order_by('-uploaded_at')[:1000]
        for a in qs:
            try:
                file_field = getattr(a, 'file', None)
                url = ''
                filename = ''
                if file_field:
                    try:
                        url = file_field.url
                    except Exception:
                        url = ''
                    filename = os.path.basename(file_field.name) if getattr(file_field, 'name', None) else ''
                attachments.append({
                    'id': getattr(a, 'id', None),
                    'title': getattr(a, 'title', '') or filename,
                    'filename': filename,
                    'url': url,
                    'uploaded_at': a.uploaded_at.isoformat() if getattr(a, 'uploaded_at', None) else None,
                    'post_id': a.post.id if getattr(a, 'post', None) else None,
                })
            except Exception:
                logger.exception("Error serializing PostAttachment id=%s", getattr(a, 'id', None))
                continue
    except Exception:
        logger.exception("Error fetching PostAttachment queryset")

    context.update({
        'attachments': attachments,
    })
    return render(request, 'admin/media_library.html', context)
