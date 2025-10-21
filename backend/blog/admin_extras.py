# backend/blog/admin_extras.py
import logging
from django.urls import path
from django.shortcuts import render
from django.http import JsonResponse, HttpRequest, HttpResponse, HttpResponseNotFound
from django.views.decorators.http import require_http_methods
from django.contrib.admin.views.decorators import staff_member_required
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile

logger = logging.getLogger(__name__)

# Optional: if you have a PostAttachment model, use it; if not, fallback to storage-only
try:
    from .models import PostAttachment  # adjust name if different
except Exception:
    PostAttachment = None

@staff_member_required
@require_http_methods(["GET", "POST"])
def admin_media_library_view(request: HttpRequest):
    """
    GET: simple media library page (admin-only).
    POST: accepts multipart 'file' and returns JSON:
      { "success": True, "attachment": { "url": "<public url>" } }
    """
    if request.method == "GET":
        # Render a minimal template if you have one, otherwise return a simple HTML
        attachments = []
        try:
            if PostAttachment is not None:
                attachments = list(PostAttachment.objects.order_by("-uploaded_at")[:200])
        except Exception:
            attachments = []
        # Try to render project template if exists, else return a small HTML page
        try:
            return render(request, "admin/media_library.html", {"attachments": attachments})
        except Exception:
            html = "<html><head><title>Media Library</title></head><body><h1>Media Library</h1>"
            html += "<p>Use POST /admin/media-library/ to upload files.</p></body></html>"
            return HttpResponse(html)

    # POST: upload handler
    upload = request.FILES.get("file")
    if not upload:
        return JsonResponse({"success": False, "message": "No file provided"}, status=400)
    try:
        # If you have a PostAttachment model, save to it for CMS linking
        if PostAttachment is not None:
            att = PostAttachment.objects.create(
                title=getattr(upload, "name", ""),
                file=upload,
                uploaded_by=request.user if request.user.is_authenticated else None
            )
            url = getattr(att.file, "url", "")
        else:
            # fallback: save through default_storage
            path = default_storage.save(f"uploads/{upload.name}", ContentFile(upload.read()))
            url = default_storage.url(path)
        return JsonResponse({"success": True, "attachment": {"url": url}})
    except Exception as e:
        logger.exception("Media upload error: %s", e)
        return JsonResponse({"success": False, "message": str(e)}, status=500)


@staff_member_required
@require_http_methods(["GET"])
def admin_dashboard_view(request: HttpRequest):
    # Minimal dashboard - if you have a template, render it
    try:
        return render(request, "admin/index.html", {})
    except Exception:
        return HttpResponse("<h1>Admin Dashboard</h1><p>Custom dashboard placeholder.</p>")

# Helper to expose URL patterns if you want to include them elsewhere
def extra_urls():
    return [
        path("admin/media-library/", admin_media_library_view, name="admin-media-library"),
        path("media-library/", admin_media_library_view, name="media-library"),
        path("admin/dashboard/", admin_dashboard_view, name="admin-dashboard"),
    ]
