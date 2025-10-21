# backend/core/urls.py
import logging

from django.conf import settings
from django.contrib import admin
from django.urls import path, include
from django.views.generic import RedirectView
from django.http import HttpResponseNotFound, HttpRequest, HttpResponse
from django.shortcuts import redirect

logger = logging.getLogger(__name__)


def custom_404_view(request, exception=None):
    return HttpResponseNotFound("Страница не найдена")


# --- Wrappers for optional admin views (safe: they won't crash at import time) ---
def admin_media_library_wrapper(request: HttpRequest, *args, **kwargs) -> HttpResponse:
    """
    Wrapper that tries to call blog.admin.admin_media_library_view(request).
    If that view is unavailable or raises, redirects to /admin/ to avoid 500.
    This wrapper is deliberately defensive because templates may call reverse('media-library').
    """
    try:
        from blog.admin import admin_media_library_view  # type: ignore
        return admin_media_library_view(request, *args, **kwargs)
    except Exception as e:
        logger.debug("admin_media_library_wrapper: blog.admin.admin_media_library_view not available or failed: %s", e)
        # safe fallback: redirect to admin index
        return redirect('/admin/')


def admin_dashboard_wrapper(request: HttpRequest, *args, **kwargs) -> HttpResponse:
    """
    Wrapper for blog.admin.admin_dashboard_view with safe fallback.
    """
    try:
        from blog.admin import admin_dashboard_view  # type: ignore
        return admin_dashboard_view(request, *args, **kwargs)
    except Exception as e:
        logger.debug("admin_dashboard_wrapper: blog.admin.admin_dashboard_view not available or failed: %s", e)
        return redirect('/admin/')


# --- Try to import preview view from blog.views (safe) ---
MediaLibraryView = None
try:
    from blog.views import MediaLibraryView  # type: ignore
except Exception as e:
    logger.debug("MediaLibraryView not available: %s", e)
    MediaLibraryView = None


# --- Build urlpatterns robustly ---
urlpatterns = [
    path('grappelli/', include('grappelli.urls')),
    path('admin/', admin.site.urls),

    # Blog API (namespace kept)
    path('api/blog/', include(('blog.urls', 'blog'), namespace='blog')),

    # Summernote (optional)
    path('summernote/', include('django_summernote.urls')),
]

# Preview (only if MediaLibraryView imported successfully)
if MediaLibraryView is not None:
    urlpatterns += [
        path('preview/<str:token>/', MediaLibraryView.as_view(), name='post-preview'),
    ]
else:
    logger.debug("Skipping preview route because MediaLibraryView is not available.")

# --- Admin custom views / aliases ---
# We always register the wrappers under the common names so reverse('media-library') and reverse('dashboard')
# will resolve even if blog.admin doesn't provide the real handlers yet.
urlpatterns += [
    # Dashboard aliases (both plain and admin- prefixed names)
    path('admin/dashboard/', admin_dashboard_wrapper, name='dashboard'),
    path('admin/dashboard/', admin_dashboard_wrapper, name='admin-dashboard'),

    # Media library aliases (both plain and admin- prefixed names)
    #path('admin/media-library/', admin_media_library_wrapper, name='media-library'),
    #path('admin/media-library/', admin_media_library_wrapper, name='admin-media-library'),
]

# Health check + root redirect
urlpatterns += [
    path('health/', lambda request: HttpResponseNotFound("OK"), name='health-check'),
    path('', RedirectView.as_view(url='/admin/')),
]

# CKEditor 5 optional URLs
try:
    urlpatterns += [path('ckeditor5/', include('django_ckeditor_5.urls'))]
except Exception:
    logger.debug("django_ckeditor_5 not available; skipping ckeditor5 urls.")

# Serve static/media in DEBUG
if settings.DEBUG:
    from django.conf.urls.static import static
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# 404 handler
handler404 = custom_404_view
