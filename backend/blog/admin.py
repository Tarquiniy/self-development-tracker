# backend/blog/admin.py
import logging
from importlib import import_module

from django import forms
from django.contrib import admin
from django.contrib.admin.sites import AlreadyRegistered
from django.urls import reverse
from django.utils import timezone
from django.utils.safestring import mark_safe
from django.forms.models import modelform_factory
from django.apps import apps

logger = logging.getLogger(__name__)

PREVIEW_SALT = "post-preview-salt"


# -----------------------
# Base (без привязки к модели) Admin Form — будет использована для создания финальной ModelForm через modelform_factory
# -----------------------
class PostAdminFormBase(forms.ModelForm):
    class Meta:
        # Model будет задан динамически через modelform_factory при регистрации
        fields = "__all__"
        widgets = {
            "excerpt": forms.Textarea(attrs={"rows": 3, "placeholder": "Краткое описание поста..."}),
            "meta_description": forms.Textarea(attrs={"rows": 2, "placeholder": "Мета-описание для SEO..."}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Безопасно обновляем атрибуты, только если поля существуют
        if "title" in self.fields:
            self.fields["title"].widget.attrs.update(
                {"class": "post-title-field", "placeholder": "Введите заголовок поста..."}
            )
        if "slug" in self.fields:
            self.fields["slug"].widget.attrs.update({"class": "post-slug-field", "placeholder": "url-slug..."})


# -----------------------
# Enhanced Admin Classes (не зависят от конкретных моделей на этапе импорта)
# -----------------------
class BasePostAdmin(admin.ModelAdmin):
    # form будет присвоен динамически при регистрации
    form = None
    change_form_template = "admin/blog/post/change_form_fixed.html"

    list_display = (
        "title",
        "status_badge",
        "author",
        "published_at",
        "reading_time_display",
        "actions_column",
    )
    list_filter = ()
    search_fields = ("title", "excerpt", "content", "meta_description")
    prepopulated_fields = {}
    date_hierarchy = "published_at"
    ordering = ("-published_at",)
    filter_horizontal = ()
    actions = ["make_published", "make_draft", "duplicate_post", "update_seo_meta"]

    fieldsets = (
        ("Основное содержание", {"fields": ("title", "slug", "content", "excerpt"), "classes": ("main-content",)}),
        ("Визуальные элементы", {"fields": ("featured_image", "og_image"), "classes": ("visual-elements", "collapse")}),
        ("Классификация", {"fields": ("categories", "tags"), "classes": ("classification",)}),
        ("Настройки публикации", {"fields": ("author", "status", "published_at"), "classes": ("publication-settings",)}),
        ("SEO оптимизация", {"fields": ("meta_title", "meta_description"), "classes": ("seo-settings", "collapse")}),
    )

    def status_badge(self, obj):
        if not obj:
            return ""
        status_colors = {"draft": "gray", "published": "green", "archived": "orange"}
        color = status_colors.get(getattr(obj, "status", ""), "gray")
        display = getattr(obj, "get_status_display", lambda: getattr(obj, "status", ""))()
        return mark_safe(f'<span class="status-badge status-{color}">{display}</span>')

    status_badge.short_description = "Статус"
    status_badge.admin_order_field = "status"

    def reading_time_display(self, obj):
        if not obj:
            return "0 мин"
        return f"{getattr(obj, 'reading_time', 0)} мин"

    reading_time_display.short_description = "Время чтения"

    def actions_column(self, obj):
        if not obj:
            return ""
        try:
            change_url = reverse("admin:%s_%s_change" % (obj._meta.app_label, obj._meta.model_name), args=[obj.pk])
        except Exception:
            change_url = "#"
        view_url = getattr(obj, "get_absolute_url", lambda: "#")()
        return mark_safe(
            f'''
            <div class="action-buttons">
                <a href="{change_url}" class="button edit-btn">✏️</a>
                <a href="{view_url}" target="_blank" class="button view-btn">👁️</a>
            </div>
        '''
        )

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
            old_slug = getattr(p, "slug", "") or ""
            p.pk = None
            p.slug = f"{old_slug}-copy"
            p.title = f"{getattr(p, 'title', '')} (копия)"
            p.status = "draft"
            try:
                p.save()
                created += 1
            except Exception as e:
                logger.error("Error duplicating post: %s", e)
        self.message_user(request, f"Создано {created} копий.")

    duplicate_post.short_description = "🔁 Создать копии"

    def update_seo_meta(self, request, queryset):
        updated = 0
        for post in queryset:
            if not getattr(post, "meta_title", None):
                post.meta_title = getattr(post, "title", "")
                try:
                    post.save()
                    updated += 1
                except Exception as e:
                    logger.error("Error updating SEO meta: %s", e)
        self.message_user(request, f"SEO мета-заголовки обновлены для {updated} постов.")

    update_seo_meta.short_description = "🔍 Обновить SEO мета-данные"


class CategoryAdmin(admin.ModelAdmin):
    list_display = ("title", "slug", "post_count", "created_at")
    prepopulated_fields = {"slug": ("title",)}
    search_fields = ("title", "description")

    def post_count(self, obj):
        if not obj:
            return 0
        related_qs = getattr(obj, "posts", None)
        try:
            count = related_qs.count() if related_qs is not None else 0
            return mark_safe(f'<span class="badge">{count}</span>')
        except Exception:
            return mark_safe(f'<span class="badge">0</span>')

    post_count.short_description = "Постов"


class TagAdmin(admin.ModelAdmin):
    list_display = ("title", "slug", "post_count")
    prepopulated_fields = {"slug": ("title",)}
    search_fields = ("title",)

    def post_count(self, obj):
        if not obj:
            return 0
        related_qs = getattr(obj, "posts", None)
        try:
            count = related_qs.count() if related_qs is not None else 0
            return mark_safe(f'<span class="badge">{count}</span>')
        except Exception:
            return mark_safe(f'<span class="badge">0</span>')

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
            return obj.name or (f"User #{obj.user_id}" if getattr(obj, "user", None) else "Anonymous")
        except Exception:
            return "-"

    author_name.short_description = "Автор"

    def post_link(self, obj):
        try:
            if not obj or not getattr(obj, "post", None):
                return "-"
            url = reverse("admin:%s_%s_change" % (obj.post._meta.app_label, obj.post._meta.model_name), args=[obj.post.id])
            return mark_safe(f'<a href="{url}">{obj.post.title}</a>')
        except Exception:
            return "-"

    post_link.short_description = "Пост"

    def short_content(self, obj):
        if not obj:
            return ""
        content = getattr(obj, "content", "") or ""
        short = content[:100]
        if len(content) > 100:
            short += "..."
        return short

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


# -----------------------
# Media Library Enhancements (гибкая регистрация)
# -----------------------
class MediaLibraryAdmin(admin.ModelAdmin):
    list_display = ("thumbnail", "title", "file_type", "uploaded_by", "uploaded_at_display", "post_link", "file_size")
    list_filter = ()
    search_fields = ("title", "file")
    readonly_fields = ("file_size", "file_type", "uploaded_at_display")

    def thumbnail(self, obj):
        if not obj or not getattr(obj, "file", None):
            return "📄"
        try:
            if obj.file.name.lower().endswith((".jpg", ".jpeg", ".png", ".gif", ".webp")):
                url = obj.file.url
                return mark_safe(f'<img src="{url}" style="width: 50px; height: 50px; object-fit: cover;" />')
        except Exception:
            pass
        return "📄"

    thumbnail.short_description = ""

    def file_type(self, obj):
        if not obj or not getattr(obj, "file", None):
            return "📄"
        try:
            import os
            ext = os.path.splitext(obj.file.name)[1].lower()
            type_icons = {
                ".jpg": "🖼️",
                ".jpeg": "🖼️",
                ".png": "🖼️",
                ".gif": "🖼️",
                ".webp": "🖼️",
                ".pdf": "📕",
                ".doc": "📘",
                ".docx": "📘",
                ".mp4": "🎥",
                ".mov": "🎥",
                ".avi": "🎥",
            }
            return type_icons.get(ext, "📄")
        except Exception:
            return "📄"

    file_type.short_description = "Тип"

    def file_size(self, obj):
        try:
            if not obj or not getattr(obj, "file", None):
                return "N/A"
            size = obj.file.size
            for unit in ["B", "KB", "MB", "GB"]:
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
        # try both 'uploaded_at' and 'uploaded'
        return getattr(obj, "uploaded_at", getattr(obj, "uploaded", None))

    uploaded_at_display.short_description = "Дата загрузки"

    def post_link(self, obj):
        try:
            if obj and getattr(obj, "post", None):
                url = reverse("admin:%s_%s_change" % (obj.post._meta.app_label, obj.post._meta.model_name), args=[obj.post.id])
                return mark_safe(f'<a href="{url}">{obj.post.title}</a>')
        except Exception:
            pass
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
# Registration (динамическая, безопасная)
# -----------------------
def _model_exists(app_label: str, model_name: str):
    try:
        return apps.get_model(app_label, model_name)
    except LookupError:
        return None


def _is_registered(site_obj, model):
    return model in getattr(site_obj, "_registry", {})


def register_admin_models(site_obj=admin.site):
    """
    Регистрирует admin модели — импорт моделей происходит через django.apps.apps.get_model,
    что предотвращает повторную регистрацию при различном способе импорта (backend.blog vs blog).
    Экспортируется как register_blog_admin для совместимости с BlogConfig.ready().
    """
    try:
        # Попробуем получить модели через метаданные приложения 'blog'
        Post = _model_exists("blog", "Post")
        Category = _model_exists("blog", "Category")
        Tag = _model_exists("blog", "Tag")
        Comment = _model_exists("blog", "Comment")
        PostReaction = _model_exists("blog", "PostReaction")
        PostView = _model_exists("blog", "PostView")
        PostAttachment = _model_exists("blog", "PostAttachment")
        MediaLibrary = _model_exists("blog", "MediaLibrary")
        PostRevision = _model_exists("blog", "PostRevision")

        # Регистрируем Post (если есть)
        if Post is not None and not _is_registered(site_obj, Post):
            try:
                PostForm = None
                try:
                    PostForm = modelform_factory(Post, form=PostAdminFormBase, fields="__all__")
                except Exception:
                    logger.exception("Could not build Post ModelForm dynamically; using default form.")

                post_admin_attrs = {}
                if PostForm is not None:
                    post_admin_attrs["form"] = PostForm

                # динамически назначаем list_filter / prepopulated_fields / filter_horizontal если поля присутствуют
                lf = []
                if "status" in [f.name for f in Post._meta.get_fields()]:
                    lf.append("status")
                if "published_at" in [f.name for f in Post._meta.get_fields()]:
                    lf.append("published_at")
                if "categories" in [f.name for f in Post._meta.get_fields()]:
                    lf.append("categories")
                    post_admin_attrs.setdefault("filter_horizontal", ("categories",))
                if "tags" in [f.name for f in Post._meta.get_fields()]:
                    lf.append("tags")
                    post_admin_attrs.setdefault("filter_horizontal", ("tags",))
                if lf:
                    post_admin_attrs.setdefault("list_filter", tuple(lf))

                if "slug" in [f.name for f in Post._meta.get_fields()]:
                    post_admin_attrs.setdefault("prepopulated_fields", {"slug": ("title",)})

                PostAdmin = type("PostAdmin", (BasePostAdmin,), post_admin_attrs)
                site_obj.register(Post, PostAdmin)
                logger.info("Registered Post admin for %s.%s", Post._meta.app_label, Post._meta.model_name)
            except AlreadyRegistered:
                logger.info("Post already registered in admin; skipping.")
            except Exception as e:
                logger.exception("Failed to register Post admin: %s", e)

        # Register Category
        if Category is not None and not _is_registered(site_obj, Category):
            try:
                site_obj.register(Category, CategoryAdmin)
            except AlreadyRegistered:
                pass
            except Exception as e:
                logger.exception("Failed to register Category admin: %s", e)

        # Register Tag
        if Tag is not None and not _is_registered(site_obj, Tag):
            try:
                site_obj.register(Tag, TagAdmin)
            except AlreadyRegistered:
                pass
            except Exception as e:
                logger.exception("Failed to register Tag admin: %s", e)

        # Register Comment
        if Comment is not None and not _is_registered(site_obj, Comment):
            try:
                site_obj.register(Comment, CommentAdmin)
            except AlreadyRegistered:
                pass
            except Exception as e:
                logger.exception("Failed to register Comment admin: %s", e)

        # Register PostReaction
        if PostReaction is not None and not _is_registered(site_obj, PostReaction):
            try:
                site_obj.register(PostReaction)
            except AlreadyRegistered:
                pass
            except Exception as e:
                logger.exception("Failed to register PostReaction admin: %s", e)

        # Register PostView
        if PostView is not None and not _is_registered(site_obj, PostView):
            try:
                site_obj.register(PostView)
            except AlreadyRegistered:
                pass
            except Exception as e:
                logger.exception("Failed to register PostView admin: %s", e)

        # Register PostRevision
        if PostRevision is not None and not _is_registered(site_obj, PostRevision):
            try:
                site_obj.register(PostRevision, PostRevisionAdmin)
            except AlreadyRegistered:
                pass
            except Exception as e:
                logger.exception("Failed to register PostRevision admin: %s", e)

        # Register MediaLibrary / PostAttachment
        if MediaLibrary is not None and not _is_registered(site_obj, MediaLibrary):
            try:
                # подстраиваем list_filter: ищем поле uploaded_at или uploaded
                ml_admin_attrs = {}
                ml_list_filter = []
                try:
                    fields = [f.name for f in MediaLibrary._meta.get_fields()]
                except Exception:
                    fields = []
                if "uploaded_at" in fields:
                    ml_list_filter.append("uploaded_at")
                elif "uploaded" in fields:
                    ml_list_filter.append("uploaded")
                if "uploaded_by" in fields:
                    ml_list_filter.append("uploaded_by")
                if ml_list_filter:
                    ml_admin_attrs["list_filter"] = tuple(ml_list_filter)

                MediaAdmin = type("MediaLibraryAdminDynamic", (MediaLibraryAdmin,), ml_admin_attrs)
                site_obj.register(MediaLibrary, MediaAdmin)
            except AlreadyRegistered:
                pass
            except Exception as e:
                logger.exception("Failed to register MediaLibrary admin: %s", e)

        logger.info("Registered blog admin models into site via register_admin_models.")
        return True
    except Exception as e:
        logger.exception("Admin registration failed: %s", e)
        return False


# Для совместимости с ранее ожидаемым именем
register_blog_admin = register_admin_models
