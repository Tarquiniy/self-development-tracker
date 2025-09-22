# backend/blog/views_proxy.py

import requests
from django.http import JsonResponse, HttpResponse
from django.views.decorators.http import require_GET
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
import logging

logger = logging.getLogger(__name__)

# Your WordPress site URL
WP_BASE_URL = "https://cs88500-wordpress-o0a99.tw1.ru"
WP_HTML_API_URL = f"{WP_BASE_URL}/wp-json/cs/v1/post"

@require_GET
def wordpress_posts_proxy(request):
    page = request.GET.get('page', '1')
    per_page = request.GET.get('perPage', '10')
    wp_url = f"{WP_BASE_URL}/wp-json/wp/v2/posts?per_page={per_page}&page={page}&_embed"
    
    try:
        resp = requests.get(wp_url, timeout=10)
    except requests.RequestException as e:
        return JsonResponse({'error': 'Failed to fetch from WP', 'details': str(e)}, status=502)

    if resp.status_code != 200:
        return JsonResponse({'error': 'WP status not 200', 'status': resp.status_code}, status=resp.status_code)

    try:
        data = resp.json()
    except ValueError:
        return JsonResponse({'error': 'Invalid JSON', 'body': resp.text[:200]}, status=502)

    return JsonResponse(data, safe=False)

@api_view(['GET'])
@permission_classes([AllowAny])
def wordpress_post_html_proxy(request, post_identifier):
    """
    New endpoint to get fully rendered HTML from WordPress
    Supports both post ID and slug
    """
    # Determine if identifier is ID or slug
    if post_identifier.isdigit():
        url = f"{WP_HTML_API_URL}/{post_identifier}/html"
    else:
        url = f"{WP_HTML_API_URL}/slug/{post_identifier}/html"
    
    try:
        logger.info(f"Fetching HTML from WordPress: {url}")
        resp = requests.get(url, timeout=15)
        
        if resp.status_code != 200:
            logger.error(f"WordPress HTML API error: {resp.status_code} - {resp.text}")
            return JsonResponse(
                {'error': 'Failed to fetch rendered HTML from WordPress', 'status': resp.status_code}, 
                status=resp.status_code
            )
        
        data = resp.json()
        return JsonResponse(data)
        
    except requests.RequestException as e:
        logger.error(f"Request to WordPress HTML API failed: {str(e)}")
        return JsonResponse(
            {'error': 'Connection to WordPress failed', 'details': str(e)}, 
            status=502
        )
    except ValueError as e:
        logger.error(f"Invalid JSON from WordPress HTML API: {str(e)}")
        return JsonResponse(
            {'error': 'Invalid response from WordPress', 'details': str(e)}, 
            status=502
        )