#!/usr/bin/env bash
set -o errexit

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Installing Python dependencies (backend) ==="
pip install --upgrade pip
pip install -r backend/requirements.txt

echo "=== Collecting static files (backend) ==="
cd backend
python manage.py collectstatic --noinput --clear

echo "=== Making migrations (backend) ==="
python manage.py makemigrations

echo "=== Applying database migrations (backend) ==="
python manage.py migrate

echo "=== Build completed successfully ==="