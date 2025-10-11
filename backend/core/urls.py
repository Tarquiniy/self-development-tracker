# backend/core/urls.py
from django.conf import settings
from django.contrib import admin
from django.urls import path, include, reverse_lazy
from django.shortcuts import redirect
from django.views.generic import TemplateView
from django.views.generic.base import RedirectView
from users.views import RegisterView, LoginView, ProfileView
from django.conf.urls.static import static
from .admin import custom_admin_site
from blog import views as blog_views
from django.http import Http404

import logging
logger = logging.getLogger(__name__)

# Import Post model defensively (used by compatibility wrappers)
try:
    from blog.models import Post
except Exception:
    Post = None
    logger.exception("Could not import blog.models.Post for compatibility URL wrappers")

# -----------------------
# Compatibility wrappers
# These ensure that URLs with names blog_post_add, blog_post_change, blog_post_changelist
# exist regardless of ordering/import problems elsewhere in the project.
# They delegate to the registered ModelAdmin for Post (if present).
# -----------------------
def _get_post_modeladmin():
    """Return ModelAdmin instance for Post or None."""
    try:
        if Post is None:
            return None
        return admin.site._registry.get(Post)
    except Exception:
        logger.exception("Error fetching ModelAdmin for Post")
        return None

def blog_post_add(request, *args, **kwargs):
    """
    Compatibility view named 'blog_post_add'.
    Delegates to PostAdmin.add_view(request).
    """
    model_admin = _get_post_modeladmin()
    if not model_admin:
        # If not registered, return 404 to avoid NoReverseMatch later
        raise Http404("Post admin not available")
    return model_admin.add_view(request, *args, **kwargs)

def blog_post_change(request, object_id, *args, **kwargs):
    """
    Compatibility view named 'blog_post_change'.
    Delegates to PostAdmin.change_view(request, object_id).
    """
    model_admin = _get_post_modeladmin()
    if not model_admin:
        raise Http404("Post admin not available")
    return model_admin.change_view(request, str(object_id), *args, **kwargs)

def blog_post_changelist(request, *args, **kwargs):
    """
    Compatibility view named 'blog_post_changelist'.
    Delegates to PostAdmin.changelist_view(request).
    """
    model_admin = _get_post_modeladmin()
    if not model_admin:
        raise Http404("Post admin not available")
    # prefer standard method name, fall back sensibly
    view_fn = getattr(model_admin, "changelist_view", None) or getattr(model_admin, "changelist_view", None)
    if not callable(view_fn):
        # last resort: use admin.site.index to show admin index
        return admin.site.index(request)
    return view_fn(request, *args, **kwargs)

# -----------------------
# Try to import admin helper views from blog.admin (if available).
# core/urls.py will still work even if blog.admin import fails.
# -----------------------
admin_media_library_view = None
admin_dashboard_view = None
admin_post_update_view = None
admin_stats_api = None
admin_autosave_view = None
admin_preview_token_view = None

try:
    import blog.admin as blog_admin_mod
    admin_media_library_view = getattr(blog_admin_mod, "admin_media_library_view", getattr(blog_admin_mod, "admin_media_library", None))
    admin_dashboard_view = getattr(blog_admin_mod, "admin_dashboard_view", None)
    admin_post_update_view = getattr(blog_admin_mod, "admin_post_update_view", None)
    admin_stats_api = getattr(blog_admin_mod, "admin_stats_api", getattr(blog_admin_mod, "admin_dashboard_stats", None))
    admin_autosave_view = getattr(blog_admin_mod, "admin_autosave_view", getattr(blog_admin_mod, "admin_autosave", None))
    admin_preview_token_view = getattr(blog_admin_mod, "admin_preview_token_view", getattr(blog_admin_mod, "admin_preview_token", None))
except Exception:
    # ignore import errors — we have compatibility wrappers above
    logger.exception("Could not import blog.admin module (continuing without it)")

# If admin_media_library_view is not provided, fallback to blog.views.MediaLibraryView if present
if admin_media_library_view is None:
    try:
        from blog.views import MediaLibraryView
        admin_media_library_view = MediaLibraryView.as_view()
    except Exception:
        admin_media_library_view = None

# -----------------------
# URL patterns
# Note: compatibility post routes must be registered *before* admin.site.urls
# so they are matched prior to admin catch-all.
# -----------------------
urlpatterns = []

# media-library route registered first (as in your previous setup)
if admin_media_library_view:
    urlpatterns.append(path('admin/media-library/', admin_media_library_view, name='admin-media-library'))
else:
    urlpatterns.append(path('admin/media-library/', TemplateView.as_view(template_name='admin/media_library_unavailable.html'), name='admin-media-library'))

# Compatibility routes for older templates/links (guaranteed to exist)
urlpatterns += [
    path('admin/blog/post/add/', blog_post_add, name='blog_post_add'),
    path('admin/blog/post/<int:object_id>/change/', blog_post_change, name='blog_post_change'),
    path('admin/blog/post/', blog_post_changelist, name='blog_post_changelist'),
]

# Normal app routes and admin registration
urlpatterns += [
    path('grappelli/', include('grappelli.urls')),
    # Custom admin site
    path("admin/", custom_admin_site.urls),
    path('api/auth/register/', RegisterView.as_view(), name='register'),
    path('api/auth/login/', LoginView.as_view(), name='login'),
    path('api/blog/', include(('blog.urls', 'blog'), namespace='blog')),
    path('api/tables/', include(('tables.urls', 'tables'), namespace='tables')),
    path('summernote/', include('django_summernote.urls')),
    path('api/auth/profile/', ProfileView.as_view(), name='profile'),
    path('preview/<str:token>/', blog_views.preview_by_token, name='post-preview'),
    # Root redirect (so GET / doesn't 404). Change target if you want a public homepage.
    path('', RedirectView.as_view(url=reverse_lazy('admin:index'))),
]

# Optional admin helpers (if present)
if admin_dashboard_view:
    urlpatterns.append(path('admin/dashboard/', admin_dashboard_view, name='admin-dashboard'))
if admin_stats_api:
    urlpatterns.append(path('admin/dashboard/stats-data/', admin_stats_api, name='admin-dashboard-stats'))
if admin_post_update_view:
    urlpatterns.append(path('admin/posts/update/', admin_post_update_view, name='admin-post-update'))
if admin_autosave_view:
    urlpatterns.append(path('admin/posts/autosave/', admin_autosave_view, name='admin-autosave'))
if admin_preview_token_view:
    urlpatterns.append(path('admin/posts/preview-token/', admin_preview_token_view, name='admin-preview-token'))

# Serve media/static in DEBUG
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
