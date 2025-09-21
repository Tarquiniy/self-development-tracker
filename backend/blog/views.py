import requests
from django.http import JsonResponse
from django.views.decorators.http import require_GET
from django.views.decorators.csrf import csrf_exempt
from django.utils.html import strip_tags
import re

@require_GET
@csrf_exempt
def wordpress_post_content(request, slug):
    """
    Новая функция: возвращает только чистый HTML контент поста
    без обертки в полную HTML страницу
    """
    # Добавляем CORS заголовки
    response = JsonResponse({})
    response["Access-Control-Allow-Origin"] = "https://sdtracker.vercel.app"
    response["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    
    if request.method == "OPTIONS":
        return response

    # Получаем данные поста из WordPress API
    wp_url = f"https://cs88500-wordpress-o0a99.tw1.ru/wp-json/wp/v2/posts?slug={slug}&_embed"
    try:
        resp = requests.get(wp_url, timeout=10)
    except requests.RequestException as e:
        return JsonResponse({
            'error': 'Failed to fetch from WordPress',
            'details': str(e)
        }, status=502)

    if resp.status_code != 200:
        return JsonResponse({
            'error': 'WordPress returned error',
            'status': resp.status_code
        }, status=resp.status_code)

    data = resp.json()
    if not data:
        return JsonResponse({'error': 'Post not found'}, status=404)

    post = data[0]
    
    # Извлекаем чистый HTML контент
    content = post.get('content', {}).get('rendered', '')
    
    # Очищаем контент от потенциально опасных тегов
    def clean_html(html):
        # Разрешаем только безопасные теги
        allowed_tags = [
            'p', 'br', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'span',
            'table', 'tr', 'td', 'th', 'tbody', 'thead',
            'a', 'img', 'blockquote', 'code', 'pre'
        ]
        
        # Базовая очистка
        clean_html = re.sub(r'<script.*?</script>', '', html, flags=re.DOTALL)
        clean_html = re.sub(r'<style.*?</style>', '', clean_html, flags=re.DOTALL)
        clean_html = re.sub(r'on\w+=".*?"', '', clean_html)
        clean_html = re.sub(r'on\w+=\'.*?\'', '', clean_html)
        
        return clean_html

    # Возвращаем чистый контент
    return JsonResponse({
        'title': post.get('title', {}).get('rendered', ''),
        'content': clean_html(content),
        'date': post.get('date', ''),
        'featured_image': post.get('featured_media', None)
    })