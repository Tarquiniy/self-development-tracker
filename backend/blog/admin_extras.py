# backend/blog/admin_extras.py
import logging
import json
from django.urls import path
from django.shortcuts import render, redirect
from django.http import JsonResponse, HttpResponseBadRequest
from django.views.decorators.http import require_http_methods
from django.contrib.admin.views.decorators import staff_member_required

logger = logging.getLogger(__name__)

# Import models in a defensive way
try:
    from .models import PostAttachment, Post, Comment
except Exception as e:
    logger.exception("blog.models import failed in admin_extras: %s", e)
    PostAttachment = None
    Post = None
    Comment = None


@staff_member_required
@require_http_methods(["GET"])
def admin_dashboard_view(request):
    """
    Simple admin dashboard view — returns minimal counts and app_list.
    Template: templates/admin/index.html
    """
    try:
        posts_count = Post.objects.count() if Post is not None else 0
        published_count = Post.objects.filter(status='published').count() if Post is not None else 0
        drafts_count = Post.objects.filter(status='draft').count() if Post is not None else 0
    except Exception as e:
        logger.exception("Counting posts failed: %s", e)
        posts_count = published_count = drafts_count = 0

    try:
        media_count = PostAttachment.objects.count() if PostAttachment is not None else 0
    except Exception:
        media_count = 0

    try:
        comments_count = Comment.objects.count() if Comment is not None else 0
    except Exception:
        comments_count = 0

    context = {
        'posts_count': posts_count,
        'published_count': published_count,
        'drafts_count': drafts_count,
        'media_count': media_count,
        'comments_count': comments_count,
        'app_list': request.resolver_match is not None and getattr(request, 'user', None) and [] or [],  # minimal placeholder
        'user': request.user,
    }
    return render(request, 'admin/index.html', context)


@staff_member_required
@require_http_methods(["GET", "POST"])
def admin_media_library_view(request):
    """
    Media library admin view:
    - GET: render template with recent attachments
    - POST: accept multipart upload "file" and optional "title"; create PostAttachment
    """
    if request.method == "GET":
        try:
            attachments = PostAttachment.objects.all().order_by('-uploaded_at')[:200] if PostAttachment is not None else []
        except Exception as e:
            logger.exception("Fetching attachments failed: %s", e)
            attachments = []
        context = {
            'attachments': attachments,
            'user': request.user,
        }
        return render(request, 'admin/media_library.html', context)

    # POST: upload handling
    upload = request.FILES.get('file')
    if not upload:
        return JsonResponse({"success": False, "message": "No file provided"}, status=400)

    title = (request.POST.get('title') or "").strip()
    try:
        # Create attachment; be defensive if PostAttachment unavailable
        if PostAttachment is None:
            raise RuntimeError("PostAttachment model not available")
        attachment = PostAttachment.objects.create(
            post=None,
            file=upload,
            title=title,
            uploaded_by=request.user if request.user.is_authenticated else None,
        )
        return JsonResponse({
            "success": True,
            "attachment": {
                "id": attachment.id,
                "title": attachment.title,
                "url": getattr(attachment.file, 'url', ''),
                "uploaded_at": getattr(attachment, 'uploaded_at', getattr(attachment, 'uploaded', None))
            }
        })
    except Exception as e:
        logger.exception("Failed to create attachment: %s", e)
        return JsonResponse({"success": False, "message": str(e)}, status=500)


def get_extra_admin_urls():
    """
    Returns a list of django.urls.path patterns for admin extras.
    Exposes both names:
      - 'admin-media-library' and 'media-library'
      - 'admin-dashboard' and 'dashboard'
    So older templates that use 'media-library' won't break.
    """
    urls = []
    try:
        urls = [
            path('admin/dashboard/', admin_dashboard_view, name='admin-dashboard'),
            path('admin/dashboard/', admin_dashboard_view, name='dashboard'),
            path('admin/media-library/', admin_media_library_view, name='admin-media-library'),
            path('admin/media-library/', admin_media_library_view, name='media-library'),
        ]
    except Exception as e:
        logger.exception("Failed to build extra admin urls: %s", e)
    return urls
