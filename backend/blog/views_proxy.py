import requests
from django.http import JsonResponse, HttpResponse
from django.views.decorators.http import require_GET
from django.views.decorators.csrf import csrf_exempt

@require_GET
def wordpress_posts_proxy(request):
    page = request.GET.get('page', '1')
    per_page = request.GET.get('perPage', '10')
    # Используй правильный WP домен на InfinityFree
    wp_url = f"https://sdblog.infinityfreeapp.com/wp-json/wp/v2/posts?per_page={per_page}&page={page}&_embed"

    try:
        resp = requests.get(wp_url, timeout=10)
    except requests.RequestException as e:
        return JsonResponse({'error': 'Failed to fetch from WP', 'details': str(e)}, status=502)

    # Даже если 200, тело может быть HTML (если WP не отвечает как API)
    if resp.status_code != 200:
        return JsonResponse({'error': 'WordPress returned non-200', 'status': resp.status_code, 'body': resp.text[:200]}, status=resp.status_code)

    # Проверяем, JSON ли на самом деле
    try:
        data = resp.json()
    except ValueError:
        return JsonResponse({'error': 'Invalid JSON from WP', 'body': resp.text[:200]}, status=502)

    return JsonResponse(data, safe=False)
