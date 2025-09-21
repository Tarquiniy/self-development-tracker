from django.contrib import admin
from django.urls import path, include
from users.views import RegisterView, LoginView

urlpatterns = [
    path('api/auth/register/', RegisterView.as_view(), name='register'),
    path('api/auth/login/', LoginView.as_view(), name='login'),
    path('api/wordpress/', include('blog.urls')),
    path('admin/', admin.site.urls),
    path('api/blog/', include('blog.urls')),
    path('api/blog/reactions/', include('blog.urls'))
]