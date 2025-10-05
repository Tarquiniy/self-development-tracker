# backend/core/urls.py
from django.conf import settings
from django.urls import path, include
from django.conf.urls.static import static
from .admin import custom_admin_site
from users.views import RegisterView, LoginView, ProfileView
from blog import views as blog_views

urlpatterns = [
    path('grappelli/', include('grappelli.urls')),
    # use custom_admin_site as the admin root
    path("admin/", custom_admin_site.urls),
    path('api/auth/register/', RegisterView.as_view(), name='register'),
    path('api/auth/login/', LoginView.as_view(), name='login'),
    path('api/blog/', include(('blog.urls', 'blog'), namespace='blog')),
    path('api/tables/', include(('tables.urls', 'tables'), namespace='tables')),
    path('summernote/', include('django_summernote.urls')),
    path('api/auth/profile/', ProfileView.as_view(), name='profile'),
    path('preview/<str:token>/', blog_views.preview_by_token, name='post-preview'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
