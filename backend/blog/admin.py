# backend/blog/admin.py
import os
import io
import json
import logging
from PIL import Image, UnidentifiedImageError  # Pillow for thumbnail generation
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
from django.utils.module_loading import import_string


from .utils import translit_slugify

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

# Optional admin form (TipTap integration)
try:
    from .forms import PostAdminForm as ProjectPostAdminForm
except Exception:
    ProjectPostAdminForm = None

CustomUser = get_user_model()
PREVIEW_SALT = "post-preview-salt"

# -----------------------
# TipTap Widget (robust fallback)
# -----------------------
TipTapWidget = None
try:
    from .widgets import TipTapWidget as ProjectTipTapWidget  # noqa: F401
    TipTapWidget = ProjectTipTapWidget
except Exception:
    TipTapWidget = None

if TipTapWidget is None:
    class TipTapWidget(forms.Widget):
        def __init__(self, attrs=None, upload_url="/api/blog/media/upload/"):
            super().__init__(attrs or {})
            self.upload_url = upload_url

        def get_config(self, name, value, attrs):
            cfg = {
                "name": name,
                "uploadUrl": self.upload_url,
                "placeholder": (self.attrs.get("placeholder") if isinstance(self.attrs, dict) else None) or "Введите текст...",
            }
            if attrs:
                for k, v in attrs.items():
                    if isinstance(v, (str, bool, int, float)):
                        cfg[k] = v
            return cfg

        def value_as_text(self, value):
            if value is None:
                return ""
            try:
                return str(value)
            except Exception:
                return ""

        def render(self, name, value, attrs=None, renderer=None):
            final_attrs = {} if attrs is None else dict(attrs)
            css_class = final_attrs.get("class", "")
            classes = (css_class + " admin-tiptap-textarea").strip()
            textarea_value = escape(self.value_as_text(value))

            textarea_attrs = {
                "name": name,
                "class": classes,
                "rows": final_attrs.get("rows", 20),
                "id": final_attrs.get("id", f"id_{name}"),
                "data-post-id": final_attrs.get("data-post-id", final_attrs.get("data_post_id", "")),
            }

            parts = []
            for k, v in textarea_attrs.items():
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
                f'<div class="admin-tiptap-widget" data-tiptap-config="{escape(cfg_json)}" '
                f'id="{escape(textarea_attrs.get("id"))}_tiptap_wrapper">'
                f'<div class="tiptap-toolbar"></div><div class="tiptap-editor" contenteditable="true"></div>'
                f'</div>'
            )

            textarea_html = f'<textarea {attr_str}>{textarea_value}</textarea>'
            noscript_html = '<noscript><p>Включите JavaScript для использования визуального редактора; доступен простой textarea.</p></noscript>'

            return mark_safe(textarea_html + wrapper_html + noscript_html)

        class Media:
            js = (
                'admin/js/grp_shim.js',
                'https://cdn.jsdelivr.net/npm/ckeditor5-build-classic-all-plugin@latest/build/ckeditor.js',
                'admin/js/ckeditor_admin_extra.js',
                'https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.js',
                'admin/js/admin_slug_seo.js',
            )
            css = {
                'all': (
                    'https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.css',
                )
            }

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
    try:
        from django.conf import settings as _settings
        dirs = []
        try:
            dirs = _settings.TEMPLATES[0].get('DIRS', []) if getattr(_settings, 'TEMPLATES', None) else []
        except Exception:
            dirs = []
        found = False
        template_name = os.path.join('admin', 'blog', 'post', 'change_form.html')
        for d in dirs:
            if os.path.exists(os.path.join(d, template_name)):
                found = True
                break
        if not found:
            alt = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'templates', 'admin', 'blog', 'post', 'change_form.html'))
            if os.path.exists(alt):
                found = True
        if found:
            change_form_template = 'admin/blog/post/change_form.html'
    except Exception:
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

    def save_model(self, request, obj, form, change):
        if not obj.slug:
            base = translit_slugify(obj.title) or translit_slugify(obj.meta_title or obj.excerpt or 'post')
            slug = base
            i = 1
            while self.model.objects.filter(slug=slug).exclude(pk=getattr(obj, 'pk', None)).exists():
                i += 1
                slug = f"{base}-{i}"
            obj.slug = slug
        if getattr(obj, 'status', None) == 'published' and not obj.published_at:
            obj.published_at = timezone.now()
        super().save_model(request, obj, form, change)

    def get_form(self, request, obj=None, **kwargs):
        if ProjectPostAdminForm:
            try:
                return super().get_form(request, obj, form=ProjectPostAdminForm, **kwargs)
            except Exception:
                logger.exception("Project PostAdminForm raised during get_form — falling back to default admin form.")
        try:
            return super().get_form(request, obj, **kwargs)
        except Exception:
            logger.exception("admin.get_form failed; falling back to modelform_factory")
            from django.forms import modelform_factory
            return modelform_factory(self.model, fields="__all__")

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
    """
    GET: render media library page (admin/media_library.html) with attachments list.
    POST (multipart): upload file (tries Supabase first if settings are present, else default_storage).
    POST action=delete: delete attachment and attempt to delete file from storage.
    """
    if not request.user.is_staff:
        raise Http404("permission denied")

    # DELETE via POST action
    if request.method == "POST" and (request.POST.get("action") == "delete" or request.POST.get("action") == "remove"):
        if PostAttachment is None:
            return JsonResponse({'success': False, 'error': 'PostAttachment model not configured'}, status=500)
        aid = request.POST.get("id") or request.POST.get("attachment_id")
        if not aid:
            return JsonResponse({'success': False, 'error': 'missing id'}, status=400)
        try:
            att = PostAttachment.objects.filter(pk=aid).first()
            if not att:
                return JsonResponse({'success': False, 'error': 'not_found'}, status=404)
            try:
                fobj = getattr(att, 'file', None)
                if fobj and getattr(fobj, 'name', None):
                    try:
                        # try default_storage delete
                        default_storage.delete(fobj.name)
                    except Exception:
                        logger.debug("default_storage.delete failed for %s", getattr(fobj, 'name', None), exc_info=True)
                        # try supabase delete if configured
                        try:
                            from django.conf import settings as _settings
                            SUPA_URL = getattr(_settings, "SUPABASE_URL", os.environ.get("SUPABASE_URL"))
                            SUPA_KEY = getattr(_settings, "SUPABASE_SERVICE_ROLE_KEY", os.environ.get("SUPABASE_SERVICE_ROLE_KEY"))
                            SUPA_BUCKET = getattr(_settings, "SUPABASE_MEDIA_BUCKET", os.environ.get("SUPABASE_MEDIA_BUCKET", "media")) or "media"
                        except Exception:
                            SUPA_URL = os.environ.get("SUPABASE_URL")
                            SUPA_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
                            SUPA_BUCKET = os.environ.get("SUPABASE_MEDIA_BUCKET", "media") or "media"
                        try:
                            if SUPA_URL and SUPA_KEY:
                                try:
                                    from supabase import create_client
                                    client = create_client(SUPA_URL, SUPA_KEY)
                                    client.storage.from_(SUPA_BUCKET).remove([fobj.name])
                                except Exception:
                                    logger.debug("Supabase delete failed", exc_info=True)
                        except Exception:
                            logger.debug("Supabase delete fallback encountered error", exc_info=True)
            except Exception:
                logger.debug("Error while deleting file from storage", exc_info=True)
            att.delete()
            return JsonResponse({'success': True})
        except Exception:
            logger.exception("Delete attachment failed")
            return JsonResponse({'success': False, 'error': 'delete_failed'}, status=500)

    # UPLOAD via multipart/form-data
    if request.method == "POST" and request.FILES:
        upload = request.FILES.get("file") or request.FILES.get("image")
        title = request.POST.get("title") or (getattr(upload, 'name', '') if upload else "")
        if not upload:
            return JsonResponse({'success': False, 'error': 'No file provided'}, status=400)
        if PostAttachment is None:
            return JsonResponse({'success': False, 'error': 'PostAttachment model not configured'}, status=500)

        # Get supabase settings (with sensible default bucket)
        try:
            from django.conf import settings as _settings
            SUPA_URL = getattr(_settings, "SUPABASE_URL", os.environ.get("SUPABASE_URL"))
            SUPA_KEY = getattr(_settings, "SUPABASE_SERVICE_ROLE_KEY", os.environ.get("SUPABASE_SERVICE_ROLE_KEY"))
            SUPA_BUCKET = getattr(_settings, "SUPABASE_MEDIA_BUCKET", os.environ.get("SUPABASE_MEDIA_BUCKET", "media")) or "media"
        except Exception:
            SUPA_URL = os.environ.get("SUPABASE_URL")
            SUPA_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
            SUPA_BUCKET = os.environ.get("SUPABASE_MEDIA_BUCKET", "media") or "media"

        saved_path = None
        uploaded_url = ""

        # Try Supabase upload if credentials are present
        if SUPA_URL and SUPA_KEY:
            try:
                try:
                    from supabase import create_client
                except Exception:
                    create_client = None
                if create_client:
                    client = create_client(SUPA_URL, SUPA_KEY)
                    saved_path = f'post_attachments/{timezone.now().strftime("%Y/%m/%d")}/{getattr(upload, "name", "")}'
                    # supabase expects bytes or file-like
                    file_bytes = upload.read()
                    try:
                        # upload may expect a file-like; supabase-py often accepts bytes
                        client.storage.from_(SUPA_BUCKET).upload(saved_path, file_bytes)
                        try:
                            public = client.storage.from_(SUPA_BUCKET).get_public_url(saved_path)
                            if isinstance(public, dict):
                                uploaded_url = public.get("publicURL") or public.get("public_url") or ""
                            else:
                                uploaded_url = public or ""
                        except Exception:
                            uploaded_url = f"{SUPA_URL.rstrip('/')}/storage/v1/object/public/{SUPA_BUCKET}/{saved_path}"
                    except Exception:
                        logger.exception("Supabase upload attempt failed; will fallback to default_storage")
                        saved_path = None
            except Exception:
                logger.exception("Supabase upload flow failed; falling back to default_storage")
                saved_path = None

        # Fallback to default_storage if Supabase didn't work
        if not saved_path:
            try:
                # ensure content read (upload.read() might have been called earlier)
                if hasattr(upload, 'seek'):
                    try:
                        upload.seek(0)
                    except Exception:
                        pass
                saved_path = default_storage.save(f'post_attachments/{timezone.now().strftime("%Y/%m/%d")}/{getattr(upload, "name", "")}', ContentFile(upload.read()))
                try:
                    uploaded_url = getattr(upload, 'url', '') or default_storage.url(saved_path)
                except Exception:
                    try:
                        uploaded_url = default_storage.url(saved_path)
                    except Exception:
                        uploaded_url = ''
            except Exception:
                logger.exception("fallback default_storage.save failed")
                return JsonResponse({'success': False, 'error': 'upload_failed'}, status=500)

        # Create DB record
        try:
            att = PostAttachment()
            try:
                att.title = title or os.path.basename(getattr(upload, 'name', '') or '')
            except Exception:
                att.title = title
            try:
                att.uploaded_by = request.user
            except Exception:
                pass
            att.uploaded_at = timezone.now()
            try:
                if hasattr(att, 'file') and saved_path:
                    att.file.name = saved_path
            except Exception:
                logger.debug("Could not set att.file.name; continuing")
            att.save()
        except Exception:
            logger.exception("Saving PostAttachment object failed")
            return JsonResponse({'success': False, 'error': 'db_save_failed'}, status=500)

        resp = {'success': True, 'id': getattr(att, 'id', None), 'url': uploaded_url, 'title': att.title}
        return JsonResponse(resp, status=201)

    # GET: build listing
    attachments_qs = PostAttachment.objects.all().order_by('-uploaded_at')[:500] if PostAttachment is not None else []
    def _is_image_name(name):
        if not name:
            return False
        ext = os.path.splitext(name)[1].lower()
        return ext in ('.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp')

    attachments = []
    for a in attachments_qs:
        try:
            file_obj = getattr(a, 'file', None)
            raw_name = getattr(a, 'title', None) or (getattr(file_obj, 'name', None) or "")
            filename = os.path.basename(raw_name) if raw_name else ""
            url = ""
            if file_obj:
                try:
                    url = getattr(file_obj, 'url', '') or default_storage.url(getattr(file_obj, 'name', ''))
                except Exception:
                    try:
                        url = default_storage.url(getattr(file_obj, 'name', ''))
                    except Exception:
                        url = ''
            else:
                url = ""
            thumb = ""
            try:
                storage_name = getattr(file_obj, 'name', '') or filename
                if _is_image_name(storage_name):
                    thumb = reverse('admin-media-thumbnail', args=[getattr(a, 'id', '')])
            except Exception:
                thumb = url if _is_image_name(filename) else ""
            attachments.append({
                'id': getattr(a, 'id', None),
                'title': filename or (getattr(a, 'title', None) or ""),
                'url': url,
                'thumb': thumb,
                'uploaded_at': getattr(a, 'uploaded_at', None),
            })
        except Exception:
            logger.debug("Failed building attachment dict", exc_info=True)

    is_xhr = request.headers.get('x-requested-with') == 'XMLHttpRequest' or request.GET.get('format') == 'json'
    if is_xhr:
        return JsonResponse({'attachments': attachments})

    context = {'attachments': attachments}
    return render(request, 'admin/media_library.html', context)


@require_GET
def admin_media_thumbnail_view(request, pk):
    """
    Returns a generated thumbnail (JPEG) for a PostAttachment id=pk.
    Tries default_storage first, then Supabase client if default_storage cannot open the file.
    """
    if not request.user.is_staff:
        raise Http404("permission denied")
    if PostAttachment is None:
        raise Http404("PostAttachment not available")
    try:
        att = PostAttachment.objects.filter(pk=pk).first()
        if not att:
            raise Http404("attachment not found")
        file_field = getattr(att, 'file', None)
        if not file_field or not getattr(file_field, 'name', None):
            raise Http404("file missing")
        fname = getattr(file_field, 'name')

        data = None
        # Try default storage
        try:
            with default_storage.open(fname, 'rb') as fh:
                data = fh.read()
        except Exception:
            logger.debug("default_storage.open failed for %s, will try Supabase client", fname, exc_info=True)

        # If default_storage failed, try Supabase client download
        if not data:
            try:
                from django.conf import settings as _settings
                SUPA_URL = getattr(_settings, "SUPABASE_URL", os.environ.get("SUPABASE_URL"))
                SUPA_KEY = getattr(_settings, "SUPABASE_SERVICE_ROLE_KEY", os.environ.get("SUPABASE_SERVICE_ROLE_KEY"))
                SUPA_BUCKET = getattr(_settings, "SUPABASE_MEDIA_BUCKET", os.environ.get("SUPABASE_MEDIA_BUCKET", "media")) or "media"
            except Exception:
                SUPA_URL = os.environ.get("SUPABASE_URL")
                SUPA_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
                SUPA_BUCKET = os.environ.get("SUPABASE_MEDIA_BUCKET", "media") or "media"

            if SUPA_URL and SUPA_KEY:
                try:
                    try:
                        from supabase import create_client
                    except Exception:
                        create_client = None
                    if create_client:
                        client = create_client(SUPA_URL, SUPA_KEY)
                        try:
                            result = client.storage.from_(SUPA_BUCKET).download(fname)
                            if hasattr(result, 'read'):
                                data = result.read()
                            else:
                                data = result
                        except Exception:
                            # Last resort: try public URL fetch
                            try:
                                public = client.storage.from_(SUPA_BUCKET).get_public_url(fname)
                                public_url = public.get("publicURL") if isinstance(public, dict) else public
                                import requests
                                r = requests.get(public_url, timeout=10)
                                if r.status_code == 200:
                                    data = r.content
                            except Exception:
                                logger.exception("Supabase download fallback failed", exc_info=True)
                except Exception:
                    logger.exception("Supabase client not available or download failed", exc_info=True)

        if not data:
            raise Http404("cannot open file")

        # Generate thumbnail
        try:
            im = Image.open(io.BytesIO(data))
            im = im.convert("RGB")
            im.thumbnail((400, 400), Image.LANCZOS)
            buf = io.BytesIO()
            im.save(buf, format="JPEG", quality=85)
            buf.seek(0)
            resp = HttpResponse(buf.read(), content_type="image/jpeg")
            resp["Cache-Control"] = "max-age=86400, public"
            return resp
        except UnidentifiedImageError:
            svg = b'''<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"><rect width="100%" height="100%" fill="#f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#6b7280" font-family="Arial" font-size="14">No preview</text></svg>'''
            return HttpResponse(svg, content_type="image/svg+xml")
        except Exception:
            logger.exception("thumbnail generation failed", exc_info=True)
            raise Http404("thumbnail generation failed")
    except Http404:
        raise
    except Exception:
        logger.exception("media thumbnail error", exc_info=True)
        raise Http404("thumbnail error")


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


@require_POST
def admin_media_attach_view(request):
    """
    Прикрепить существующий PostAttachment к посту:
    Ожидает JSON body или form-data с: post_id, attachment_id, field (по умолчанию 'featured_image').
    Возвращает {'success': True, 'url': '<public_url>', 'post_id': ..., 'attachment_id': ...}
    """
    if not request.user.is_staff:
        return JsonResponse({'success': False, 'error': 'permission_denied'}, status=403)

    # Поддержка JSON body или form POST
    try:
        payload = json.loads(request.body.decode('utf-8') or '{}') if request.content_type == 'application/json' else request.POST
    except Exception:
        payload = request.POST

    post_id = payload.get('post_id') or payload.get('postId') or None
    attachment_id = payload.get('attachment_id') or payload.get('attachmentId') or payload.get('id')
    field = payload.get('field') or 'featured_image'

    if not post_id or not attachment_id:
        return JsonResponse({'success': False, 'error': 'missing_parameters'}, status=400)

    # Find objects
    try:
        post_obj = Post.objects.get(pk=post_id)
    except Exception:
        return JsonResponse({'success': False, 'error': 'post_not_found'}, status=404)

    try:
        att = PostAttachment.objects.get(pk=attachment_id)
    except Exception:
        return JsonResponse({'success': False, 'error': 'attachment_not_found'}, status=404)

    # Attempt to assign attachment.file to post.field in a robust way
    file_field = getattr(att, 'file', None)
    assigned = False
    url = ''

    try:
        # prefer assigning file object if field exists and is FileField/ImageField on Post
        if hasattr(post_obj, field):
            try:
                # If post.field is a FileField descriptor, assign the file object (will copy name)
                setattr(post_obj, field, file_field)
                post_obj.save()
                assigned = True
            except Exception:
                # Try assigning the filename (name string)
                try:
                    setattr(post_obj, field, getattr(file_field, 'name', None))
                    post_obj.save()
                    assigned = True
                except Exception:
                    assigned = False
        else:
            # as fallback, try to set an attribute like field + '_id' if exists (for FK)
            if hasattr(post_obj, f"{field}_id"):
                try:
                    setattr(post_obj, f"{field}_id", getattr(att, 'id', None))
                    post_obj.save()
                    assigned = True
                except Exception:
                    assigned = False
    except Exception:
        logger.exception("Failed while assigning attachment to post")
        assigned = False

    # Try to compute a usable URL for client
    try:
        if file_field and getattr(file_field, 'name', None):
            try:
                url = getattr(file_field, 'url', '') or default_storage.url(getattr(file_field, 'name'))
            except Exception:
                try:
                    url = default_storage.url(getattr(file_field, 'name'))
                except Exception:
                    url = ''
    except Exception:
        url = ''

    if not assigned:
        return JsonResponse({'success': False, 'error': 'assign_failed'}, status=500)

    return JsonResponse({'success': True, 'url': url, 'post_id': post_obj.pk, 'attachment_id': att.pk})


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
    """
    Safely register model on provided site_obj. If site_obj is None, fallback to admin.site.
    """
    if model is None:
        return
    if site_obj is None:
        site_obj = admin.site
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
            path("media-thumbnail/<int:pk>/", admin_media_thumbnail_view, name="admin-media-thumbnail"),
            path("media-attach/", admin_media_attach_view, name="admin-media-attach"),
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


# -----------------------
# PostAdminForm + PostAdmin
# -----------------------
if ProjectPostAdminForm:
    PostAdminForm = ProjectPostAdminForm
else:
    class PostAdminForm(forms.ModelForm):
        class Meta:
            model = Post
            fields = '__all__'

        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            try:
                if TipTapWidget:
                    self.fields['content'].widget = TipTapWidget(attrs={'class': 'admin-tiptap-textarea'})
                else:
                    self.fields['content'].widget = forms.Textarea(attrs={'class': 'admin-tiptap-textarea simple-admin-editor', 'rows': 20})
            except Exception:
                logger.exception("Failed to attach widget to content field; using plain textarea")
                self.fields['content'].widget = forms.Textarea(attrs={'rows': 20})

class PostAdmin(BasePostAdmin):
    form = PostAdminForm
    exclude = ('content_json',)
    change_form_template = BasePostAdmin.change_form_template or 'admin/blog/post/change_form.html'

    class Media:
        js = (
            "admin/js/grp_shim.js",
            "https://cdn.jsdelivr.net/npm/@ckeditor/ckeditor5-build-classic@47.0.0/build/ckeditor.js",
            "admin/js/ckeditor_admin_extra.js",
            "https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.js",
            "admin/js/admin_slug_seo.js",
        )
        css = {
            'all': ('admin/vendor/ckeditor5/ckeditor.css', "https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.css",),
        }

    def media(self):
        media = super().media
        try:
            extra = forms.Media(
                js=(
                    "admin/js/grp_shim.js",
                    "admin/vendor/ckeditor5/ckeditor.js",
                    "admin/js/ckeditor_admin_extra.js",
                ),
                css={'all': ("admin/css/ckeditor_admin.css",)}
            )
            return media + extra
        except Exception:
            return media

    media = property(media)


# Register admin classes safely (module-level fallback)
try:
    if Post is not None:
        admin.site.register(Post, PostAdmin)
except AlreadyRegistered:
    pass
except Exception:
    logger.exception("Could not register Post admin")

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
