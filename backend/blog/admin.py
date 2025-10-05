import os
import json
import logging
from django.contrib import admin
from django.contrib.admin.sites import AlreadyRegistered
from django.urls import reverse, path
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

# Optional reversion
try:
    import reversion
    from reversion.admin import VersionAdmin
except Exception:
    reversion = None
    class VersionAdmin(admin.ModelAdmin):
        pass

# Custom admin site
try:
    from backend.core.admin import custom_admin_site
except Exception:
    custom_admin_site = admin.site

# Models
try:
    from .models import (
        Post, Category, Tag, Comment,
        PostReaction, PostView, PostAttachment, MediaLibrary
    )
except Exception:
    Post = Category = Tag = Comment = PostReaction = PostView = PostAttachment = MediaLibrary = None
    logger.exception("Could not import blog.models")

# Optional TipTap form
try:
    from .forms import PostAdminForm
except Exception:
    PostAdminForm = None

CustomUser = get_user_model()
PREVIEW_SALT = "post-preview-salt"


# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------
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


# ----------------------------------------------------------------------
# Admin classes
# ----------------------------------------------------------------------
class BasePostAdmin(VersionAdmin):
    if PostAdminForm:
        form = PostAdminForm

    change_form_template = "admin/blog/post/change_form.html"
    list_display = ("title", "status", "author", "published_at")
    list_filter = ("status", "published_at")
    search_fields = ("title", "content")
    prepopulated_fields = {"slug": ("title",)}
    date_hierarchy = "published_at"
    ordering = ("-published_at",)
    filter_horizontal = ("categories", "tags")
    actions = ["make_published", "make_draft", "duplicate_post"]

    fieldsets = (
        ("Основная информация", {
            "fields": ("title", "slug", "author", "status", "published_at")
        }),
        ("Содержание", {
            "fields": ("excerpt", "content", "content_json", "featured_image")
        }),
        ("Категории и теги", {"fields": ("categories", "tags")}),
        ("SEO", {
            "fields": ("meta_title", "meta_description", "og_image"),
            "classes": ("collapse",),
        }),
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
            p.title = f"{p.title} (копия)"
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
        c = getattr(obj, "content", "")
        return c[:100] + ("..." if len(c) > 100 else "")


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


# ----------------------------------------------------------------------
# Views
# ----------------------------------------------------------------------
@require_GET
def admin_dashboard_view(request):
    if not request.user.is_staff:
        raise Http404("permission denied")

    posts_count = Post.objects.count() if Post else 0
    comments_count = Comment.objects.count() if Comment else 0
    users_count = CustomUser.objects.count() if CustomUser else 0

    try:
        each_context = custom_admin_site.each_context(request)
    except Exception:
        each_context = {}

    context = {
        **each_context,
        "title": "Панель администратора",
        "posts_count": posts_count,
        "comments_count": comments_count,
        "users_count": users_count,
    }

    try:
        return render(request, "admin/dashboard.html", context)
    except Exception as e:
        logger.exception("Dashboard render failed")
        return JsonResponse({"error": str(e), "context": context}, status=500)

@require_GET
def admin_stats_api(request):
    if not request.user.is_staff:
        return JsonResponse({"detail": "permission denied"}, status=403)
    posts = Post.objects.count() if Post else 0
    comments = Comment.objects.count() if Comment else 0
    users = CustomUser.objects.count() if CustomUser else 0
    return JsonResponse({"posts": posts, "comments": comments, "users": users})


@require_POST
def admin_autosave_view(request):
    if not request.user.is_staff:
        return JsonResponse({"success": False}, status=403)
    data = json.loads(request.body.decode("utf-8"))
    post_id = data.get("id")
    post = Post.objects.filter(pk=post_id).first() if Post else None
    if not post:
        post = Post(author=request.user, status="draft")
    for field in ("title", "content", "excerpt"):
        if field in data:
            setattr(post, field, data[field])
    post.save()
    return JsonResponse({"success": True, "id": post.id})


@require_POST
def admin_post_update_view(request):
    if not request.user.is_staff:
        return JsonResponse({"success": False}, status=403)
    try:
        data = json.loads(request.body.decode("utf-8"))
        post = Post.objects.get(pk=data.get("id"))
        for f, v in data.items():
            if hasattr(post, f):
                setattr(post, f, v)
        post.save()
        return JsonResponse({"success": True, "id": post.id})
    except Exception as e:
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@require_POST
def admin_preview_token_view(request):
    """Создаёт токен предпросмотра поста"""
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
    except Exception as e:
        logger.exception("Preview token generation failed")
        return JsonResponse({"error": str(e)}, status=500)


@require_http_methods(["GET", "POST"])
def admin_media_library_view(request):
    if not request.user.is_staff:
        raise Http404("permission denied")

    if request.method == "POST":
        upload = request.FILES.get("file")
        if not upload:
            return JsonResponse({"success": False, "error": "no file"}, status=400)
        att = PostAttachment.objects.create(
            file=upload,
            title=upload.name,
            uploaded_by=request.user,
        )
        return JsonResponse({"success": True, "id": att.id, "url": att.file.url})

    attachments = PostAttachment.objects.all().order_by("-uploaded_at")
    return render(request, "admin/media_library.html", {"attachments": attachments})


# ----------------------------------------------------------------------
# Registration
# ----------------------------------------------------------------------
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
        logger.exception("Could not register %s", model)


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
    if PostAttachment:
        _ensure_registered(admin.site, MediaLibrary, MediaLibraryAdmin)
        _ensure_registered(custom_admin_site, MediaLibrary, MediaLibraryAdmin)
except Exception:
    logger.exception("bulk registration failed")


# ----------------------------------------------------------------------
# Custom admin URLs
# ----------------------------------------------------------------------
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


__all__ = [
    "admin_dashboard_view",
    "admin_stats_api",
    "admin_post_update_view",
    "admin_autosave_view",
    "admin_preview_token_view",
    "admin_media_library_view",
]
