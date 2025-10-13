#!/usr/bin/env python3
"""
Create a Django superuser from environment variables if it doesn't exist.

This script is safe to run both as:
  python ./backend/create_superuser.py
и
  python -m backend.create_superuser

It ensures the project root is on sys.path so the 'backend' package is importable.
"""
import os
import sys

# --- Make sure project root is on sys.path ---
# If this file is in <repo_root>/backend/create_superuser.py,
# add <repo_root> to sys.path so 'backend' package can be imported.
THIS_FILE = os.path.abspath(__file__)
BACKEND_DIR = os.path.dirname(THIS_FILE)           # .../repo/backend
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)        # .../repo

if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# Ensure correct settings module
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

# Now import Django and set it up
import django
try:
    django.setup()
except Exception as exc:
    print("Django setup failed:", exc, file=sys.stderr)
    sys.exit(2)

from django.contrib.auth import get_user_model

def main():
    User = get_user_model()

    username = os.getenv("DJANGO_SUPERUSER_USERNAME")
    email = os.getenv("DJANGO_SUPERUSER_EMAIL")
    password = os.getenv("DJANGO_SUPERUSER_PASSWORD")

    if not (username and email and password):
        print("Skipping superuser creation: DJANGO_SUPERUSER_* env vars are not all set.")
        return 0

    # Check existing by email or username
    if User.objects.filter(email=email).exists() or User.objects.filter(username=username).exists():
        print(f"Superuser with email={email} or username={username} already exists — skipping.")
        return 0

    try:
        # Preferred explicit kwargs (works with custom USER model using email as USERNAME_FIELD)
        User.objects.create_superuser(email=email, username=username, password=password)
        print(f"Created superuser: {email} (username: {username})")
        return 0
    except TypeError:
        # Fallback to positional signature for older user models
        try:
            User.objects.create_superuser(username, email, password)
            print(f"Created superuser via fallback signature: {email} (username: {username})")
            return 0
        except Exception as exc:
            print("Failed to create superuser (fallback). Exception:", exc, file=sys.stderr)
            return 3
    except Exception as exc:
        print("Failed to create superuser. Exception:", exc, file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(main())
