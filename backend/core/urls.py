# backend/core/urls.py
from django.conf import settings
from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView
from users.views import RegisterView, LoginView, ProfileView
from django.conf.urls.static import static
import logging

logger = logging.getLogger(__name__)

# Make sure Django's admin modules are discovered (loads app admin.py files)
admin.autodiscover()

# Force admin visual text and namespace name to standard values
admin.site.site_header = "Positive Theta Admin"
admin.site.site_title = "Positive Theta"
admin.site.index_title = "Панель управления Positive Theta"
# Ensure namespace used by templates / third-party packages is 'admin'
admin.site.name = "admin"

# Ensure auth models registered (safe no-op if already registered)
try:
    from django.contrib.auth import get_user_model
    from django.contrib.auth.models import Group
    from django.contrib.auth.admin import UserAdmin, GroupAdmin

    try:
        admin.site.register(get_user_model(), UserAdmin)
    except Exception:
        # already registered or custom admin exists
        pass

    try:
        admin.site.register(Group, GroupAdmin)
    except Exception:
        pass
except Exception as e:
    logger.debug("Auth registration check failed: %s", e)

# Try to import optional blog admin helper views (media library, dashboard, etc.)
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
    # optional helpers not present — that's fine
    pass

urlpatterns = [
    path("grappelli/", include("grappelli.urls")),

    # API / auth
    path("api/auth/register/", RegisterView.as_view(), name="register"),
    path("api/auth/login/", LoginView.as_view(), name="login"),
    path("api/blog/", include(("blog.urls", "blog"), namespace="blog")),
    path("api/tables/", include(("tables.urls", "tables"), namespace="tables")),
    path("summernote/", include("django_summernote.urls")),
    path("api/auth/profile/", ProfileView.as_view(), name="profile"),
    path("preview/<str:token>/", (blog_admin.preview_by_token if 'blog_admin' in locals() and hasattr(blog_admin, "preview_by_token") else TemplateView.as_view(template_name="404.html")), name="post-preview"),
]

# register media-library route before admin/ if provided by blog.admin
if admin_media_library_view:
    urlpatterns += [
        path("admin/media-library/", admin_media_library_view, name="admin-media-library"),
    ]
else:
    urlpatterns += [
        path("admin/media-library/", TemplateView.as_view(template_name="admin/media_library_unavailable.html"), name="admin-media-library"),
    ]

# Use standard admin.site (ensures expected "admin:" namespace and URL names)
urlpatterns += [
    path("admin/", admin.site.urls),
]

# Additional optional admin views if provided by blog.admin (kept outside admin.site)
if admin_dashboard_view:
    urlpatterns += [path("admin/dashboard/", admin_dashboard_view, name="admin-dashboard")]

if admin_stats_api:
    urlpatterns += [path("admin/dashboard/stats-data/", admin_stats_api, name="admin-dashboard-stats")]

if admin_post_update_view:
    urlpatterns += [path("admin/posts/update/", admin_post_update_view, name="admin-post-update")]

# Serve media / static in DEBUG
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
