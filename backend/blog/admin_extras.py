# backend/blog/admin_extras.py
import logging
from django.urls import path
from django.shortcuts import render, redirect
from django.http import JsonResponse, HttpRequest, HttpResponse
from django.views.decorators.http import require_http_methods
from django.contrib.admin.views.decorators import staff_member_required
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile

logger = logging.getLogger(__name__)

# Пытаться импортировать модель вложений, но работать и без неё
try:
    from .models import PostAttachment
except Exception:
    PostAttachment = None

@staff_member_required
@require_http_methods(["GET"])
def admin_dashboard_view(request: HttpRequest):
    return render(request, "admin/index.html", {})

@staff_member_required
@require_http_methods(["GET", "POST"])
def admin_media_library_view(request: HttpRequest):
    """
    GET - отображает простую страницу медиатеки
    POST - принимает multipart file в поле 'file', сохраняет и возвращает JSON с URL
    """
    if request.method == "GET":
        # загрузить последние файлы, если модель есть
        attachments = []
        try:
            if PostAttachment is not None:
                attachments = list(PostAttachment.objects.all().order_by('-uploaded_at')[:200])
        except Exception:
            attachments = []
        return render(request, "admin/media_library.html", {"attachments": attachments})

    # POST: обработка загрузки
    upload = request.FILES.get("file")
    if not upload:
        return JsonResponse({"success": False, "message": "No file provided"}, status=400)
    try:
        # Если у вас есть модель PostAttachment — используем её
        if PostAttachment is not None:
            att = PostAttachment.objects.create(post=None, file=upload, title=getattr(upload, 'name', ''), uploaded_by=request.user if request.user.is_authenticated else None)
            url = getattr(att.file, "url", "")
        else:
            # fallback: сохранить через storage и вернуть url
            path = default_storage.save(f"uploads/{upload.name}", ContentFile(upload.read()))
            url = default_storage.url(path)
        return JsonResponse({"success": True, "attachment": {"url": url}})
    except Exception as e:
        logger.exception("Media upload error: %s", e)
        return JsonResponse({"success": False, "message": str(e)}, status=500)

def get_extra_admin_urls():
    return [
        path("admin/media-library/", admin_media_library_view, name="admin-media-library"),
        path("admin/media-library/", admin_media_library_view, name="media-library"),
        path("media-library/", admin_media_library_view, name="media-library-public"),
        path("admin/dashboard/", admin_dashboard_view, name="admin-dashboard"),
        path("admin/dashboard/", admin_dashboard_view, name="dashboard"),
    ]
