#!/usr/bin/env python
import os
import sys
from pathlib import Path

def main():
    # Добавляем корневую папку в PYTHONPATH, чтобы backend.users был найден
    current_path = Path(__file__).resolve().parent
    sys.path.append(str(current_path.parent))

    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.core.settings')  
    from django.core.management import execute_from_command_line
    execute_from_command_line(sys.argv)

if __name__ == '__main__':
    main()
