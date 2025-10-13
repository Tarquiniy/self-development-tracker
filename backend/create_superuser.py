#!/usr/bin/env python3
"""
Create a Django superuser from environment variables if it doesn't exist.

Expected environment variables:
  DJANGO_SUPERUSER_USERNAME  - (string) username (this is 'username' field)
  DJANGO_SUPERUSER_EMAIL     - (string) email (CustomUser.USERNAME_FIELD == 'email' in your project)
  DJANGO_SUPERUSER_PASSWORD  - (string) password

This script is safe to run on every deploy: if the user already exists it will skip creation.
Place it somewhere in your repo (I suggest backend/scripts/) and call it after migrations.
"""

import os
import sys

# Set Django settings module if not already set (Render usually sets DJANGO_SETTINGS_MODULE)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

# Import Django and setup
import django
django.setup()

from django.contrib.auth import get_user_model

def main():
    User = get_user_model()

    username = os.getenv("DJANGO_SUPERUSER_USERNAME")
    email = os.getenv("DJANGO_SUPERUSER_EMAIL")
    password = os.getenv("DJANGO_SUPERUSER_PASSWORD")

    if not (username and email and password):
        print("Skipping superuser creation: one or more DJANGO_SUPERUSER_* env vars are not set.")
        return 0

    # You may want to check by email or username depending on your USERNAME_FIELD.
    # In your CustomUser USERNAME_FIELD = 'email', but REQUIRED_FIELDS contains 'username',
    # so we check both to be safe.
    exists = User.objects.filter(email=email).exists() or User.objects.filter(username=username).exists()
    if exists:
        print(f"Superuser with email={email} or username={username} already exists — skipping.")
        return 0

    try:
        # Use keyword args to match custom user manager expectations
        User.objects.create_superuser(email=email, username=username, password=password)
        print(f"Created superuser: {email} (username: {username})")
        return 0
    except TypeError:
        # Fallback if create_superuser signature is different
        try:
            User.objects.create_superuser(username, email, password)
            print(f"Created superuser via fallback signature: {email} (username: {username})")
            return 0
        except Exception as exc:
            print("Failed to create superuser (fallback). Exception:", exc, file=sys.stderr)
            return 2
    except Exception as exc:
        print("Failed to create superuser. Exception:", exc, file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(main())
