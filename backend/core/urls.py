# backend/core/urls.py
import logging
from django.conf import settings
from django.contrib import admin
from django.urls import path, include
from django.views.generic import RedirectView
from django.http import HttpResponseNotFound, HttpRequest, HttpResponse
from django.shortcuts import redirect

logger = logging.getLogger(__name__)

# --- Provide safe fallback views in this file so reverse() never fails ---
def custom_404_view(request, exception=None):
    return HttpResponseNotFound("Страница не найдена")

def _simple_media_library_view(request: HttpRequest):
    # simple fallback: GET returns a tiny HTML, POST returns JSON error
    if request.method == "GET":
        return HttpResponse("<html><body><h1>Media Library (fallback)</h1></body></html>")
    return HttpResponseNotFound("No upload handler configured")

def _simple_dashboard_view(request: HttpRequest):
    return HttpResponse("<html><body><h1>Admin Dashboard (fallback)</h1></body></html>")

# Try to import custom admin views from blog.admin_extras (recommended)
admin_media_library_view = None
admin_dashboard_view = None
try:
    from blog.admin_extras import admin_media_library_view as _amlv, admin_dashboard_view as _adb
    admin_media_library_view = _amlv
    admin_dashboard_view = _adb
    logger.debug("Loaded admin_extras admin_media_library_view/admin_dashboard_view.")
except Exception:
    # fallback to local simple views
    admin_media_library_view = _simple_media_library_view
    admin_dashboard_view = _simple_dashboard_view
    logger.debug("blog.admin_extras not available — using fallback media/dashboard views.")

# --- Monkeypatch admin.site.get_urls BEFORE including admin.site.urls so admin namespace has these names ---
try:
    _orig_get_urls = admin.site.get_urls  # type: ignore

    def _get_urls_with_extras():
        extras = [
            path('media-library/', admin_media_library_view, name='media-library'),
            path('dashboard/', admin_dashboard_view, name='dashboard'),
        ]
        return extras + _orig_get_urls()

    admin.site.get_urls = _get_urls_with_extras  # patch
    logger.debug("Patched admin.site.get_urls to include admin:media-library and admin:dashboard")
except Exception as e:
    logger.exception("Failed to patch admin.site.get_urls: %s", e)

# --- Main urlpatterns (global names as well) ---
urlpatterns = [
    path('grappelli/', include('grappelli.urls')),
    path('admin/', admin.site.urls),

    # Blog API
    path('api/blog/', include(('blog.urls', 'blog'), namespace='blog')),

    # Summernote (if used)
    path('summernote/', include('django_summernote.urls')),

    # Optional preview view — try import; if fails, skip
    # path('preview/<str:token>/', MediaLibraryView.as_view(), name='post-preview'),
]

try:
    from blog.admin_extras import get_urls as get_blog_admin_urls
    urlpatterns += get_blog_admin_urls()
except Exception:
    pass

# Ensure both admin-prefixed and top-level media-library routes exist
urlpatterns += [
    # explicit admin-prefixed route (same view as in admin namespace)
    path('admin/media-library/', admin_media_library_view, name='admin-media-library'),
    # top-level (no admin namespace) route named 'media-library' for global reverse()
    path('media-library/', admin_media_library_view, name='media-library'),
    # admin dashboard explicit
    path('admin/dashboard/', admin_dashboard_view, name='admin-dashboard'),
    path('dashboard/', admin_dashboard_view, name='dashboard'),
]

# CKEditor 5 urls (optional)
try:
    urlpatterns += [path('ckeditor5/', include('django_ckeditor_5.urls'))]
except Exception:
    logger.debug("django_ckeditor_5.urls not available; skipping.")

# Health + root
urlpatterns += [
    path('health/', lambda request: HttpResponse("OK"), name='health-check'),
    path('', RedirectView.as_view(url='/admin/')),
]

# Serve static/media in DEBUG
if settings.DEBUG:
    from django.conf.urls.static import static
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

handler404 = custom_404_view
