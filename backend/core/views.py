# backend/core/views.py
from django.http import JsonResponse


def health_check(request):
    """
    Простой health-check эндпоинт для проверки доступности backend
    """
    return JsonResponse({"status": "ok", "message": "Django backend is running"})
