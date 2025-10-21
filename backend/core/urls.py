# backend/core/urls.py
import logging

from django.conf import settings
from django.contrib import admin
from django.urls import path, include
from django.views.generic import RedirectView
from django.http import HttpResponseNotFound

logger = logging.getLogger(__name__)

# Attempt to import optional admin views from blog.admin in a robust way.
# If they don't exist (ImportError or any runtime error during import),
# we log the issue and continue without registering those routes.
extra_admin_urlpatterns = []
try:
    # Try to import the individual views first (preferred)
    from blog.admin import admin_dashboard_view, admin_media_library_view  # type: ignore

    extra_admin_urlpatterns = [
        path('admin/dashboard/', admin_dashboard_view, name='admin-dashboard'),
        path('admin/media-library/', admin_media_library_view, name='admin-media-library'),
    ]
except Exception as e:
    logger.warning("Could not import admin_dashboard_view/admin_media_library_view from blog.admin: %s", e)
    # Try to import helper that returns URL patterns (if available)
    try:
        from blog.admin import get_extra_admin_urls  # type: ignore
        # get_extra_admin_urls is expected to return a list of django.urls.path(...) items
        extra_admin_urlpatterns = get_extra_admin_urls() or []
    except Exception as e2:
        logger.info("No extra admin URLs provided by blog.admin (get_extra_admin_urls missing or failed): %s", e2)
        extra_admin_urlpatterns = []

# Admin views from blog.views (example usage in preview route)
# Note: if this import fails, it's appropriate to see the traceback and fix blog.views
try:
    from blog.views import MediaLibraryView  # type: ignore
except Exception as e:
    logger.warning("Could not import MediaLibraryView from blog.views: %s", e)
    MediaLibraryView = None  # safe fallback

def custom_404_view(request, exception=None):
    return HttpResponseNotFound("Страница не найдена")

urlpatterns = [
    path('grappelli/', include('grappelli.urls')),
    path('admin/', admin.site.urls),

    # Blog API
    path('api/blog/', include(('blog.urls', 'blog'), namespace='blog')),

    # Summernote
    path('summernote/', include('django_summernote.urls')),

    # Preview (only if MediaLibraryView imported successfully)
    # If MediaLibraryView is None, preview route will not be added.
]

# Add preview route only when view exists
if MediaLibraryView is not None:
    urlpatterns += [
        path('preview/<str:token>/', MediaLibraryView.as_view(), name='post-preview'),
    ]
else:
    logger.debug("Skipping preview route because MediaLibraryView is not available.")

# Add extra admin views (if any were discovered)
if extra_admin_urlpatterns:
    urlpatterns += extra_admin_urlpatterns

# Health check
urlpatterns += [
    path('health/', lambda request: HttpResponseNotFound("OK"), name='health-check'),
    # Root redirect to admin
    path('', RedirectView.as_view(url='/admin/')),
]

# CKEditor 5 urls (optional)
try:
    urlpatterns += [path('ckeditor5/', include('django_ckeditor_5.urls'))]
except Exception:
    # ignore if package not installed
    logger.debug("django_ckeditor_5 not available; skipping ckeditor5 urls.")

# Debug mode static serving
if settings.DEBUG:
    from django.conf.urls.static import static
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# 404 handler
handler404 = custom_404_view
