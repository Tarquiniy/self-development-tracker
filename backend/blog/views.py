# backend/blog/views.py
import os
import json
import logging
import mimetypes
import traceback
import uuid
import requests

from django.conf import settings
from django.core import signing
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.http import JsonResponse, FileResponse, Http404, HttpResponse, HttpResponseBadRequest
from django.shortcuts import get_object_or_404, render, redirect
from django.utils import timezone
from django.views.generic import TemplateView
from django.views.decorators.http import require_POST, require_GET
from django.middleware.csrf import get_token
from django.contrib.admin.views.decorators import staff_member_required
from django.db import transaction
from django.urls import reverse
from rest_framework import permissions, viewsets, status, filters
from rest_framework.decorators import action, api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticatedOrReadOnly, AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser

from django_filters.rest_framework import DjangoFilterBackend
from django.db import models as dj_models

from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie
from django.utils.decorators import method_decorator

from .models import Post, Category, PostView, Tag, Comment, PostReaction, PostAttachment, PostRevision
from .serializers import (
    PostListSerializer, PostDetailSerializer, PostCreateUpdateSerializer,
    CategorySerializer, TagSerializer, CommentSerializer
)

logger = logging.getLogger(__name__)

PREVIEW_SALT = getattr(settings, "PREVIEW_SALT", "post-preview-salt")
PREVIEW_MAX_AGE = getattr(settings, "PREVIEW_MAX_AGE", 60 * 60)



# ---------------------------
# Preview / Post preview token
# ---------------------------
def preview_by_token(request, token):
    try:
        payload = signing.loads(token, salt=PREVIEW_SALT, max_age=PREVIEW_MAX_AGE)
    except signing.SignatureExpired:
        raise Http404("Preview token expired")
    except signing.BadSignature:
        raise Http404("Invalid preview token")
    post_data = {
        'title': payload.get('title', ''),
        'content': payload.get('content', ''),
        'excerpt': payload.get('excerpt', ''),
        'featured_image': payload.get('featured_image', ''),
        'preview_token': token,
    }
    return render(request, 'blog/preview.html', {'post': post_data})


# ---------------------------
# Post / Category / Tag / Comment API (ViewSets)
# ---------------------------
class PostViewSet(viewsets.ModelViewSet):
    """
    Rest viewset for blog posts.

    Fixes and improvements:
    - defensive get_queryset (published-only for anonymous users)
    - defensive retrieve: explicit handling of invalid slugs like 'undefined'
    - fallback lookup by PK if slug lookup fails
    - robust create/update/destroy with try/except, logging traceback and returning JSON errors
    - revision snapshot creation before updates
    """
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
        """
        Base queryset with defensive filters:
        - select_related + prefetch for performance
        - for anonymous users, only published posts with non-null published_at and published_at <= now()
        """
        qs = Post.objects.select_related('author').prefetch_related('categories', 'tags')
        user = getattr(self.request, 'user', None)
        if not (user and getattr(user, 'is_staff', False)):
            now = timezone.now()
            try:
                qs = qs.filter(status='published', published_at__isnull=False, published_at__lte=now)
            except Exception:
                # In case of unexpected DB issues, log and fallback to safer filter
                logger.exception("Error applying published filter on Post queryset; falling back to status-only filter")
                try:
                    qs = qs.filter(status='published')
                except Exception:
                    logger.exception("Fallback filter also failed; returning empty queryset")
                    return Post.objects.none()
        return qs

    def _is_invalid_slug_value(self, slug_value: str) -> bool:
        # treat common placeholder strings as invalid
        if not slug_value:
            return True
        sval = str(slug_value).strip().lower()
        return sval in ("undefined", "null", "none", "nan", "")

    def get_object(self):
        """
        Defensive override to:
         - return 404 for obviously-bad slugs (like 'undefined')
         - try lookup by slug, then fallback to PK if slug lookup fails
        """
        lookup_val = self.kwargs.get(self.lookup_field)
        logger.debug("PostViewSet.get_object lookup_field=%s value=%s", self.lookup_field, lookup_val)

        if self._is_invalid_slug_value(lookup_val):
            logger.warning("Attempt to retrieve post with invalid slug value: %s", lookup_val)
            # Return 404 (DRF style)
            from rest_framework.exceptions import NotFound
            raise NotFound(detail="Invalid post identifier")

        # First try the normal lookup (slug)
        try:
            return super().get_object()
        except Exception as e_slug:
            logger.debug("Slug lookup failed for %s: %s — trying fallback by id", lookup_val, e_slug)
            # Fallback: if lookup_val looks like integer, try pk
            try:
                if lookup_val and str(lookup_val).isdigit():
                    obj = Post.objects.select_related('author').prefetch_related('categories', 'tags').get(pk=int(lookup_val))
                    # ensure visibility according to get_queryset
                    qs = self.filter_queryset(self.get_queryset())
                    if obj not in qs:
                        # object exists but not visible to requester
                        from rest_framework.exceptions import NotFound
                        raise NotFound(detail="Post not found")
                    return obj
            except Post.DoesNotExist:
                pass
            # re-raise original to produce proper 404
            from rest_framework.exceptions import NotFound
            raise NotFound(detail="Post not found")

    def perform_create(self, serializer):
        """
        Save author if authenticated. Wrap in transaction for safety.
        """
        user = self.request.user if getattr(self.request, "user", None) and self.request.user.is_authenticated else None
        try:
            with transaction.atomic():
                post = serializer.save(author=user)
                # Ensure published_at is set when status == published and published_at missing
                if getattr(post, "status", None) == "published" and not getattr(post, "published_at", None):
                    post.published_at = timezone.now()
                    post.save(update_fields=["published_at"])
                logger.info("Post created id=%s slug=%s by user=%s", getattr(post, "id", None), getattr(post, "slug", None), getattr(user, "pk", None) if user else "anon")
        except Exception:
            logger.exception("perform_create failed")
            raise

    def perform_update(self, serializer):
        """
        Wrap updates in transaction and create a PostRevision snapshot of previous content.
        """
        try:
            with transaction.atomic():
                instance = self.get_object()
                # create revision snapshot BEFORE applying update
                try:
                    PostRevision.objects.create(
                        post=instance,
                        author=self.request.user if getattr(self.request, "user", None) and self.request.user.is_authenticated else None,
                        content=instance.content or "",
                        title=instance.title or "",
                        excerpt=instance.excerpt or "",
                        autosave=False,
                        meta={'reason': 'manual update via API'}
                    )
                except Exception:
                    logger.exception("Could not create PostRevision snapshot before update for post id=%s", getattr(instance, "id", None))
                updated = serializer.save()
                # if status changed to published and published_at missing -> set it
                if getattr(updated, "status", None) == "published" and not getattr(updated, "published_at", None):
                    updated.published_at = timezone.now()
                    updated.save(update_fields=["published_at"])
                logger.info("Post updated id=%s slug=%s by user=%s", getattr(updated, "id", None), getattr(updated, "slug", None), getattr(self.request.user, "pk", None) if getattr(self.request, "user", None) and self.request.user.is_authenticated else "anon")
        except Exception:
            logger.exception("perform_update failed")
            raise

    def perform_destroy(self, instance):
        """
        Perform destroy inside transaction and log. Keep simple hard-delete here;
        if you want soft-delete, adapt accordingly.
        """
        try:
            with transaction.atomic():
                pid = getattr(instance, "id", None)
                pslug = getattr(instance, "slug", None)
                instance.delete()
                logger.info("Post deleted id=%s slug=%s by user=%s", pid, pslug, getattr(self.request.user, "pk", None) if getattr(self.request, "user", None) and self.request.user.is_authenticated else "anon")
        except Exception:
            logger.exception("perform_destroy failed")
            raise

    # ----- robust create/update/destroy overrides that return JSON errors instead of HTML 500 -----
    def create(self, request, *args, **kwargs):
        try:
            serializer = self.get_serializer(data=request.data)
            if not serializer.is_valid():
                logger.debug("Post create validation failed: %s", serializer.errors)
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            try:
                self.perform_create(serializer)
            except Exception as e:
                tb = traceback.format_exc()
                logger.exception("Error in perform_create: %s", tb)
                return Response({'detail': 'Failed to create post', 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
        except Exception as e:
            tb = traceback.format_exc()
            logger.exception("PostViewSet.create unexpected error: %s", tb)
            return Response({'detail': 'Internal server error', 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def update(self, request, *args, **kwargs):
        try:
            partial = kwargs.pop('partial', False)
            instance = self.get_object()
            serializer = self.get_serializer(instance, data=request.data, partial=partial)
            if not serializer.is_valid():
                logger.debug("Post update validation failed: %s", serializer.errors)
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            try:
                self.perform_update(serializer)
            except Exception as e:
                tb = traceback.format_exc()
                logger.exception("Error in perform_update: %s", tb)
                return Response({'detail': 'Failed to update post', 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            return Response(serializer.data)
        except Exception as e:
            tb = traceback.format_exc()
            logger.exception("PostViewSet.update unexpected error: %s", tb)
            return Response({'detail': 'Internal server error', 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def destroy(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            try:
                self.perform_destroy(instance)
            except Exception as e:
                tb = traceback.format_exc()
                logger.exception("Error in perform_destroy: %s", tb)
                return Response({'detail': 'Failed to delete post', 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            tb = traceback.format_exc()
            logger.exception("PostViewSet.destroy unexpected error: %s", tb)
            return Response({'detail': 'Internal server error', 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    # -----------------------------------------------------------------------------------------------

    def list(self, request, *args, **kwargs):
        """
        Override list to catch unexpected serialization errors and log them clearly.
        This prevents a raw 500 traceback leaking to the client and helps debugging.
        """
        try:
            return super().list(request, *args, **kwargs)
        except Exception as e:
            tb = traceback.format_exc()
            logger.exception("PostViewSet.list failed: %s", tb)
            # Return a safe error response with minimal detail (do not leak sensitive internals)
            return Response({'detail': 'Internal server error while listing posts'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], permission_classes=[AllowAny])
    def add_comment(self, request, slug=None):
        """
        POST /api/blog/posts/<slug>/add_comment/
        (this action exists and accepts post data)
        """
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
    """
    CommentViewSet:
      - list/create/retrieve -> AllowAny
      - update/delete -> authenticated
    Note: create is csrf_exempt to allow anonymous POSTs from cross-origin frontends
    (you may remove csrf_exempt and rely on CSRF cookie + X-CSRFToken from frontend).
    """
    queryset = Comment.objects.all()
    serializer_class = CommentSerializer

    def get_permissions(self):
        if self.action in ['create', 'list', 'retrieve']:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]
    
    @method_decorator(csrf_exempt)
    def create(self, request, *args, **kwargs):
        """
        Allow creation without CSRF when called from external frontend (fallback).
        If you prefer CSRF protection, remove the decorator and ensure frontend
        fetches /api/blog/csrf/ before POST and sends X-CSRFToken header.
        """
        return super().create(request, *args, **kwargs)


# ---------------------------
# Reactions endpoints
# ---------------------------
@api_view(['GET'])
@permission_classes([AllowAny])
def reaction_detail(request):
    post_slug = request.query_params.get('post_slug')
    if not post_slug:
        return Response({'detail': 'Missing post_slug'}, status=status.HTTP_400_BAD_REQUEST)
    post = get_object_or_404(Post, slug=post_slug)
    reaction, _ = PostReaction.objects.get_or_create(post=post)
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
            # If anonymous, we toggle via anon_count but be conservative: increment only
            reaction.anon_count = reaction.anon_count + 1 if reaction.anon_count >= 0 else 1
        reaction.save()
    return Response({'post_slug': post.slug, 'likes_count': reaction.likes_count()})


# ---------------------------
# Admin quick actions and dashboard
# ---------------------------
@require_POST
@staff_member_required(login_url='/admin/login/')
def quick_action_view(request):
    try:
        if request.content_type and 'application/json' in request.content_type:
            data = json.loads(request.body.decode('utf-8') or '{}')
        else:
            data = request.POST or {}
        action = data.get('action')
        post_id = data.get('post_id')
        if not post_id:
            return JsonResponse({'success': False, 'message': 'post_id is required'}, status=400)

        post = Post.objects.get(id=post_id)
        if action == 'publish':
            post.status = 'published'
            post.published_at = timezone.now()
            post.save(update_fields=['status', 'published_at'])
            return JsonResponse({'success': True, 'message': 'Пост опубликован'})
        elif action == 'draft':
            post.status = 'draft'; post.save(update_fields=['status'])
            return JsonResponse({'success': True, 'message': 'Пост перемещен в черновики'})
        elif action == 'archive':
            post.status = 'archived'; post.save(update_fields=['status'])
            return JsonResponse({'success': True, 'message': 'Пост перемещен в архив'})
        else:
            return JsonResponse({'success': False, 'message': 'Неизвестное действие'}, status=400)
    except Post.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Пост не найден'}, status=404)
    except Exception as e:
        logger.exception("quick_action_view error")
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@staff_member_required(login_url='/admin/login/')
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
# Media Library UI (admin) and helpers
# ---------------------------
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
            qs = PostAttachment.objects.all().order_by('-uploaded_at')
            for a in qs[:1000]:
                file_field = getattr(a, 'file', None)
                url = ''
                filename = ''
                try:
                    if file_field and getattr(file_field, 'name', None):
                        filename = os.path.basename(file_field.name)
                        try:
                            url = file_field.url
                        except Exception:
                            url = ''
                except Exception:
                    logger.exception("Error getting file/url for attachment id=%s", getattr(a, 'id', None))
                title = getattr(a, 'title', '') or filename
                uploaded_at = getattr(a, 'uploaded_at', None)
                attachments.append({
                    'id': getattr(a, 'id', None),
                    'title': title,
                    'filename': filename,
                    'url': url,
                    'uploaded_at': uploaded_at.isoformat() if uploaded_at else None,
                    'post_id': a.post.id if getattr(a, 'post', None) else None,
                })
        except Exception:
            logger.exception("Error fetching PostAttachment queryset")
        ctx['attachments'] = attachments
        ctx['current_post_id'] = self.request.GET.get('post_id') or None
        return ctx


# Create callable views for URLs and wrap with staff_member_required when exposing
admin_media_library_view = staff_member_required(MediaLibraryView.as_view(), login_url='/admin/login/')


@require_GET
@staff_member_required(login_url='/admin/login/')
def admin_preview_token_view(request):
    token = get_token(request)
    return JsonResponse({"csrf": token})

@ensure_csrf_cookie
@require_GET
def get_csrf_token(request):
    """
    GET /api/blog/csrf/ -> returns JSON { csrf: "<token>" } and sets csrftoken cookie.
    Frontend should call this with credentials included to obtain CSRF cookie before POST.
    """
    return JsonResponse({"csrf": get_token(request)})

@require_GET
@staff_member_required(login_url='/admin/login/')
def admin_stats_api(request):
    return dashboard_stats(request)


@require_POST
@staff_member_required(login_url='/admin/login/')
def admin_post_update_view(request):
    """
    Legacy admin update endpoint (kept for compatibility with admin UI JS).
    Accepts JSON or form-data. Validates fields and updates the Post.
    """
    try:
        if request.content_type and 'application/json' in request.content_type:
            data = json.loads(request.body.decode('utf-8') or '{}')
        else:
            data = request.POST or {}
        post_id = data.get('post_id')
        if not post_id:
            return JsonResponse({'success': False, 'message': 'post_id required'}, status=400)
        try:
            post = Post.objects.get(pk=int(post_id))
        except Post.DoesNotExist:
            return JsonResponse({'success': False, 'message': 'Post not found'}, status=404)

        allowed = {'title', 'excerpt', 'content', 'status', 'meta_description', 'meta_title', 'featured_image'}
        updates = {}
        # ensure data is dict-like
        iterable = data.items() if hasattr(data, 'items') else []
        for k, v in iterable:
            if k in allowed:
                updates[k] = v

        if not updates:
            return JsonResponse({'success': False, 'message': 'No updatable fields provided'}, status=400)

        # Save snapshot before update
        try:
            PostRevision.objects.create(
                post=post,
                author=request.user if request.user.is_authenticated else None,
                content=post.content or "",
                title=post.title or "",
                excerpt=post.excerpt or "",
                autosave=False,
                meta={'reason': 'admin quick update'}
            )
        except Exception:
            logger.exception("Could not create revision before admin quick update for post id=%s", getattr(post, "id", None))

        for k, v in updates.items():
            setattr(post, k, v)
        post.save()
        return JsonResponse({'success': True, 'post_id': post.id})
    except Post.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Post not found'}, status=404)
    except Exception:
        logger.exception("admin_post_update_view error")
        return JsonResponse({'success': False, 'message': 'Internal error'}, status=500)


@require_POST
@staff_member_required(login_url='/admin/login/')
def admin_autosave_view(request):
    try:
        if request.content_type and 'application/json' in request.content_type:
            data = json.loads(request.body.decode('utf-8') or '{}')
        else:
            data = request.POST or {}
        payload = {
            'title': data.get('title', ''),
            'content': data.get('content', ''),
            'excerpt': data.get('excerpt', ''),
            'featured_image': data.get('featured_image', ''),
        }
        token = signing.dumps(payload, salt=PREVIEW_SALT)
        return JsonResponse({'success': True, 'preview_token': token, 'preview_url': reverse('post-preview', args=[token])})
    except Exception:
        logger.exception("admin_autosave_view error")
        return JsonResponse({'success': False, 'message': 'Internal error'}, status=500)


# ---------------------------
# Media API: list / upload / delete / proxy / attach
# ---------------------------
@api_view(['GET'])
@permission_classes([IsAuthenticatedOrReadOnly])
def media_list(request):
    try:
        q = request.GET.get('q', '').strip()
        unattached = request.GET.get('unattached_only') in ('1', 'true', 'True')
        qs = PostAttachment.objects.all().order_by('-uploaded_at')
        if unattached:
            qs = qs.filter(post__isnull=True)
        if q:
            qs = qs.filter(dj_models.Q(title__icontains=q) | dj_models.Q(file__icontains=q))

        page_size = min(int(request.GET.get('page_size', 48)), 200)
        page = max(int(request.GET.get('page', 1)), 1)
        start = (page - 1) * page_size
        end = start + page_size

        items = []
        for a in qs[start:end]:
            file_field = getattr(a, 'file', None)
            url = ''
            filename = ''
            try:
                if file_field and getattr(file_field, 'name', None):
                    filename = os.path.basename(file_field.name)
                    try:
                        url = file_field.url
                    except Exception:
                        url = ''
            except Exception:
                logger.exception("media_list: error reading file for attachment id=%s", getattr(a, 'id', None))
            items.append({
                'id': a.id,
                'title': a.title or filename,
                'filename': filename,
                'url': url,
                'uploaded_at': a.uploaded_at.isoformat() if getattr(a, 'uploaded_at', None) else None,
                'post_id': a.post.id if getattr(a, 'post', None) else None
            })
        return Response({'results': items})
    except Exception:
        logger.exception("media_list error")
        return Response({'results': [], 'error': 'internal'}, status=500)


@api_view(['POST'])
@permission_classes([IsAdminUser])
@parser_classes([MultiPartParser, FormParser])
def media_upload(request):
    try:
        files = []
        if 'file' in request.FILES:
            files = [request.FILES['file']]
        elif 'files' in request.FILES:
            files = request.FILES.getlist('files')
        else:
            files = request.FILES.getlist('file') or []

        if not files:
            return Response({'success': False, 'message': 'No files provided'}, status=400)

        uploaded = []
        for f in files:
            att = PostAttachment()
            try:
                att.file.save(f.name, f, save=False)
            except Exception as e:
                logger.exception("media_upload: file.save failed for %s: %s", f.name, e)
                return Response({'success': False, 'message': 'file.save failed'}, status=500)

            att.title = request.data.get('title') or f.name
            att.uploaded_by = request.user if request.user.is_authenticated else None
            try:
                att.save()
            except Exception as e:
                try:
                    if att.file:
                        att.file.delete(save=False)
                except Exception:
                    logger.exception("media_upload: cleanup failed for %s", f.name)
                logger.exception("media_upload: saving PostAttachment failed: %s", e)
                return Response({'success': False, 'message': 'attachment save failed'}, status=500)

            try:
                name = getattr(att.file, 'name', '') or ''
                normalized = name.replace('post_attachments/post_attachments/', 'post_attachments/')
                if normalized != name:
                    try:
                        if att.file.storage.exists(normalized):
                            att.file.name = normalized
                            att.save(update_fields=['file'])
                            logger.debug("Normalized attachment name from %s -> %s", name, normalized)
                    except Exception:
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
    except Exception:
        tb = traceback.format_exc()
        logger.exception("media_upload error: %s", tb)
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
    except Exception:
        logger.exception("media_delete error")
        return Response({'success': False, 'message': 'Internal server error'}, status=500)


@require_GET
def media_proxy(request, pk):
    att = get_object_or_404(PostAttachment, pk=pk)
    file_field = getattr(att, 'file', None)
    if not file_field or not getattr(file_field, 'name', None):
        raise Http404("Attachment has no file")

    try:
        direct_url = file_field.url
    except Exception:
        direct_url = ''

    if not (request.user.is_authenticated and request.user.is_staff):
        if direct_url:
            return redirect(direct_url)
        raise Http404("File not available")

    try:
        file_obj = file_field.open('rb')
    except Exception as e:
        logger.exception("media_proxy: failed to open file %s: %s", pk, e)
        if direct_url:
            return redirect(direct_url)
        raise Http404("File not available")

    mime_type, _ = mimetypes.guess_type(file_field.name or '')
    content_type = mime_type or 'application/octet-stream'
    response = FileResponse(file_obj, filename=os.path.basename(file_field.name), content_type=content_type)
    response['Content-Disposition'] = f'inline; filename="{os.path.basename(file_field.name)}"'
    response['Access-Control-Allow-Origin'] = '*'
    response['Cache-Control'] = 'public, max-age=31536000'
    return response


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


# List revisions for a post (admin-only or post author)
@api_view(['GET'])
@permission_classes([IsAdminUser])
def revisions_list(request, post_id):
    """
    Returns revisions for post_id (admin-only).
    """
    try:
        revisions = PostRevision.objects.filter(post_id=post_id).order_by('-created_at')[:100]
        data = [{
            'id': r.id,
            'author': getattr(r.author, 'username', None),
            'created_at': r.created_at.isoformat(),
            'autosave': r.autosave,
            'title': r.title,
        } for r in revisions]
        return Response({'results': data})
    except Exception:
        logger.exception("revisions_list error")
        return Response({'results': []}, status=500)

# Restore revision (admin-only)
@api_view(['POST'])
@permission_classes([IsAdminUser])
def revision_restore(request, revision_id):
    try:
        r = PostRevision.objects.get(pk=revision_id)
        post = r.post
        # Save current as manual revision before restore
        PostRevision.objects.create(
            post=post,
            author=request.user if request.user.is_authenticated else None,
            content=post.content,
            title=post.title,
            excerpt=post.excerpt,
            autosave=False,
            meta={'restored_from': r.id}
        )
        # restore
        post.content = r.content
        post.title = r.title
        post.excerpt = r.excerpt
        post.save(update_fields=['content', 'title', 'excerpt'])
        return Response({'success': True, 'post_id': post.id})
    except PostRevision.DoesNotExist:
        return Response({'success': False, 'message': 'revision not found'}, status=404)
    except Exception:
        logger.exception("revision_restore error")
        return Response({'success': False, 'message': 'internal'}, status=500)

# Autosave endpoint (admin autosave & revision creation)
@api_view(['POST'])
@permission_classes([IsAdminUser])
@parser_classes([FormParser, MultiPartParser])
def autosave_revision(request):
    """
    Called by admin JS periodically. Accepts JSON/form fields: post_id, title, content, excerpt, autosave=true
    Creates a PostRevision and returns preview token + revision id.
    """
    try:
        data = request.data if hasattr(request, 'data') else json.loads(request.body.decode('utf-8') or '{}')
        post_id = data.get('post_id') or None
        title = data.get('title', '') or ''
        content = data.get('content', '') or ''
        excerpt = data.get('excerpt', '') or ''
        autosave = bool(data.get('autosave', True))

        if post_id:
            try:
                post = Post.objects.get(pk=int(post_id))
            except Post.DoesNotExist:
                post = None
        else:
            post = None

        rev = PostRevision.objects.create(
            post=post,
            author=request.user if request.user.is_authenticated else None,
            content=content,
            title=title,
            excerpt=excerpt,
            autosave=autosave,
            meta={'client': 'admin-autosave'}
        )
        # create preview token (signed payload) for preview_by_token
        payload = {'title': title, 'content': content, 'excerpt': excerpt}
        token = signing.dumps(payload, salt=PREVIEW_SALT)
        return Response({'success': True, 'revision_id': rev.id, 'preview_token': token, 'preview_url': reverse('post-preview', args=[token])})
    except Exception:
        logger.exception("autosave_revision error")
        return Response({'success': False, 'message': 'internal'}, status=500)

# Delete revisions (admin-only)
@api_view(['POST'])
@permission_classes([IsAdminUser])
def revisions_delete(request):
    try:
        ids = request.data.get('ids') or []
        if not isinstance(ids, (list, tuple)):
            return Response({'success': False, 'message': 'ids must be list'}, status=400)
        deleted = PostRevision.objects.filter(id__in=ids).delete()[0]
        return Response({'success': True, 'deleted': deleted})
    except Exception:
        logger.exception("revisions_delete error")
        return Response({'success': False, 'message': 'internal'}, status=500)
    
@csrf_exempt
@staff_member_required
def ckeditor_upload(request):
    """
    Endpoint для CKEditor4 upload. Ожидает POST с полем 'upload' (CKEditor4).
    Загружает файл в SUPABASE bucket через Supabase REST API используя SERVICE ROLE KEY.
    Возвращает JSON: { uploaded: 1, fileName: "...", url: "..." } - формат, который понимает CKEditor4.
    """
    if request.method != 'POST':
        return HttpResponseBadRequest('Only POST allowed')
    upload = request.FILES.get('upload') or request.FILES.get('file')
    if not upload:
        return HttpResponseBadRequest('No file uploaded')

    SUPABASE_URL = os.getenv('SUPABASE_URL')
    SERVICE_ROLE = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    BUCKET = os.getenv('SUPABASE_BUCKET', 'post_attachments')

    if not SUPABASE_URL or not SERVICE_ROLE:
        return HttpResponse('Supabase not configured on server', status=500)

    # формируем имя файла в бакете
    filename = f"uploads/{uuid.uuid4().hex}_{upload.name}"

    upload_url = f"{SUPABASE_URL.rstrip('/')}/storage/v1/object/{BUCKET}"
    headers = {
        "Authorization": f"Bearer {SERVICE_ROLE}",
        # "apikey": SERVICE_ROLE  # не нужно, Authorization хватает
    }
    files = {
        'file': (filename, upload.read(), upload.content_type)
    }
    resp = requests.post(upload_url, headers=headers, files=files, timeout=30)
    if resp.status_code not in (200, 201, 204):
        return HttpResponse(f"Upload failed: {resp.status_code} {resp.text}", status=500)

    public_url = f"{SUPABASE_URL.rstrip('/')}/storage/v1/object/public/{BUCKET}/{filename}"
    return JsonResponse({'uploaded': 1, 'fileName': upload.name, 'url': public_url})
