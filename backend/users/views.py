import logging
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model, authenticate
from django.utils import timezone
from .models import UserProfile
from .serializers import UserSerializer, UserProfileSerializer, UserRegistrationSerializer, TelegramAuthSerializer
from .telegram_utils import verify_telegram_authentication

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
@permission_classes([permissions.AllowAny])
def telegram_auth(request):
    """
    Обработчик аутентификации через Telegram
    """
    logger.info("Telegram auth request received")
    
    serializer = TelegramAuthSerializer(data=request.data)
    
    if not serializer.is_valid():
        logger.warning(f"Telegram auth validation failed: {serializer.errors}")
        return Response(
            {'error': 'Invalid Telegram data', 'details': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        telegram_data = serializer.validated_data
        telegram_id = str(telegram_data['id'])
        
        logger.info(f"Processing Telegram auth for user ID: {telegram_id}")
        
        try:
            # Поиск существующего пользователя
            user = User.objects.get(telegram_id=telegram_id)
            logger.info(f"Found existing user: {user.username}")
            
            # Обновление данных пользователя
            user.telegram_username = telegram_data.get('username', user.telegram_username)
            user.first_name = telegram_data.get('first_name', user.first_name)
            user.last_name = telegram_data.get('last_name', user.last_name)
            user.save()
            
        except User.DoesNotExist:
            # Создание нового пользователя
            username = f"tg_{telegram_id}"
            logger.info(f"Creating new user: {username}")
            
            user = User.objects.create(
                username=username,
                telegram_id=telegram_id,
                telegram_username=telegram_data.get('username', ''),
                first_name=telegram_data.get('first_name', ''),
                last_name=telegram_data.get('last_name', ''),
                registration_method='telegram'
            )
            
            # Создание профиля пользователя
            UserProfile.objects.create(user=user)
            logger.info(f"User profile created for: {username}")

        # Генерация JWT токенов
        refresh = RefreshToken.for_user(user)
        
        logger.info(f"Successful Telegram auth for user: {user.username}")
        
        return Response({
            'user': UserSerializer(user).data,
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        })
    
    except Exception as e:
        logger.error(f"Telegram auth error: {str(e)}")
        return Response(
            {'error': 'Internal server error during authentication'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )