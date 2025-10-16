from django.urls import path
from .views import PostListCreateView, PostRetrieveUpdateView, upload_media

urlpatterns = [
    path('', PostListCreateView.as_view(), name='posts_list'),
    path('<int:pk>/', PostRetrieveUpdateView.as_view(), name='post_detail'),
    path('media/upload/', upload_media, name='media_upload'),
]
