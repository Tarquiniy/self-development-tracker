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
    return JsonResponse(data, safe=False)

@api_view(['GET'])
@permission_classes([AllowAny])
def reaction_detail(request):
    """
    GET /api/blog/reactions/?post_identifier=<slug_or_id>
    Возвращает obj с likes_count и liked_by_current_user.
    """
    identifier = request.query_params.get('post_identifier')
    if not identifier:
        return Response({'detail': 'Missing post_identifier'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        obj = PostReaction.objects.get(post_identifier=identifier)
    except PostReaction.DoesNotExist:
        # пустая запись — ноль лайков
        obj = PostReaction(post_identifier=identifier)
        obj.save()
    serializer = PostReactionSerializer(obj, context={'request': request})
    return Response(serializer.data)

@api_view(['POST'])
@permission_classes([AllowAny])
def reaction_toggle(request):
    """
    POST /api/blog/reactions/toggle/
    body: { post_identifier: "slug-or-id" }
    Логика:
      - Если авторизован: переключаем связь в M2M users (т.е. ставим/снимаем лайк).
      - Если неавторизован: для простоты — инкрементируем anon_count при лайке, декремент при снятии.
    Для анонимов мы не делаем строгой защиты — можно улучшить через cookie+uuid или IP throttling.
    """
    identifier = request.data.get('post_identifier')
    if not identifier:
        return Response({'detail': 'Missing post_identifier'}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        obj, created = PostReaction.objects.get_or_create(post_identifier=identifier)
        user = request.user if request.user and request.user.is_authenticated else None

        if user:
            if obj.users.filter(pk=user.pk).exists():
                obj.users.remove(user)
            else:
                obj.users.add(user)
            obj.save()
        else:
            # простая логика: если anon_count == 0 -> увеличиваем; if >0 -> уменьшаем
            # Это простейшая toggle; можно заменить на проверку cookie/uuid для уникальности.
            if obj.anon_count > 0:
                obj.anon_count = max(0, obj.anon_count - 1)
            else:
                obj.anon_count = obj.anon_count + 1
            obj.save()

    serializer = PostReactionSerializer(obj, context={'request': request})
    return Response(serializer.data)
