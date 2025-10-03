# backend/blog/admin.py
import os
import json
import logging
from django.contrib import admin
from django.contrib.admin.sites import AlreadyRegistered
from django.urls import reverse, NoReverseMatch
from django.shortcuts import render, redirect
from django.http import JsonResponse, Http404
from django.utils import timezone
from django.db.models import Count
from django.db.models.functions import TruncDate
from django.views.decorators.http import require_http_methods, require_POST, require_GET
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.core import signing
from django.conf import settings
from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)

# Optional: django-reversion safe import
try:
    import reversion
    from reversion.admin import VersionAdmin
    REVERSION_AVAILABLE = True
except Exception:
    reversion = None
    class VersionAdmin(admin.ModelAdmin):
        pass
    REVERSION_AVAILABLE = False

# Try to import custom_admin_site (if you use a separate AdminSite instance)
try:
    from backend.core.admin import custom_admin_site
except Exception:
    custom_admin_site = admin.site

# Import models from blog.models
try:
    from .models import (
        Post, Category, Tag, Comment, PostReaction, PostView,
        PostAttachment, MediaLibrary
    )
except Exception as e:
    logger.exception("Could not import blog.models: %s", e)
    Post = Category = Tag = Comment = PostReaction = PostView = PostAttachment = MediaLibrary = None

# Import forms / widgets if present (PostAdmin form for TipTap can be provided)
try:
    from .forms import PostAdminForm
except Exception:
    PostAdminForm = None

PREVIEW_SALT = "post-preview-salt"
CustomUser = get_user_model()

# ----------------------------
# Utility: admin change URL resolution (respects custom_admin_site name)
# ----------------------------
def get_admin_change_url_for_obj(obj):
    if obj is None:
        return None
    try:
        viewname = f"{obj._meta.app_label}_{obj._meta.model_name}_change"
    except Exception:
        return None
    candidates = []
    try:
        if custom_admin_site and getattr(custom_admin_site, 'name', None):
            candidates.append(getattr(custom_admin_site, 'name'))
    except Exception:
        pass
    candidates.append('admin')
    for ns in candidates:
        try:
            return reverse(f"{ns}:{viewname}", args=[obj.pk])
        except Exception:
            continue
    try:
        return reverse(viewname, args=[obj.pk])
    except Exception:
        return None

# ----------------------------
# Admin classes
# ----------------------------
class BasePostAdmin(VersionAdmin):
    if PostAdminForm:
        form = PostAdminForm
    change_form_template = 'admin/blog/post/change_form.html'
    list_display = ('admin_thumbnail', 'title', 'status', 'author', 'published_at')
    list_filter = ('status', 'published_at', 'categories', 'tags') if Post is not None else ()
    search_fields = ('title', 'content')
    prepopulated_fields = {'slug': ('title',)}
    date_hierarchy = 'published_at'
    ordering = ('-published_at',)
    filter_horizontal = ('categories', 'tags') if Post is not None else ()
    inlines = []
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
        if not obj:
            return "—"
        try:
            if getattr(obj, 'featured_image', None):
                return format_html('<img src="{}" style="width:56px;height:42px;object-fit:cover;border-radius:6px;border:1px solid #e6edf3" />', obj.featured_image)
        except Exception:
            pass
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
            old_slug = getattr(p, 'slug', '') or ''
            p.pk = None
            p.slug = f"{old_slug}-copy"
            p.title = f"{getattr(p, 'title', '')} (копия)"
            p.status = 'draft'
            p.save()
            created += 1
        self.message_user(request, f"Создано {created} копий.")
    duplicate_post.short_description = "Создать копии"

class CategoryAdmin(admin.ModelAdmin):
    list_display = ('title', 'slug', 'post_count')
    prepopulated_fields = {'slug': ('title',)}
    def post_count(self, obj):
        try:
            return obj.posts.count()
        except Exception:
            return 0
    post_count.short_description = "Постов"

class TagAdmin(admin.ModelAdmin):
    list_display = ('title', 'slug', 'post_count')
    prepopulated_fields = {'slug': ('title',)}
    def post_count(self, obj):
        try:
            return obj.posts.count()
        except Exception:
            return 0
    post_count.short_description = "Постов"

class CommentAdmin(admin.ModelAdmin):
    list_display = ('shorter_name', 'post_link', 'user', 'short_content', 'is_public', 'is_moderated', 'created_at')
    list_editable = ('is_public', 'is_moderated')
    def shorter_name(self, obj): return getattr(obj, 'name', '')[:30]
    def post_link(self, obj):
        try:
            post = getattr(obj, 'post', None)
            url = get_admin_change_url_for_obj(post)
            if post and url:
                return format_html('<a href="{}">{}</a>', url, getattr(post, 'title', ''))
        except Exception:
            pass
        return '-'
    def short_content(self, obj): return (getattr(obj, 'content', '')[:100] + ('...' if len(getattr(obj, 'content', '')) > 100 else ''))

class PostReactionAdmin(admin.ModelAdmin):
    list_display = ('post', 'likes_count', 'updated_at')
    def likes_count(self, obj):
        try:
            return obj.likes_count()
        except Exception:
            return 0

class MediaLibraryAdmin(admin.ModelAdmin):
    list_display = ('title', 'uploaded_by', 'uploaded_at', 'post_link')
    def post_link(self, obj):
        try:
            if obj.post:
                url = get_admin_change_url_for_obj(obj.post)
                if url:
                    return format_html('<a href="{}">{}</a>', url, obj.post.title)
        except Exception:
            pass
        return '-'
    def changelist_view(self, request, extra_context=None):
        return redirect('admin-media-library')

# ----------------------------
# Admin views (exported functions)
# ----------------------------
@require_http_methods(["GET", "POST"])
def admin_media_library_view(request):
    if not request.user.is_staff:
        raise Http404("permission denied")
    if request.method == 'POST':
        upload = request.FILES.get('file') or request.FILES.get('image')
        title = request.POST.get('title') or (upload.name if upload else '')
        if not upload:
            return JsonResponse({'success': False, 'error': 'No file provided'}, status=400)
        try:
            if PostAttachment is None:
                return JsonResponse({'success': False, 'error': 'PostAttachment model not configured'}, status=500)
            att = PostAttachment()
            att.title = title
            try:
                att.uploaded_by = request.user
            except Exception:
                pass
            att.uploaded_at = timezone.now()
            saved_path = default_storage.save(f'uploads/{timezone.now().strftime("%Y/%m/%d")}/{upload.name}', ContentFile(upload.read()))
            try:
                if hasattr(att, 'file'):
                    att.file.name = saved_path
            except Exception:
                pass
            att.save()
            url = default_storage.url(saved_path)
            return JsonResponse({'success': True, 'id': getattr(att, 'id', None), 'url': url, 'title': att.title})
        except Exception as e:
            logger.exception('Upload failed')
            return JsonResponse({'success': False, 'error': str(e)}, status=500)
    attachments = PostAttachment.objects.all().order_by('-uploaded_at')[:500] if PostAttachment is not None else []
    is_xhr = request.headers.get('x-requested-with') == 'XMLHttpRequest' or request.GET.get('format') == 'json'
    if is_xhr:
        data = [{'id': a.id, 'title': a.title or os.path.basename(getattr(a.file, 'name', '')), 'url': getattr(a.file, 'url', '')} for a in attachments]
        return JsonResponse({'attachments': data})
    context = {'attachments': attachments}
    return render(request, 'admin/media_library.html', context)

@require_POST
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

@require_POST
def admin_autosave_view(request):
    if not request.user.is_staff:
        return JsonResponse({'success': False, 'message': 'permission denied'}, status=403)
    try:
        payload = json.loads(request.body.decode('utf-8') or '{}')
    except Exception as e:
        return JsonResponse({'success': False, 'message': f'Invalid JSON: {e}'}, status=400)
    post_id = payload.get('id')
    if post_id:
        post = Post.objects.filter(pk=post_id).first() if Post is not None else None
        if not post and Post is not None:
            post = Post(author=request.user, status='draft')
    else:
        post = Post(author=request.user, status='draft') if Post is not None else None
    if post is None:
        return JsonResponse({'success': False, 'message': 'Post model not available'}, status=500)
    for f in ('title', 'excerpt', 'content', 'featured_image'):
        if f in payload:
            setattr(post, f, payload[f])
    if 'content_json' in payload:
        try:
            post.content_json = payload['content_json']
        except Exception:
            pass
    if payload.get('published_at'):
        from django.utils.dateparse import parse_datetime, parse_date
        dt = parse_datetime(payload['published_at']) or parse_date(payload['published_at'])
        if dt:
            post.published_at = dt
    try:
        post.save()
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

@require_POST
def admin_post_update_view(request):
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
    except Exception:
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
        return JsonResponse({'success': True, 'post_id': post.id, 'field': field, 'value': getattr(post, field)})
    except Exception as e:
        logger.exception("Error saving post inline update")
        return JsonResponse({'success': False, 'message': f'Error saving: {e}'}, status=500)

# pretty-print change_message helper
def _pretty_change_message(raw):
    try:
        parsed = json.loads(raw)
        return json.dumps(parsed, ensure_ascii=False)
    except Exception:
        try:
            return raw.encode('utf-8', errors='ignore').decode('unicode_escape')
        except Exception:
            return str(raw)

@require_GET
def admin_dashboard_view(request):
    if not request.user.is_staff:
        raise Http404("permission denied")
    try:
        posts_count = Post.objects.count() if Post is not None else 0
        published_count = Post.objects.filter(status='published').count() if Post is not None else 0
        draft_count = Post.objects.filter(status='draft').count() if Post is not None else 0
        today = timezone.now().date()
        today_posts = Post.objects.filter(created_at__date=today).count() if Post is not None else 0
        comments_count = Comment.objects.count() if Comment is not None else 0
        users_count = CustomUser.objects.count() if CustomUser is not None else 0
        total_views = PostView.objects.count() if PostView is not None else 0
        recent_posts = []
        if Post is not None:
            for p in Post.objects.order_by('-created_at')[:8]:
                recent_posts.append({
                    'id': p.pk,
                    'title': getattr(p, 'title', '')[:120],
                    'url': get_admin_change_url_for_obj(p),
                    'published_at': getattr(p, 'published_at', None).isoformat() if getattr(p, 'published_at', None) else None,
                })
        recent_comments = []
        if Comment is not None:
            for c in Comment.objects.select_related('post').order_by('-created_at')[:8]:
                recent_comments.append({
                    'id': c.pk,
                    'post_title': getattr(c.post, 'title', '') if getattr(c, 'post', None) else '',
                    'post_url': get_admin_change_url_for_obj(getattr(c, 'post', None)),
                    'name': getattr(c, 'name', '')[:80],
                    'content': getattr(c, 'content', '')[:160],
                    'created_at': getattr(c, 'created_at', None).isoformat() if getattr(c, 'created_at', None) else None,
                })
        from django.contrib.admin.models import LogEntry
        recent_logs = []
        for le in LogEntry.objects.select_related('user').order_by('-action_time')[:10]:
            recent_logs.append({
                'id': le.pk,
                'user': getattr(le.user, 'username', str(le.user)),
                'action_time': le.action_time.isoformat() if getattr(le, 'action_time', None) else None,
                'object_repr': getattr(le, 'object_repr', '')[:140],
                'change_message': _pretty_change_message(getattr(le, 'change_message', '')),
                'action_flag': le.action_flag,
            })
        app_list = []
        try:
            if custom_admin_site:
                app_list = custom_admin_site.get_app_list(request)
        except Exception:
            try:
                app_list = admin.site.get_app_list(request)
            except Exception:
                app_list = []
        context = {
            'title': 'Dashboard',
            'posts_count': posts_count,
            'published_count': published_count,
            'draft_count': draft_count,
            'today_posts': today_posts,
            'comments_count': comments_count,
            'users_count': users_count,
            'total_views': total_views,
            'recent_posts': recent_posts,
            'recent_comments': recent_comments,
            'log_entries': recent_logs,
            'app_list': app_list,
        }
        try:
            return render(request, 'admin/dashboard.html', context)
        except Exception as e:
            logger.exception("Failed to render custom dashboard template, falling back to JSON: %s", e)
            return JsonResponse(context)
    except Exception as exc:
        logger.exception("Unexpected error building dashboard")
        return JsonResponse({'error': 'dashboard_error', 'detail': str(exc)}, status=500)

# ----------------------------
# Register models robustly on both admin.site and custom_admin_site
# ----------------------------
def _ensure_registered(site, model, admin_class=None):
    if model is None:
        return
    try:
        if model not in getattr(site, "_registry", {}):
            if admin_class:
                site.register(model, admin_class)
            else:
                site.register(model)
    except AlreadyRegistered:
        pass
    except Exception:
        logger.exception("Could not register model %s on site %s", getattr(model, '__name__', str(model)), getattr(site, 'name', str(site)))

try:
    _ensure_registered(admin.site, Post, BasePostAdmin)
    _ensure_registered(custom_admin_site, Post, BasePostAdmin)
    _ensure_registered(admin.site, Category, CategoryAdmin)
    _ensure_registered(custom_admin_site, Category, CategoryAdmin)
    _ensure_registered(admin.site, Tag, TagAdmin)
    _ensure_registered(custom_admin_site, Tag, TagAdmin)
    _ensure_registered(admin.site, Comment, CommentAdmin)
    _ensure_registered(custom_admin_site, Comment, CommentAdmin)
    _ensure_registered(admin.site, PostReaction, PostReactionAdmin)
    _ensure_registered(custom_admin_site, PostReaction, PostReactionAdmin)
    if PostAttachment is not None:
        _ensure_registered(admin.site, MediaLibrary, MediaLibraryAdmin)
        _ensure_registered(custom_admin_site, MediaLibrary, MediaLibraryAdmin)
        try:
            _ensure_registered(admin.site, PostAttachment, MediaLibraryAdmin)
            _ensure_registered(custom_admin_site, PostAttachment, MediaLibraryAdmin)
        except Exception:
            pass
except Exception:
    logger.exception("Error while bulk registering blog admin models")
