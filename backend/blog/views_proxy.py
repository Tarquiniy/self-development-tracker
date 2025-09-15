# backend/blog/views_proxy.py

import requests
from django.http import JsonResponse
from django.views.decorators.http import require_GET

@require_GET
def wordpress_posts_proxy(request):
    page = request.GET.get('page', '1')
    per_page = request.GET.get('perPage', '10')
    wp_url = f"https://sdblog.infinityfreeapp.com/wp-json/wp/v2/posts?per_page={per_page}&page={page}&_embed"
    try:
        resp = requests.get(wp_url, timeout=10)
    except requests.RequestException as e:
        return JsonResponse({'error': 'Error fetching from WordPress', 'details': str(e)}, status=502)
    if resp.status_code != 200:
        return JsonResponse({'error': 'WordPress returned error', 'status': resp.status_code, 'body': resp.text}, status=resp.status_code)
    try:
        data = resp.json()
    except ValueError as e:
        return JsonResponse({'error': 'Invalid JSON from WordPress', 'body': resp.text[:200]}, status=502)
    return JsonResponse(data, safe=False)
