# backend/blog/admin_extras.py
import logging
from django.urls import path
from django.shortcuts import render, redirect
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.contrib.admin.views.decorators import staff_member_required

logger = logging.getLogger(__name__)

# Импорт моделей защищённо
try:
    from .models import PostAttachment, Post, Comment
except Exception as e:
    logger.exception("Failed to import blog.models in admin_extras: %s", e)
    PostAttachment = None
    Post = None
    Comment = None


@staff_member_required
@require_http_methods(["GET"])
def admin_dashboard_view(request):
    """
    Минимальный дашборд для админки — безопасный, без внешних зависимостей.
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

    ctx = {
        "posts_count": posts_count,
        "published_count": published_count,
        "drafts_count": drafts_count,
        "media_count": media_count,
        "comments_count": comments_count,
        "user": request.user,
    }
    return render(request, "admin/index.html", ctx)


@staff_member_required
@require_http_methods(["GET", "POST"])
def admin_media_library_view(request):
    """
    Медиа-библиотека: GET — список, POST — загрузка файла (multipart/form-data).
    Возвращает JSON при POST.
    """
    if request.method == "GET":
        try:
            attachments = PostAttachment.objects.all().order_by("-uploaded_at")[:500] if PostAttachment is not None else []
        except Exception as e:
            logger.exception("Fetching attachments failed: %s", e)
            attachments = []
        return render(request, "admin/media_library.html", {"attachments": attachments, "user": request.user})

    # POST - загрузка файла
    upload = request.FILES.get("file")
    if not upload:
        return JsonResponse({"success": False, "message": "No file provided"}, status=400)
    title = (request.POST.get("title") or "").strip()
    try:
        if PostAttachment is None:
            raise RuntimeError("PostAttachment model not available")
        att = PostAttachment.objects.create(
            post=None,
            file=upload,
            title=title,
            uploaded_by=request.user if request.user.is_authenticated else None,
        )
        return JsonResponse({
            "success": True,
            "attachment": {
                "id": att.id,
                "title": att.title,
                "url": getattr(att.file, "url", ""),
                "uploaded_at": getattr(att, "uploaded_at", getattr(att, "uploaded", None))
            }
        })
    except Exception as e:
        logger.exception("Attachment create failed: %s", e)
        return JsonResponse({"success": False, "message": str(e)}, status=500)


def public_media_library_view(request):
    """
    Публичный (но служебный) маршрут /media-library/ — возвращает ту же страницу как GET,
    но доступ только для staff через шаблон (если не staff — редирект в /admin/).
    Нужен для совместимости со старыми шаблонами, которые могли ожидать маршрут без префикса admin/.
    """
    if not request.user.is_authenticated or not request.user.is_staff:
        return redirect("/admin/")
    return admin_media_library_view(request)


def get_extra_admin_urls():
    """
    Возвращает список path-ов, которые можно подключить из core/urls.py.
    Мы даём маршруты под несколькими именами чтобы совместимость была максимальной.
    """
    urls = [
        # Admin-prefixed and plain aliases
        path("admin/dashboard/", admin_dashboard_view, name="admin-dashboard"),
        path("admin/dashboard/", admin_dashboard_view, name="dashboard"),
        path("dashboard/", admin_dashboard_view, name="dashboard-plain"),

        path("admin/media-library/", admin_media_library_view, name="admin-media-library"),
        path("admin/media-library/", admin_media_library_view, name="media-library"),
        # Plain public alias (also name 'media-library' — duplicate name is fine; reverse will find one)
        path("media-library/", public_media_library_view, name="media-library-public"),
    ]
    return urls
