#!/usr/bin/env bash
# backend/build.sh
# Выполняется во время build-пайплайна. Не выполняем миграции тут — это делает start.sh
set -euo pipefail

echo "=== build.sh started: $(date) ==="

echo "-> Python info:"
python -V || true
echo "-> Pip info:"
pip -V || true

echo "=== Installing Python dependencies ==="
# Обновляем pip, затем устанавливаем зависимости
pip install --upgrade pip
pip install -r requirements.txt

# Сделаем start.sh исполняемым, если он есть (немедленное предупреждение, если нет)
if [ -f "./start.sh" ]; then
  chmod +x ./start.sh || true
fi

if [ -f "./backend/start.sh" ]; then
  chmod +x ./backend/start.sh || true
fi

echo "=== Collecting static files ==="
# Устанавливаем буферизацию вывода, чтобы логи приходили сразу
export PYTHONUNBUFFERED=1

# Собираем статику (не требует БД)
python manage.py collectstatic --noinput

echo "=== build.sh finished: $(date) ==="
