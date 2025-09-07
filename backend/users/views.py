from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import authenticate
from django.contrib.auth.hashers import make_password
from django.conf import settings
from users.models import CustomUser, UserProfile
from rest_framework_simplejwt.tokens import RefreshToken
from supabase import create_client, Client
import logging
from .serializers import UserProfileSerializer
from rest_framework.permissions import IsAuthenticated

class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserProfileSerializer(request.user.profile)
        return Response(serializer.data)

logger = logging.getLogger(__name__)

class RegisterView(APIView):
    def post(self, request):
        try:
            email = request.data.get("email")
            password = request.data.get("password")
            username = request.data.get("username", email.split("@")[0])

            if not email or not password:
                return Response({"error": "Email и пароль обязательны"}, status=status.HTTP_400_BAD_REQUEST)

            if CustomUser.objects.filter(email=email).exists():
                return Response({"error": "Пользователь с таким email уже существует"}, status=status.HTTP_400_BAD_REQUEST)

            # Создаём пользователя в Django
            user = CustomUser.objects.create(
                email=email,
                username=username,
                password=make_password(password),
            )
            
            # Создаем профиль пользователя
            UserProfile.objects.create(user=user)

            # Пытаемся создать пользователя в Supabase (но не блокируем из-за ошибок)
            try:
                supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
                result = supabase.auth.sign_up({
                    "email": email,
                    "password": password
                })
                
                if hasattr(result, 'error') and result.error:
                    logger.warning(f"Supabase registration warning: {result.error}")
                else:
                    logger.info("User successfully created in Supabase")
                    
            except Exception as e:
                logger.error(f"Supabase error (non-critical): {str(e)}")
                # Не прерываем регистрацию из-за ошибки Supabase

            # JWT токены
            refresh = RefreshToken.for_user(user)

            return Response({
                "message": "Регистрация прошла успешно",
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "username": user.username,
                },
                "tokens": {
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                }
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"Registration error: {str(e)}")
            return Response({"error": "Внутренняя ошибка сервера"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class LoginView(APIView):
    def post(self, request):
        try:
            email = request.data.get("email")
            password = request.data.get("password")

            if not email or not password:
                return Response({"error": "Email и пароль обязательны"}, status=status.HTTP_400_BAD_REQUEST)

            # Аутентификация в Django
            user = authenticate(request, username=email, password=password)
            if not user:
                return Response({"error": "Неверный email или пароль"}, status=status.HTTP_400_BAD_REQUEST)

            # Пытаемся войти в Supabase (но не блокируем из-за ошибок)
            try:
                supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
                result = supabase.auth.sign_in_with_password({
                    "email": email,
                    "password": password
                })
                
                if hasattr(result, 'error') and result.error:
                    logger.warning(f"Supabase login warning: {result.error}")
                else:
                    logger.info("User successfully logged in Supabase")
                    
            except Exception as e:
                logger.error(f"Supabase error (non-critical): {str(e)}")
                # Не прерываем вход из-за ошибки Supabase

            refresh = RefreshToken.for_user(user)

            return Response({
                "message": "Успешный вход",
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "username": user.username,
                },
                "tokens": {
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                }
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Login error: {str(e)}")
            return Response({"error": "Внутренняя ошибка сервера"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)