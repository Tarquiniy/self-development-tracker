# backend/blog/views.py
import json
import os
import logging
import mimetypes

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action, api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticatedOrReadOnly, AllowAny, IsAdminUser
from rest_framework.response import Response

from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend
from django.db import models as dj_models
from django.http import JsonResponse, FileResponse, Http404
from django.views.decorators.http import require_POST, require_GET
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required, user_passes_test
from django.db.models import Count
from django.views.generic import TemplateView
from django.utils.decorators import method_decorator
from django.contrib.admin.views.decorators import staff_member_required
from django.conf import settings
from django.shortcuts import redirect
from rest_framework.parsers import MultiPartParser, FormParser
from django.urls import reverse

from .models import Post, Category, PostView, Tag, Comment, PostReaction, PostAttachment
from .serializers import (
    PostListSerializer, PostDetailSerializer, PostCreateUpdateSerializer,
    CategorySerializer, TagSerializer, CommentSerializer
)

logger = logging.getLogger(__name__)


class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.all()
    permission_classes = [IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'categories__slug', 'tags__slug']
    search_fields = ['title', 'excerpt', 'content', 'meta_description']
    ordering_fields = ['published_at', 'created_at']
    ordering = ['-published_at']
    lookup_field = 'slug'

    def get_serializer_class(self):
        if self.action in ('list',):
            return PostListSerializer
        if self.action in ('retrieve',):
            return PostDetailSerializer
        return PostCreateUpdateSerializer

    def get_queryset(self):
        qs = Post.objects.select_related('author').prefetch_related('categories', 'tags')
        if not self.request.user.is_authenticated or not self.request.user.is_staff:
            qs = qs.filter(dj_models.Q(status='published', published_at__lte=timezone.now()))
        return qs

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(author=user)

    @action(detail=True, methods=['post'], permission_classes=[AllowAny])
    def add_comment(self, request, slug=None):
        post = self.get_object()
        data = request.data.copy()
        data['post'] = post.pk
        serializer = CommentSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    lookup_field = 'slug'


class TagViewSet(viewsets.ModelViewSet):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    lookup_field = 'slug'


class CommentViewSet(viewsets.ModelViewSet):
    queryset = Comment.objects.filter(is_public=True)
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(user=user)


# Reactions endpoints
@api_view(['GET'])
@permission_classes([AllowAny])
def reaction_detail(request):
    post_slug = request.query_params.get('post_slug')
    if not post_slug:
        return Response({'detail': 'Missing post_slug'}, status=status.HTTP_400_BAD_REQUEST)
    post = get_object_or_404(Post, slug=post_slug)
    try:
        reaction = post.reactions.get()
    except PostReaction.DoesNotExist:
        reaction = PostReaction.objects.create(post=post)
    return Response({'post_slug': post.slug, 'likes_count': reaction.likes_count()})


@api_view(['POST'])
@permission_classes([AllowAny])
def reaction_toggle(request):
    post_slug = request.data.get('post_slug')
    if not post_slug:
        return Response({'detail': 'Missing post_slug'}, status=status.HTTP_400_BAD_REQUEST)
    post = get_object_or_404(Post, slug=post_slug)

    with transaction.atomic():
        reaction, created = PostReaction.objects.get_or_create(post=post)
        user = request.user if request.user.is_authenticated else None
        if user:
            if reaction.users.filter(pk=user.pk).exists():
                reaction.users.remove(user)
            else:
                reaction.users.add(user)
        else:
            if reaction.anon_count > 0:
                reaction.anon_count = max(0, reaction.anon_count - 1)
            else:
                reaction.anon_count += 1
        reaction.save()
    return Response({'post_slug': post.slug, 'likes_count': reaction.likes_count()})


@require_POST
@csrf_exempt
@user_passes_test(lambda u: u.is_staff)
def quick_action_view(request):
    try:
        data = json.loads(request.body)
        action = data.get('action')
        post_id = data.get('post_id')
        post = Post.objects.get(id=post_id)
        if action == 'publish':
            post.status = 'published'; post.save()
            return JsonResponse({'success': True, 'message': 'Пост опубликован'})
        elif action == 'draft':
            post.status = 'draft'; post.save()
            return JsonResponse({'success': True, 'message': 'Пост перемещен в черновики'})
        elif action == 'archive':
            post.status = 'archived'; post.save()
            return JsonResponse({'success': True, 'message': 'Пост перемещен в архив'})
        else:
            return JsonResponse({'success': False, 'message': 'Неизвестное действие'})
    except Post.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Пост не найден'})
    except Exception as e:
        logger.exception("quick_action_view error")
        return JsonResponse({'success': False, 'message': str(e)})


@login_required
@user_passes_test(lambda u: u.is_staff)
def dashboard_stats(request):
    today = timezone.now().date()
    stats = {
        'total_posts': Post.objects.count(),
        'published_posts': Post.objects.filter(status='published').count(),
        'draft_posts': Post.objects.filter(status='draft').count(),
        'today_posts': Post.objects.filter(created_at__date=today).count(),
        'total_comments': Comment.objects.count(),
        'pending_comments': Comment.objects.filter(is_moderated=False).count(),
        'total_views': PostView.objects.count(),
        'today_views': PostView.objects.filter(viewed_at__date=today).count(),
    }
    return JsonResponse(stats)


# ---------------------------
# Media Library view + API
# ---------------------------

@method_decorator(staff_member_required(login_url='/admin/login/'), name='dispatch')
class MediaLibraryView(TemplateView):
    template_name = 'admin/media_library.html'

    def dispatch(self, request, *args, **kwargs):
        try:
            return super().dispatch(request, *args, **kwargs)
        except Exception as e:
            logger.exception("MediaLibraryView dispatch error")
            return render(request, 'admin/media_library_error.html', {'error': str(e)}, status=500)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        attachments = []
        try:
            qs = PostAttachment.objects.all().order_by('-uploaded_at')[:1000]
            for a in qs:
                try:
                    file_field = getattr(a, 'file', None)
                    url = ''
                    if file_field:
                        try:
                            url = file_field.url
                        except Exception:
                            url = ''
                    title = a.title if getattr(a, 'title', None) else (os.path.basename(file_field.name) if file_field and getattr(file_field, 'name', None) else '')
                    filename = os.path.basename(file_field.name) if file_field and getattr(file_field, 'name', None) else ''
                    uploaded_at = a.uploaded_at.isoformat() if getattr(a, 'uploaded_at', None) else None
                    attachments.append({
                        'id': getattr(a, 'id', None),
                        'title': title,
                        'filename': filename,
                        'url': url,
                        'uploaded_at': uploaded_at,
                        'post_id': a.post.id if getattr(a, 'post', None) else None,
                    })
                except Exception:
                    logger.exception("Error serializing PostAttachment id=%s", getattr(a, 'id', None))
                    continue
        except Exception:
            logger.exception("Error fetching PostAttachment queryset")

        ctx['attachments'] = attachments
        # Support passing current post id to media library via ?post_id=123
        ctx['current_post_id'] = self.request.GET.get('post_id') or None
        return ctx


# API: list / upload / delete (robust)
@api_view(['GET'])
@permission_classes([IsAuthenticatedOrReadOnly])
def media_list(request):
    """
    Returns list of attachments with .url set to file.url (public Supabase URL when available).
    """
    q = request.GET.get('q', '').strip()
    unattached = request.GET.get('unattached_only') == '1'
    qs = PostAttachment.objects.all().order_by('-uploaded_at')
    if unattached:
        qs = qs.filter(post__isnull=True)
    if q:
        from django.db import models as dj_models
        qs = qs.filter(dj_models.Q(title__icontains=q) | dj_models.Q(file__icontains=q))

    page_size = min(int(request.GET.get('page_size', 48)), 200)
    page = max(int(request.GET.get('page', 1)), 1)
    start = (page - 1) * page_size
    end = start + page_size

    items = []
    for a in qs[start:end]:
        file_field = getattr(a, 'file', None)
        url = ''
        try:
            if file_field:
                url = file_field.url
        except Exception:
            url = ''
        filename = ''
        try:
            filename = file_field.name.split('/')[-1] if file_field and getattr(file_field, 'name', None) else ''
        except Exception:
            filename = ''
        items.append({
            'id': a.id,
            'title': a.title or filename,
            'filename': filename,
            'url': url,
            'uploaded_at': a.uploaded_at.isoformat() if getattr(a, 'uploaded_at', None) else None,
            'post_id': a.post.id if getattr(a, 'post', None) else None
        })
    return Response({'results': items})


import io
import traceback
from django.conf import settings
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAdminUser

@api_view(['POST'])
@permission_classes([IsAdminUser])
@parser_classes([MultiPartParser, FormParser])
def media_upload(request):
    """
    Upload files (admin-only). Saves file via storage and normalizes DB path if needed.
    Returns uploaded items with their public URLs (if available).
    """
    try:
        files = request.FILES.getlist('file') or []
        if not files:
            return Response({'success': False, 'message': 'No files provided'}, status=400)

        uploaded = []
        for f in files:
            att = PostAttachment()
            # Try save file (FileField will use upload_to on model)
            try:
                att.file.save(f.name, f, save=False)
            except Exception as e:
                # log and return diagnostic info when DEBUG
                logger.exception("media_upload: file.save failed for %s: %s", f.name, e)
                if getattr(settings, 'DEBUG', False):
                    return Response({'success': False, 'message': f'file.save failed: {e}', 'traceback': traceback.format_exc()}, status=500)
                return Response({'success': False, 'message': 'file.save failed'}, status=500)

            att.title = request.data.get('title') or f.name
            att.uploaded_by = request.user if request.user.is_authenticated else None

            # If storage created file at an unexpected path (e.g. duplicate prefix), try to normalize
            try:
                # commit to DB (this will write file info)
                att.save()
            except Exception as e:
                # attempt cleanup and return error
                try:
                    if att.file:
                        att.file.delete(save=False)
                except Exception:
                    logger.exception("media_upload: cleanup failed for %s", f.name)
                logger.exception("media_upload: saving PostAttachment failed: %s", e)
                if getattr(settings, 'DEBUG', False):
                    return Response({'success': False, 'message': str(e), 'traceback': traceback.format_exc()}, status=500)
                return Response({'success': False, 'message': 'attachment save failed'}, status=500)

            # Normalize DB path if duplicate prefix exists but normalized path exists in storage
            try:
                name = getattr(att.file, 'name', '') or ''
                normalized = name.replace('post_attachments/post_attachments/', 'post_attachments/')
                if normalized != name:
                    # If the normalized file actually exists in storage, point DB to it.
                    try:
                        if att.file.storage.exists(normalized):
                            att.file.name = normalized
                            att.save(update_fields=['file'])
                            logger.debug("Normalized attachment name from %s -> %s", name, normalized)
                    except Exception:
                        # storage.exists may fail on some configs — ignore silently
                        logger.debug("Could not check storage.exists for normalized path %s", normalized)
            except Exception:
                logger.exception("media_upload: normalization check failed")

            uploaded.append({
                'id': att.id,
                'url': getattr(att.file, 'url', ''),
                'filename': getattr(att.file, 'name', f.name),
                'title': att.title,
            })

        return Response({'success': True, 'uploaded': uploaded})
    except Exception as e:
        tb = traceback.format_exc()
        logger.exception("media_upload error: %s", tb)
        if getattr(settings, 'DEBUG', False):
            return Response({'success': False, 'message': str(e), 'traceback': tb}, status=500)
        return Response({'success': False, 'message': 'Internal server error'}, status=500)

@api_view(['POST'])
@permission_classes([IsAdminUser])
def media_delete(request):
    try:
        ids = request.data.get('ids') or []
        if not isinstance(ids, (list, tuple)):
            return Response({'success': False, 'message': 'ids must be a list'}, status=400)
        deleted = 0
        for pk in ids:
            try:
                att = PostAttachment.objects.get(pk=pk)
                try:
                    if att.file:
                        att.file.delete(save=False)
                except Exception:
                    logger.exception("Error deleting file for attachment id=%s", pk)
                att.delete()
                deleted += 1
            except PostAttachment.DoesNotExist:
                continue
        return Response({'success': True, 'deleted': deleted})
    except Exception as e:
        logger.exception("media_delete error")
        return Response({'success': False, 'message': str(e)}, status=500)


# ----- NEW: media proxy endpoint to avoid ORB/CORS problems in browser -----
@require_GET
def media_proxy(request, pk):
    """
    Proxy endpoint:
    - anonymous users: redirect to the direct public URL (file.url) so browser loads from Supabase
    - staff: stream from storage (useful when file is private)
    """
    att = get_object_or_404(PostAttachment, pk=pk)
    file_field = getattr(att, 'file', None)
    if not file_field or not getattr(file_field, 'name', None):
        raise Http404("Attachment has no file")

    try:
        direct_url = file_field.url
    except Exception:
        direct_url = ''

    # If request is not by staff -> redirect to direct_url for frontend images
    if not (request.user.is_authenticated and request.user.is_staff):
        if direct_url:
            return redirect(direct_url)
        raise Http404("File not available")

    # Staff -> attempt streaming
    try:
        file_obj = file_field.open('rb')
    except Exception as e:
        logger.exception("media_proxy: failed to open file %s: %s", pk, e)
        if direct_url:
            return redirect(direct_url)
        raise Http404("File not available")

    mime_type, _ = mimetypes.guess_type(file_field.name or '')
    content_type = mime_type or 'application/octet-stream'
    response = FileResponse(file_obj, filename=file_field.name.split('/')[-1], content_type=content_type)
    response['Content-Disposition'] = f'inline; filename="{file_field.name.split("/")[-1]}"'
    response['Access-Control-Allow-Origin'] = '*'
    response['Cache-Control'] = 'public, max-age=31536000'
    return response

# ----- NEW: attach an existing PostAttachment to a Post -----
@api_view(['POST'])
@permission_classes([IsAdminUser])
def media_attach_to_post(request):
    try:
        data = request.data if hasattr(request, 'data') else json.loads(request.body.decode('utf-8') or '{}')
    except Exception:
        data = {}
    aid = data.get('attachment_id')
    pid = data.get('post_id', None)
    if not aid:
        return Response({'success': False, 'message': 'attachment_id required'}, status=400)
    try:
        att = PostAttachment.objects.get(pk=int(aid))
    except PostAttachment.DoesNotExist:
        return Response({'success': False, 'message': 'Attachment not found'}, status=404)
    if pid is None or pid == '' or str(pid).lower() == 'null':
        att.post = None
    else:
        try:
            post = Post.objects.get(pk=int(pid))
        except Post.DoesNotExist:
            return Response({'success': False, 'message': 'Post not found'}, status=400)
        att.post = post
    att.save()
    try:
        url = att.file.url
    except Exception:
        url = ''
    return Response({'success': True, 'attachment': {'id': att.id, 'url': url, 'post_id': att.post.id if att.post else None}})
