from django.http import HttpResponse
from django.views.generic import View
import os
from django.conf import settings


class ReactAppView(View):
    def get(self, request):
        try:
            with open(os.path.join(settings.STATICFILES_DIRS[0], "index.html")) as file:
                return HttpResponse(file.read())
        except Exception:
            return HttpResponse(
                """
                <html>
                    <body>
                        <h1>Django React App</h1>
                        <p>React files not found. Build the frontend first.</p>
                    </body>
                </html>
                """,
                status=501,
            )
