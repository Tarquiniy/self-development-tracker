# backend/blog/views.py
import json
import os
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticatedOrReadOnly, AllowAny, IsAdminUser
from rest_framework.response import Response
from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend
from django.db import models as dj_models
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required, user_passes_test
from django.db.models import Count
from django.views.generic import TemplateView
from django.utils.decorators import method_decorator
from django.contrib.admin.views.decorators import staff_member_required
from django.conf import settings

from .models import Post, Category, PostView, Tag, Comment, PostReaction, PostAttachment
from .serializers import (
    PostListSerializer, PostDetailSerializer, PostCreateUpdateSerializer,
    CategorySerializer, TagSerializer, CommentSerializer
)
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser


class PostViewSet(viewsets.ModelViewSet):
    """
    /api/blog/posts/
    Public list shows only published posts.
    Admins/authors can create/update/draft posts.
    """
    queryset = Post.objects.all()
    permission_classes = [IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'categories__slug', 'tags__slug']
    search_fields = ['title', 'excerpt', 'content', 'meta_description']
    ordering_fields = ['published_at', 'created_at']
    ordering = ['-published_at']
    lookup_field = 'slug'  # enable /posts/<slug>/

    def get_serializer_class(self):
        if self.action in ('list',):
            return PostListSerializer
        if self.action in ('retrieve',):
            return PostDetailSerializer
        return PostCreateUpdateSerializer

    def get_queryset(self):
        qs = Post.objects.select_related('author').prefetch_related('categories', 'tags')
        # public endpoint: only published for non-staff
        if not self.request.user.is_authenticated or not self.request.user.is_staff:
            qs = qs.filter(dj_models.Q(status='published', published_at__lte=timezone.now()))
        else:
            # staff/authenticated can see all
            pass
        return qs

    def perform_create(self, serializer):
        # set author automatically if authenticated
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
        # attach authenticated user if available
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(user=user)


# Simple reaction endpoints (toggle)
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
            # simplistic anon toggle
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
    """Обработчик быстрых действий для постов"""
    try:
        data = json.loads(request.body)
        action = data.get('action')
        post_id = data.get('post_id')

        post = Post.objects.get(id=post_id)

        if action == 'publish':
            post.status = 'published'
            post.save()
            return JsonResponse({'success': True, 'message': 'Пост опубликован'})
        elif action == 'draft':
            post.status = 'draft'
            post.save()
            return JsonResponse({'success': True, 'message': 'Пост перемещен в черновики'})
        elif action == 'archive':
            post.status = 'archived'
            post.save()
            return JsonResponse({'success': True, 'message': 'Пост перемещен в архив'})
        else:
            return JsonResponse({'success': False, 'message': 'Неизвестное действие'})

    except Post.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Пост не найден'})
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)})


@login_required
@user_passes_test(lambda u: u.is_staff)
def dashboard_stats(request):
    """Статистика для дашборда админки"""
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
    """
    Рендерит страницу админской медиатеки (staff only)
    Шаблон: admin/media_library.html
    Контекст: attachments = [{id, title, filename, url, uploaded_at, post_id}, ...]
    """
    template_name = 'admin/media_library.html'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        qs = PostAttachment.objects.all().order_by('-uploaded_at')
        attachments = []
        for a in qs:
            url = a.file.url if a.file else ''
            attachments.append({
                'id': a.id,
                'title': a.title or os.path.basename(a.file.name) if a.file else '',
                'filename': os.path.basename(a.file.name) if a.file else '',
                'url': url,
                'uploaded_at': a.uploaded_at.isoformat() if a.uploaded_at else None,
                'post_id': a.post.id if a.post else None,
            })
        ctx['attachments'] = attachments
        return ctx


# API: list / upload / delete
@api_view(['GET'])
@permission_classes([IsAuthenticatedOrReadOnly])
def media_list(request):
    """
    GET /api/blog/media/list/?q=...&page=1&page_size=24&unattached_only=1
    returns JSON: { results: [ {id, title, filename, url, uploaded_at, post_id}, ... ] }
    """
    q = request.GET.get('q', '').strip()
    unattached = request.GET.get('unattached_only') == '1'
    qs = PostAttachment.objects.all().order_by('-uploaded_at')
    if unattached:
        qs = qs.filter(post__isnull=True)
    if q:
        qs = qs.filter(dj_models.Q(title__icontains=q) | dj_models.Q(file__icontains=q))
    # simple pagination
    page_size = min(int(request.GET.get('page_size', 24)), 200)
    page = max(int(request.GET.get('page', 1)), 1)
    start = (page - 1) * page_size
    end = start + page_size
    items = []
    for a in qs[start:end]:
        items.append({
            'id': a.id,
            'title': a.title or os.path.basename(a.file.name) if a.file else '',
            'filename': os.path.basename(a.file.name) if a.file else '',
            'url': a.file.url if a.file else '',
            'uploaded_at': a.uploaded_at.isoformat() if a.uploaded_at else None,
            'post_id': a.post.id if a.post else None,
        })
    return Response({'results': items})


@api_view(['POST'])
@permission_classes([IsAdminUser])
@parser_classes([MultiPartParser, FormParser])
def media_upload(request):
    """
    POST multipart/form-data: files -> 'file' (multiple allowed), title optional
    returns { success: True, uploaded: [ {id, url, filename, title} ] }
    """
    files = request.FILES.getlist('file') or []
    uploaded = []
    for f in files:
        att = PostAttachment()
        att.file.save(f.name, f, save=False)
        att.title = request.data.get('title') or f.name
        att.uploaded_by = request.user if request.user.is_authenticated else None
        att.save()
        uploaded.append({
            'id': att.id,
            'url': att.file.url,
            'filename': os.path.basename(att.file.name),
            'title': att.title,
        })
    return Response({'success': True, 'uploaded': uploaded})


@api_view(['POST'])
@permission_classes([IsAdminUser])
def media_delete(request):
    """
    POST JSON: { ids: [1,2,3] }
    """
    ids = request.data.get('ids') or []
    if not isinstance(ids, (list, tuple)):
        return Response({'success': False, 'message': 'ids must be a list'}, status=status.HTTP_400_BAD_REQUEST)
    deleted = 0
    for pk in ids:
        try:
            att = PostAttachment.objects.get(pk=pk)
            # remove file from storage
            try:
                if att.file:
                    att.file.delete(save=False)
            except Exception:
                pass
            att.delete()
            deleted += 1
        except PostAttachment.DoesNotExist:
            continue
    return Response({'success': True, 'deleted': deleted})
