#!/usr/bin/env python
"""Django's command-line utility for administrative tasks.

Мы добавляем корень репозитория в sys.path, чтобы управление через manage.py
работало корректно независимо от текущей директории запуска.
"""
import os
import sys
from pathlib import Path

def main():
    # Файл manage.py лежит в backend/manage.py
    HERE = Path(__file__).resolve()
    REPO_ROOT = HERE.parents[1]  # parents[0]=backend, parents[1]=repo_root

    # Вставляем repo_root в sys.path, если нужно
    repo_root_str = str(REPO_ROOT)
    if repo_root_str not in sys.path:
        sys.path.insert(0, repo_root_str)

    # Также добавляем backend/ в sys.path — безопасно и полезно
    backend_dir_str = str(HERE.parent)
    if backend_dir_str not in sys.path:
        sys.path.insert(0, backend_dir_str)

    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django."
        ) from exc
    execute_from_command_line(sys.argv)

if __name__ == '__main__':
    main()
