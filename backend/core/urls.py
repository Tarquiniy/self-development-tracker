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

# Simple safe views defined inline so reverse('media-library') always exists.
def _redirect_to_admin(request: HttpRequest, *args, **kwargs) -> HttpResponse:
    """Быстрый безопасный handler — просто редирект в /admin/"""
    return redirect('/admin/')

# Core URL patterns
urlpatterns = [
    path('grappelli/', include('grappelli.urls')),
    path('admin/', admin.site.urls),

    # Blog API
    path('api/blog/', include(('blog.urls', 'blog'), namespace='blog')),

    # Summernote (if present)
    path('summernote/', include('django_summernote.urls')),
]

# Ensure the names templates might expect exist and are safe:
# - admin/media-library/  -> name 'admin-media-library' and 'media-library'
# - admin/dashboard/     -> name 'admin-dashboard' and 'dashboard'
# Also add plain /media-library/ just in case.
urlpatterns += [
    path('admin/media-library/', _redirect_to_admin, name='admin-media-library'),
    path('admin/media-library/', _redirect_to_admin, name='media-library'),
    path('media-library/', _redirect_to_admin, name='media-library-public'),

    path('admin/dashboard/', _redirect_to_admin, name='admin-dashboard'),
    path('admin/dashboard/', _redirect_to_admin, name='dashboard'),
    path('dashboard/', _redirect_to_admin, name='dashboard-plain'),
]

# Optional preview view (if your blog.views.MediaLibraryView exists, it will be attached)
try:
    from blog.views import MediaLibraryView  # type: ignore
    urlpatterns += [
        path('preview/<str:token>/', MediaLibraryView.as_view(), name='post-preview'),
    ]
except Exception:
    logger.debug("blog.views.MediaLibraryView not available; skipping preview route")

# Health & root
urlpatterns += [
    path('health/', lambda request: HttpResponseNotFound("OK"), name='health-check'),
    path('', RedirectView.as_view(url='/admin/')),
]

# Optional ckeditor5 urls
try:
    urlpatterns += [path('ckeditor5/', include('django_ckeditor_5.urls'))]
except Exception:
    logger.debug("django_ckeditor_5 not available; skipping ckeditor5 urls.")

# Static in DEBUG
if settings.DEBUG:
    from django.conf.urls.static import static
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

handler404 = custom_404_view
