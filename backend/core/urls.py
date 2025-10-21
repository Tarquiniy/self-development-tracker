# backend/core/urls.py
import logging

from django.conf import settings
from django.contrib import admin
from django.urls import path, include
from django.views.generic import RedirectView
from django.http import HttpResponseNotFound

logger = logging.getLogger(__name__)

# Try to import admin views from blog.admin in a safe way.
admin_dashboard_view = None
admin_media_library_view = None
try:
    # Preferred: import explicit views (so we can name them as needed)
    from blog.admin import admin_dashboard_view, admin_media_library_view  # type: ignore
except Exception as e:
    logger.warning("Could not import admin_dashboard_view/admin_media_library_view from blog.admin: %s", e)
    # Try a helper that provides URL patterns (fallback)
    try:
        from blog.admin import get_extra_admin_urls  # type: ignore
        # We'll call get_extra_admin_urls() later if needed
    except Exception as e2:
        logger.debug("blog.admin.get_extra_admin_urls not available: %s", e2)
        # leave views as None

# Try to import MediaLibraryView used by preview route (safe)
try:
    from blog.views import MediaLibraryView  # type: ignore
except Exception as e:
    logger.warning("Could not import MediaLibraryView from blog.views: %s", e)
    MediaLibraryView = None

def custom_404_view(request, exception=None):
    return HttpResponseNotFound("Страница не найдена")

urlpatterns = [
    path('grappelli/', include('grappelli.urls')),
    path('admin/', admin.site.urls),

    # Blog API
    path('api/blog/', include(('blog.urls', 'blog'), namespace='blog')),

    # Summernote
    path('summernote/', include('django_summernote.urls')),
]

# Preview (only if MediaLibraryView imported successfully)
if MediaLibraryView is not None:
    urlpatterns += [
        path('preview/<str:token>/', MediaLibraryView.as_view(), name='post-preview'),
    ]
else:
    logger.debug("Skipping preview route because MediaLibraryView is not available.")

# If explicit views imported, register them under *two* names:
# - the 'admin-...' name we used earlier (admin-media-library / admin-dashboard)
# - and the legacy/simple name templates might expect (media-library / dashboard)
if admin_dashboard_view and admin_media_library_view:
    urlpatterns += [
        # Dashboard (two names)
        path('admin/dashboard/', admin_dashboard_view, name='admin-dashboard'),
        path('admin/dashboard/', admin_dashboard_view, name='dashboard'),
        # Media library (two names)
        path('admin/media-library/', admin_media_library_view, name='admin-media-library'),
        path('admin/media-library/', admin_media_library_view, name='media-library'),
    ]
else:
    # If explicit views not available, try get_extra_admin_urls() from blog.admin if present
    try:
        from blog.admin import get_extra_admin_urls  # type: ignore
        extra = get_extra_admin_urls() or []
        # If get_extra_admin_urls returned patterns, include them.
        if extra:
            urlpatterns += extra
            # Also add quick aliases for common names if we can discover them:
            # We'll attempt to map patterns named 'admin-media-library' -> 'media-library' etc.
            # But since we cannot introspect easily here, add safe fallback alias routes if functions exist in module.
            try:
                # If functions exist in module, register aliases
                import blog.admin as blog_admin_mod  # type: ignore
                if hasattr(blog_admin_mod, 'admin_dashboard_view'):
                    urlpatterns += [
                        path('admin/dashboard/', getattr(blog_admin_mod, 'admin_dashboard_view'), name='dashboard'),
                        path('admin/dashboard/', getattr(blog_admin_mod, 'admin_dashboard_view'), name='admin-dashboard'),
                    ]
                if hasattr(blog_admin_mod, 'admin_media_library_view'):
                    urlpatterns += [
                        path('admin/media-library/', getattr(blog_admin_mod, 'admin_media_library_view'), name='media-library'),
                        path('admin/media-library/', getattr(blog_admin_mod, 'admin_media_library_view'), name='admin-media-library'),
                    ]
            except Exception as e_inner:
                logger.debug("Could not add alias admin URLs from blog.admin module: %s", e_inner)
    except Exception:
        # nothing we can do safely — skip adding extra admin urls
        logger.debug("No extra admin URLs added from blog.admin.")

# Health check and root redirect
urlpatterns += [
    path('health/', lambda request: HttpResponseNotFound("OK"), name='health-check'),
    path('', RedirectView.as_view(url='/admin/')),
]

# CKEditor 5 (optional)
try:
    urlpatterns += [path('ckeditor5/', include('django_ckeditor_5.urls'))]
except Exception:
    logger.debug("django_ckeditor_5 not available; skipping ckeditor5 urls.")

# Static serving in DEBUG
if settings.DEBUG:
    from django.conf.urls.static import static
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# 404 handler
handler404 = custom_404_view
