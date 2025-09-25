# backend/core/urls.py
from django.conf import settings
from django.contrib import admin
from django.urls import path, include
from backend.core.views import health_check
from users.views import RegisterView, LoginView
from django.conf.urls.static import static
from users.views import RegisterView, LoginView, ProfileView

urlpatterns = [
    path('grappelli/', include('grappelli.urls')),
    path('api/auth/register/', RegisterView.as_view(), name='register'),
    path('api/auth/login/', LoginView.as_view(), name='login'),
    path('api/blog/', include(('blog.urls', 'blog'), namespace='blog')),
    path('api/tables/', include(('tables.urls', 'tables'), namespace='tables')),
    path('admin/', admin.site.urls),
    path('summernote/', include('django_summernote.urls')),
    path('api/auth/profile/', ProfileView.as_view(), name='profile'),

    # health-check вместо старого index.html
    path('', health_check, name='health-check'),
]

if settings.DEBUG:  # только в dev
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
