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
    path("grappelli/", include("grappelli.urls")),
    path("admin/", admin.site.urls),

    # Blog API
    path("api/blog/", include(("blog.urls", "blog"), namespace="blog")),

    # Summernote
    path("summernote/", include("django_summernote.urls")),
]

# Try to attach extra admin URLs from blog.admin_extras
try:
    from blog.admin_extras import get_extra_admin_urls  # type: ignore
    extra = get_extra_admin_urls() or []
    if extra:
        urlpatterns += extra
        logger.debug("Loaded extra admin URLs from blog.admin_extras")
except Exception as e:
    logger.debug("blog.admin_extras not available or failed: %s", e)
    # Add defensive fallback routes so reverse('media-library') never fails
    def _fallback_to_admin(request, *a, **k):
        return redirect("/admin/")
    urlpatterns += [
        path("admin/media-library/", _fallback_to_admin, name="media-library"),
        path("admin/media-library/", _fallback_to_admin, name="admin-media-library"),
        path("media-library/", _fallback_to_admin, name="media-library-public"),
        path("admin/dashboard/", _fallback_to_admin, name="dashboard"),
        path("admin/dashboard/", _fallback_to_admin, name="admin-dashboard"),
        path("dashboard/", _fallback_to_admin, name="dashboard-plain"),
    ]

# Optional: preview view
try:
    from blog.views import MediaLibraryView  # type: ignore
    urlpatterns += [
        path("preview/<str:token>/", MediaLibraryView.as_view(), name="post-preview"),
    ]
except Exception as e:
    logger.debug("blog.views.MediaLibraryView not available: %s", e)

# Health + root redirect
urlpatterns += [
    path("health/", lambda request: HttpResponseNotFound("OK"), name="health-check"),
    path("", RedirectView.as_view(url="/admin/")),
]

# CKEditor5 urls (optional)
try:
    urlpatterns += [path("ckeditor5/", include("django_ckeditor_5.urls"))]
except Exception:
    logger.debug("django_ckeditor_5 not available; skipping ckeditor5 urls.")

if settings.DEBUG:
    from django.conf.urls.static import static
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

handler404 = custom_404_view
