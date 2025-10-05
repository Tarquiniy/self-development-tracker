# backend/blog/admin.py
import os
import json
import logging
from django.contrib import admin
from django.contrib.admin.sites import AlreadyRegistered
from django.urls import reverse, path
from django.shortcuts import render, redirect, get_object_or_404
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
from django.contrib.admin.models import LogEntry

logger = logging.getLogger(__name__)

# Optional reversion
try:
    import reversion
    from reversion.admin import VersionAdmin
except Exception:
    reversion = None
    class VersionAdmin(admin.ModelAdmin):
        pass

# Try to import custom_admin_site (fallback to admin.site)
try:
    from backend.core.admin import custom_admin_site
except Exception:
    custom_admin_site = admin.site

# Import models defensively
try:
    from .models import (
        Post, Category, Tag, Comment,
        PostReaction, PostView, PostAttachment, MediaLibrary
    )
except Exception:
    Post = Category = Tag = Comment = PostReaction = PostView = PostAttachment = MediaLibrary = None
    logger.exception("Could not import blog.models")

# Optional PostAdminForm (TipTap widget)
try:
    from .forms import PostAdminForm
except Exception:
    PostAdminForm = None

CustomUser = get_user_model()
PREVIEW_SALT = "post-preview-salt"


# Utility: get admin change URL
def get_admin_change_url_for_obj(obj):
    if obj is None:
        return None
    try:
        viewname = f"{obj._meta.app_label}_{obj._meta.model_name}_change"
    except Exception:
        return None
    candidates = []
    try:
        if custom_admin_site and getattr(custom_admin_site, "name", None):
            candidates.append(custom_admin_site.name)
    except Exception:
        pass
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


# Admin classes (kept simple & safe)
class BasePostAdmin(VersionAdmin):
    if PostAdminForm:
        form = PostAdminForm

    change_form_template = "admin/blog/post/change_form.html"
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
        ("Содержание", {"fields": ("excerpt", "content", "content_json", "featured_image")}),
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
        post = getattr(obj, "post", None)
        url = get_admin_change_url_for_obj(post)
        if post and url:
            from django.utils.html import format_html
            return format_html('<a href="{}">{}</a>', url, post.title)
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
        if getattr(obj, "post", None):
            url = get_admin_change_url_for_obj(obj.post)
            from django.utils.html import format_html
            if url:
                return format_html('<a href="{}">{}</a>', url, obj.post.title)
        return "-"
    def changelist_view(self, request, extra_context=None):
        return redirect("admin-media-library")


# Admin views
@require_GET
def admin_dashboard_view(request):
    if not request.user.is_staff:
        raise Http404("permission denied")
    try:
        posts_count = Post.objects.count() if Post else 0
        published_count = Post.objects.filter(status="published").count() if Post else 0
        draft_count = Post.objects.filter(status="draft").count() if Post else 0
        today_posts = Post.objects.filter(created_at__date=timezone.now().date()).count() if Post else 0
        comments_count = Comment.objects.count() if Comment else 0
        users_count = CustomUser.objects.count() if CustomUser else 0
        total_views = PostView.objects.count() if PostView else 0

        recent_posts = []
        if Post:
            for p in Post.objects.order_by("-created_at")[:8]:
                recent_posts.append({
                    "id": p.pk,
                    "title": getattr(p, "title", "")[:120],
                    "url": get_admin_change_url_for_obj(p),
                    "published_at": getattr(p, "published_at", None).isoformat() if getattr(p, "published_at", None) else None,
                })

        recent_comments = []
        if Comment:
            for c in Comment.objects.select_related("post").order_by("-created_at")[:8]:
                recent_comments.append({
                    "id": c.pk,
                    "post_title": getattr(c.post, "title", "") if getattr(c, "post", None) else "",
                    "post_url": get_admin_change_url_for_obj(getattr(c, "post", None)),
                    "name": getattr(c, "name", "")[:80],
                    "content": getattr(c, "content", "")[:160],
                    "created_at": getattr(c, "created_at", None).isoformat() if getattr(c, "created_at", None) else None,
                })

        recent_logs = []
        try:
            for le in LogEntry.objects.select_related("user").order_by("-action_time")[:10]:
                recent_logs.append({
                    "id": le.pk,
                    "user": getattr(le.user, "username", str(le.user)),
                    "action_time": le.action_time.isoformat() if getattr(le, "action_time", None) else None,
                    "object_repr": getattr(le, "object_repr", "")[:140],
                    "change_message": _pretty_change_message(getattr(le, "change_message", "")),
                    "action_flag": le.action_flag,
                })
        except Exception:
            recent_logs = []

        app_list = []
        try:
            app_list = custom_admin_site.get_app_list(request)
        except Exception:
            try:
                app_list = admin.site.get_app_list(request)
            except Exception:
                app_list = []

        context = {
            "title": "Dashboard",
            "posts_count": posts_count,
            "published_count": published_count,
            "draft_count": draft_count,
            "today_posts": today_posts,
            "comments_count": comments_count,
            "users_count": users_count,
            "total_views": total_views,
            "recent_posts": recent_posts,
            "recent_comments": recent_comments,
            "log_entries": recent_logs,
            "app_list": app_list,
        }
        try:
            return render(request, "admin/dashboard.html", context)
        except Exception:
            logger.exception("dashboard render failed, returning JSON")
            return JsonResponse(context)
    except Exception:
        logger.exception("dashboard build error")
        return JsonResponse({"error": "dashboard_error"}, status=500)


@require_http_methods(["GET", "POST"])
def admin_media_library_view(request):
    if not request.user.is_staff:
        raise Http404("permission denied")
    if request.method == "POST":
        upload = request.FILES.get("file")
        if not upload:
            return JsonResponse({"success": False, "error": "no file"}, status=400)
        if PostAttachment is None:
            return JsonResponse({"success": False, "error": "PostAttachment not configured"}, status=500)
        try:
            att = PostAttachment()
            att.title = upload.name
            try:
                att.uploaded_by = request.user
            except Exception:
                pass
            att.uploaded_at = timezone.now()
            saved_path = default_storage.save(f"post_attachments/{timezone.now().strftime('%Y/%m/%d')}/{upload.name}", ContentFile(upload.read()))
            try:
                if hasattr(att, "file"):
                    att.file.name = saved_path
            except Exception:
                pass
            att.save()
            url = default_storage.url(saved_path)
            return JsonResponse({"success": True, "id": getattr(att, "id", None), "url": url, "title": att.title})
        except Exception:
            logger.exception("Upload failed")
            return JsonResponse({"success": False, "error": "upload_failed"}, status=500)
    attachments = PostAttachment.objects.all().order_by("-uploaded_at") if PostAttachment else []
    context = {"attachments": attachments}
    return render(request, "admin/media_library.html", context)


@require_POST
def admin_preview_token_view(request):
    if not request.user.is_staff:
        return JsonResponse({"detail": "permission denied"}, status=403)
    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
        package = {
            "title": payload.get("title", ""),
            "content": payload.get("content", ""),
            "excerpt": payload.get("excerpt", ""),
            "featured_image": payload.get("featured_image", ""),
            "generated_by": request.user.pk,
            "generated_at": timezone.now().isoformat(),
        }
        token = signing.dumps(package, salt=PREVIEW_SALT)
        return JsonResponse({"token": token})
    except Exception:
        logger.exception("Preview token failed")
        return JsonResponse({"detail": "error"}, status=500)


@require_POST
def admin_autosave_view(request):
    if not request.user.is_staff:
        return JsonResponse({"success": False, "message": "permission denied"}, status=403)
    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except Exception:
        return JsonResponse({"success": False, "message": "Invalid JSON"}, status=400)
    post_id = payload.get("id")
    if post_id:
        post = Post.objects.filter(pk=post_id).first() if Post else None
        if not post and Post:
            post = Post(author=request.user, status="draft")
    else:
        post = Post(author=request.user, status="draft") if Post else None
    if post is None:
        return JsonResponse({"success": False, "message": "Post model not available"}, status=500)
    for f in ("title", "excerpt", "content", "featured_image"):
        if f in payload:
            setattr(post, f, payload[f])
    if "content_json" in payload:
        try:
            post.content_json = payload["content_json"]
        except Exception:
            pass
    if payload.get("published_at"):
        from django.utils.dateparse import parse_datetime, parse_date
        dt = parse_datetime(payload["published_at"]) or parse_date(payload["published_at"])
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
        return JsonResponse({"success": True, "id": post.id})
    except Exception:
        logger.exception("Autosave failed")
        return JsonResponse({"success": False, "message": "save_failed"}, status=500)


@require_POST
def admin_post_update_view(request):
    if not request.user.is_staff:
        return JsonResponse({"success": False, "message": "permission denied"}, status=403)
    try:
        data = json.loads(request.body.decode("utf-8") or "{}")
    except Exception:
        return JsonResponse({"success": False, "message": "Invalid JSON"}, status=400)
    post_id = data.get("post_id") or data.get("id")
    field = data.get("field")
    value = data.get("value")
    if post_id is None:
        return JsonResponse({"success": False, "message": "Missing post id"}, status=400)
    try:
        post = Post.objects.get(pk=post_id) if Post else None
    except Exception:
        return JsonResponse({"success": False, "message": "Post not found"}, status=404)
    if post is None:
        return JsonResponse({"success": False, "message": "Post not available"}, status=500)
    if field:
        ALLOWED = {"title", "status", "published_at"}
        if field not in ALLOWED:
            return JsonResponse({"success": False, "message": "Field not allowed"}, status=400)
        if field == "published_at":
            from django.utils.dateparse import parse_datetime, parse_date
            dt = parse_datetime(value) or parse_date(value)
            if not dt:
                return JsonResponse({"success": False, "message": "Invalid datetime"}, status=400)
            setattr(post, field, dt)
        else:
            setattr(post, field, value)
    else:
        for k, v in data.items():
            if hasattr(post, k) and k != "id":
                setattr(post, k, v)
    try:
        post.save()
        return JsonResponse({"success": True, "post_id": post.id})
    except Exception:
        logger.exception("Inline update failed")
        return JsonResponse({"success": False, "message": "save_failed"}, status=500)


@require_GET
def admin_stats_api(request):
    if not request.user.is_staff:
        return JsonResponse({"detail": "permission denied"}, status=403)
    try:
        days = int(request.GET.get("days", 30))
    except Exception:
        days = 30
    days = max(1, min(days, 365))
    now = timezone.now()
    start = now - timezone.timedelta(days=days - 1)
    def safe_qs(qs, date_field):
        try:
            return (qs.filter(**{f"{date_field}__date__gte": start.date()})
                    .annotate(day=TruncDate(date_field))
                    .values("day")
                    .annotate(count=Count("id")).order_by("day"))
        except Exception:
            return []
    posts_qs = safe_qs(Post.objects.all(), "created_at") if Post else []
    comments_qs = safe_qs(Comment.objects.all(), "created_at") if Comment else []
    views_qs = safe_qs(PostView.objects.all(), "viewed_at") if PostView else []
    labels = [(start + timezone.timedelta(days=i)).date().isoformat() for i in range(days)]
    def build_series(qs):
        mapping = {}
        try:
            mapping = {item["day"].isoformat(): item["count"] for item in qs}
        except Exception:
            mapping = {}
        return [mapping.get(d, 0) for d in labels]
    return JsonResponse({
        "labels": labels,
        "posts": build_series(posts_qs),
        "comments": build_series(comments_qs),
        "views": build_series(views_qs),
    })


# Registration helper
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
        logger.exception("Could not register %s on %s", getattr(model, "__name__", model), getattr(site, "name", site))


# Register models on both admin.site and custom_admin_site
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

    # Ensure CustomUser is registered in BOTH admin sites so Users appear in sidebar
    try:
        _ensure_registered(admin.site, CustomUser)
        _ensure_registered(custom_admin_site, CustomUser)
    except Exception:
        pass
except Exception:
    logger.exception("bulk registration failed")


# Add custom admin urls to custom_admin_site
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
    custom_admin_site.get_urls = lambda: get_admin_urls(custom_admin_site.get_urls())
except Exception:
    logger.warning("Custom admin site URL extension failed", exc_info=True)


# Export views so core/admin.py import won't fail
__all__ = [
    "admin_dashboard_view",
    "admin_stats_api",
    "admin_post_update_view",
    "admin_autosave_view",
    "admin_preview_token_view",
    "admin_media_library_view",
]
