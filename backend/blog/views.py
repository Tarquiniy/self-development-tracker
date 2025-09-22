import requests
from django.http import JsonResponse, HttpResponse
from django.views.decorators.http import require_GET
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from .models import PostReaction
from .serializers import PostReactionSerializer
from django.db import transaction

@require_GET
def wordpress_posts(request):
    page = request.GET.get('page', '1')
    per_page = request.GET.get('perPage', '10')
    wp_url = f"https://cs88500-wordpress-o0a99.tw1.ru/wp-json/wp/v2/posts?per_page={per_page}&page={page}&_embed"

    try:
        resp = requests.get(wp_url, timeout=10)
    except requests.RequestException as e:
        return JsonResponse({'error': 'Failed to fetch from WordPress', 'details': str(e)}, status=502)

    if resp.status_code != 200:
        return JsonResponse({'error': 'WordPress returned error', 'status': resp.status_code, 'body': resp.text}, status=resp.status_code)

    data = resp.json()
    return JsonResponse(data, safe=False)

@api_view(['GET'])
@permission_classes([AllowAny])
def wordpress_post_with_styles(request, post_id):
    """
    Get WordPress post with styles
    """
    wp_url = f"https://cs88500-wordpress-o0a99.tw1.ru/wp-json/sdtracker/v1/post/{post_id}"
    
    try:
        resp = requests.get(wp_url, timeout=10)
    except requests.RequestException as e:
        return Response({'error': 'Failed to fetch from WordPress', 'details': str(e)}, status=502)

    if resp.status_code != 200:
        return Response({'error': 'WordPress returned error', 'status': resp.status_code, 'body': resp.text}, status=resp.status_code)

    data = resp.json()
    return Response(data)