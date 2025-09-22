from django.contrib import admin
from django.utils.html import format_html
from .models import Post, Category, Tag, Comment, PostReaction
from django_summernote.admin import SummernoteModelAdmin
from django.contrib.auth import get_user_model

CustomUser = get_user_model()


# ----------------------------------------
# Регистрация пользователей
# ----------------------------------------
@admin.register(CustomUser)
class CustomUserAdmin(admin.ModelAdmin):
    search_fields = ['username', 'email']
    list_display = ('username', 'email', 'is_staff', 'is_active')
    list_filter = ('is_staff', 'is_active')
    ordering = ('username',)
    class Media:
        css = {'all': ('admin/custom.css',)}


# ----------------------------------------
# POST ADMIN с карточками и быстрыми действиями
# ----------------------------------------
@admin.register(Post)
class PostAdmin(SummernoteModelAdmin):
    list_display = ('card_post',)
    search_fields = ('title', 'slug', 'content')
    prepopulated_fields = {"slug": ("title",)}
    summernote_fields = ('content',)
    date_hierarchy = 'published_at'
    ordering = ('-published_at',)
    actions = ['make_published', 'make_draft']
    filter_horizontal = ('categories', 'tags')

    def card_post(self, obj):
        categories_html = ''.join(
            f'<span class="category-badge">{c.title}</span>' for c in obj.categories.all()
        )
        tags_html = ''.join(
            f'<span class="tag-badge">{t.title}</span>' for t in obj.tags.all()
        )
        status_color = 'green' if obj.status == 'published' else 'orange'
        return format_html(f"""
        <div class="card">
            <div class="card-header">
                <strong>{obj.title}</strong> — <span style="color:{status_color}">{obj.get_status_display()}</span>
            </div>
            <div class="card-body">
                <img src="{obj.featured_image or ''}" class="card-img" />
                <p>{obj.excerpt[:120]}...</p>
                <div>{categories_html} {tags_html}</div>
            </div>
            <div class="card-footer">
                <a href="/admin/blog/post/{obj.id}/change/" class="button">Редактировать</a>
                <a href="{obj.get_absolute_url()}" target="_blank" class="button">Посмотреть</a>
            </div>
        </div>
        """)

    card_post.short_description = "Пост"
    card_post.allow_tags = True

    # Массовые действия
    def make_published(self, request, queryset):
        queryset.update(status='published')
        self.message_user(request, "Выбранные посты опубликованы.")
    make_published.short_description = "Опубликовать выбранные"

    def make_draft(self, request, queryset):
        queryset.update(status='draft')
        self.message_user(request, "Выбранные посты переведены в черновики.")
    make_draft.short_description = "Перевести в черновики"

    class Media:
        css = {'all': ('admin/custom.css',)}
        js = ('admin/custom.js',)


# ----------------------------------------
# CATEGORIES & TAGS
# ----------------------------------------
@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('title', 'slug', 'post_count')
    search_fields = ('title',)
    prepopulated_fields = {"slug": ("title",)}

    def post_count(self, obj):
        return obj.posts.count()
    post_count.short_description = "Количество постов"

    class Media:
        css = {'all': ('admin/custom.css',)}


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ('title', 'slug', 'post_count')
    search_fields = ('title',)
    prepopulated_fields = {"slug": ("title",)}

    def post_count(self, obj):
        return obj.posts.count()
    post_count.short_description = "Количество постов"

    class Media:
        css = {'all': ('admin/custom.css',)}


# ----------------------------------------
# COMMENTS
# ----------------------------------------
@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ('name', 'post', 'user', 'parent', 'is_public', 'is_moderated', 'created_at')
    list_filter = ('is_public', 'is_moderated', 'created_at', 'post')
    search_fields = ('name', 'email', 'content')
    autocomplete_fields = ('post', 'parent', 'user')
    actions = ['approve_comments', 'reject_comments']

    def approve_comments(self, request, queryset):
        queryset.update(is_moderated=False, is_public=True)
        self.message_user(request, "Выбранные комментарии одобрены.")
    approve_comments.short_description = "Одобрить выбранные комментарии"

    def reject_comments(self, request, queryset):
        queryset.update(is_moderated=True, is_public=False)
        self.message_user(request, "Выбранные комментарии отклонены.")
    reject_comments.short_description = "Отклонить выбранные комментарии"

    class Media:
        css = {'all': ('admin/custom.css',)}


# ----------------------------------------
# POST REACTIONS
# ----------------------------------------
@admin.register(PostReaction)
class PostReactionAdmin(admin.ModelAdmin):
    list_display = ('post', 'likes_count', 'anon_count', 'created_at', 'updated_at')
    search_fields = ('post__title',)
    autocomplete_fields = ('post', 'users')
    ordering = ('-created_at',)

    class Media:
        css = {'all': ('admin/custom.css',)}
