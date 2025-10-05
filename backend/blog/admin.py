# backend/blog/admin.py
import os
import json
import logging
from django import forms
from django.contrib import admin
from django.contrib.admin.sites import AlreadyRegistered
from django.urls import reverse, path
from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse, Http404, HttpResponse
from django.utils import timezone
from django.views.decorators.http import require_http_methods, require_POST, require_GET
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.core import signing
from django.contrib.auth import get_user_model
from django.db.models.functions import TruncDate
from django.db.models import Count
from django.db import models
from django.utils.safestring import mark_safe

logger = logging.getLogger(__name__)

# Try optional reversion support
try:
    import reversion
    from reversion.admin import VersionAdmin
except Exception:
    reversion = None

    class VersionAdmin(admin.ModelAdmin):
        pass

# Defensive import of blog models (so admin import won't fail hard)
try:
    from .models import (
        Post, Category, Tag, Comment,
        PostReaction, PostView, PostAttachment, MediaLibrary
    )
except Exception:
    Post = Category = Tag = Comment = PostReaction = PostView = PostAttachment = MediaLibrary = None
    logger.exception("Could not import blog.models")

# Try optional PostAdminForm from forms (if present)
try:
    from .forms import PostAdminForm as ExternalPostAdminForm
except Exception:
    ExternalPostAdminForm = None

CustomUser = get_user_model()
PREVIEW_SALT = "post-preview-salt"
PREVIEW_MAX_AGE = 60 * 60  # 1 hour


# -----------------------
# Helpers
# -----------------------
def get_admin_change_url_for_obj(obj, site_name=None):
    if obj is None:
        return None
    try:
        viewname = f"{obj._meta.app_label}_{obj._meta.model_name}_change"
    except Exception:
        return None
    candidates = []
    if site_name:
        candidates.append(site_name)
    candidates.append("admin")
    for ns in candidates:
        try:
            return reverse(f"{ns}:{viewname}", args=[obj.pk])
        except Exception:
            continue
    try:
        return reverse(viewname, args=[obj.pk])
    except Exception:
        return None


def _pretty_change_message(raw):
    if not raw:
        return ""
    try:
        parsed = json.loads(raw)
        return json.dumps(parsed, ensure_ascii=False)
    except Exception:
        try:
            return raw.encode("utf-8", errors="ignore").decode("unicode_escape")
        except Exception:
            return str(raw)


# -----------------------
# Admin views / endpoints
# -----------------------

@require_http_methods(["GET", "POST"])
def admin_media_library_view(request):
    """
    Admin media library view: returns template or JSON list for XHR.
    Allows upload via POST (multipart/form-data).
    """
    if not request.user.is_staff:
        raise Http404("permission denied")

    # POST = upload single file (compat for small uploads)
    if request.method == "POST":
        upload = request.FILES.get("file") or request.FILES.get("image")
        title = request.POST.get("title") or (upload.name if upload else "")
        if not upload:
            return JsonResponse({'success': False, 'error': 'No file provided'}, status=400)
        if PostAttachment is None and MediaLibrary is None:
            return JsonResponse({'success': False, 'error': 'Attachment model not configured'}, status=500)
        try:
            saved_path = default_storage.save(
                f'post_attachments/{timezone.now().strftime("%Y/%m/%d")}/{upload.name}',
                ContentFile(upload.read())
            )
            url = default_storage.url(saved_path)
            # Try save to PostAttachment if exists else to MediaLibrary
            att = None
            try:
                if PostAttachment is not None:
                    att = PostAttachment()
                    att.title = title
                    try:
                        att.uploaded_by = request.user
                    except Exception:
                        pass
                    att.uploaded_at = timezone.now()
                    if hasattr(att, 'file'):
                        att.file.name = saved_path
                    att.save()
                elif MediaLibrary is not None:
                    entry = MediaLibrary()
                    entry.title = title
                    try:
                        entry.uploaded_by = request.user
                    except Exception:
                        pass
                    entry.uploaded_at = timezone.now()
                    if hasattr(entry, 'file'):
                        entry.file.name = saved_path
                    entry.save()
            except Exception:
                logger.exception("Saving attachment entry failed (continue)")

            return JsonResponse({'success': True, 'id': getattr(att, 'id', None), 'url': url, 'title': title})
        except Exception:
            logger.exception("Upload failed")
            return JsonResponse({'success': False, 'error': 'upload_failed'}, status=500)

    # GET
    attachments = []
    try:
        qs = PostAttachment.objects.all().order_by('-uploaded_at')[:500] if PostAttachment is not None else []
        for a in qs:
            try:
                file_field = getattr(a, 'file', None)
                url = ''
                if file_field:
                    try:
                        url = file_field.url
                    except Exception:
                        url = ''
                title = a.title if getattr(a, 'title', None) else (os.path.basename(file_field.name) if file_field and getattr(file_field, 'name', None) else '')
                attachments.append({
                    'id': getattr(a, 'id', None),
                    'title': title,
                    'url': url,
                })
            except Exception:
                logger.exception("Error serializing attachment id=%s", getattr(a, 'id', None))
                continue
    except Exception:
        logger.exception("Error fetching attachments for media library")

    is_xhr = request.headers.get('x-requested-with') == 'XMLHttpRequest' or request.GET.get('format') == 'json'
    if is_xhr:
        return JsonResponse({'attachments': attachments})
    return render(request, 'admin/media_library.html', {'attachments': attachments})


@require_POST
def admin_tiptap_upload_view(request):
    """
    Endpoint to accept file uploads from TipTap editor (drag'n'drop or file selector).
    Returns JSON { success: True, url: '...' } or error.
    """
    if not request.user.is_staff:
        return JsonResponse({'success': False, 'error': 'permission denied'}, status=403)

    upload = request.FILES.get("file") or request.FILES.get("image")
    if not upload:
        return JsonResponse({'success': False, 'error': 'no_file'}, status=400)

    try:
        folder = timezone.now().strftime("post_uploads/%Y/%m/%d/")
        path = default_storage.save(folder + upload.name, ContentFile(upload.read()))
        url = default_storage.url(path)

        # Optionally persist to PostAttachment or MediaLibrary
        try:
            if PostAttachment is not None:
                att = PostAttachment.objects.create(
                    title=upload.name,
                    uploaded_by=request.user if getattr(request, 'user', None) else None,
                    uploaded_at=timezone.now()
                )
                if hasattr(att, 'file'):
                    att.file.name = path
                    att.save()
        except Exception:
            logger.debug("Could not save PostAttachment for uploaded file", exc_info=True)

        return JsonResponse({'success': True, 'url': url})
    except Exception:
        logger.exception("admin_tiptap_upload_view: upload failed")
        return JsonResponse({'success': False, 'error': 'upload_failed'}, status=500)


@require_POST
def admin_preview_token_view(request):
    """
    Create a signed token for previewing a post draft in frontend.
    Expects JSON body with title/content/excerpt/featured_image.
    """
    if not request.user.is_staff:
        return JsonResponse({'detail': 'permission denied'}, status=403)
    try:
        payload = json.loads(request.body.decode('utf-8') or '{}')
        package = {
            'title': payload.get('title', ''),
            'content': payload.get('content', ''),
            'excerpt': payload.get('excerpt', ''),
            'featured_image': payload.get('featured_image', ''),
            'generated_by': request.user.pk,
            'generated_at': timezone.now().isoformat(),
        }
        token = signing.dumps(package, salt=PREVIEW_SALT)
        return JsonResponse({'token': token})
    except Exception:
        logger.exception("Preview token failed")
        return JsonResponse({'detail': 'error'}, status=500)


@require_POST
def admin_autosave_view(request):
    """
    Autosave endpoint used by editor JS. Accepts JSON body,
    creates or updates a Draft post and returns { success: True, id: <post_id> }.
    """
    if not request.user.is_staff:
        return JsonResponse({'success': False, 'message': 'permission denied'}, status=403)
    try:
        payload = json.loads(request.body.decode('utf-8') or '{}')
    except Exception:
        return JsonResponse({'success': False, 'message': 'Invalid JSON'}, status=400)

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
            try:
                setattr(post, f, payload[f])
            except Exception:
                pass
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
            logger.debug("reversion skipped on autosave", exc_info=True)
        return JsonResponse({'success': True, 'id': post.id})
    except Exception:
        logger.exception("Autosave failed")
        return JsonResponse({'success': False, 'message': 'save_failed'}, status=500)


@require_POST
def admin_post_update_view(request):
    """
    Inline post field update used by admin UI (AJAX).
    Payload: { post_id, field, value }
    """
    if not request.user.is_staff:
        return JsonResponse({'success': False, 'message': 'permission denied'}, status=403)
    try:
        data = json.loads(request.body.decode('utf-8') or '{}')
    except Exception:
        return JsonResponse({'success': False, 'message': 'Invalid JSON'}, status=400)

    post_id = data.get('post_id') or data.get('id')
    field = data.get('field')
    value = data.get('value')
    if not post_id or not field:
        return JsonResponse({'success': False, 'message': 'Missing data'}, status=400)
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
            return JsonResponse({'success': False, 'message': 'Invalid datetime'}, status=400)
        post.published_at = dt
    else:
        try:
            setattr(post, field, value)
        except Exception:
            return JsonResponse({'success': False, 'message': 'Invalid value'}, status=400)
    try:
        post.save()
        return JsonResponse({'success': True, 'post_id': post.id, 'field': field, 'value': getattr(post, field)})
    except Exception:
        logger.exception("Inline update failed")
        return JsonResponse({'success': False, 'message': 'save_failed'}, status=500)


@require_GET
def admin_stats_api(request):
    """
    Returns simple time series (posts/comments/views) for the admin dashboard chart.
    ?days=30
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

    posts_qs = []
    comments_qs = []
    views_qs = []
    try:
        if Post is not None:
            posts_qs = (Post.objects.filter(created_at__date__gte=start.date())
                        .annotate(day=TruncDate('created_at'))
                        .values('day').annotate(count=Count('id')).order_by('day'))
    except Exception:
        posts_qs = []
    try:
        if Comment is not None:
            comments_qs = (Comment.objects.filter(created_at__date__gte=start.date())
                        .annotate(day=TruncDate('created_at'))
                        .values('day').annotate(count=Count('id')).order_by('day'))
    except Exception:
        comments_qs = []
    try:
        if PostView is not None:
            views_qs = (PostView.objects.filter(viewed_at__date__gte=start.date())
                        .annotate(day=TruncDate('viewed_at'))
                        .values('day').annotate(count=Count('id')).order_by('day'))
    except Exception:
        views_qs = []

    labels = [(start + timezone.timedelta(days=i)).date().isoformat() for i in range(days)]

    def build_series(qs):
        mapping = {}
        try:
            mapping = {item['day'].isoformat(): item['count'] for item in qs}
        except Exception:
            mapping = {}
        return [mapping.get(d, 0) for d in labels]

    posts_series = build_series(posts_qs)
    comments_series = build_series(comments_qs)
    views_series = build_series(views_qs)
    return JsonResponse({'labels': labels, 'posts': posts_series, 'comments': comments_series, 'views': views_series})


@require_GET
def admin_dashboard_view(request):
    """Renders admin dashboard page (custom)."""
    if not request.user.is_staff:
        raise Http404("permission denied")
    posts_count = Post.objects.count() if Post else 0
    comments_count = Comment.objects.count() if Comment else 0
    users_count = CustomUser.objects.count() if CustomUser else 0
    app_list = []
    try:
        app_list = admin.site.get_app_list(request)
    except Exception:
        app_list = []
    ctx_base = admin.site.each_context(request)
    context = dict(ctx_base, title="Admin dashboard", posts_count=posts_count, comments_count=comments_count, users_count=users_count, app_list=app_list)
    return render(request, "admin/dashboard.html", context)


# -----------------------
# Admin classes (ModelAdmin)
# -----------------------
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("title", "slug", "post_count")
    prepopulated_fields = {"slug": ("title",)}

    def post_count(self, obj):
        try:
            return obj.posts.count()
        except Exception:
            return 0
    post_count.short_description = "Постов"


class TagAdmin(admin.ModelAdmin):
    list_display = ("title", "slug", "post_count")
    prepopulated_fields = {"slug": ("title",)}

    def post_count(self, obj):
        try:
            return obj.posts.count()
        except Exception:
            return 0
    post_count.short_description = "Постов"


class CommentAdmin(admin.ModelAdmin):
    list_display = ("shorter_name", "post_link", "user", "short_content", "is_public", "is_moderated", "created_at")
    list_editable = ("is_public", "is_moderated")

    def shorter_name(self, obj):
        return getattr(obj, "name", "")[:30]

    def post_link(self, obj):
        try:
            post = getattr(obj, "post", None)
            site_name = getattr(custom_admin_site, "name", None) if 'custom_admin_site' in globals() else None
            url = get_admin_change_url_for_obj(post, site_name=site_name)
            if post and url:
                from django.utils.html import format_html
                return format_html('<a href="{}">{}</a>', url, getattr(post, "title", ""))
        except Exception:
            pass
        return "-"

    def short_content(self, obj):
        txt = getattr(obj, "content", "") or ""
        return txt[:100] + ("..." if len(txt) > 100 else "")


class PostReactionAdmin(admin.ModelAdmin):
    list_display = ("post", "likes_count", "updated_at")

    def likes_count(self, obj):
        try:
            return obj.likes_count()
        except Exception:
            return 0


class MediaLibraryAdmin(admin.ModelAdmin):
    list_display = ("title", "uploaded_by", "uploaded_at", "post_link")

    def post_link(self, obj):
        try:
            if getattr(obj, "post", None):
                site_name = getattr(custom_admin_site, "name", None) if 'custom_admin_site' in globals() else None
                url = get_admin_change_url_for_obj(obj.post, site_name=site_name)
                from django.utils.html import format_html
                if url:
                    return format_html('<a href="{}">{}</a>', url, obj.post.title)
        except Exception:
            pass
        return "-"

    def changelist_view(self, request, extra_context=None):
        # Redirect to unified admin media library route
        return redirect("admin-media-library")


# -----------------------
# Post admin form & registration
# -----------------------
# Use external PostAdminForm if provided; else we declare our own with TipTap widget
if ExternalPostAdminForm:
    PostAdminForm = ExternalPostAdminForm
else:
    try:
        from .widgets import TipTapWidget  # ensure name exists
    except Exception:
        TipTapWidget = None

    class PostAdminForm(forms.ModelForm):
        class Meta:
            model = Post
            fields = "__all__"
            widgets = {}
            if TipTapWidget is not None:
                widgets['content'] = TipTapWidget(
                    attrs={'class': 'admin-tiptap-textarea'},
                    upload_url='/admin/blog/upload-image/',
                    preview_token_url='/admin/posts/preview-token/'
                )

# Define PostAdmin (robust)
@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    form = PostAdminForm
    change_form_template = 'admin/blog/post/change_form.html'
    list_display = ("title", "status", "author", "published_at")
    search_fields = ("title", "content")
    prepopulated_fields = {"slug": ("title",)}
    ordering = ("-published_at",)

    class Media:
        js = ('admin/js/tiptap_admin_extra.js',)
        css = {'all': ('admin/css/tiptap_admin.css',)}


# -----------------------
# Registration helper & attach custom URLs
# -----------------------
def _ensure_registered(site_obj, model, admin_class=None):
    if model is None:
        return
    try:
        if model not in getattr(site_obj, "_registry", {}):
            if admin_class:
                site_obj.register(model, admin_class)
            else:
                site_obj.register(model)
    except AlreadyRegistered:
        pass
    except Exception:
        logger.exception("Could not register %s on %s", getattr(model, "__name__", model), getattr(site_obj, "name", site_obj))


custom_admin_site = None  # will be set by register_admin_models()


def register_admin_models(site_obj):
    """
    Register admin models into provided admin site (safe).
    Also attaches a few custom admin URLs.
    """
    global custom_admin_site
    custom_admin_site = site_obj or admin.site

    # Register models
    try:
        _ensure_registered(custom_admin_site, Post, PostAdmin)
        _ensure_registered(custom_admin_site, Category, CategoryAdmin)
        _ensure_registered(custom_admin_site, Tag, TagAdmin)
        _ensure_registered(custom_admin_site, Comment, CommentAdmin)
        _ensure_registered(custom_admin_site, PostReaction, PostReactionAdmin)

        if PostAttachment is not None:
            _ensure_registered(custom_admin_site, MediaLibrary, MediaLibraryAdmin)
            try:
                _ensure_registered(custom_admin_site, PostAttachment, MediaLibraryAdmin)
            except Exception:
                pass

        try:
            _ensure_registered(custom_admin_site, CustomUser)
        except Exception:
            pass
    except Exception:
        logger.exception("bulk registration failed")

    # Add custom admin URLs (wrap get_urls)
    def get_admin_urls(original_get_urls):
        def wrapped_get_urls():
            try:
                base_urls = original_get_urls()
            except Exception:
                try:
                    base_urls = super(type(custom_admin_site), custom_admin_site).get_urls()
                except Exception:
                    base_urls = []

            custom_urls = [
                path("dashboard/", admin_dashboard_view, name="admin-dashboard"),
                path("dashboard/stats-data/", admin_stats_api, name="admin-dashboard-stats"),
                path("media-library/", admin_media_library_view, name="admin-media-library"),
                path("posts/update/", admin_post_update_view, name="admin-post-update"),
                path("posts/autosave/", admin_autosave_view, name="admin-autosave"),
                path("posts/preview-token/", admin_preview_token_view, name="admin-preview-token"),
                path("upload-image/", admin_tiptap_upload_view, name="admin-blog-upload"),
            ]
            return custom_urls + base_urls
        return wrapped_get_urls

    try:
        current_get_urls = getattr(custom_admin_site, "get_urls", None)
        already_wrapped = getattr(current_get_urls, "_is_wrapped_by_blog_admin", False)
        if not already_wrapped:
            orig_get_urls = current_get_urls or (lambda: super(type(custom_admin_site), custom_admin_site).get_urls())
            wrapped = get_admin_urls(orig_get_urls)
            setattr(wrapped, "_is_wrapped_by_blog_admin", True)
            custom_admin_site.get_urls = wrapped
    except Exception:
        logger.exception("Failed to attach custom urls to custom_admin_site", exc_info=True)

    return True


# Ensure default registrations on import (safe)
try:
    # register into default admin.site as well (if not already)
    _ensure_registered(admin.site, Category, CategoryAdmin)
    _ensure_registered(admin.site, Tag, TagAdmin)
    _ensure_registered(admin.site, Comment, CommentAdmin)
    _ensure_registered(admin.site, PostReaction, PostReactionAdmin)
    if PostAttachment is not None:
        _ensure_registered(admin.site, MediaLibrary, MediaLibraryAdmin)
        try:
            _ensure_registered(admin.site, PostAttachment, MediaLibraryAdmin)
        except Exception:
            pass
except Exception:
    logger.exception("Initial safe registrations failed")
