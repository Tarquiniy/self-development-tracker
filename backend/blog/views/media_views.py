# backend/blog/views/media_views.py
"""
Upload endpoint compatible with CKEditor5 SimpleUpload adapter and
backwards-compatible with previous consumers.

Endpoint path: /api/blog/media/upload/  (ensure wired in urls)
Accepts multipart POST with file in field 'upload' (CKEditor default).
Returns JSON:
  {
    "url": "<public file url>",
    "uploaded": 1,
    "fileName": "<original name>",
    "success": True,
    "attachment": { ... optional metadata ... }
  }

If you already have an Attachment model and special logic, replace the storage
block with your model creation and serialization.
"""

import os
import uuid
from django.conf import settings
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.http import JsonResponse, HttpResponseBadRequest, HttpResponseForbidden
from django.views.decorators.http import require_POST
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import ensure_csrf_cookie

# Optional: restrict to staff users if desired
def staff_required(view_func):
    def _wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated or not request.user.is_staff:
            return HttpResponseForbidden(JsonResponse({"error": "staff-only"}))
        return view_func(request, *args, **kwargs)
    return _wrapped


@login_required
@staff_required
@require_POST
def media_upload(request):
    """
    Save uploaded file to Django default_storage and return CKEditor-friendly JSON.
    Accepts field 'upload' (CKEditor), or 'file' (generic).
    """
    uploaded_file = request.FILES.get('upload') or request.FILES.get('file') or None
    if not uploaded_file:
        return HttpResponseBadRequest(JsonResponse({"error": "no file uploaded"}))

    # Build a safe unique filename
    orig_name = uploaded_file.name
    ext = os.path.splitext(orig_name)[1]
    safe_name = f"{uuid.uuid4().hex}{ext or ''}"
    save_path = os.path.join('uploads', safe_name)

    try:
        saved_path = default_storage.save(save_path, ContentFile(uploaded_file.read()))
        file_url = default_storage.url(saved_path)
    except Exception as e:
        return HttpResponseBadRequest(JsonResponse({"error": "save_failed", "details": str(e)}))

    # Optional: If you have Attachment model, create it and serialize instead.
    # Example (pseudo):
    # attachment = Attachment.objects.create(file=saved_path, uploaded_by=request.user, ...)
    # attachment_data = serialize_attachment(attachment)
    # and then set file_url = attachment_data['url'] and include attachment_data in response.
    #
    # For now we return simple metadata:
    attachment_data = {
        "name": orig_name,
        "url": file_url,
        "content_type": uploaded_file.content_type,
        "size": uploaded_file.size,
        "stored_path": saved_path,
    }

    response = {
        "url": file_url,            # CKEditor expects this key
        "uploaded": 1,
        "fileName": orig_name,
        "success": True,
        "attachment": attachment_data
    }
    # Return response as JSON
    return JsonResponse(response)
