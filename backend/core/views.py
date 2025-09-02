import os
from django.http import HttpResponse
from django.views.generic import View
from django.conf import settings
from django.views.generic import TemplateView

class SPAView(View):
    def get(self, request, *args, **kwargs):
        try:
            # Путь к index.html в собранном React-приложении
            index_path = os.path.join(settings.STATICFILES_DIRS[0], 'index.html')
            with open(index_path, 'r', encoding='utf-8') as f:
                return HttpResponse(f.read())
        except FileNotFoundError:
            # Кастомная ошибка, если файл не найден
            return HttpResponse(
                """
                <html><body>
                <h1>Django React SPA</h1>
                <p>Static files not found. Ensure React app is built and collected.</p>
                </body></html>
                """,
                status=501,
            )

class ReactAppView(TemplateView):
    template_name = 'index.html'