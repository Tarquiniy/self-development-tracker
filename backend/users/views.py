import logging
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from rest_framework_simplejwt.tokens import RefreshToken
from .models import CustomUser
from .telegram_utils import verify_telegram_authentication
from .telegram_utils import check_telegram_auth
from django.conf import settings
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model, authenticate
from django.utils import timezone
from .models import UserProfile
from .serializers import UserSerializer, UserProfileSerializer, UserRegistrationSerializer, TelegramAuthSerializer
from .telegram_utils import check_telegram_auth

logger = logging.getLogger(__name__)
User = get_user_model()

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def auth_test(request):
    return Response({"message": "Auth API is working"})

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def register_user(request):
    serializer = UserRegistrationSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()

        # Create user profile
        UserProfile.objects.create(user=user)

        # Generate tokens
        refresh = RefreshToken.for_user(user)

        # TODO: Добавить аналитику после создания модели AnalyticsUserRegistration
        # AnalyticsUserRegistration.objects.create(
        #     user=user,
        #     registration_method='email',
        #     details={'source': 'direct_registration'}
        # )

        return Response({
            'user': UserSerializer(user).data,
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def login_user(request):
    email = request.data.get('email')
    password = request.data.get('password')

    user = authenticate(request, email=email, password=password)

    if user is not None:
        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserSerializer(user).data,
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        })

    return Response(
        {'error': 'Invalid credentials'},
        status=status.HTTP_401_UNAUTHORIZED
    )

@api_view(['GET'])
def get_user_profile(request):
    profile = request.user.profile
    serializer = UserProfileSerializer(profile)
    return Response(serializer.data)

@api_view(['POST'])
@permission_classes([AllowAny])
@csrf_exempt
def telegram_auth(request):
    """
    Обработчик аутентификации через Telegram Web App
    """
    try:
        logger.info("Telegram auth request received")
        
        # Получаем данные из запроса
        if request.content_type == 'application/json':
            telegram_data = request.data
        else:
            telegram_data = request.POST.dict()

        logger.debug(f"Telegram data: {telegram_data}")

        # Проверяем наличие обязательных полей
        if not telegram_data.get('hash'):
            return JsonResponse({
                'error': 'Missing authentication hash'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Верифицируем данные Telegram
        try:
            verified_data = verify_telegram_authentication(
                settings.TELEGRAM_BOT_TOKEN,
                telegram_data
            )
        except Exception as e:
            logger.error(f"Telegram auth verification failed: {str(e)}")
            return JsonResponse({
                'error': 'Telegram authentication failed',
                'details': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

        telegram_id = str(verified_data['id'])
        username = verified_data.get('username', '')
        first_name = verified_data.get('first_name', '')
        last_name = verified_data.get('last_name', '')

        logger.info(f"Processing Telegram auth for user ID: {telegram_id}")

        # Ищем или создаем пользователя
        try:
            user = User.objects.get(telegram_id=telegram_id)
            logger.info(f"Found existing user: {user.username}")
            
            # Обновляем данные пользователя
            user.telegram_username = username
            user.first_name = first_name
            user.last_name = last_name
            user.save()
            
        except User.DoesNotExist:
            # Создаем нового пользователя
            username = f"tg_{telegram_id}" if not username else username
            user = User.objects.create(
                username=username,
                telegram_id=telegram_id,
                telegram_username=username,
                first_name=first_name,
                last_name=last_name,
                registration_method='telegram'
            )
            UserProfile.objects.create(user=user)
            logger.info(f"Created new user: {username}")

        # Генерируем JWT токены
        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)

        # Формируем ответ
        response_data = {
            'status': 'success',
            'user': {
                'id': user.id,
                'email': user.email or '',
                'username': user.username,
                'telegram_id': user.telegram_id,
                'telegram_username': user.telegram_username,
                'first_name': user.first_name,
                'last_name': user.last_name
            },
            'tokens': {
                'refresh': str(refresh),
                'access': access_token,
            }
        }

        # Устанавливаем access token в cookie для автоматической аутентификации
        response = JsonResponse(response_data)
        response.set_cookie(
            key='access_token',
            value=access_token,
            httponly=True,
            secure=not settings.DEBUG,
            samesite='Lax',
            max_age=60 * 60 * 24 * 7  # 1 неделя
        )
        
        return response

    except Exception as e:
        logger.error(f"Telegram auth error: {str(e)}")
        return JsonResponse({
            'status': 'error',
            'message': 'Internal server error',
            'details': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
@csrf_exempt
def telegram_login(request):
    """
    Обрабатывает POST-запрос от фронта после авторизации в Telegram Login Widget.
    Проверяет подпись данных и выдает JWT-токены.
    """
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=400)

    try:
        data = json.loads(request.body)
        logger.info(f"Telegram login attempt: {data}")
    except Exception as e:
        logger.error(f"Error parsing JSON: {e}")
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    # Добавьте проверку обязательных полей
    required_fields = ['id', 'hash', 'auth_date']
    for field in required_fields:
        if field not in data:
            logger.error(f"Missing required field: {field}")
            return JsonResponse({"error": f"Missing required field: {field}"}, status=400)

    if not check_telegram_auth(data):
        logger.error("Telegram auth validation failed")
        return JsonResponse({"error": "Invalid Telegram auth"}, status=400)

    telegram_id = data.get("id")
    username = data.get("username") or f"user{telegram_id}"

    try:
        # либо находим, либо создаём пользователя
        user, created = CustomUser.objects.get_or_create(
            telegram_id=telegram_id,
            defaults={
                "username": username,
                "registration_method": "telegram",
                "telegram_username": username,
                "telegram_data": data,
            },
        )

        # обновляем данные, если уже есть
        if not created:
            user.telegram_username = username
            user.telegram_data = data
            user.save(update_fields=["telegram_username", "telegram_data"])

        refresh = RefreshToken.for_user(user)

        logger.info(f"Successful Telegram login for user: {user.username}")

        return JsonResponse(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "telegram_id": user.telegram_id,
                }
            }
        )

    except Exception as e:
        logger.error(f"Error during Telegram login: {e}")
        return JsonResponse({"error": "Internal server error"}, status=500)
