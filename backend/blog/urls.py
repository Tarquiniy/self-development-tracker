from django.urls import path
from .views_proxy import wordpress_posts_proxy
from .views import wordpress_post_content, reaction_detail, reaction_toggle

urlpatterns = [
    path('wordpress/posts/', wordpress_posts_proxy, name='wordpress_posts_proxy'),
    path('posts/', wordpress_posts_proxy, name='wordpress_posts_proxy'),
    path('wordpress/posts/content/<slug:slug>/', wordpress_post_content, name='wordpress_post_content'),
    path('reactions/', reaction_detail, name='reaction_detail'),
    path('reactions/toggle/', reaction_toggle, name='reaction_toggle'),
]