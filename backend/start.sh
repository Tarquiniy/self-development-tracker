#!/usr/bin/env bash
set -euo pipefail

# Отладочная информация
echo ">>> Starting backend/start.sh"
echo "DJANGO_SETTINGS_MODULE=${DJANGO_SETTINGS_MODULE:-<not set>}"
echo "PORT=${PORT:-<not set>}"

# Выводим важные настройки Django (выполняем в here-doc, чтобы не мешать с кавычками)
python - <<'PY'
from django.conf import settings
import json
print("AUTH_USER_MODEL:", getattr(settings, "AUTH_USER_MODEL", None))
print("DATABASES:", json.dumps(settings.DATABASES, indent=2))
PY

# Ожидаем готовности БД: повторяем migrate до успеха
until python manage.py migrate --noinput --verbosity 1; do
  echo "Waiting for DB to be ready (retrying migrate) ..."
  sleep 3
done

# Собираем статику (повторно на runtime — безопасно)
python manage.py collectstatic --noinput

# Создаём суперпользователя, если заданы переменные окружения
if [ -n "${DJANGO_SUPERUSER_USERNAME:-}" ] && [ -n "${DJANGO_SUPERUSER_EMAIL:-}" ] && [ -n "${DJANGO_SUPERUSER_PASSWORD:-}" ]; then
  python manage.py shell -c "from django.contrib.auth import get_user_model; import os; User=get_user_model(); u=os.environ.get('DJANGO_SUPERUSER_USERNAME'); e=os.environ.get('DJANGO_SUPERUSER_EMAIL'); p=os.environ.get('DJANGO_SUPERUSER_PASSWORD'); \
if not User.objects.filter(username=u).exists(): User.objects.create_superuser(u,e,p)"
fi

# Запускаем gunicorn (PORT предоставляет Render)
exec gunicorn core.wsgi:application --bind 0.0.0.0:"${PORT:-8000}" --workers 3
