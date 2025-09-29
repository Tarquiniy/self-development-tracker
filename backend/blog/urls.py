# backend/blog/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter

# Импорты viewsets и endpoint'ов из blog.views
from .views import (
    PostViewSet,
    CategoryViewSet,
    TagViewSet,
    CommentViewSet,
    reaction_detail,
    reaction_toggle,
    quick_action_view,
    dashboard_stats,
    media_list,
    media_upload,
    media_delete,
)

app_name = 'blog'

router = DefaultRouter()
router.register(r'posts', PostViewSet, basename='post')
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'tags', TagViewSet, basename='tag')
router.register(r'comments', CommentViewSet, basename='comment')

urlpatterns = [
    # REST router (posts, categories, tags, comments)
    path('', include(router.urls)),

    # Reactions endpoints
    path('reactions/detail/', reaction_detail, name='reaction-detail'),
    path('reactions/toggle/', reaction_toggle, name='reaction-toggle'),

    # Summernote (rich text) - если используется на фронте/API
    path('summernote/', include('django_summernote.urls')),

    # Admin helpers (used by admin UI)
    # quick_action: быстрые операции над постом (publish/draft/archive)
    path('admin/quick-action/', quick_action_view, name='quick-action'),
    # dashboard stats for admin
    path('admin/dashboard-stats/', dashboard_stats, name='dashboard-stats'),

    # Media API used by admin media-library JS
    # GET  /api/blog/media/list/?q=...&page=...        -> media_list
    # POST /api/blog/media/upload/                     -> media_upload (multipart/form-data)
    # POST /api/blog/media/delete/                     -> media_delete (JSON { ids: [...] })
    path('media/list/', media_list, name='media-list'),
    path('media/upload/', media_upload, name='media-upload'),
    path('media/delete/', media_delete, name='media-delete'),
]
