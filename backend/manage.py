#!/usr/bin/env python
import os
import sys
from pathlib import Path

# загрузка .env перед установкой DJANGO_SETTINGS_MODULE (если используете .env)
try:
    from dotenv import load_dotenv, find_dotenv
    load_dotenv(find_dotenv())
except Exception:
    pass

BASE_DIR = Path(__file__).resolve().parent

# Установите здесь правильное имя пакета с settings.py
# Если ваш файл находится в backend/settings.py — оставьте 'backend.settings'
# Если файл в другой папке, замените 'backend' на имя той папки
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

def main():
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Активируйте venv и убедитесь, что Django установлен."
        ) from exc
    execute_from_command_line(sys.argv)

if __name__ == '__main__':
    main()
