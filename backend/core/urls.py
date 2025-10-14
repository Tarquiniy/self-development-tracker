# backend/core/urls.py (важная часть)
from django.conf import settings
from django.contrib import admin
from django.urls import path, include
from users.views import RegisterView, LoginView, ProfileView
from django.conf.urls.static import static
from django.views.generic import TemplateView

# импорт blog.admin views опционально, но не используем custom admin site
admin_media_library_view = None
admin_dashboard_view = None
admin_stats_api = None
admin_post_update_view = None
admin_autosave_view = None
admin_preview_token_view = None
try:
    from blog import admin as blog_admin
    admin_media_library_view = getattr(blog_admin, "admin_media_library", None) or getattr(blog_admin, "admin_media_library_view", None)
    admin_dashboard_view = getattr(blog_admin, "admin_dashboard_view", None)
    admin_stats_api = getattr(blog_admin, "admin_stats_api", None)
    admin_post_update_view = getattr(blog_admin, "admin_post_update_view", None)
    admin_autosave_view = getattr(blog_admin, "admin_autosave_view", None)
    admin_preview_token_view = getattr(blog_admin, "admin_preview_token_view", None)
except Exception:
    pass

urlpatterns = [
    path('grappelli/', include('grappelli.urls')),

    path('api/auth/register/', RegisterView.as_view(), name='register'),
    path('api/auth/login/', LoginView.as_view(), name='login'),
    path('api/blog/', include(('blog.urls', 'blog'), namespace='blog')),
    #path('api/tables/', include(('tables.urls', 'tables'), namespace='tables')),
    path('summernote/', include('django_summernote.urls')),
    path('api/auth/profile/', ProfileView.as_view(), name='profile'),
    path('preview/<str:token>/', (blog_admin.preview_by_token if hasattr(blog_admin, "preview_by_token") else TemplateView.as_view(template_name='404.html')), name='post-preview'),
]

# media-library route before admin if provided
if admin_media_library_view:
    urlpatterns += [
        path('admin/media-library/', admin_media_library_view, name='admin-media-library'),
    ]
else:
    urlpatterns += [
        path('admin/media-library/', TemplateView.as_view(template_name='admin/media_library_unavailable.html'), name='admin-media-library'),
    ]

# --> Use standard admin.site here:
urlpatterns += [
    path('admin/', admin.site.urls),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
