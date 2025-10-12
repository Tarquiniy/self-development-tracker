# backend/core/views.py
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

@csrf_exempt
def cors_test(request):
    """Endpoint для тестирования CORS"""
    return JsonResponse({
        "status": "CORS test successful", 
        "message": "CORS headers are working correctly",
        "origin": request.META.get('HTTP_ORIGIN', 'Not provided')
    })