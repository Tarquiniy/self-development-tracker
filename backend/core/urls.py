# backend/core/urls.py
import logging

from django.conf import settings
from django.contrib import admin
from django.urls import path, include
from django.views.generic import RedirectView
from django.http import HttpResponseNotFound
from django.shortcuts import redirect

logger = logging.getLogger(__name__)

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

# Try to add extra admin urls from blog.admin_extras (preferred)
added_extra = False
try:
    from blog.admin_extras import get_extra_admin_urls  # type: ignore
    extra = get_extra_admin_urls() or []
    if extra:
        urlpatterns += extra
        added_extra = True
        logger.debug("Loaded extra admin urls from blog.admin_extras")
except Exception as e:
    logger.debug("blog.admin_extras not available or failed: %s", e)

# If admin_extras not available, add defensive fallback aliases to avoid NoReverseMatch.
if not added_extra:
    # simple safe wrappers that redirect to /admin/
    def _dash_wrapper(request, *a, **k):
        return redirect('/admin/')
    def _media_wrapper(request, *a, **k):
        return redirect('/admin/')

    urlpatterns += [
        path('admin/dashboard/', _dash_wrapper, name='dashboard'),
        path('admin/dashboard/', _dash_wrapper, name='admin-dashboard'),
        path('admin/media-library/', _media_wrapper, name='media-library'),
        path('admin/media-library/', _media_wrapper, name='admin-media-library'),
    ]

# Preview route: try to import MediaLibraryView
try:
    from blog.views import MediaLibraryView  # type: ignore
    urlpatterns += [
        path('preview/<str:token>/', MediaLibraryView.as_view(), name='post-preview'),
    ]
except Exception as e:
    logger.debug("blog.views.MediaLibraryView not available: %s", e)

# Health check and root redirect
urlpatterns += [
    path('health/', lambda request: HttpResponseNotFound("OK"), name='health-check'),
    path('', RedirectView.as_view(url='/admin/')),
]

# CKEditor5 optional
try:
    urlpatterns += [path('ckeditor5/', include('django_ckeditor_5.urls'))]
except Exception:
    logger.debug("django_ckeditor_5 urls not added")

# Serve static/media in DEBUG
if settings.DEBUG:
    from django.conf.urls.static import static
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

handler404 = custom_404_view
