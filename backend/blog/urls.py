
from django.urls import path
from .views_proxy import wordpress_posts, wordpress_post_by_slug

urlpatterns = [
    path('/api/wordpress/posts/', wordpress_posts, name='wordpress_posts'),
    path('/api/wordpress/posts/<slug:slug>/', wordpress_post_by_slug, name='wordpress_post_by_slug'),
]