# backend/blog/admin_views.py
import os
import uuid
import requests

from django.http import JsonResponse, HttpResponse, HttpResponseBadRequest
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.contrib.admin.views.decorators import staff_member_required

# --- Защищённый handler, который вы уже используете (оставьте как есть для админа) ---
@csrf_exempt
@require_POST
@staff_member_required
def ckeditor_upload(request):
    upload = request.FILES.get('upload') or request.FILES.get('file')
    if not upload:
        return HttpResponseBadRequest('No file uploaded')
    SUPABASE_URL = os.getenv('SUPABASE_URL')
    SERVICE_ROLE = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    BUCKET = os.getenv('SUPABASE_BUCKET', 'post_attachments')
    if not SUPABASE_URL or not SERVICE_ROLE:
        return HttpResponse('Supabase not configured on server', status=500)

    filename = f"uploads/{uuid.uuid4().hex}_{upload.name}"
    upload_url = f"{SUPABASE_URL.rstrip('/')}/storage/v1/object/{BUCKET}"
    headers = {"Authorization": f"Bearer {SERVICE_ROLE}"}
    files = {'file': (filename, upload.read(), upload.content_type)}
    try:
        resp = requests.post(upload_url, headers=headers, files=files, timeout=30)
    except Exception as e:
        return HttpResponse(f"Upload request failed: {e}", status=500)
    if resp.status_code not in (200,201,204):
        return HttpResponse(f"Upload failed: {resp.status_code} {resp.text}", status=500)
    public_url = f"{SUPABASE_URL.rstrip('/')}/storage/v1/object/public/{BUCKET}/{filename}"
    return JsonResponse({'uploaded': 1, 'fileName': upload.name, 'url': public_url})


# --- Тестовый публичный handler — ТОЛЬКО ДЛЯ ЛОКАЛЬНОГО ТЕСТА: уберите/защитите в проде ---
@csrf_exempt
@require_POST
def ckeditor_upload_test(request):
    """
    Тестовый upload без проверки staff. Используйте только локально для отладки.
    """
    upload = request.FILES.get('upload') or request.FILES.get('file')
    if not upload:
        return HttpResponseBadRequest('No file uploaded')
    SUPABASE_URL = os.getenv('SUPABASE_URL')
    SERVICE_ROLE = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    BUCKET = os.getenv('SUPABASE_BUCKET', 'post_attachments')
    if not SUPABASE_URL or not SERVICE_ROLE:
        return HttpResponse('Supabase not configured on server', status=500)

    filename = f"uploads/{uuid.uuid4().hex}_{upload.name}"
    upload_url = f"{SUPABASE_URL.rstrip('/')}/storage/v1/object/{BUCKET}"
    headers = {"Authorization": f"Bearer {SERVICE_ROLE}"}
    files = {'file': (filename, upload.read(), upload.content_type)}
    try:
        resp = requests.post(upload_url, headers=headers, files=files, timeout=30)
    except Exception as e:
        return HttpResponse(f"Upload request failed: {e}", status=500)
    if resp.status_code not in (200,201,204):
        return HttpResponse(f"Upload failed: {resp.status_code} {resp.text}", status=500)
    public_url = f"{SUPABASE_URL.rstrip('/')}/storage/v1/object/public/{BUCKET}/{filename}"
    return JsonResponse({'uploaded': 1, 'fileName': upload.name, 'url': public_url})
