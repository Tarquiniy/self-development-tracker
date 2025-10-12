"""
WSGI config for core project.

It exposes the WSGI callable as a module-level variable named ``application``.
"""

import os
import sys

# Добавьте путь к проекту в sys.path
project_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_path not in sys.path:
    sys.path.append(project_path)

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

application = get_wsgi_application()