import requests
from django.http import HttpResponse, JsonResponse
from django.views.decorators.http import require_GET, require_http_methods
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from .models import PostReaction
from .serializers import PostReactionSerializer
from django.db import transaction
import logging

logger = logging.getLogger(__name__)

@require_GET
@csrf_exempt
def wordpress_post_html(request, slug):
    # Добавляем правильные CORS и X-Frame-Options заголовки
    response = HttpResponse()
    response["Access-Control-Allow-Origin"] = "https://sdtracker.vercel.app"
    response["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response["X-Frame-Options"] = "ALLOW-FROM https://sdtracker.vercel.app"
    response["Content-Security-Policy"] = "frame-ancestors 'self' https://sdtracker.vercel.app"
    
    if request.method == "OPTIONS":
        return response

    # Получаем данные поста из WordPress API
    wp_url = f"https://cs88500-wordpress-o0a99.tw1.ru/wp-json/wp/v2/posts?slug={slug}&_embed"
    try:
        resp = requests.get(wp_url, timeout=10)
    except requests.RequestException as e:
        return HttpResponse(f"Failed to fetch from WordPress: {str(e)}", status=502)

    if resp.status_code != 200:
        return HttpResponse(f"WordPress returned error: {resp.status_code}", status=resp.status_code)

    data = resp.json()
    if not data:
        return HttpResponse("Post not found", status=404)

    post = data[0]
    content = post.get('content', {}).get('rendered', '')
    title = post.get('title', {}).get('rendered', '')

    # Получаем CSS стили из заголовка WordPress
    wp_home_url = "https://cs88500-wordpress-o0a99.tw1.ru"
    try:
        home_resp = requests.get(wp_home_url, timeout=10)
        stylesheets = []
        if home_resp.status_code == 200:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(home_resp.text, 'html.parser')
            for link in soup.find_all('link', rel='stylesheet'):
                href = link.get('href')
                if href and 'wp-content' in href:
                    stylesheets.append(href)
    except:
        # Fallback: используем стандартные стили темы
        stylesheets = [
            "https://cs88500-wordpress-o0a99.tw1.ru/wp-content/themes/twentytwentyfive/style.css",
            "https://cs88500-wordpress-o0a99.tw1.ru/wp-content/themes/twentytwentyfive/assets/css/print.css",
            "https://cs88500-wordpress-o0a99.tw1.ru/wp-includes/css/dist/block-library/style.min.css"
        ]

    # Строим HTML-ответ
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>{title}</title>
        <style>
            body {{
                margin: 0;
                padding: 20px;
                background: #fff;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
            }}
            .wp-container {{
                max-width: 800px;
                margin: 0 auto;
            }}
        </style>
        {"".join([f'<link rel="stylesheet" href="{url}">' for url in stylesheets])}
    </head>
    <body>
        <div class="wp-container">
            {content}
        </div>
    </body>
    </html>
    """

    response.content = html
    return response

@api_view(['GET'])
@permission_classes([AllowAny])
def reaction_detail(request):
    """
    GET /api/blog/reactions/?post_identifier=<slug_or_id>
    """
    try:
        identifier = request.query_params.get('post_identifier')
        if not identifier:
            return Response({'detail': 'Missing post_identifier'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Логируем запрос
        logger.info(f"Reaction detail request for: {identifier}")
        
        obj, created = PostReaction.objects.get_or_create(post_identifier=identifier)
        serializer = PostReactionSerializer(obj, context={'request': request})
        
        return Response(serializer.data)
        
    except Exception as e:
        logger.error(f"Error in reaction_detail: {str(e)}")
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def reaction_toggle(request):
    """
    POST /api/blog/reactions/toggle/
    """
    try:
        identifier = request.data.get('post_identifier')
        if not identifier:
            return Response({'detail': 'Missing post_identifier'}, status=status.HTTP_400_BAD_REQUEST)

        logger.info(f"Reaction toggle request for: {identifier}")

        with transaction.atomic():
            obj, created = PostReaction.objects.get_or_create(post_identifier=identifier)
            user = request.user if request.user and request.user.is_authenticated else None

            if user:
                if obj.users.filter(pk=user.pk).exists():
                    obj.users.remove(user)
                    action = "removed"
                else:
                    obj.users.add(user)
                    action = "added"
                obj.save()
            else:
                if obj.anon_count > 0:
                    obj.anon_count = max(0, obj.anon_count - 1)
                    action = "decremented"
                else:
                    obj.anon_count = obj.anon_count + 1
                    action = "incremented"
                obj.save()

        logger.info(f"Reaction {action} for {identifier}")
        serializer = PostReactionSerializer(obj, context={'request': request})
        return Response(serializer.data)
        
    except Exception as e:
        logger.error(f"Error in reaction_toggle: {str(e)}")
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# Добавляем обработку OPTIONS для остальных views
@require_http_methods(["GET", "OPTIONS"])
@csrf_exempt
def wordpress_posts(request):
    # Добавляем CORS заголовки для OPTIONS запросов
    if request.method == "OPTIONS":
        response = HttpResponse()
        response["Access-Control-Allow-Origin"] = "https://sdtracker.vercel.app"
        response["Access-Control-Allow-Methods"] = "GET, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        return response

    # получаем параметры page и per_page из запроса фронтенда
    page = request.GET.get('page', '1')
    per_page = request.GET.get('perPage', '10')
    # формируем URL WordPress API
    wp_url = f"https://sdtracker.wordpress.com/wp-json/wp/v2/posts?per_page={per_page}&page={page}&_embed"

    try:
        resp = requests.get(wp_url, timeout=10)
    except requests.RequestException as e:
        return JsonResponse({'error': 'Failed to fetch from WordPress', 'details': str(e)}, status=502)

    if resp.status_code != 200:
        return JsonResponse({'error': 'WordPress returned error', 'status': resp.status_code, 'body': resp.text}, status=resp.status_code)

    data = resp.json()
    
    # Добавляем CORS заголовки для основного ответа
    response = JsonResponse(data, safe=False)
    response["Access-Control-Allow-Origin"] = "https://sdtracker.vercel.app"
    return response