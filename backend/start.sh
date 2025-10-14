#!/usr/bin/env bash
# backend/start.sh
# Start script for Render (or similar). Runs migrations (with retries), creates a superuser
# if DJANGO_SUPERUSER_USERNAME/EMAIL/PASSWORD env vars are set, collects static and launches Gunicorn.
set -euo pipefail

echo "=== start.sh starting: $(date) ==="
echo "DJANGO_SETTINGS_MODULE=${DJANGO_SETTINGS_MODULE:-<not set>}"
echo "PORT=${PORT:-8000}"
echo "Running as user: $(id -un || true)"

# Ensure python output is unbuffered for real-time logs
export PYTHONUNBUFFERED=1

# Optional: print Django & Python versions
python -V || true
python -c "import django, sys; print('Django', django.get_version())" || true

# Wait for DB to be ready and apply migrations (retry loop)
echo "=== Running migrations (will retry until DB ready) ==="
until python manage.py migrate --noinput --verbosity 1; do
  echo "Waiting for DB to be ready (retrying migrate in 3s) ..."
  sleep 3
done
echo "Migrations applied."

# Collect static (safe to run on start)
echo "=== Collecting static files ==="
python manage.py collectstatic --noinput --verbosity 0 || true

# Create superuser if env vars are provided (safe idempotent script)
if [ -n "${DJANGO_SUPERUSER_USERNAME:-}" ] && [ -n "${DJANGO_SUPERUSER_EMAIL:-}" ] && [ -n "${DJANGO_SUPERUSER_PASSWORD:-}" ]; then
  echo "=== Creating Django superuser (if not exists) ==="
  TMP_SCRIPT="$(mktemp /tmp/create_superuser.XXXXXX.py)"
  cat > "${TMP_SCRIPT}" <<'PY'
import os
import sys
os.environ.setdefault('DJANGO_SETTINGS_MODULE', os.environ.get('DJANGO_SETTINGS_MODULE', 'core.settings'))
import django
django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()
u = os.environ.get('DJANGO_SUPERUSER_USERNAME')
e = os.environ.get('DJANGO_SUPERUSER_EMAIL')
p = os.environ.get('DJANGO_SUPERUSER_PASSWORD')
if not (u and e and p):
    print("DJANGO_SUPERUSER_* env vars not set; skipping.")
    sys.exit(0)
# Build kwargs for create_superuser - include both username and email where available
kwargs = {}
# Try to set both fields to be safe for different user models
kwargs['username'] = u
kwargs['email'] = e
try:
    if not User.objects.filter(**{User.USERNAME_FIELD: u if User.USERNAME_FIELD != 'email' else e}).exists():
        User.objects.create_superuser(**kwargs, password=p)
        print("Superuser created:", u)
    else:
        print("Superuser already exists; skipping:", u)
except Exception as ex:
    # As a fallback, try creating by email as USERNAME_FIELD
    try:
        if not User.objects.filter(email=e).exists():
            User.objects.create_superuser(email=e, username=u, password=p)
            print("Superuser created via fallback:", e)
        else:
            print("Superuser already exists via fallback; skipping:", e)
    except Exception as ex2:
        print("Failed to create superuser:", ex, ex2)
        sys.exit(1)
PY
  python "${TMP_SCRIPT}" || true
  rm -f "${TMP_SCRIPT}" || true
else
  echo "DJANGO_SUPERUSER_* env vars not provided — skipping superuser creation."
fi

# Final run: start Gunicorn
GUNICORN_MODULE=${GUNICORN_MODULE:-"core.wsgi:application"}
GUNICORN_BIND=${PORT:-8000}
GUNICORN_WORKERS=${GUNICORN_WORKERS:-3}
echo "=== Starting Gunicorn: ${GUNICORN_MODULE} (bind 0.0.0.0:${GUNICORN_BIND}, workers=${GUNICORN_WORKERS}) ==="

exec gunicorn "${GUNICORN_MODULE}" --bind "0.0.0.0:${GUNICORN_BIND}" --workers "${GUNICORN_WORKERS}" --log-level info
