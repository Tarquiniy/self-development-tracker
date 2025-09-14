import requests
from django.http import JsonResponse, HttpResponse
from django.views.decorators.http import require_GET

@require_GET
def wordpress_post_by_slug(request, slug):
    wp_url = f"https://sdtracker.wordpress.com/wp-json/wp/v2/posts?slug={slug}&_embed"
    try:
        resp = requests.get(wp_url, timeout=10)
    except requests.RequestException as e:
        return JsonResponse({'error': 'Failed to fetch from WordPress', 'details': str(e)}, status=502)

    if resp.status_code != 200:
        return JsonResponse({'error': 'WordPress returned error', 'status': resp.status_code, 'body': resp.text}, status=resp.status_code)

    arr = resp.json()
    if not isinstance(arr, list) or len(arr) == 0:
        return JsonResponse({'error': 'Post not found'}, status=404)
    return JsonResponse(arr[0], safe=False)
