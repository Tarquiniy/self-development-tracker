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

# --- Safe small handlers used as fallbacks ---
def _redirect_to_admin(request: HttpRequest, *args, **kwargs) -> HttpResponse:
    """Безопасный fallback: просто редирект в /admin/"""
    return redirect('/admin/')

# --- Patch admin site urls to include our names inside 'admin' namespace ---
# This ensures reverse('admin:media-library') and reverse('admin:dashboard') succeed.
try:
    _orig_get_urls = admin.site.get_urls  # type: ignore

    def _get_urls_with_extras():
        extra = [
            # These names will live *inside* admin.site.urls namespace,
            # so templates resolving within current_app='admin' will find them.
            path('media-library/', _redirect_to_admin, name='media-library'),
            path('dashboard/', _redirect_to_admin, name='dashboard'),
        ]
        # add our extra admin urls before the default admin urls
        return extra + _orig_get_urls()

    admin.site.get_urls = _get_urls_with_extras  # monkeypatch
    logger.debug("Patched admin.site.get_urls to include media-library/dashboard names.")
except Exception as e:
    logger.exception("Failed to patch admin.site.get_urls: %s", e)

# --- Core urlpatterns ---
urlpatterns = [
    path('grappelli/', include('grappelli.urls')),
    path('admin/', admin.site.urls),

    # Blog API
    path('api/blog/', include(('blog.urls', 'blog'), namespace='blog')),

    # Summernote
    path('summernote/', include('django_summernote.urls')),
]

# Also provide top-level routes for compatibility (global names)
urlpatterns += [
    path('admin/media-library/', _redirect_to_admin, name='admin-media-library'),
    path('media-library/', _redirect_to_admin, name='media-library'),
    path('admin/dashboard/', _redirect_to_admin, name='admin-dashboard'),
    path('dashboard/', _redirect_to_admin, name='dashboard-plain'),
]

# Optional preview view
try:
    from blog.views import MediaLibraryView  # type: ignore
    urlpatterns += [
        path('preview/<str:token>/', MediaLibraryView.as_view(), name='post-preview'),
    ]
except Exception:
    logger.debug("blog.views.MediaLibraryView not available; skipping preview route")

# Health + root redirect
urlpatterns += [
    path('health/', lambda request: HttpResponseNotFound("OK"), name='health-check'),
    path('', RedirectView.as_view(url='/admin/')),
]

# CKEditor5 optional urls
try:
    urlpatterns += [path('ckeditor5/', include('django_ckeditor_5.urls'))]
except Exception:
    logger.debug("django_ckeditor_5 not available; skipping ckeditor5 urls.")

# Serve static/media in DEBUG
if settings.DEBUG:
    from django.conf.urls.static import static
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

handler404 = custom_404_view
