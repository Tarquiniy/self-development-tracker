from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.contrib.auth import get_user_model
from .models import Post, Category, Tag, Comment, PostReaction
from django_summernote.admin import SummernoteModelAdmin

CustomUser = get_user_model()

# ========== КАСТОМНЫЙ АДМИН САЙТ ==========
class CustomAdminSite(admin.AdminSite):
    site_header = 'Positive Theta Administration'
    site_title = 'Positive Theta Admin'
    index_title = 'Dashboard'
    
    def each_context(self, request):
        context = super().each_context(request)
        context['has_permission'] = True
        return context

# ========== ПОЛЬЗОВАТЕЛИ ==========
@admin.register(CustomUser)
class CustomUserAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'is_staff', 'is_active', 'date_joined')
    list_filter = ('is_staff', 'is_active', 'date_joined')
    search_fields = ('username', 'email', 'first_name', 'last_name')
    ordering = ('-date_joined',)
    fieldsets = (
        (None, {
            'fields': ('username', 'email', 'password')
        }),
        ('Personal info', {
            'fields': ('first_name', 'last_name')
        }),
        ('Permissions', {
            'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')
        }),
        ('Important dates', {
            'fields': ('last_login', 'date_joined')
        }),
    )
    
    class Media:
        css = {'all': ('admin/admin-modern.css',)}

# ========== ПОСТЫ С УЛУЧШЕННЫМ ИНТЕРФЕЙСОМ ==========
class CommentInline(admin.TabularInline):
    model = Comment
    extra = 0
    fields = ('name', 'content', 'is_public', 'is_moderated', 'created_at')
    readonly_fields = ('created_at',)

@admin.register(Post)
class PostAdmin(SummernoteModelAdmin):
    summernote_fields = ('content', 'excerpt')
    list_display = ('admin_thumbnail', 'title', 'author', 'status', 'published_at', 'action_buttons')
    list_filter = ('status', 'published_at', 'categories', 'tags')
    search_fields = ('title', 'content', 'excerpt')
    prepopulated_fields = {'slug': ('title',)}
    date_hierarchy = 'published_at'
    ordering = ('-published_at',)
    filter_horizontal = ('categories', 'tags')
    
    fieldsets = (
        ('Основная информация', {
            'fields': ('title', 'slug', 'author', 'status', 'published_at')
        }),
        ('Содержание', {
            'fields': ('excerpt', 'content', 'featured_image')
        }),
        ('Категории и теги', {
            'fields': ('categories', 'tags')
        }),
        ('SEO', {
            'fields': ('meta_title', 'meta_description', 'og_image'),
            'classes': ('collapse',)
        }),
    )
    
    inlines = [CommentInline]
    actions = ['make_published', 'make_draft', 'duplicate_post']
    
    def admin_thumbnail(self, obj):
        if obj.featured_image:
            return format_html('<img src="{}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;" />', obj.featured_image)
        return "🖼️"
    admin_thumbnail.short_description = "Изображение"
    
    def action_buttons(self, obj):
        return format_html(
            '<div class="action-icons">'
            '<a href="{}" class="action-icon" title="Редактировать">✏️</a>'
            '<a href="{}" target="_blank" class="action-icon" title="Просмотреть">👁️</a>'
            '</div>',
            reverse('admin:blog_post_change', args=[obj.id]),
            obj.get_absolute_url()
        )
    action_buttons.short_description = "Действия"
    
    def make_published(self, request, queryset):
        updated = queryset.update(status='published')
        self.message_user(request, f"{updated} постов опубликовано.")
    make_published.short_description = "Опубликовать выбранные посты"
    
    def make_draft(self, request, queryset):
        updated = queryset.update(status='draft')
        self.message_user(request, f"{updated} постов переведено в черновики.")
    make_draft.short_description = "Перевести в черновики"
    
    def duplicate_post(self, request, queryset):
        for post in queryset:
            post.pk = None
            post.slug = f"{post.slug}-copy"
            post.title = f"{post.title} (копия)"
            post.status = 'draft'
            post.save()
        self.message_user(request, f"Создано {queryset.count()} копий постов.")
    duplicate_post.short_description = "Создать копии"
    
    class Media:
        css = {'all': ('admin/admin-modern.css',)}
        js = ('admin/admin.js',)

# ========== КАТЕГОРИИ И ТЕГИ ==========
@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'post_count', 'created_at')
    search_fields = ('name', 'description')
    prepopulated_fields = {'slug': ('name',)}
    fields = ('name', 'slug', 'description')
    
    def post_count(self, obj):
        return obj.posts.count()
    post_count.short_description = "Количество постов"
    
    class Media:
        css = {'all': ('admin/admin-modern.css',)}

@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'post_count')
    search_fields = ('name',)
    prepopulated_fields = {'slug': ('name',)}
    
    def post_count(self, obj):
        return obj.posts.count()
    post_count.short_description = "Количество постов"
    
    class Media:
        css = {'all': ('admin/admin-modern.css',)}

# ========== КОММЕНТАРИИ ==========
@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ('name', 'post_link', 'user', 'short_content', 'is_public', 'is_moderated', 'created_at')
    list_filter = ('is_public', 'is_moderated', 'created_at', 'post')
    search_fields = ('name', 'email', 'content', 'post__title')
    list_editable = ('is_public', 'is_moderated')
    actions = ['approve_comments', 'reject_comments', 'mark_as_spam']
    
    def post_link(self, obj):
        return format_html('<a href="{}">{}</a>', 
                         reverse('admin:blog_post_change', args=[obj.post.id]),
                         obj.post.title)
    post_link.short_description = "Пост"
    
    def short_content(self, obj):
        return obj.content[:100] + '...' if len(obj.content) > 100 else obj.content
    short_content.short_description = "Комментарий"
    
    def approve_comments(self, request, queryset):
        updated = queryset.update(is_moderated=True, is_public=True)
        self.message_user(request, f"{updated} комментариев одобрено.")
    approve_comments.short_description = "Одобрить выбранные"
    
    def reject_comments(self, request, queryset):
        updated = queryset.update(is_moderated=True, is_public=False)
        self.message_user(request, f"{updated} комментариев отклонено.")
    reject_comments.short_description = "Отклонить выбранные"
    
    def mark_as_spam(self, request, queryset):
        updated = queryset.update(is_moderated=True, is_public=False)
        self.message_user(request, f"{updated} комментариев помечено как спам.")
    mark_as_spam.short_description = "Пометить как спам"
    
    class Media:
        css = {'all': ('admin/admin-modern.css',)}

# ========== РЕАКЦИИ ==========
@admin.register(PostReaction)
class PostReactionAdmin(admin.ModelAdmin):
    list_display = ('post', 'likes_count', 'users_count', 'anon_count', 'updated_at')
    search_fields = ('post__title',)
    readonly_fields = ('likes_count', 'users_count', 'anon_count')
    
    def likes_count(self, obj):
        return obj.likes_count()
    likes_count.short_description = "Всего лайков"
    
    def users_count(self, obj):
        return obj.users.count()
    users_count.short_description = "Лайков от пользователей"
    
    class Media:
        css = {'all': ('admin/admin-modern.css',)}

# ========== DASHBOARD WIDGETS ==========
class DashboardAdmin(admin.ModelAdmin):
    def get_urls(self):
        from django.urls import path
        urls = super().get_urls()
        custom_urls = [
            path('dashboard/', self.admin_site.admin_view(self.dashboard_view), name='dashboard'),
        ]
        return custom_urls + urls
    
    def dashboard_view(self, request):
        from django.shortcuts import render
        context = {
            'title': 'Dashboard',
            'posts_count': Post.objects.count(),
            'published_count': Post.objects.filter(status='published').count(),
            'comments_count': Comment.objects.count(),
            'users_count': CustomUser.objects.count(),
        }
        return render(request, 'admin/dashboard.html', context)

# Регистрируем кастомный админ сайт
custom_admin_site = CustomAdminSite(name='custom_admin')
custom_admin_site.register(Post, PostAdmin)
custom_admin_site.register(Category, CategoryAdmin)
custom_admin_site.register(Tag, TagAdmin)
custom_admin_site.register(Comment, CommentAdmin)
custom_admin_site.register(PostReaction, PostReactionAdmin)
custom_admin_site.register(CustomUser, CustomUserAdmin)