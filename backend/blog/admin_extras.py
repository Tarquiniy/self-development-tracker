# backend/blog/admin_extras.py
import os
import logging
from uuid import uuid4
from django.conf import settings
from django.urls import path
from django.shortcuts import render
from django.http import JsonResponse, HttpResponse, HttpRequest
from django.views.decorators.http import require_http_methods
from django.contrib.admin.views.decorators import staff_member_required
from supabase import create_client

logger = logging.getLogger(__name__)

# Supabase client factory (server-side)
def get_supabase_client():
    url = getattr(settings, "SUPABASE_URL", None) or os.environ.get("SUPABASE_URL")
    key = getattr(settings, "SUPABASE_SERVICE_KEY", None) or os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in settings or env")
    return create_client(url, key)

BUCKET = getattr(settings, "SUPABASE_BUCKET", os.environ.get("SUPABASE_BUCKET", "post_attachments"))

@staff_member_required
@require_http_methods(["GET"])
def admin_media_library_view(request: HttpRequest):
    """Возвращает HTML страницу медиатеки (подключается как /admin/media-library/)."""
    try:
        supabase = get_supabase_client()
        # list objects
        listing = supabase.storage.from_(BUCKET).list()
        attachments = []
        if listing and listing.get("data"):
            for obj in listing["data"]:
                path = obj.get("name")
                # try to get public url; if bucket private, create signed URL (60 min)
                pub_resp = supabase.storage.from_(BUCKET).get_public_url(path)
                public_url = None
                if pub_resp and pub_resp.get("data") and pub_resp["data"].get("publicUrl"):
                    public_url = pub_resp["data"]["publicUrl"]
                else:
                    # fallback to signed url for 1 hour
                    signed = supabase.storage.from_(BUCKET).create_signed_url(path, 3600)
                    if signed and signed.get("data") and signed["data"].get("signedUrl"):
                        public_url = signed["data"]["signedUrl"]
                attachments.append({
                    "name": path,
                    "url": public_url,
                    "size": obj.get("metadata", {}).get("size"),
                    "content_type": obj.get("metadata", {}).get("mimetype"),
                })
    except Exception as e:
        logger.exception("Failed to list Supabase storage: %s", e)
        attachments = []

    # Try to render a template admin/media_library.html if present
    try:
        return render(request, "admin/media_library.html", {"attachments": attachments})
    except Exception:
        # fallback minimal HTML
        html = "<html><head><meta charset='utf-8'><title>Media Library</title></head><body>"
        html += "<h1>Media Library</h1><div>"
        for a in attachments:
            html += f"<div style='display:inline-block;margin:6px;text-align:center;'><img src='{a['url']}' width='120' /><div>{a['name']}</div></div>"
        html += "</div></body></html>"
        return HttpResponse(html)

@staff_member_required
@require_http_methods(["GET"])
def admin_media_list_api(request: HttpRequest):
    """Возвращает JSON список файлов (для AJAX модального окна)."""
    try:
        supabase = get_supabase_client()
        listing = supabase.storage.from_(BUCKET).list()
        out = []
        if listing and listing.get("data"):
            for obj in listing["data"]:
                path = obj.get("name")
                pub = supabase.storage.from_(BUCKET).get_public_url(path)
                public_url = pub.get("data", {}).get("publicUrl") if pub else None
                if not public_url:
                    signed = supabase.storage.from_(BUCKET).create_signed_url(path, 3600)
                    public_url = signed.get("data", {}).get("signedUrl") if signed else None
                out.append({"name": path, "url": public_url})
        return JsonResponse({"success": True, "files": out})
    except Exception as e:
        logger.exception("media list api error: %s", e)
        return JsonResponse({"success": False, "message": str(e)}, status=500)

@staff_member_required
@require_http_methods(["POST"])
def admin_supabase_upload(request: HttpRequest):
    """
    End-point для загрузки файла (используется CKEditor UploadAdapter и модаль).
    Ожидает multipart/form-data с ключом 'file'.
    Возвращает JSON { success: true, attachment: { url: '...' } }
    """
    upload = request.FILES.get("file")
    if not upload:
        return JsonResponse({"success": False, "message": "No file provided"}, status=400)
    try:
        supabase = get_supabase_client()
        # build safe path
        ext = os.path.splitext(upload.name)[1]
        filename = f"{uuid4().hex}{ext}"
        path = f"{filename}"  # optionally: f"uploads/{filename}"
        # supabase python expects file-like or bytes; send file bytes and pass path
        # use upload(file=..., path=...) signature:
        resp = supabase.storage.from_(BUCKET).upload(file=upload, path=path)
        # check for errors
        if resp is None:
            raise RuntimeError("Supabase returned no response")
        if resp.get("error"):
            raise RuntimeError("Supabase upload error: " + str(resp.get("error")))

        # Get public URL if possible, otherwise signed URL
        pub_resp = supabase.storage.from_(BUCKET).get_public_url(path)
        public_url = pub_resp.get("data", {}).get("publicUrl") if pub_resp else None
        if not public_url:
            signed = supabase.storage.from_(BUCKET).create_signed_url(path, 3600)
            public_url = signed.get("data", {}).get("signedUrl") if signed else None

        return JsonResponse({"success": True, "attachment": {"url": public_url}})
    except Exception as e:
        logger.exception("Supabase upload error: %s", e)
        return JsonResponse({"success": False, "message": str(e)}, status=500)


# URL helper to include in project's urls
def get_urls():
    return [
        path("admin/media-library/", admin_media_library_view, name="admin-media-library"),
        path("admin/supabase-upload/", admin_supabase_upload, name="admin-supabase-upload"),
        path("admin/supabase-attachments/", admin_media_list_api, name="admin-supabase-attachments"),
        path("media-library/", admin_media_library_view, name="media-library"),
    ]
