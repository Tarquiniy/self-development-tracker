#!/usr/bin/env python
import os
import sys
from pathlib import Path

# загрузка .env перед установкой DJANGO_SETTINGS_MODULE
try:
    from dotenv import load_dotenv
except Exception:
    load_dotenv = None

BASE_DIR = Path(__file__).resolve().parent

if load_dotenv:
    load_dotenv(dotenv_path=BASE_DIR / '.env')

def main():
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Activate venv and ensure Django is installed."
        ) from exc
    execute_from_command_line(sys.argv)

if __name__ == '__main__':
    main()
