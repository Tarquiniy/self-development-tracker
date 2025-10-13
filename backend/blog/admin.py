# backend/blog/admin.py
"""
Robust blog admin module.

Условие: этот модуль НЕ должен регистрировать модели на этапе импорта,
чтобы избежать проблем с порядком загрузки приложений (особенно с кастомной
моделью пользователя). Вместо этого вызываетeся функция `register_admin_models(site_obj)`
из AppConfig.ready() или вручную, когда приложения уже готовы.
"""

import os
import logging
from importlib import import_module

from django import forms
from django.contrib import admin
from django.contrib.admin.sites import AlreadyRegistered
from django.urls import reverse, NoReverseMatch
from django.utils import timezone
from django.core.exceptions import ImproperlyConfigured
from django.utils.safestring import mark_safe
from django.forms.models import modelform_factory

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
            self.fields["title"].widget.attrs.update({
                "class": "post-title-field",
                "placeholder": "Введите заголовок поста..."
            })
        if "slug" in self.fields:
            self.fields["slug"].widget.attrs.update({
                "class": "post-slug-field",
                "placeholder": "url-slug..."
            })


# -----------------------
# Enhanced Admin Classes (не зависят от конкретных моделей на этапе импорта)
# -----------------------
class BasePostAdmin(admin.ModelAdmin):
    # form будет присвоен динамически при регистрации
    form = None
    change_form_template = "admin/blog/post/change_form_fixed.html"

    list_display = ("title", "status_badge", "author", "published_at", "reading_time_display", "actions_column")
    # list_filter / prepopulated_fields / filter_horizontal будут присвоены динамически, если модель есть
    list_filter = ()
    search_fields = ("title", "excerpt", "content", "meta_description")
    prepopulated_fields = {}
    date_hierarchy = "published_at"
    ordering = ("-published_at",)
    filter_horizontal = ()
    actions = ["make_published", "make_draft", "duplicate_post", "update_seo_meta"]

    fieldsets = (
        ("Основное содержание", {
            "fields": ("title", "slug", "content", "excerpt"),
            "classes": ("main-content",)
        }),
        ("Визуальные элементы", {
            "fields": ("featured_image", "og_image"),
            "classes": ("visual-elements", "collapse")
        }),
        ("Классификация", {
            "fields": ("categories", "tags"),
            "classes": ("classification",)
        }),
        ("Настройки публикации", {
            "fields": ("author", "status", "published_at"),
            "classes": ("publication-settings",)
        }),
        ("SEO оптимизация", {
            "fields": ("meta_title", "meta_description"),
            "classes": ("seo-settings", "collapse")
        }),
    )

    def _safe_reverse(self, viewname, *args, **kwargs):
        try:
            return reverse(viewname, args=args, kwargs=kwargs)
        except NoReverseMatch:
            # в ранних этапах админ-URL может ещё не быть зарегистрирован
            return "#"
        except Exception:
            return "#"

    def status_badge(self, obj):
        if not obj:
            return ""
        status_colors = {
            "draft": "gray",
            "published": "green",
            "archived": "orange"
        }
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
        # Безопасно формируем ссылки — используем _safe_reverse
        change_url = self._safe_reverse("admin:blog_post_change", obj.id) if obj and getattr(obj, "id", None) else "#"
        view_url = "#"
        try:
            view_url = getattr(obj, "get_absolute_url", lambda: "#")() or "#"
        except Exception:
            view_url = "#"

        return mark_safe(f'''
            <div class="action-buttons">
                <a href="{change_url}" class="button edit-btn">✏️</a>
                <a href="{view_url}" target="_blank" class="button view-btn">👁️</a>
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


# -----------------------
# Прочие админ-классы (без ранних импортов моделей)
# -----------------------
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("title", "slug", "post_count", "created_at")
    prepopulated_fields = {"slug": ("title",)}
    search_fields = ("title", "description")

    def post_count(self, obj):
        if not obj:
            return 0
        count_qs = getattr(obj, "posts", None)
        try:
            return mark_safe(f'<span class="badge">{count_qs.count() if count_qs is not None else 0}</span>')
        except Exception:
            return mark_safe('<span class="badge">0</span>')
    post_count.short_description = "Постов"


class TagAdmin(admin.ModelAdmin):
    list_display = ("title", "slug", "post_count")
    prepopulated_fields = {"slug": ("title",)}
    search_fields = ("title",)

    def post_count(self, obj):
        if not obj:
            return 0
        count_qs = getattr(obj, "posts", None)
        try:
            return mark_safe(f'<span class="badge">{count_qs.count() if count_qs is not None else 0}</span>')
        except Exception:
            return mark_safe('<span class="badge">0</span>')
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
            url = reverse("admin:blog_post_change", args=[obj.post.id])
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
# Media Library и Revision Admins
# -----------------------
class MediaLibraryAdmin(admin.ModelAdmin):
    list_display = ("thumbnail", "title", "file_type", "uploaded_by", "uploaded_at_display", "post_link", "file_size")
    list_filter = ("uploaded", "uploaded_by")
    search_fields = ("title", "file")
    readonly_fields = ("file_size", "file_type", "uploaded_at_display")

    def thumbnail(self, obj):
        if not obj or not getattr(obj, "file", None):
            return "📄"
        try:
            if obj.file.name.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp')):
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
            ext = os.path.splitext(obj.file.name)[1].lower()
            type_icons = {
                '.jpg': '🖼️', '.jpeg': '🖼️', '.png': '🖼️', '.gif': '🖼️', '.webp': '🖼️',
                '.pdf': '📕', '.doc': '📘', '.docx': '📘',
                '.mp4': '🎥', '.mov': '🎥', '.avi': '🎥',
            }
            return type_icons.get(ext, '📄')
        except Exception:
            return '📄'
    file_type.short_description = "Тип"

    def file_size(self, obj):
        try:
            if not obj or not getattr(obj, "file", None):
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
        return getattr(obj, "uploaded", None)
    uploaded_at_display.short_description = "Дата загрузки"

    def post_link(self, obj):
        try:
            if obj and getattr(obj, "post", None):
                url = reverse("admin:blog_post_change", args=[obj.post.id])
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
def register_admin_models(site_obj):
    """
    Регистрирует admin модели — импорт моделей происходит здесь, в момент, когда AppConfig.ready() вызовет эту функцию.
    Это предотвращает ошибки импорта моделей до инициализации реестра приложений.
    """
    try:
        # Попробуем импортировать модуль моделей через возможные имена пакета.
        blog_models = None
        tried = []

        # Первая попытка: модуль в пространстве имён backend.blog (если структура проекта backend/)
        try:
            blog_models = import_module("backend.blog.models")
            tried.append("backend.blog.models")
        except Exception as e:
            tried.append(f"backend.blog.models failed: {e}")

        # Вторая попытка: модуль как blog.models (если app в корне)
        if blog_models is None:
            try:
                blog_models = import_module("blog.models")
                tried.append("blog.models")
            except Exception as e:
                tried.append(f"blog.models failed: {e}")

        if blog_models is None:
            logger.error("Could not import blog.models; tried: %s", tried)
            return False

        # Получаем классы моделей, если они есть
        Post = getattr(blog_models, "Post", None)
        Category = getattr(blog_models, "Category", None)
        Tag = getattr(blog_models, "Tag", None)
        Comment = getattr(blog_models, "Comment", None)
        PostReaction = getattr(blog_models, "PostReaction", None)
        PostView = getattr(blog_models, "PostView", None)
        PostAttachment = getattr(blog_models, "PostAttachment", None)
        MediaLibrary = getattr(blog_models, "MediaLibrary", None)
        PostRevision = getattr(blog_models, "PostRevision", None)

        # Регистрируем Post (если есть)
        if Post is not None:
            try:
                PostForm = None
                try:
                    PostForm = modelform_factory(Post, form=PostAdminFormBase, fields="__all__")
                except Exception as e:
                    # Не критично, админ всё ещё будет работать без кастомной формы
                    logger.exception("Could not build Post ModelForm dynamically: %s", e)
                    PostForm = None

                # Создаём админ-класс динамически, чтобы назначить form и связанные опции
                post_admin_attrs = {}
                if PostForm is not None:
                    post_admin_attrs["form"] = PostForm

                # Если модель содержит поля categories/tags/status/published_at — задаём фильтры/поля
                # Здесь присваиваем "рекомендуемые" опции; Django проигнорирует несуществующие поля.
                post_admin_attrs.setdefault("list_filter", ("status", "published_at", "categories", "tags"))
                post_admin_attrs.setdefault("prepopulated_fields", {"slug": ("title",)})
                post_admin_attrs.setdefault("filter_horizontal", ("categories", "tags"))

                PostAdmin = type("PostAdmin", (BasePostAdmin,), post_admin_attrs)

                try:
                    site_obj.register(Post, PostAdmin)
                    logger.info("Registered Post with custom PostAdmin")
                except AlreadyRegistered:
                    logger.info("Post already registered")
                except Exception as e:
                    logger.exception("Failed to register Post admin: %s", e)

            except Exception as e:
                logger.exception("Error while preparing Post admin: %s", e)

        # Регистрируем остальные модели, если присутствуют
        def safe_register(model_cls, admin_cls=None, name_hint="model"):
            if model_cls is None:
                return
            try:
                if admin_cls is not None:
                    site_obj.register(model_cls, admin_cls)
                else:
                    site_obj.register(model_cls)
            except AlreadyRegistered:
                logger.debug("%s already registered", name_hint)
            except Exception as e:
                logger.exception("Failed to register %s admin: %s", name_hint, e)

        safe_register(Category, CategoryAdmin, "Category")
        safe_register(Tag, TagAdmin, "Tag")
        safe_register(Comment, CommentAdmin, "Comment")
        safe_register(PostReaction, None, "PostReaction")
        safe_register(PostView, None, "PostView")
        safe_register(PostRevision, PostRevisionAdmin, "PostRevision")
        # PostAttachment/MediaLibrary pair
        if PostAttachment is not None and MediaLibrary is not None:
            safe_register(MediaLibrary, MediaLibraryAdmin, "MediaLibrary")

        logger.info("Registered blog admin models into provided admin site via register_admin_models.")
        return True

    except Exception as e:
        logger.exception("Admin registration failed: %s", e)
        return False
