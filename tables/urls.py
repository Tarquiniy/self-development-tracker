# backend/tables/urls.py (или tables/urls.py)
from django.urls import path
from django.http import JsonResponse

def placeholder_tables_api(request):
    return JsonResponse({"detail":"Tables app placeholder - no routes yet"})

urlpatterns = [
    path('', placeholder_tables_api, name='tables-root'),
]
