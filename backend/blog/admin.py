import os
import json
import logging
from django import forms
from django.contrib import admin
from django.contrib.admin.sites import AlreadyRegistered
from django.urls import reverse, path
from django.shortcuts import render, redirect
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
from django.utils.html import escape
from django.conf import settings

logger = logging.getLogger(__name__)

# Optional reversion support
try:
    import reversion
    from reversion.admin import VersionAdmin
except Exception:
    reversion = None
    class VersionAdmin(admin.ModelAdmin):
        pass

# Defensive import of models (log exceptions but don't crash import)
try:
    from .models import (
        Post, Category, Tag, Comment,
        PostReaction, PostView, PostAttachment, MediaLibrary
    )
except Exception:
    Post = Category = Tag = Comment = PostReaction = PostView = PostAttachment = MediaLibrary = None
    logger.exception("Could not import blog.models")

# Optional admin form (project-provided)
try:
    from .forms import PostAdminForm as ProjectPostAdminForm
except Exception:
    ProjectPostAdminForm = None

CustomUser = get_user_model()
PREVIEW_SALT = "post-preview-salt"


# --------------------------------------------------------------------
# REPLACEMENT: CKEditor widget(s)
# --------------------------------------------------------------------
CKEDITOR_CDN = "https://cdn.jsdelivr.net/npm/@ckeditor/ckeditor5-build-classic@44.3.0/build/ckeditor.js"


class CKEditorWidget(forms.Textarea):
    """
    Универсальный виджет, который рендерит <textarea> (fallback для форм без JS)
    плюс специальный wrapper, содержащий data-ckeditor-config JSON
    прочитатель JS инициализирует CKEditor на wrapper.
    """
    template_name = None

    class Media:
        js = (
            CKEDITOR_CDN,
            "admin/js/ckeditor_upload_adapter.js",
            "admin/js/ckeditor_init.js",
        )
        css = {
            "all": (
                "admin/css/ckeditor_admin.css",
            )
        }

    def __init__(self, attrs=None):
        base_attrs = {
            "class": "admin-ckeditor-textarea",
            "rows": 20,
            "data-editor": "auto",  # 'auto'|'ckeditor'|'fallback'
            "data-upload-url": "/api/blog/media/upload/",
        }
        if attrs:
            base_attrs.update(attrs)
        super().__init__(attrs=base_attrs)

    def get_config(self, name, value, attrs):
        final = attrs or {}
        cfg = {
            "editor": final.get("data-editor", "auto"),
            "uploadUrl": final.get("data-upload-url", "/api/blog/media/upload/"),
            "previewTokenUrl": final.get("data-ckeditor-preview-token-url", "/admin/posts/preview-token/"),
            "name": name,
            "id": final.get("id") or f"id_{name}",
            "initialData": value or "",
        }
        extra = final.get("data-ckeditor-extra")
        if extra:
            try:
                if isinstance(extra, str):
                    extra_parsed = json.loads(extra)
                else:
                    extra_parsed = extra
                if isinstance(extra_parsed, dict):
                    cfg.update(extra_parsed)
            except Exception:
                pass
        return cfg

    def render(self, name, value, attrs=None, renderer=None):
        final_attrs = self.build_attrs(self.attrs, attrs or {})
        textarea_value = escape(self.format_value(value) or "")
        final_id = final_attrs.get("id") or f"id_{name}"
        final_attrs["id"] = final_id

        parts = []
        for k, v in final_attrs.items():
            if v is None or v == "":
                continue
            parts.append(f'{k}="{escape(str(v))}"')
        attr_str = " ".join(parts)

        config = self.get_config(name, value, final_attrs)
        try:
            cfg_json = json.dumps(config, ensure_ascii=False)
        except Exception:
            cfg_json = "{}"

        wrapper_html = (
            f'<div class="admin-ckeditor-widget" data-ckeditor-config="{escape(cfg_json)}" '
            f'id="{escape(final_id)}_ckeditor_wrapper">'
            f'<div class="ckeditor-toolbar"></div><div class="ckeditor-editor" contenteditable="true"></div>'
            f'</div>'
        )

        textarea_html = f'<textarea {attr_str}>{textarea_value}</textarea>'
        noscript_html = '<noscript><p>Включите JavaScript для использования визуального редактора; доступен простой textarea.</p></noscript>'

        html = textarea_html + wrapper_html + noscript_html
        return mark_safe(html)


class AdminRichTextWidget(CKEditorWidget):
    """
    Alias for CKEditorWidget; used where ранее использовался TipTap-specific widget.
    """
    pass


# --------------------------------------------------------------------
# Post admin integration (форма и регистрация)
# --------------------------------------------------------------------
if ProjectPostAdminForm is None:
    class PostAdminForm(forms.ModelForm):
        class Meta:
            model = Post
            fields = "__all__"
            widgets = {
                "content": AdminRichTextWidget(),
            }
else:
    class PostAdminForm(ProjectPostAdminForm):
        class Meta(ProjectPostAdminForm.Meta):
            widgets = getattr(ProjectPostAdminForm.Meta, "widgets", {})
            widgets.update({
                "content": AdminRichTextWidget(),
            })


class PostAdmin(VersionAdmin):
    form = PostAdminForm

    list_display = ("title", "status", "author", "published_at")
    list_filter = ("status", "published_at")
    search_fields = ("title", "content")
    ordering = ("-published_at",)

try:
    if Post is not None:
        try:
            admin.site.unregister(Post)
        except Exception:
            pass
        admin.site.register(Post, PostAdmin)
except AlreadyRegistered:
    pass


# --------------------------------------------------------------------
# Helper views preserved/ported from original admin.py
# --------------------------------------------------------------------
@require_GET
def admin_media_library(request):
    if request.method != "GET":
        return HttpResponse(status=405)
    attachments = []
    try:
        if MediaLibrary is not None:
            qs = MediaLibrary.objects.order_by("-created_at")[:200]
            attachments = [{
                "id": a.id,
                "title": getattr(a, "title", "") or "",
                "file": getattr(a.file, "url", "") if getattr(a, "file", None) else ""
            } for a in qs]
    except Exception:
        logger.exception("Failed to load media attachments")

    if request.GET.get("format") == "json":
        return JsonResponse({"attachments": attachments})
    return render(request, "admin/media_library.html", {"attachments": attachments})


@require_POST
def admin_media_upload(request):
    """
    Upload endpoint used by ckeditor_upload_adapter.js
    Returns JSON: { "url": "<public url>" }
    """
    if request.method != "POST":
        return HttpResponse(status=405)
    if not request.FILES:
        return JsonResponse({"error": "no file"}, status=400)
    f = request.FILES.get("file")
    if not f:
        return JsonResponse({"error": "file key missing"}, status=400)
    try:
        base_path = getattr(settings, "BLOG_MEDIA_UPLOAD_PATH", "uploads/blog/")
        filename = f.name
        save_path = os.path.join(base_path, filename)
        save_path = default_storage.save(save_path, ContentFile(f.read()))
        try:
            url = default_storage.url(save_path)
        except Exception:
            url = save_path
        if MediaLibrary is not None:
            try:
                ml = MediaLibrary.objects.create(title=filename, file=save_path)
            except Exception:
                ml = None
        return JsonResponse({"url": url})
    except Exception as e:
        logger.exception("admin_media_upload failed")
        return JsonResponse({"error": str(e)}, status=500)


@require_POST
def admin_preview_token(request):
    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except Exception:
        payload = {}
    token = signing.dumps({
        "payload": payload,
        "created": timezone.now().isoformat()
    }, salt=PREVIEW_SALT)
    return JsonResponse({"token": token})


@require_POST
def admin_autosave(request):
    try:
        data = json.loads(request.body.decode("utf-8") or "{}")
    except Exception:
        data = {}
    try:
        if Post is None:
            return JsonResponse({"error": "Post model not available"}, status=500)
        title = data.get("title") or "Untitled"
        content = data.get("content") or ""
        post_id = data.get("id")
        if post_id:
            p = Post.objects.filter(pk=post_id).first()
            if not p:
                return JsonResponse({"error": "not found"}, status=404)
            p.title = title
            p.content = content
            p.status = "draft"
            p.save()
            return JsonResponse({"success": True, "id": p.id})
        else:
            p = Post.objects.create(title=title, content=content, status="draft", author=request.user if request.user.is_authenticated else None)
            return JsonResponse({"success": True, "id": p.id})
    except Exception as e:
        logger.exception("admin_autosave failed")
        return JsonResponse({"error": str(e)}, status=500)


@require_GET
def admin_dashboard_stats(request):
    try:
        days = int(request.GET.get("days", "30"))
    except Exception:
        days = 30
    data = {}
    try:
        if Post is not None:
            qs = Post.objects.filter(published_at__isnull=False)
            counts = qs.annotate(d=TruncDate("published_at")).values("d").annotate(n=Count("id")).order_by("d")
            labels = []
            posts = []
            for c in counts:
                labels.append(c["d"].isoformat())
                posts.append(c["n"])
            data = {"labels": labels, "posts": posts}
    except Exception:
        logger.exception("admin_dashboard_stats failed")
    return JsonResponse(data)


def get_admin_urls():
    return [
        path("media-library/", admin_media_library, name="admin-media-library"),
        path("media/upload/", admin_media_upload, name="admin-media-upload"),
        path("preview-token/", admin_preview_token, name="admin-preview-token"),
        path("autosave/", admin_autosave, name="admin-autosave"),
        path("dashboard-stats/", admin_dashboard_stats, name="admin-dashboard-stats"),
    ]


admin_urls = get_admin_urls()

def register_admin_models(site):
    try:
        if Post is not None:
            try:
                site.register(Post, PostAdmin)
            except Exception:
                pass
        # Регистрируем прочие модели с дефолтным ModelAdmin
        for model in (Category, Tag, Comment, PostReaction, PostView, PostAttachment, MediaLibrary):
            if model is None:
                continue
            try:
                # если есть кастомный Admin класс — замените None соответствующим классом
                site.register(model)
            except Exception:
                # уже зарегистрировано или другая ошибка — пропускаем
                pass
    except Exception:
        logger.exception("register_admin_models failed")

# Экспорт view-алиасов, которые core.admin ожидает импортировать
admin_media_library_view = admin_media_library
admin_media_upload_view = admin_media_upload
admin_preview_token_view = admin_preview_token
admin_autosave_view = admin_autosave
admin_stats_api = admin_dashboard_stats
admin_dashboard_view = None

# ----- ensure blog models are registered in default admin.site -----
def _ensure_blog_models_registered():
    models_to_register = (Post, Category, Tag, Comment, PostReaction, PostView, PostAttachment, MediaLibrary)
    for m in models_to_register:
        if not m:
            continue
        try:
            if m not in admin.site._registry:
                admin.site.register(m)
        except Exception:
            # попытаемся без кастомного класса; если и это упадет — логируем
            try:
                admin.site.register(m)
            except Exception:
                logger.exception("Failed to register blog model %s in admin.site", getattr(m, "__name__", str(m)))

_ensure_blog_models_registered()
