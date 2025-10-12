# backend/core/cors_middleware.py
from django import http
from django.utils.deprecation import MiddlewareMixin

class CorsMiddleware(MiddlewareMixin):
    def process_response(self, request, response):
        # Добавляем CORS заголовки ко всем ответам
        origin = request.META.get('HTTP_ORIGIN')
        
        allowed_origins = [
            "https://sdtracker.vercel.app",
            "http://localhost:3000", 
            "http://127.0.0.1:3000",
            "https://cs88500-wordpress-o0a99.tw1.ru",
            "https://sdracker.onrender.com",
            "https://positive-theta.vercel.app",
        ]
        
        if origin in allowed_origins:
            response['Access-Control-Allow-Origin'] = origin
            response['Access-Control-Allow-Credentials'] = 'true'
            response['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
            response['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-CSRFToken, X-Requested-With'
            response['Access-Control-Expose-Headers'] = 'Content-Type, X-CSRFToken'
        
        return response