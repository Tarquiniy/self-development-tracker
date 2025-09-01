# backend/core/views.py
from django.http import HttpResponse
from django.views.generic import View
from django.conf import settings
import os

class SPAView(View):
    """
    Представление для одностраничного приложения (SPA).
    Отдает index.html для всех нетипичных путей.
    """

    def get(self, request, *args, **kwargs):
        try:
            # Попробуйте отдать статический файл
            with open(os.path.join(settings.STATIC_ROOT, 'index.html'), 'r') as f:
                return HttpResponse(f.read())
        except FileNotFoundError:
            # Если файл не найден, верните простое сообщение
            return HttpResponse(
                """
                <html><body>
                <h1>Django React SPA</h1>
                <p>Static files not built yet. Run 'python manage.py collectstatic'.</p>
                </body></html>
                """,
                status=501,
            )