import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.core.settings')  # 👈 изменено
application = get_wsgi_application()
