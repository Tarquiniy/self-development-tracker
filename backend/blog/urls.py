# backend/blog/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter

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
    media_proxy,
    media_attach_to_post,
    revisions_list,
    revision_restore,
    autosave_revision,
    revisions_delete,
    get_csrf_token,  # <-- new
)

app_name = 'blog'

router = DefaultRouter()
router.register(r'posts', PostViewSet, basename='post')
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'tags', TagViewSet, basename='tag')
router.register(r'comments', CommentViewSet, basename='comment')

urlpatterns = [
    path('', include(router.urls)),

    path('reactions/detail/', reaction_detail, name='reaction-detail'),
    path('reactions/toggle/', reaction_toggle, name='reaction-toggle'),

    path('summernote/', include('django_summernote.urls')),

    path('admin/quick-action/', quick_action_view, name='quick-action'),
    path('admin/dashboard-stats/', dashboard_stats, name='dashboard-stats'),

    path('media/list/', media_list, name='media-list'),
    path('media/upload/', media_upload, name='media-upload'),
    path('media/delete/', media_delete, name='media-delete'),
    path('media/proxy/<int:pk>/', media_proxy, name='media-proxy'),
    path('media/attach/', media_attach_to_post, name='media-attach'),

    path('revisions/<int:post_id>/', revisions_list, name='revisions-list'),
    path('revisions/restore/<int:revision_id>/', revision_restore, name='revisions-restore'),
    path('revisions/autosave/', autosave_revision, name='revisions-autosave'),
    path('revisions/delete/', revisions_delete, name='revisions-delete'),

    # PUBLIC CSRF token endpoint — frontend should call this (with credentials: include)
    path('csrf/', get_csrf_token, name='csrf-token'),
]
