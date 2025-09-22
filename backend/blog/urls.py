from django.urls import path
from .views_proxy import wordpress_posts_proxy, wordpress_post_html_proxy

urlpatterns = [
    path('wordpress/posts/', wordpress_posts_proxy, name='wordpress_posts_proxy'),
    path('posts/', wordpress_posts_proxy, name='wordpress_posts_proxy'),
    # New endpoint for fully rendered HTML
    path('wordpress/post/<str:post_identifier>/html/', wordpress_post_html_proxy, name='wordpress_post_html_proxy'),
]