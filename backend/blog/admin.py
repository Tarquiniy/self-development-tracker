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

logger = logging.getLogger(__name__)

# Optional reversion support (best-effort)
try:
    import reversion
    from reversion.admin import VersionAdmin
except Exception:
    reversion = None
    class VersionAdmin(admin.ModelAdmin):
        pass

# Defensive import of models (do not crash import if models missing)
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
# Utility helpers
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
class SimpleTextareaWidget(forms.Textarea):
    """Plain textarea; enhanced client-side by `simple_admin_editor.js`."""
    pass

class BasePostAdmin(VersionAdmin):
    """
    Minimal, robust Post admin:
    - Uses a plain textarea widget for 'content' (enhanced by local JS/CSS)
    - Uses a simple custom change_form template that avoids TipTap/CDN includes
    """
    change_form_template = 'admin/blog/post/change_form_simple.html'

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

    class Media:
        # Only include our simple local editor (no TipTap, no external CDN).
        js = (
            'admin/js/simple_admin_editor.js',
        )
        css = {
            'all': ('admin/css/simple_admin_editor.css',)
        }

    def get_form(self, request, obj=None, **kwargs):
        # Build a ModelForm and set our SimpleTextareaWidget for 'content'
        from django.forms import modelform_factory
        if Post is None:
            return super().get_form(request, obj, **kwargs)
        try:
            BaseForm = modelform_factory(Post, fields="__all__")
            # create subclass to override widget safely
            class SafeForm(BaseForm):
                class Meta(BaseForm.Meta):
                    widgets = getattr(BaseForm.Meta, 'widgets', {}).copy() if getattr(BaseForm.Meta, 'widgets', None) else {}
                    widgets.update({'content': SimpleTextareaWidget(attrs={'class': 'admin-simple-editor', 'rows': 20, 'style': 'font-family: monospace;'})})
            return SafeForm
        except Exception:
            logger.exception("get_form: failed to build SafeForm")
            return super().get_form(request, obj, **kwargs)

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
# Minimal admin helper views (media upload/autosave/preview etc.)
# (Keep same implementation as before; omitted here for brevity)
# If you had prior helper views in your admin.py, re-add them below.
# -----------------------

# --- Safe registration utilities ---
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
        # unregister first if another registration exists
        try:
            if Post is not None and Post in getattr(admin.site, "_registry", {}):
                admin.site.unregister(Post)
        except Exception:
            pass

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

    # attach urls
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

# Register Post on default admin site (safe fallback)
if Post is not None:
    try:
        # ensure no previous Post admin remains registered
        try:
            if Post in getattr(admin.site, "_registry", {}):
                admin.site.unregister(Post)
        except Exception:
            pass
        admin.site.register(Post, BasePostAdmin)
    except Exception:
        logger.exception("Could not register Post admin (final fallback)")
