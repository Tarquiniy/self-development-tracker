from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PostViewSet, CategoryViewSet, TagViewSet, CommentViewSet, reaction_detail, reaction_toggle

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
]
