# backend/blog/admin.py
import os
import json
import logging
from django import forms
from django.contrib import admin
from django.contrib.admin.sites import AlreadyRegistered
from django.contrib.admin.views.decorators import staff_member_required
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
from django.db import models
from django.utils.safestring import mark_safe
from django.utils.html import escape
from django.template.loader import render_to_string

logger = logging.getLogger(__name__)

# CKEditor import
try:
    from django_ckeditor_5.widgets import CKEditor5Widget
    HAS_CKEDITOR_WIDGET = True
except ImportError:
    HAS_CKEDITOR_WIDGET = False
    CKEditor5Widget = forms.Textarea

# Import models
try:
    from .models import (
        Post, Category, Tag, Comment,
        PostReaction, PostView, PostAttachment, MediaLibrary, PostRevision
    )
except Exception as e:
    logger.exception("Could not import blog.models: %s", e)
    Post = Category = Tag = Comment = PostReaction = PostView = PostAttachment = MediaLibrary = PostRevision = None

CustomUser = get_user_model()
PREVIEW_SALT = "post-preview-salt"

# -----------------------
# Modern Admin Form
# -----------------------
class ModernPostAdminForm(forms.ModelForm):
    published_at = forms.DateTimeField(
        required=False,
        widget=forms.DateTimeInput(attrs={
            'type': 'datetime-local',
            'class': 'modern-input'
        }),
        input_formats=['%Y-%m-%dT%H:%M']
    )

    class Meta:
        model = Post
        fields = '__all__'
        widgets = {
            'excerpt': forms.Textarea(attrs={
                'rows': 4, 
                'placeholder': 'Write a compelling excerpt for your post...',
                'class': 'modern-textarea'
            }),
            'meta_description': forms.Textarea(attrs={
                'rows': 3,
                'placeholder': 'Meta description for SEO (recommended: 150-160 characters)',
                'class': 'modern-textarea'
            }),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        
        # Add CKEditor widget for content field
        if HAS_CKEDITOR_WIDGET and 'content' in self.fields:
            self.fields['content'].widget = CKEditor5Widget(
                attrs={'class': 'ckeditor'},
                config_name='extends'
            )
        elif 'content' in self.fields:
            self.fields['content'].widget.attrs.update({
                'class': 'modern-textarea large',
                'rows': 20,
                'placeholder': 'Start writing your amazing content here...'
            })
        
        # Modern styling for all fields
        for field_name, field in self.fields.items():
            if isinstance(field.widget, (forms.TextInput, forms.URLInput)):
                field.widget.attrs.update({
                    'class': 'modern-input',
                    'placeholder': f'Enter {field.label.lower()}...'
                })
            elif isinstance(field.widget, forms.Select):
                field.widget.attrs.update({'class': 'modern-select'})

        # Set initial published_at
        if self.instance and self.instance.published_at:
            self.fields['published_at'].initial = self.instance.published_at.strftime('%Y-%m-%dT%H:%M')
        elif not self.instance.pk:
            self.fields['published_at'].initial = timezone.now().strftime('%Y-%m-%dT%H:%M')

# -----------------------
# Modern Admin Classes
# -----------------------
class ModernPostAdmin(admin.ModelAdmin):
    form = ModernPostAdminForm
    change_form_template = 'admin/blog/post/change_form.html'

    # Modern list display
    list_display = ("title", "status_badge", "author", "published_at", "reading_time", "actions_column")
    list_filter = ("status", "published_at", "categories", "tags")
    search_fields = ("title", "excerpt", "content", "meta_description")
    prepopulated_fields = {"slug": ("title",)}
    date_hierarchy = "published_at"
    ordering = ("-published_at",)
    filter_horizontal = ("categories", "tags")
    actions = ["make_published", "make_draft", "duplicate_post", "update_seo_meta"]
    
    # Modern fieldsets
    fieldsets = (
        ("📝 Content", {
            'fields': ('title', 'slug', 'content', 'excerpt'),
            'classes': ('modern-fieldset', 'wide')
        }),
        ("🖼️ Media", {
            'fields': ('featured_image', 'og_image'),
            'classes': ('modern-fieldset', 'collapse')
        }),
        ("🏷️ Organization", {
            'fields': ('categories', 'tags'),
            'classes': ('modern-fieldset',)
        }),
        ("⚙️ Publishing", {
            'fields': ('author', 'status', 'published_at'),
            'classes': ('modern-fieldset',)
        }),
        ("🔍 SEO", {
            'fields': ('meta_title', 'meta_description'),
            'classes': ('modern-fieldset', 'collapse')
        }),
    )

    def status_badge(self, obj):
        status_config = {
            'draft': {'color': 'gray', 'icon': '⏳'},
            'published': {'color': 'green', 'icon': '✅'},
            'archived': {'color': 'orange', 'icon': '📁'}
        }
        config = status_config.get(obj.status, {'color': 'gray', 'icon': '❓'})
        return mark_safe(
            f'<span class="status-badge status-{config["color"]}">'
            f'{config["icon"]} {obj.get_status_display()}'
            f'</span>'
        )
    status_badge.short_description = "Status"
    status_badge.admin_order_field = 'status'

    def reading_time(self, obj):
        time = obj.reading_time
        return f"⏱️ {time} min"
    reading_time.short_description = "Reading Time"

    def actions_column(self, obj):
        change_url = reverse('admin:blog_post_change', args=[obj.id])
        view_url = obj.get_absolute_url()
        preview_url = f"{view_url}?preview=true"
        
        return mark_safe(f'''
            <div class="action-buttons">
                <a href="{change_url}" class="btn btn-primary btn-sm" title="Edit">
                    <i class="fas fa-edit"></i>
                </a>
                <a href="{preview_url}" target="_blank" class="btn btn-success btn-sm" title="Preview">
                    <i class="fas fa-eye"></i>
                </a>
                <a href="{view_url}" target="_blank" class="btn btn-outline btn-sm" title="View Live">
                    <i class="fas fa-external-link-alt"></i>
                </a>
            </div>
        ''')
    actions_column.short_description = "Actions"

    def make_published(self, request, queryset):
        updated = queryset.update(status="published", published_at=timezone.now())
        self.message_user(request, f"✅ {updated} posts published successfully.")
    make_published.short_description = "📢 Publish selected posts"

    def make_draft(self, request, queryset):
        updated = queryset.update(status="draft")
        self.message_user(request, f"📝 {updated} posts moved to drafts.")
    make_draft.short_description = "📝 Move to drafts"

    def duplicate_post(self, request, queryset):
        created = 0
        for post in queryset:
            try:
                post.pk = None
                post.slug = f"{post.slug}-copy"
                post.title = f"{post.title} (Copy)"
                post.status = "draft"
                post.save()
                created += 1
            except Exception as e:
                logger.error(f"Error duplicating post {post.id}: {e}")
        self.message_user(request, f"🔁 {created} posts duplicated successfully.")
    duplicate_post.short_description = "🔁 Duplicate selected posts"

    def update_seo_meta(self, request, queryset):
        updated = 0
        for post in queryset:
            if not post.meta_title:
                post.meta_title = post.title
                post.save()
                updated += 1
        self.message_user(request, f"🔍 SEO meta titles updated for {updated} posts.")
    update_seo_meta.short_description = "🔍 Update SEO meta data"

class ModernCategoryAdmin(admin.ModelAdmin):
    list_display = ("title", "slug", "post_count", "created_at")
    prepopulated_fields = {"slug": ("title",)}
    search_fields = ("title", "description")
    list_filter = ("created_at",)

    def post_count(self, obj):
        count = obj.posts.count()
        return mark_safe(f'<span class="status-badge status-blue">📄 {count}</span>')
    post_count.short_description = "Posts"

class ModernTagAdmin(admin.ModelAdmin):
    list_display = ("title", "slug", "post_count")
    prepopulated_fields = {"slug": ("title",)}
    search_fields = ("title",)

    def post_count(self, obj):
        count = obj.posts.count()
        return mark_safe(f'<span class="status-badge status-blue">📄 {count}</span>')
    post_count.short_description = "Posts"

class ModernCommentAdmin(admin.ModelAdmin):
    list_display = ("author_name", "post_link", "short_content", "status_badges", "created_at")
    list_filter = ("is_public", "is_moderated", "created_at")
    search_fields = ("name", "email", "content")
    actions = ["approve_comments", "reject_comments", "mark_as_moderated"]

    def author_name(self, obj):
        if obj.user:
            return f"👤 {obj.user.get_username()}"
        return f"👤 {obj.name} ({obj.email})"
    author_name.short_description = "Author"

    def post_link(self, obj):
        if obj.post:
            url = reverse('admin:blog_post_change', args=[obj.post.id])
            return mark_safe(f'<a href="{url}" class="btn btn-outline btn-sm">📝 {obj.post.title[:30]}...</a>')
        return "—"
    post_link.short_description = "Post"

    def short_content(self, obj):
        content = obj.content[:100] + "..." if len(obj.content) > 100 else obj.content
        return content
    short_content.short_description = "Comment"

    def status_badges(self, obj):
        badges = []
        if obj.is_public:
            badges.append('<span class="status-badge status-green">🌐 Public</span>')
        else:
            badges.append('<span class="status-badge status-gray">🔒 Hidden</span>')
        if obj.is_moderated:
            badges.append('<span class="status-badge status-blue">✅ Moderated</span>')
        else:
            badges.append('<span class="status-badge status-orange">⏳ Pending</span>')
        return mark_safe(" ".join(badges))
    status_badges.short_description = "Status"

    def approve_comments(self, request, queryset):
        updated = queryset.update(is_public=True, is_moderated=True)
        self.message_user(request, f"✅ {updated} comments approved and published.")
    approve_comments.short_description = "✅ Approve and publish comments"

    def reject_comments(self, request, queryset):
        updated = queryset.update(is_public=False)
        self.message_user(request, f"❌ {updated} comments hidden.")
    reject_comments.short_description = "❌ Hide comments"

    def mark_as_moderated(self, request, queryset):
        updated = queryset.update(is_moderated=True)
        self.message_user(request, f"✅ {updated} comments marked as moderated.")
    mark_as_moderated.short_description = "✅ Mark as moderated"

class ModernMediaLibraryAdmin(admin.ModelAdmin):
    list_display = ("thumbnail", "title", "file_type", "file_size", "uploaded_by", "uploaded_at", "post_link")
    list_filter = ("uploaded", "uploaded_by")
    search_fields = ("title", "file")
    readonly_fields = ("file_size", "file_type", "uploaded_at_display")

    def thumbnail(self, obj):
        if not obj or not obj.file:
            return "📄"
        file_ext = os.path.splitext(obj.file.name)[1].lower()
        image_exts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']
        
        if file_ext in image_exts:
            try:
                url = obj.file.url
                return mark_safe(f'<img src="{url}" class="media-thumbnail" alt="{obj.title}">')
            except Exception:
                return "🖼️"
        elif file_ext == '.pdf':
            return "📕"
        elif file_ext in ['.doc', '.docx']:
            return "📘"
        elif file_ext in ['.mp4', '.mov', '.avi']:
            return "🎥"
        elif file_ext in ['.mp3', '.wav']:
            return "🎵"
        else:
            return "📄"
    thumbnail.short_description = ""

    def file_type(self, obj):
        ext = os.path.splitext(obj.file.name)[1].upper().replace('.', '')
        return f"{ext} file"
    file_type.short_description = "Type"

    def file_size(self, obj):
        try:
            size = obj.file.size
            for unit in ['B', 'KB', 'MB', 'GB']:
                if size < 1024.0:
                    return f"{size:.1f} {unit}"
                size /= 1024.0
            return f"{size:.1f} TB"
        except Exception:
            return "N/A"
    file_size.short_description = "Size"

    def uploaded_at_display(self, obj):
        return obj.uploaded_at.strftime("%Y-%m-%d %H:%M") if obj.uploaded_at else ""
    uploaded_at_display.short_description = "Uploaded"

    def post_link(self, obj):
        if obj and obj.post:
            url = reverse('admin:blog_post_change', args=[obj.post.id])
            return mark_safe(f'<a href="{url}" class="btn btn-outline btn-sm">📝 {obj.post.title[:20]}...</a>')
        return mark_safe('<span class="text-muted">—</span>')
    post_link.short_description = "Post"

# -----------------------
# Registration
# -----------------------
def register_modern_admin_models():
    """Register all models with modern admin interfaces"""
    try:
        if Post is not None:
            admin.site.register(Post, ModernPostAdmin)
        if Category is not None:
            admin.site.register(Category, ModernCategoryAdmin)
        if Tag is not None:
            admin.site.register(Tag, ModernTagAdmin)
        if Comment is not None:
            admin.site.register(Comment, ModernCommentAdmin)
        if MediaLibrary is not None:
            admin.site.register(MediaLibrary, ModernMediaLibraryAdmin)
            
        # Register other models with basic admin
        if PostReaction is not None:
            admin.site.register(PostReaction)
        if PostView is not None:
            admin.site.register(PostView)
        if PostRevision is not None:
            admin.site.register(PostRevision)
            
    except AlreadyRegistered:
        pass
    except Exception as e:
        logger.exception("Modern admin registration failed: %s", e)

# Register models
register_modern_admin_models()

# Admin views
@require_GET
@staff_member_required
def admin_dashboard_view(request):
    """Modern admin dashboard"""
    context = {
        'posts_count': Post.objects.count() if Post else 0,
        'comments_count': Comment.objects.count() if Comment else 0,
        'recent_posts': Post.objects.all().order_by('-created_at')[:5] if Post else [],
    }
    return render(request, 'admin/dashboard.html', context)

@require_GET  
@staff_member_required
def admin_media_library_view(request):
    """Modern media library view"""
    attachments = PostAttachment.objects.all().order_by('-uploaded_at')[:50] if PostAttachment else []
    return render(request, 'admin/media_library.html', {'attachments': attachments})