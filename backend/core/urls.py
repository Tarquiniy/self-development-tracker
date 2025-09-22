from django.conf import settings
from django.contrib import admin
from django.urls import path, include
from users.views import RegisterView, LoginView
from django.conf.urls.static import static

urlpatterns = [
    path('grappelli/', include('grappelli.urls')),
    path('api/auth/register/', RegisterView.as_view(), name='register'),
    path('api/auth/login/', LoginView.as_view(), name='login'),
    # подключаем API блога
    path('api/blog/', include('blog.urls', namespace='blog')),
    path('admin/', admin.site.urls),
    path('summernote/', include('django_summernote.urls')),
]

if settings.DEBUG:  # только в dev
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

