# backend/blog/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PostViewSet, CategoryViewSet, TagViewSet, CommentViewSet, reaction_detail, reaction_toggle, quick_action_view, dashboard_stats
from . import media_views
from blog.views import MediaLibraryView

app_name = 'blog'

router = DefaultRouter()
router.register(r'posts', PostViewSet, basename='post')
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'tags', TagViewSet, basename='tag')
router.register(r'comments', CommentViewSet, basename='comment')

urlpatterns = [
    path('grappelli/', include('grappelli.urls')),
    path('', include(router.urls)),
    path('reactions/detail/', reaction_detail, name='reaction-detail'),
    path('reactions/toggle/', reaction_toggle, name='reaction-toggle'),
    path('summernote/', include('django_summernote.urls')),

    # Новые URL для админки
    path('admin/quick-action/', quick_action_view, name='quick-action'),
    path('admin/dashboard-stats/', dashboard_stats, name='dashboard-stats'),

    # Media API (staff-only)
    path('media/list/', media_views.media_list, name='media-list'),
    path('media/upload/', media_views.media_upload, name='media-upload'),
    path('media/delete/', media_views.media_delete, name='media-delete'),
    path('media/attach/', media_views.media_attach_to_post, name='media-attach'),
    path("admin/media-library/", MediaLibraryView.as_view(), name="media-library"),
]
