# backend/blog/media_views.py
import os
import math
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST
from django.contrib.admin.views.decorators import staff_member_required
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from django.conf import settings
from django.core.paginator import Paginator
from django.utils import timezone

from .models import PostAttachment, Post

# Helper to return attachment data
def serialize_attachment(att):
    file_url = att.file.url if att.file else ''
    file_name = os.path.basename(att.file.name) if att.file else ''
    file_size = None
    try:
        if att.file and att.file.path and os.path.exists(att.file.path):
            file_size = os.path.getsize(att.file.path)
    except Exception:
        file_size = None
    return {
        'id': att.id,
        'title': att.title,
        'url': file_url,
        'filename': file_name,
        'filesize': file_size,
        'uploaded_by': str(att.uploaded_by) if att.uploaded_by else None,
        'uploaded_at': att.uploaded_at.isoformat() if att.uploaded_at else None,
        'post_id': att.post.id if att.post else None,
    }

@staff_member_required
@require_GET
def media_list(request):
    """
    GET params:
      - q: search by filename or title
      - page: page number
      - page_size: items per page
      - unattached_only: if "1", filter attachments with post IS NULL
    Returns JSON with items and pagination.
    """
    q = request.GET.get('q', '').strip()
    page = int(request.GET.get('page', '1'))
    page_size = int(request.GET.get('page_size', '24'))
    unattached_only = request.GET.get('unattached_only') == '1'

    qs = PostAttachment.objects.all().order_by('-uploaded_at')
    if unattached_only:
        qs = qs.filter(post__isnull=True)
    if q:
        qs = qs.filter(models.Q(title__icontains=q) | models.Q(file__icontains=q))

    paginator = Paginator(qs, page_size)
    page_obj = paginator.get_page(page)

    items = [serialize_attachment(a) for a in page_obj.object_list]
    return JsonResponse({
        'results': items,
        'page': page_obj.number,
        'page_size': page_size,
        'total_pages': paginator.num_pages,
        'total_items': paginator.count,
    })


@staff_member_required
@require_POST
def media_upload(request):
    """
    Upload file via multipart/form-data:
      - file : the file
      - title : optional title
      - post_id: optional post id to attach to
    """
    upload = request.FILES.get('file')
    if not upload:
        return JsonResponse({'success': False, 'message': 'No file provided'}, status=400)

    title = request.POST.get('title', '').strip()
    post_id = request.POST.get('post_id')

    post = None
    if post_id:
        try:
            post = Post.objects.get(pk=int(post_id))
        except Exception:
            return JsonResponse({'success': False, 'message': 'Invalid post_id'}, status=400)

    try:
        attachment = PostAttachment.objects.create(
            post=post,
            file=upload,
            title=title,
            uploaded_by=request.user if request.user.is_authenticated else None,
        )
        return JsonResponse({'success': True, 'attachment': serialize_attachment(attachment)})
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@staff_member_required
@require_POST
def media_delete(request):
    """
    Delete one or multiple attachments.
    Acceptable payload (JSON):
      { "ids": [1,2,3] } or { "id": 5 }
    """
    import json
    try:
        data = json.loads(request.body.decode('utf-8'))
    except Exception:
        data = {}

    ids = data.get('ids') or ([] if data.get('id') is None else [data.get('id')])
    if not ids:
        return JsonResponse({'success': False, 'message': 'No ids provided'}, status=400)

    deleted = 0
    errors = []
    for aid in ids:
        try:
            att = PostAttachment.objects.get(pk=aid)
            # remove file from storage if exists
            try:
                if att.file and att.file.path and os.path.exists(att.file.path):
                    os.remove(att.file.path)
            except Exception:
                # ignore file remove errors but continue
                pass
            att.delete()
            deleted += 1
        except PostAttachment.DoesNotExist:
            errors.append(f"{aid}: not found")
        except Exception as e:
            errors.append(f"{aid}: {str(e)}")

    return JsonResponse({'success': True, 'deleted': deleted, 'errors': errors})


@staff_member_required
@require_POST
def media_attach_to_post(request):
    """
    Attach existing attachment to a post (or detach if post_id is null/empty)
    JSON payload: { "attachment_id": 5, "post_id": 12 }
    If post_id is falsy, detaches (post=None)
    """
    import json
    try:
        data = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'success': False, 'message': 'Invalid JSON'}, status=400)

    aid = data.get('attachment_id')
    pid = data.get('post_id', None)

    if not aid:
        return JsonResponse({'success': False, 'message': 'attachment_id required'}, status=400)

    try:
        att = PostAttachment.objects.get(pk=aid)
    except PostAttachment.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Attachment not found'}, status=404)

    if pid:
        try:
            post = Post.objects.get(pk=int(pid))
        except Exception:
            return JsonResponse({'success': False, 'message': 'Invalid post_id'}, status=400)
        att.post = post
    else:
        att.post = None

    att.save()
    return JsonResponse({'success': True, 'attachment': serialize_attachment(att)})
