# backend/core/urls.py
from django.conf import settings
from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView, RedirectView
from django.http import HttpResponseNotFound

# Admin views
from blog.views import MediaLibraryView
from blog.admin import admin_dashboard_view, admin_media_library_view

def custom_404_view(request, exception=None):
    return HttpResponseNotFound("Страница не найдена")

urlpatterns = [
    path('grappelli/', include('grappelli.urls')),
    path('admin/', admin.site.urls),
    
    # Blog API
    path('api/blog/', include(('blog.urls', 'blog'), namespace='blog')),
    
    # Summernote
    path('summernote/', include('django_summernote.urls')),
    
    # Preview
    path('preview/<str:token>/', MediaLibraryView.as_view(), name='post-preview'),
    
    # Admin custom views
    path('admin/dashboard/', admin_dashboard_view, name='admin-dashboard'),
    path('admin/media-library/', admin_media_library_view, name='admin-media-library'),
    
    # Health check
    path('health/', lambda request: HttpResponseNotFound("OK"), name='health-check'),
    
    # Root redirect to admin
    path('', RedirectView.as_view(url='/admin/')),
]

# CKEditor 5
try:
    urlpatterns += [path('ckeditor5/', include('django_ckeditor_5.urls'))]
except Exception:
    pass

# Debug mode
if settings.DEBUG:
    from django.conf.urls.static import static
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# 404 handler
handler404 = custom_404_view