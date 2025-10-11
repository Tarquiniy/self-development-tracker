# backend/blog/admin.py
import os
import json
import logging
from django import forms
from django.contrib import admin
from django.contrib.admin.sites import AlreadyRegistered
from django.urls import reverse, path
from django.shortcuts import render, redirect
from django.http import JsonResponse, Http404
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
from django.utils.html import escape

logger = logging.getLogger(__name__)

# Optional reversion support
try:
    import reversion
    from reversion.admin import VersionAdmin
except Exception:
    reversion = None
    class VersionAdmin(admin.ModelAdmin):
        pass

# Import models
try:
    from .models import (
        Post, Category, Tag, Comment,
        PostReaction, PostView, PostAttachment, MediaLibrary
    )
except Exception:
    Post = Category = Tag = Comment = PostReaction = PostView = PostAttachment = MediaLibrary = None
    logger.exception("Could not import blog.models")

CustomUser = get_user_model()
PREVIEW_SALT = "post-preview-salt"

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
# Admin classes
# -----------------------
class BasePostAdmin(VersionAdmin):
    change_form_template = None

    list_display = ("title", "status", "author", "published_at")
    list_filter = ("status", "published_at") if Post is not None else ()
    search_fields = ("title", "content") if Post is not None else ()
    prepopulated_fields = {"slug": ("title",)} if Post is not None else {}
    date_hierarchy = "published_at"
    ordering = ("-published_at",)
    filter_horizontal = ("categories", "tags") if Post is not None else ()
    actions = ["make_published", "make_draft", "duplicate_post"]

    fieldsets = (
        ("Основная информация", {"fields": ("title", "slug", "author", "status", "published_at")}),
        ("Содержание", {"fields": ("excerpt", "content", "featured_image")}),
        ("Категории и теги", {"fields": ("categories", "tags")}),
        ("SEO", {"fields": ("meta_title", "meta_description", "og_image"), "classes": ("collapse",)}),
    )

    def make_published(self, request, queryset):
        updated = queryset.update(status="published")
        self.message_user(request, f"{updated} постов опубликовано.")
    make_published.short_description = "Опубликовать выбранные"

    def make_draft(self, request, queryset):
        updated = queryset.update(status="draft")
        self.message_user(request, f"{updated} постов переведено в черновики.")
    make_draft.short_description = "Перевести в черновики"

    def duplicate_post(self, request, queryset):
        created = 0
        for p in queryset:
            old_slug = getattr(p, "slug", "") or ""
            p.pk = None
            p.slug = f"{old_slug}-copy"
            p.title = f"{getattr(p, 'title', '')} (копия)"
            p.status = "draft"
            p.save()
            created += 1
        self.message_user(request, f"Создано {created} копий.")
    duplicate_post.short_description = "Создать копии"


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
    def shorter_name(self, obj): return getattr(obj, "name", "")[:30]
    def post_link(self, obj):
        try:
            post = getattr(obj, "post", None)
            site_name = getattr(custom_admin_site, "name", None) if custom_admin_site else None
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
                site_name = getattr(custom_admin_site, "name", None) if custom_admin_site else None
                url = get_admin_change_url_for_obj(obj.post, site_name=site_name)
                from django.utils.html import format_html
                if url:
                    return format_html('<a href="{}">{}</a>', url, obj.post.title)
        except Exception:
            pass
        return "-"
    def changelist_view(self, request, extra_context=None):
        return redirect("admin-media-library")

# -----------------------
# Views (exported)
# -----------------------
@require_http_methods(["GET", "POST"])
def admin_media_library_view(request):
    if not request.user.is_staff:
        raise Http404("permission denied")

    if request.method == "POST":
        upload = request.FILES.get("file") or request.FILES.get("image")
        title = request.POST.get("title") or (upload.name if upload else "")
        if not upload:
            return JsonResponse({'success': False, 'error': 'No file provided'}, status=400)
        if PostAttachment is None:
            return JsonResponse({'success': False, 'error': 'PostAttachment model not configured'}, status=500)
        try:
            att = PostAttachment()
            att.title = title
            try:
                att.uploaded_by = request.user
            except Exception:
                pass
            att.uploaded_at = timezone.now()
            saved_path = default_storage.save(f'post_attachments/{timezone.now().strftime("%Y/%m/%d")}/{upload.name}', ContentFile(upload.read()))
            try:
                if hasattr(att, 'file'):
                    att.file.name = saved_path
            except Exception:
                pass
            att.save()
            url = default_storage.url(saved_path)
            return JsonResponse({'success': True, 'id': getattr(att, 'id', None), 'url': url, 'title': att.title})
        except Exception:
            logger.exception("Upload failed")
            return JsonResponse({'success': False, 'error': 'upload_failed'}, status=500)

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
            setattr(post, f, payload[f])
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
            logger.debug("reversion skipped", exc_info=True)
        return JsonResponse({'success': True, 'id': post.id})
    except Exception:
        logger.exception("Autosave failed")
        return JsonResponse({'success': False, 'message': 'save_failed'}, status=500)


@require_POST
def admin_post_update_view(request):
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
        setattr(post, field, value)
    try:
        post.save()
        return JsonResponse({'success': True, 'post_id': post.id, 'field': field, 'value': getattr(post, field)})
    except Exception:
        logger.exception("Inline update failed")
        return JsonResponse({'success': False, 'message': 'save_failed'}, status=500)


@require_GET
def admin_stats_api(request):
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
    if not request.user.is_staff:
        raise Http404("permission denied")
    posts_count = Post.objects.count() if Post else 0
    comments_count = Comment.objects.count() if Comment else 0
    users_count = CustomUser.objects.count() if CustomUser else 0
    app_list = []
    try:
        if custom_admin_site:
            app_list = custom_admin_site.get_app_list(request)
        else:
            app_list = admin.site.get_app_list(request)
    except Exception:
        app_list = []
    ctx_base = custom_admin_site.each_context(request) if custom_admin_site else admin.site.each_context(request)
    context = dict(ctx_base, title="Admin dashboard", posts_count=posts_count, comments_count=comments_count, users_count=users_count, app_list=app_list)
    return render(request, "admin/dashboard.html", context)

# -----------------------
# Registration helpers & main entrypoint
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

# The global variable that will be set by register_admin_models
custom_admin_site = None

def register_admin_models(site_obj):
    """
    Register all admin models into provided admin site.
    Call this AFTER custom_admin_site is created in core.admin to avoid import cycles.
    """
    global custom_admin_site
    custom_admin_site = site_obj or admin.site

    # choose post admin class (allow emergency switch by env)
    def _choose_post_admin():
        try:
            ev = os.environ.get("EMERGENCY_ADMIN", "").strip().lower()
            if ev in ("1", "true", "yes", "on"):
                # define emergency minimal admin
                class EmergencyPostAdmin(admin.ModelAdmin):
                    list_display = ("title", "status", "author", "published_at")
                    fields = ("title", "slug", "author", "status", "published_at", "excerpt", "content", "featured_image")
                    search_fields = ("title",)
                    ordering = ("-published_at",)
                    filter_horizontal = ()
                return EmergencyPostAdmin
        except Exception:
            pass
        return BasePostAdmin

    post_admin_cls = _choose_post_admin()

    try:
        _ensure_registered(admin.site, Post, post_admin_cls)
        _ensure_registered(custom_admin_site, Post, post_admin_cls)

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

        try:
            _ensure_registered(admin.site, CustomUser)
            _ensure_registered(custom_admin_site, CustomUser)
        except Exception:
            pass
    except Exception:
        logger.exception("bulk registration failed")

    # Attach custom urls by wrapping original get_urls (avoid recursion)
    def get_admin_urls(urls):
        custom_urls = [
            path("dashboard/", admin_dashboard_view, name="admin-dashboard"),
            path("dashboard/stats-data/", admin_stats_api, name="admin-dashboard-stats"),
            path("media-library/", admin_media_library_view, name="admin-media-library"),
            path("posts/update/", admin_post_update_view, name="admin-post-update"),
            path("posts/autosave/", admin_autosave_view, name="admin-autosave"),
            path("posts/preview-token/", admin_preview_token_view, name="admin-preview-token"),
        ]
        return custom_urls + urls

    try:
        current_get_urls = getattr(custom_admin_site, "get_urls", None)
        already_wrapped = getattr(current_get_urls, "_is_wrapped_by_blog_admin", False)
        if not already_wrapped:
            orig_get_urls = current_get_urls
            def wrapped_get_urls():
                try:
                    base = orig_get_urls()
                except Exception:
                    base = super(type(custom_admin_site), custom_admin_site).get_urls()
                return get_admin_urls(base)
            setattr(wrapped_get_urls, "_is_wrapped_by_blog_admin", True)
            custom_admin_site.get_urls = wrapped_get_urls
    except Exception:
        logger.exception("Failed to attach custom urls to custom_admin_site", exc_info=True)

    return True

# Register admin classes safely
try:
    if Post is not None:
        admin.site.register(Post, BasePostAdmin)
except AlreadyRegistered:
    pass
except Exception:
    logger.exception("Could not register Post admin")

# register other models with safe helper
try:
    _ensure_registered(admin.site, Category, CategoryAdmin)
    _ensure_registered(admin.site, Tag, TagAdmin)
    _ensure_registered(admin.site, Comment, CommentAdmin)
    _ensure_registered(admin.site, PostReaction, PostReactionAdmin)
    if PostAttachment is not None:
        _ensure_registered(admin.site, MediaLibrary, MediaLibraryAdmin)
        _ensure_registered(admin.site, PostAttachment, MediaLibraryAdmin)
except Exception:
    logger.exception("Post-registration failed")