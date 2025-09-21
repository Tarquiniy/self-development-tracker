from django.urls import path

from blog import views
from .views_proxy import wordpress_posts_proxy

urlpatterns = [
    path('wordpress/posts/', wordpress_posts_proxy, name='wordpress_posts_proxy'),
    path('posts/', wordpress_posts_proxy, name='wordpress_posts_proxy'),
    path('', views.reaction_detail, name='reaction-detail'),
    path('toggle/', views.reaction_toggle, name='reaction-toggle'),
]
