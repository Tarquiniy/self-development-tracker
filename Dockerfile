FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install -r requirements.txt

# Кладём код backend/ в /app так, чтобы /app/core/* был импортируемым как core.*.
COPY backend/ .

RUN python manage.py collectstatic --noinput

EXPOSE 8000

CMD ["gunicorn", "core.wsgi:application", "--bind", "0.0.0.0:8000"]