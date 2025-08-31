from django.urls import path
from . import views

urlpatterns = [
    path('test/', views.blog_test, name='blog-test'),
]   