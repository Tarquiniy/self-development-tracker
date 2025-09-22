from django.urls import path
from .views_proxy import wordpress_posts_proxy
from .views import reaction_detail, reaction_toggle
from .views import wordpress_post_with_styles

urlpatterns = [
    path('wordpress/posts/', wordpress_posts_proxy, name='wordpress_posts_proxy'),
    path('posts/', wordpress_posts_proxy, name='wordpress_posts_proxy'),
    path('reactions/', reaction_detail, name='reaction_detail'),
    path('reactions/toggle/', reaction_toggle, name='reaction_toggle'),
]