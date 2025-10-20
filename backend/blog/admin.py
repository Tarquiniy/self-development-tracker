import logging
from django import forms
from django.contrib import admin
from django.contrib.admin.sites import AlreadyRegistered
from django.utils import timezone
from django.utils.safestring import mark_safe
from django.urls import reverse

logger = logging.getLogger(__name__)

# попытка импортировать модели, если их нет — безопасно обрабатываем
try:
    from .models import Post, Category, Tag, PostAttachment, MediaLibrary
except Exception as e:
    logger.exception("Не удалось импортировать модели блога: %s", e)
    Post = Category = Tag = PostAttachment = MediaLibrary = None

# Если используется reversion — используем VersionAdmin, иначе fallback
try:
    import reversion
    from reversion.admin import VersionAdmin
except Exception:
    class VersionAdmin(admin.ModelAdmin):
        pass

# Форма для админки - базовые улучшения
class PostAdminForm(forms.ModelForm):
    class Meta:
        model = Post
        fields = '__all__' if Post is not None else ()
        widgets = {
            'excerpt': forms.Textarea(attrs={'rows': 3, 'placeholder': 'Краткое описание поста...'}),
            'meta_description': forms.Textarea(attrs={'rows': 2, 'placeholder': 'Мета-описание для SEO...'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if Post is None:
            return
        for fname in ('title', 'slug'):
            if fname in self.fields:
                self.fields[fname].widget.attrs.update({
                    'class': f'post-{fname}-field',
                    'placeholder': 'Введите значение...'
                })

# Улучшённый админ класс для постов
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
    actions = ["make_published", "make_draft"]

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
        ("SEO", {
            'fields': ('meta_title', 'meta_description'),
            'classes': ('seo-settings', 'collapse')
        }),
    )

    def status_badge(self, obj):
        if not obj:
            return ""
        colors = {'draft': 'gray', 'published': 'green', 'archived': 'orange'}
        color = colors.get(getattr(obj, 'status', ''), 'gray')
        label = getattr(obj, "get_status_display", lambda: (lambda: getattr(obj, "status", "")))()
        return mark_safe(f'<span class="status-badge status-{color}">{label}</span>')
    status_badge.short_description = "Статус"
    status_badge.admin_order_field = 'status'

    def reading_time_display(self, obj):
        if not obj:
            return ""
        return f"{getattr(obj, 'reading_time', 0)} мин"
    reading_time_display.short_description = "Время чтения"

    def actions_column(self, obj):
        if not obj:
            return ""
        view_url = getattr(obj, 'get_absolute_url', lambda: '#')()
        change_url = reverse('admin:blog_post_change', args=[obj.id]) if obj and getattr(obj, 'id', None) else '#'
        return mark_safe(f'''
            <div class="action-buttons">
                <a href="{change_url}" class="button edit-btn" title="Редактировать">✏️</a>
                <a href="{view_url}" target="_blank" class="button view-btn" title="Открыть">👁️</a>
            </div>
        ''')
    actions_column.short_description = "Действия"

    def make_published(self, request, queryset):
        updated = queryset.update(status="published", published_at=timezone.now())
        self.message_user(request, f"{updated} пост(ов) опубликовано.")
    make_published.short_description = "Опубликовать выбранные"

    def make_draft(self, request, queryset):
        updated = queryset.update(status="draft")
        self.message_user(request, f"{updated} пост(ов) переведено в черновики.")
    make_draft.short_description = "Перевести в черновики"

    class Media:
        css = {'all': ('admin/admin-modern.css', 'admin/custom.css', 'admin/css/main.css')}
        js = ('admin/js/admin_dashboard.js', 'admin/js/custom_admin.js')

# Регистрируем админ, если модель есть
if Post is not None:
    try:
        admin.site.register(Post, BasePostAdmin)
    except AlreadyRegistered:
        logger.info("Post уже зарегистрирован в админке")
# Регистрируем MediaLibrary если есть
if MediaLibrary is not None:
    try:
        admin.site.register(MediaLibrary)
    except AlreadyRegistered:
        pass
