#!/usr/bin/env bash
set -o errexit

echo "=== Installing Python dependencies ==="
pip install --upgrade pip
pip install -r requirements.txt

echo "=== Collecting static files ==="
python manage.py collectstatic --noinput --clear

echo "=== Making migrations ==="
python manage.py makemigrations

echo "=== Applying database migrations ==="
python manage.py migrate

echo "=== Build completed successfully ==="