# backend/blog/admin.py
import os, json, logging
from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.shortcuts import render, redirect
from django.http import JsonResponse, Http404
from django.utils import timezone
from django.db.models import Count
from django.db.models.functions import TruncDate
from django.views.decorators.http import require_http_methods
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.core import signing
from django.conf import settings
from django.contrib.auth import get_user_model
from django.views.decorators.http import require_POST, require_GET
from django.utils.dateparse import parse_datetime, parse_date

logger = logging.getLogger(__name__)

try:
    import reversion
    from reversion.admin import VersionAdmin
    REVERSION_AVAILABLE = True
except Exception:
    reversion = None
    class VersionAdmin(admin.ModelAdmin):
        pass
    REVERSION_AVAILABLE = False

try:
    from backend.core.admin import custom_admin_site
except Exception:
    from django.contrib.admin import site as custom_admin_site

from .models import Post, Category, Tag, Comment, PostReaction, PostView, PostAttachment, MediaLibrary
from .forms import PostAdminForm

PREVIEW_SALT = 'post-preview-salt'

CustomUser = get_user_model()

@admin.register(CustomUser, site=custom_admin_site)
class CustomUserAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'is_staff', 'is_active', 'date_joined')
    search_fields = ('username', 'email')

class CommentInline(admin.TabularInline):
    model = Comment
    extra = 0
    readonly_fields = ('created_at',)
    fields = ('name', 'content', 'is_public', 'is_moderated', 'created_at')

BaseAdmin = VersionAdmin if REVERSION_AVAILABLE else admin.ModelAdmin

@admin.register(Post, site=custom_admin_site)
class PostAdmin(BaseAdmin):
    form = PostAdminForm
    change_form_template = 'admin/blog/post/change_form.html'
    list_display = ('admin_thumbnail', 'title', 'status', 'author', 'published_at')
    list_filter = ('status', 'published_at', 'categories', 'tags')
    search_fields = ('title', 'content')
    prepopulated_fields = {'slug': ('title',)}
    date_hierarchy = 'published_at'
    ordering = ('-published_at',)
    filter_horizontal = ('categories', 'tags')
    inlines = [CommentInline]
    actions = ['make_published', 'make_draft', 'duplicate_post']

    fieldsets = (
        ('Основная информация', {'fields': ('title', 'slug', 'author', 'status', 'published_at')}),
        ('Содержание', {'fields': ('excerpt', 'content', 'content_json', 'featured_image')}),
        ('Категории и теги', {'fields': ('categories', 'tags')}),
        ('SEO', {'fields': ('meta_title', 'meta_description', 'og_image'), 'classes': ('collapse',)}),
    )

    class Media:
        css = {'all': ('admin/css/admin-post-form.css',)}
        js = ('admin/js/tiptap-editor.js',)

    def admin_thumbnail(self, obj):
        if obj.featured_image:
            return format_html('<img src="{}" style="width:56px;height:42px;object-fit:cover;border-radius:6px;border:1px solid #e6edf3" />', obj.featured_image)
        return '—'
    admin_thumbnail.short_description = 'Изображение'

    def make_published(self, request, queryset):
        updated = queryset.update(status='published')
        self.message_user(request, f"{updated} постов опубликовано.")
    make_published.short_description = 'Опубликовать выбранные'

    def make_draft(self, request, queryset):
        updated = queryset.update(status='draft')
        self.message_user(request, f"{updated} постов переведено в черновики.")
    make_draft.short_description = 'Перевести в черновики'

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
    duplicate_post.short_description = 'Создать копии'

@admin.register(Category, site=custom_admin_site)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('title', 'slug', 'post_count')
    prepopulated_fields = {'slug': ('title',)}
    def post_count(self, obj): return obj.posts.count()
    post_count.short_description = 'Постов'

@admin.register(Tag, site=custom_admin_site)
class TagAdmin(admin.ModelAdmin):
    list_display = ('title', 'slug', 'post_count')
    prepopulated_fields = {'slug': ('title',)}
    def post_count(self, obj): return obj.posts.count()
    post_count.short_description = 'Постов'

@admin.register(Comment, site=custom_admin_site)
class CommentAdmin(admin.ModelAdmin):
    list_display = ('shorter_name', 'post_link', 'user', 'short_content', 'is_public', 'is_moderated', 'created_at')
    list_editable = ('is_public', 'is_moderated')
    def shorter_name(self, obj): return obj.name[:30]
    def post_link(self, obj):
        try:
            return format_html('<a href="{}">{}</a>', reverse('admin:blog_post_change', args=[obj.post.id]), obj.post.title)
        except Exception:
            return '-'
    def short_content(self, obj): return obj.content[:100] + ('...' if len(obj.content) > 100 else '')

@admin.register(PostReaction, site=custom_admin_site)
class PostReactionAdmin(admin.ModelAdmin):
    list_display = ('post', 'likes_count', 'updated_at')
    def likes_count(self, obj): return obj.likes_count()

@admin.register(MediaLibrary, site=custom_admin_site)
class MediaLibraryAdmin(admin.ModelAdmin):
    list_display = ('title', 'uploaded_by', 'uploaded_at', 'post_link')
    def post_link(self, obj):
        if obj.post: return format_html('<a href="{}">{}</a>', reverse('admin:blog_post_change', args=[obj.post.id]), obj.post.title)
        return '-'
    def changelist_view(self, request, extra_context=None):
        return redirect('admin:admin_media_library')

@custom_admin_site.admin_view
@require_http_methods(['GET', 'POST'])
def admin_media_library_view(request):
    if not request.user.is_staff:
        raise Http404

    if request.method == 'POST':
        upload = request.FILES.get('file') or request.FILES.get('image')
        title = request.POST.get('title') or (upload.name if upload else '')
        if not upload:
            return JsonResponse({'success': False, 'error': 'No file provided'}, status=400)
        try:
            att = PostAttachment()
            att.title = title
            try:
                att.uploaded_by = request.user
            except Exception:
                pass
            att.uploaded_at = timezone.now()
            saved_path = default_storage.save(f'uploads/{timezone.now().strftime("%Y/%m/%d")}/{upload.name}', ContentFile(upload.read()))
            try:
                att.file.name = saved_path
            except Exception:
                pass
            att.save()
            url = default_storage.url(saved_path)
            return JsonResponse({'success': True, 'id': getattr(att, 'id', None), 'url': url, 'title': att.title})
        except Exception as e:
            logger.exception('Upload failed')
            return JsonResponse({'success': False, 'error': str(e)}, status=500)

    attachments = PostAttachment.objects.all().order_by('-uploaded_at')[:500]
    is_xhr = request.headers.get('x-requested-with') == 'XMLHttpRequest'
    if is_xhr or request.GET.get('format') == 'json':
        data = [{'id': a.id, 'title': a.title or os.path.basename(getattr(a.file, 'name', '')), 'url': getattr(a.file, 'url', '')} for a in attachments]
        return JsonResponse({'attachments': data})

    context = custom_admin_site.each_context(request)
    context.update({'attachments': attachments})
    return render(request, 'admin/media_library.html', context)

@custom_admin_site.admin_view
@require_http_methods(['POST'])
def admin_preview_token_view(request):
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
        logger.exception('Preview token generation failed')
        return JsonResponse({'detail': str(e)}, status=500)

# ---------- Dashboard view ----------
@custom_admin_site.admin_view
@require_GET
def admin_dashboard_view(request):
    """
    Custom dashboard for admin. Returns rendered template 'admin/index.html' with stats.
    If template отсутствует, возвращает JSON (safe fallback).
    """
    if not request.user.is_staff:
        raise Http404("permission denied")

    context = custom_admin_site.each_context(request)
    try:
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

        # Prefer rendering admin/index.html if present
        try:
            return render(request, 'admin/index.html', context)
        except Exception:
            # Fallback JSON for safety if template missing
            return JsonResponse({
                'ok': True,
                'posts_count': posts_count,
                'published_count': published_count,
                'draft_count': draft_count,
                'today_posts': today_posts,
                'comments_count': comments_count,
                'pending_comments': pending_comments,
                'users_count': users_count,
                'total_views': total_views,
            })
    except Exception as e:
        logger.exception("Error building dashboard")
        raise

# ---------- Autosave endpoint ----------
@custom_admin_site.admin_view
@require_POST
def admin_autosave_view(request):
    """
    Receives JSON with draft data and saves/updates a draft Post.
    Returns JSON: {'success': True, 'id': post.id}
    """
    if not request.user.is_staff:
        return JsonResponse({'success': False, 'message': 'permission denied'}, status=403)
    try:
        payload = json.loads(request.body.decode('utf-8') or '{}')
    except Exception as e:
        return JsonResponse({'success': False, 'message': f'Invalid JSON: {e}'}, status=400)

    post_id = payload.get('id')
    if post_id:
        post = Post.objects.filter(pk=post_id).first()
        if not post:
            # create new draft with provided author
            post = Post(author=request.user, status='draft')
    else:
        post = Post(author=request.user, status='draft')

    # safe assign fields
    for f in ('title', 'excerpt', 'content', 'featured_image'):
        if f in payload:
            setattr(post, f, payload[f])

    # handle TipTap JSON if present
    if 'content_json' in payload:
        try:
            post.content_json = payload['content_json']
        except Exception:
            # ignore if not JSON serializable
            pass

    if payload.get('published_at'):
        dt = parse_datetime(payload['published_at']) or parse_date(payload['published_at'])
        if dt:
            post.published_at = dt

    try:
        post.save()
        # optional: create reversion revision if available
        try:
            if reversion:
                with reversion.create_revision():
                    reversion.set_user(request.user)
                    reversion.set_comment("Autosave")
        except Exception:
            logger.debug("reversion autosave skipped", exc_info=True)

        return JsonResponse({'success': True, 'id': post.id})
    except Exception as e:
        logger.exception("Autosave save failed")
        return JsonResponse({'success': False, 'message': str(e)}, status=500)

# ---------- Inline/quick post update endpoint ----------
@custom_admin_site.admin_view
@require_POST
def admin_post_update_view(request):
    """
    Quick AJAX inline update for simple fields (title/status/published_at).
    Expects JSON: {post_id, field, value}
    """
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
        dt = parse_datetime(value) or parse_date(value)
        if not dt:
            return JsonResponse({'success': False, 'message': 'Invalid datetime format'}, status=400)
        post.published_at = dt
    else:
        setattr(post, field, value)

    try:
        post.save()
        return JsonResponse({'success': True, 'post_id': post.id, 'field': field, 'value': getattr(post, field)})
    except Exception as e:
        logger.exception("Error saving post inline update")
        return JsonResponse({'success': False, 'message': f'Error saving: {e}'}, status=500)
    
# ---------------- admin_stats_api ----------------
from django.views.decorators.http import require_GET
from django.http import JsonResponse
from django.utils import timezone

@custom_admin_site.admin_view
@require_GET
def admin_stats_api(request):
    """
    Возвращает JSON-серии (posts, comments, views) за последние N дней.
    Параметр: ?days=30 (по умолчанию 30).
    Формат ответа:
    {
      "labels": ["2025-09-01", ...],
      "posts": [0,1,2,...],
      "comments": [0,2,1,...],
      "views": [10,5,8,...]
    }
    """
    if not request.user.is_staff:
        return JsonResponse({'detail': 'permission denied'}, status=403)

    try:
        days = int(request.GET.get('days', 30))
    except Exception:
        days = 30
    if days <= 0 or days > 365:
        days = 30

    now = timezone.now()
    start = now - timezone.timedelta(days=days - 1)

    # Защита: если модели не импортированы корректно, возвращаем нулевые серии
    try:
        posts_qs = (
            Post.objects.filter(created_at__date__gte=start.date())
            .annotate(day=TruncDate('created_at'))
            .values('day')
            .annotate(count=Count('id'))
            .order_by('day')
        )
    except Exception:
        posts_qs = []

    try:
        comments_qs = (
            Comment.objects.filter(created_at__date__gte=start.date())
            .annotate(day=TruncDate('created_at'))
            .values('day')
            .annotate(count=Count('id'))
            .order_by('day')
        )
    except Exception:
        comments_qs = []

    try:
        views_qs = (
            PostView.objects.filter(viewed_at__date__gte=start.date())
            .annotate(day=TruncDate('viewed_at'))
            .values('day')
            .annotate(count=Count('id'))
            .order_by('day')
        )
    except Exception:
        views_qs = []

    # Prepare labels
    labels = []
    for i in range(days):
        d = (start + timezone.timedelta(days=i)).date()
        labels.append(d.isoformat())

    posts_series = [0] * days
    comments_series = [0] * days
    views_series = [0] * days

    def fill_series(qs, target):
        try:
            mapping = {q['day'].isoformat(): q['count'] for q in qs}
        except Exception:
            mapping = {}
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