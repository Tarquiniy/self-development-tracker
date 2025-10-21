# backend/blog/admin.py
import os
import json
import logging
from django import forms
from django.contrib import admin
from django.contrib.admin.sites import AlreadyRegistered
from django.urls import reverse, path
from django.shortcuts import render, redirect
from django.http import JsonResponse, Http404, HttpResponseBadRequest
from django.utils import timezone
from django.views.decorators.http import require_http_methods, require_POST, require_GET
from django.contrib.admin.views.decorators import staff_member_required
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.core import signing
from django.contrib.auth import get_user_model
from django.db.models.functions import TruncDate
from django.db.models import Count
from django.db import models
from django.utils.safestring import mark_safe
from django.utils.html import escape
from django.template.loader import render_to_string

logger = logging.getLogger(__name__)

# Optional reversion support (keep compatible)
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
        PostReaction, PostView, PostAttachment, MediaLibrary, PostRevision
    )
except Exception as e:
    logger.exception("Could not import blog.models: %s", e)
    Post = Category = Tag = Comment = PostReaction = PostView = PostAttachment = MediaLibrary = PostRevision = None

# Import custom admin form (uses CKEditorWidget or fallback)
try:
    from .forms import PostAdminForm
except Exception:
    class PostAdminForm(forms.ModelForm):
        class Meta:
            model = Post
            fields = '__all__'

CustomUser = get_user_model()
PREVIEW_SALT = "post-preview-salt"


# -----------------------
# Admin helper views (dashboard + media library)
# -----------------------
@staff_member_required
@require_http_methods(["GET"])
def admin_dashboard_view(request):
    """
    Simple dashboard view rendered inside admin.
    Template: templates/admin/index.html
    Provides basic counts for posts/media/comments for quick overview.
    """
    try:
        posts_count = Post.objects.count() if Post is not None else 0
        published_count = Post.objects.filter(status='published').count() if Post is not None else 0
        drafts = Post.objects.filter(status='draft').count() if Post is not None else 0
    except Exception:
        posts_count = published_count = drafts = 0

    try:
        media_count = PostAttachment.objects.count() if PostAttachment is not None else 0
    except Exception:
        media_count = 0

    try:
        comments_count = Comment.objects.count() if Comment is not None else 0
    except Exception:
        comments_count = 0

    context = {
        'site_title': getattr(request, 'site_title', None),
        'site_header': getattr(request, 'site_header', None),
        'posts_count': posts_count,
        'published_count': published_count,
        'drafts_count': drafts,
        'media_count': media_count,
        'comments_count': comments_count,
        'app_list': admin.site.get_app_list(request),
        'user': request.user,
    }
    return render(request, 'admin/index.html', context)


@staff_member_required
@require_http_methods(["GET", "POST"])
def admin_media_library_view(request):
    """
    Media library admin view.
    - GET: render media library template with attachments list
    - POST: accept file upload (multipart/form-data) and return JSON
    Template: templates/admin/media_library.html
    """
    if request.method == "GET":
        try:
            attachments = PostAttachment.objects.all().order_by('-uploaded_at')[:200] if PostAttachment is not None else []
        except Exception:
            attachments = []
        context = {
            'attachments': attachments,
            'user': request.user
        }
        return render(request, 'admin/media_library.html', context)

    # POST: handle upload
    upload = request.FILES.get('file')
    if not upload:
        return JsonResponse({"success": False, "error": "No file provided"}, status=400)
    title = (request.POST.get('title') or "").strip()

    try:
        attachment = PostAttachment.objects.create(
            post=None,
            file=upload,
            title=title,
            uploaded_by=request.user if request.user.is_authenticated else None,
        )
        # return minimal JSON for frontend
        return JsonResponse({
            "success": True,
            "attachment": {
                "id": attachment.id,
                "title": attachment.title,
                "url": attachment.file.url if attachment.file else "",
                "uploaded_at": getattr(attachment, 'uploaded_at', getattr(attachment, 'uploaded', None))
            }
        })
    except Exception as e:
        logger.exception("Media upload failed: %s", e)
        return JsonResponse({"success": False, "error": str(e)}, status=500)


# -----------------------
# Admin Model definitions and helpers
# -----------------------
class BasePostAdmin(VersionAdmin):
    form = PostAdminForm
    change_form_template = 'admin/blog/post/change_form_fixed.html'

    list_display = ("title", "status_badge", "author", "published_at", "reading_time_display", "actions_column")
    list_filter = ("status", "published_at", "categories", "tags") if Post is not None else ()
    search_fields = ("title", "excerpt", "content", "meta_description")
    prepopulated_fields = {"slug": ("title",)} if Post is not None else {}
    date_hierarchy = "published_at"
    ordering = ("-published_at",)
    filter_horizontal = ("categories", "tags") if Post is not None else ()
    actions = ["make_published", "make_draft", "duplicate_post", "update_seo_meta"]

    fieldsets = (
        ("Основное содержание", {
            'fields': ('title', 'slug', 'content', 'excerpt'),
            'classes': ('main-content',)
        }),
        ("Визуальные элементы", {
            'fields': ('featured_image', 'og_image'),
            'classes': ('visual-elements', 'collapse')
        }),
        ("Классификация", {
            'fields': ('categories', 'tags'),
            'classes': ('classification',)
        }),
        ("Настройки публикации", {
            'fields': ('author', 'status', 'published_at'),
            'classes': ('publication-settings',)
        }),
        ("SEO оптимизация", {
            'fields': ('meta_title', 'meta_description'),
            'classes': ('seo-settings', 'collapse')
        }),
    )

    def status_badge(self, obj):
        if not obj:
            return ""
        status_colors = {
            'draft': 'gray',
            'published': 'green',
            'archived': 'orange'
        }
        color = status_colors.get(getattr(obj, 'status', ''), 'gray')
        return mark_safe(f'<span class="status-badge status-{color}">{escape(obj.get_status_display() if hasattr(obj, "get_status_display") else getattr(obj, "status", ""))}</span>')
    status_badge.short_description = "Статус"
    status_badge.admin_order_field = 'status'

    def reading_time_display(self, obj):
        if not obj:
            return "0 мин"
        try:
            return f"{obj.reading_time} мин"
        except Exception:
            return "—"
    reading_time_display.short_description = "Время чтения"

    def actions_column(self, obj):
        if not obj:
            return ""
        try:
            view_url = reverse('admin:blog_post_change', args=[obj.id])
        except Exception:
            view_url = "#"
        try:
            public_url = obj.get_absolute_url() if hasattr(obj, 'get_absolute_url') else '#'
        except Exception:
            public_url = '#'
        return mark_safe(f'''
            <div class="action-buttons">
                <a href="{view_url}" class="button edit-btn" title="Edit">✏️</a>
                <a href="{public_url}" target="_blank" class="button view-btn" title="View">👁️</a>
            </div>
        ''')
    actions_column.short_description = "Действия"

    def make_published(self, request, queryset):
        updated = queryset.update(status="published", published_at=timezone.now())
        self.message_user(request, f"{updated} постов опубликовано.")
    make_published.short_description = "📢 Опубликовать выбранные"

    def make_draft(self, request, queryset):
        updated = queryset.update(status="draft")
        self.message_user(request, f"{updated} постов переведено в черновики.")
    make_draft.short_description = "📝 Перевести в черновики"

    def duplicate_post(self, request, queryset):
        created = 0
        for p in queryset:
            try:
                old_slug = getattr(p, "slug", "") or ""
                p.pk = None
                p.slug = f"{old_slug}-copy"
                p.title = f"{getattr(p, 'title', '')} (копия)"
                p.status = "draft"
                p.save()
                created += 1
            except Exception as e:
                logger.error("Error duplicating post: %s", e)
        self.message_user(request, f"Создано {created} копий.")
    duplicate_post.short_description = "🔁 Создать копии"

    def update_seo_meta(self, request, queryset):
        updated = 0
        for post in queryset:
            try:
                if not post.meta_title:
                    post.meta_title = post.title
                    post.save()
                    updated += 1
            except Exception as e:
                logger.error("Error updating SEO meta: %s", e)
        self.message_user(request, f"SEO мета-заголовки обновлены для {updated} постов")
    update_seo_meta.short_description = "🔍 Обновить SEO мета-данные"


class CategoryAdmin(admin.ModelAdmin):
    list_display = ("title", "slug", "post_count", "created_at")
    prepopulated_fields = {"slug": ("title",)}
    search_fields = ("title", "description")

    def post_count(self, obj):
        if not obj:
            return 0
        try:
            count = obj.posts.count() if hasattr(obj, 'posts') else 0
        except Exception:
            count = 0
        return mark_safe(f'<span class="badge">{count}</span>')
    post_count.short_description = "Постов"


class TagAdmin(admin.ModelAdmin):
    list_display = ("title", "slug", "post_count")
    prepopulated_fields = {"slug": ("title",)}
    search_fields = ("title",)

    def post_count(self, obj):
        if not obj:
            return 0
        try:
            count = obj.posts.count() if hasattr(obj, 'posts') else 0
        except Exception:
            count = 0
        return mark_safe(f'<span class="badge">{count}</span>')
    post_count.short_description = "Постов"


class CommentAdmin(admin.ModelAdmin):
    list_display = ("author_name", "post_link", "short_content", "status_badges", "created_at")
    list_filter = ("is_public", "is_moderated", "created_at")
    search_fields = ("name", "email", "content")
    actions = ["approve_comments", "reject_comments"]

    def author_name(self, obj):
        if not obj:
            return "-"
        try:
            if obj.user:
                return obj.name or str(obj.user)
            return obj.name or "Anonymous"
        except Exception:
            return obj.name or "Anonymous"
    author_name.short_description = "Автор"

    def post_link(self, obj):
        try:
            if not obj or not obj.post:
                return "-"
            url = reverse('admin:blog_post_change', args=[obj.post.id])
            return mark_safe(f'<a href="{url}">{escape(obj.post.title)}</a>')
        except Exception:
            return "-"
    post_link.short_description = "Пост"

    def short_content(self, obj):
        if not obj:
            return ""
        try:
            content = obj.content or ""
            short = content[:100]
            if len(content) > 100:
                short += "..."
            return short
        except Exception:
            return ""
    short_content.short_description = "Комментарий"

    def status_badges(self, obj):
        if not obj:
            return ""
        badges = []
        try:
            if obj.is_public:
                badges.append('<span class="badge badge-green">Public</span>')
            else:
                badges.append('<span class="badge badge-gray">Hidden</span>')
            if obj.is_moderated:
                badges.append('<span class="badge badge-blue">Moderated</span>')
        except Exception:
            pass
        return mark_safe(" ".join(badges))
    status_badges.short_description = "Статус"

    def approve_comments(self, request, queryset):
        updated = queryset.update(is_public=True, is_moderated=True)
        self.message_user(request, f"{updated} комментариев одобрено.")
    approve_comments.short_description = "✅ Одобрить выбранные"

    def reject_comments(self, request, queryset):
        updated = queryset.update(is_public=False)
        self.message_user(request, f"{updated} комментариев скрыто.")
    reject_comments.short_description = "❌ Скрыть выбранные"


class MediaLibraryAdmin(admin.ModelAdmin):
    list_display = ("thumbnail", "title", "file_type", "uploaded_by", "uploaded_at_display", "post_link", "file_size")
    list_filter = ("uploaded", "uploaded_by") if hasattr(PostAttachment, 'uploaded') else ()
    search_fields = ("title", "file")
    readonly_fields = ("file_size", "file_type", "uploaded_at_display")

    def thumbnail(self, obj):
        if not obj or not getattr(obj, 'file', None):
            return "📄"
        try:
            if obj.file.name.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp')):
                url = obj.file.url
                return mark_safe(f'<img src="{url}" style="width:50px;height:50px;object-fit:cover;border-radius:6px"/>')
        except Exception:
            return "🖼️"
        return "📄"
    thumbnail.short_description = ""

    def file_type(self, obj):
        if not obj or not getattr(obj, 'file', None):
            return "📄"
        ext = os.path.splitext(obj.file.name)[1].lower()
        type_icons = {
            '.jpg': '🖼️', '.jpeg': '🖼️', '.png': '🖼️', '.gif': '🖼️', '.webp': '🖼️',
            '.pdf': '📕', '.doc': '📘', '.docx': '📘',
            '.mp4': '🎥', '.mov': '🎥', '.avi': '🎥',
        }
        return type_icons.get(ext, '📄')
    file_type.short_description = "Тип"

    def file_size(self, obj):
        try:
            if not obj or not getattr(obj, 'file', None):
                return "N/A"
            size = obj.file.size
            for unit in ['B', 'KB', 'MB', 'GB']:
                if size < 1024.0:
                    return f"{size:.1f} {unit}"
                size /= 1024.0
            return f"{size:.1f} TB"
        except Exception:
            return "N/A"
    file_size.short_description = "Размер"

    def uploaded_at_display(self, obj):
        if not obj:
            return ""
        if hasattr(obj, 'uploaded_at'):
            return obj.uploaded_at
        if hasattr(obj, 'uploaded'):
            return obj.uploaded
        return ""
    uploaded_at_display.short_description = "Дата загрузки"

    def post_link(self, obj):
        if obj and getattr(obj, 'post', None):
            try:
                url = reverse('admin:blog_post_change', args=[obj.post.id])
                return mark_safe(f'<a href="{url}">{escape(obj.post.title)}</a>')
            except Exception:
                return mark_safe('<span class="text-muted">Ошибка ссылки</span>')
        return mark_safe('<span class="text-muted">Не прикреплен</span>')
    post_link.short_description = "Пост"


class PostRevisionAdmin(admin.ModelAdmin):
    list_display = ("post", "author", "created_at", "autosave")
    list_filter = ("created_at", "autosave")
    search_fields = ("post__title", "title", "content")
    readonly_fields = ("created_at",)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


# -----------------------
# Registration helpers
# -----------------------
def register_admin_models(site_obj):
    """
    Register all admin models into provided admin site.
    """
    try:
        if Post is not None:
            site_obj.register(Post, BasePostAdmin)
        if Category is not None:
            site_obj.register(Category, CategoryAdmin)
        if Tag is not None:
            site_obj.register(Tag, TagAdmin)
        if Comment is not None:
            site_obj.register(Comment, CommentAdmin)
        if PostReaction is not None:
            site_obj.register(PostReaction)
        if PostView is not None:
            site_obj.register(PostView)
        if PostRevision is not None:
            site_obj.register(PostRevision, PostRevisionAdmin)
        if PostAttachment is not None:
            site_obj.register(MediaLibrary, MediaLibraryAdmin)
    except Exception as e:
        logger.exception("Admin registration failed: %s", e)
    return True


# Auto-register with default admin site
try:
    if Post is not None:
        admin.site.register(Post, BasePostAdmin)
    if Category is not None:
        admin.site.register(Category, CategoryAdmin)
    if Tag is not None:
        admin.site.register(Tag, TagAdmin)
    if Comment is not None:
        admin.site.register(Comment, CommentAdmin)
    if MediaLibrary is not None:
        admin.site.register(MediaLibrary, MediaLibraryAdmin)
    if PostRevision is not None:
        admin.site.register(PostRevision, PostRevisionAdmin)
except AlreadyRegistered:
    pass
except Exception as e:
    logger.exception("Default admin registration failed: %s", e)


# -----------------------
# Extra admin URLs registration (optional)
# If your core/urls.py expects to include views from blog.admin,
# you can wire URLs here (uncomment / adjust as needed).
# -----------------------
def get_extra_admin_urls():
    """
    Returns a list of extra URL patterns that can be included from the project's urls.
    Example in backend/core/urls.py:
        from blog.admin import get_extra_admin_urls
        urlpatterns += get_extra_admin_urls()
    """
    extra = []
    try:
        extra = [
            path('admin/dashboard/', admin_dashboard_view, name='admin-dashboard'),
            path('admin/media-library/', admin_media_library_view, name='admin-media-library'),
        ]
    except Exception as e:
        logger.exception("Failed building extra admin urls: %s", e)
    return extra
