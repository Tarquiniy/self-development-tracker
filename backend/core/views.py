# backend/core/views.py
from django.http import JsonResponse
from django.shortcuts import render
from blog.models import Post

def health_check(request):
    """
    Простой health-check эндпоинт для проверки доступности backend
    """
    return JsonResponse({"status": "ok", "message": "Django backend is running"})

def search_view(request):
    query = request.GET.get("q", "").strip()
    results = Post.objects.filter(title__icontains=query) if query else []
    return render(request, "search/results.html", {
        "query": query,
        "results": results,
    })