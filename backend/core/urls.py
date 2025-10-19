# backend/core/urls.py
from django.conf import settings
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

@csrf_exempt
def health_check(request):
    return JsonResponse({"status": "ok", "message": "Django backend is running"})

urlpatterns = [
    path('grappelli/', include('grappelli.urls')),
    path('admin/', admin.site.urls),
    path('api/blog/', include(('blog.urls', 'blog'), namespace='blog')),
    path('summernote/', include('django_summernote.urls')),
    path('health/', health_check, name='health-check'),
]

# Добавляем CKEditor 5 URLs
try:
    urlpatterns += [
        path('ckeditor5/', include('django_ckeditor_5.urls')),
    ]
except Exception:
    pass

# Media library view
try:
    from blog.views import admin_media_library_view
    urlpatterns += [
        path('admin/media-library/', admin_media_library_view, name='admin-media-library'),
    ]
except Exception:
    pass

# В режиме разработки отдаём media/static
if settings.DEBUG:
    from django.conf.urls.static import static
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# Обработчик для favicon.ico (избегаем ошибок 404)
urlpatterns += [
    path('favicon.ico', lambda request: HttpResponse(status=204)),
]

# Кастомная админка
admin.site.site_header = 'Positive Theta Admin'
admin.site.site_title = 'Positive Theta'
admin.site.index_title = 'Панель управления'