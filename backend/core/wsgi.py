"""
WSGI config for project.

This file ensures that the project root is on sys.path so imports that
refer to `backend.*` succeed even when the process is started from inside
the backend/ directory (e.g. when Render runs `cd backend && gunicorn ...`).
"""

import os
import sys
from pathlib import Path

# Путь к файлу: backend/core/wsgi.py
HERE = Path(__file__).resolve()
# repo_root = parents[2] if file is backend/core/wsgi.py:
#   HERE.parents[0] -> backend/core
#   HERE.parents[1] -> backend
#   HERE.parents[2] -> repo_root
REPO_ROOT = HERE.parents[2]

# Добавляем корень репозитория в начало sys.path, если ещё не добавлен.
# Это даёт возможность импортировать пакет 'backend' независимо от CWD.
repo_root_str = str(REPO_ROOT)
if repo_root_str not in sys.path:
    sys.path.insert(0, repo_root_str)

# Также добавим сам каталог backend (на всякий случай) — полезно если что-то импортирует модуль без префикса.
BACKEND_DIR = HERE.parents[1]
backend_dir_str = str(BACKEND_DIR)
if backend_dir_str not in sys.path:
    sys.path.insert(0, backend_dir_str)

# Устанавливаем настройки (оставляем прежний модуль настроек)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

from django.core.wsgi import get_wsgi_application

application = get_wsgi_application()
