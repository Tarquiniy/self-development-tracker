import os
import json
import logging
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from users.models import CustomUser, UserProfile
from rest_framework_simplejwt.tokens import RefreshToken
from supabase import create_client, Client
from .serializers import UserProfileSerializer
from rest_framework.permissions import IsAuthenticated
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.contrib.auth.hashers import make_password
from django.db import IntegrityError

logger = logging.getLogger(__name__)

# Инициализация Supabase клиента
supabase_url = os.environ.get('SUPABASE_URL', settings.SUPABASE_URL)
supabase_key = os.environ.get('SUPABASE_KEY', settings.SUPABASE_KEY)
supabase: Client = create_client(supabase_url, supabase_key)


@method_decorator(csrf_exempt, name='dispatch')
class LoginView(APIView):
    def post(self, request):
        try:
            logger.info(f"Login attempt - raw data: {request.body}")
            
            # Парсим данные из запроса
            if isinstance(request.data, dict):
                data = request.data
            else:
                try:
                    data = json.loads(request.body.decode('utf-8'))
                except json.JSONDecodeError as e:
                    logger.error(f"JSON decode error: {str(e)}")
                    return Response({"error": "Invalid JSON format"}, status=status.HTTP_400_BAD_REQUEST)

            email = data.get("email")
            password = data.get("password")
            username = data.get("username", email.split("@")[0] if email else "")
            logger.info(f"Login attempt for email: {email}")

            if not email or not password:
                logger.warning("Missing email or password")
                return Response({"error": "Email и пароль обязательны"}, status=status.HTTP_400_BAD_REQUEST)

            # Проверяем существование пользователя в Django
            if CustomUser.objects.filter(email=email).exists():
                return Response({"error": "Пользователь с таким email уже существует"}, status=status.HTTP_400_BAD_REQUEST)

            # 1. Регистрируем пользователя в Supabase Auth
            try:
                auth_response = supabase.auth.sign_up({
                    "email": email,
                    "password": password,
                })

                if not auth_response.user:
                    return Response({"error": "Ошибка регистрации в Supabase"}, status=status.HTTP_400_BAD_REQUEST)

                # 2. Создаем пользователя в Django
                user = CustomUser.objects.create(
                    email=email,
                    username=username,
                    password=make_password(password),  # Хэшируем пароль
                    registration_method="email",
                    supabase_uid=auth_response.user.id
                )

                # 3. Создаем профиль пользователя
                UserProfile.objects.create(user=user)

                # 4. Генерируем JWT токены
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
                logger.error(f"Supabase registration error: {str(e)}")
                return Response({"error": "Ошибка регистрации в Supabase"}, status=status.HTTP_400_BAD_REQUEST)

        except IntegrityError:
            return Response({"error": "Пользователь с таким email уже существует"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Registration error: {str(e)}")
            return Response({"error": f"Ошибка регистрации: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@method_decorator(csrf_exempt, name='dispatch')
class LoginView(APIView):
    def post(self, request):
        try:
            # Парсим данные из запроса
            if isinstance(request.data, dict):
                data = request.data
            else:
                data = json.loads(request.body.decode('utf-8'))

            email = data.get("email")
            password = data.get("password")

            if not email or not password:
                return Response({"error": "Email и пароль обязательны"}, status=status.HTTP_400_BAD_REQUEST)

            # 1. Пытаемся найти пользователя в Django
            try:
                user = CustomUser.objects.get(email=email)
                logger.info(f"User found: {user.id}, password set: {bool(user.password)}")
                                
                # 2. Проверяем пароль через Django
                if not user.check_password(password):
                    logger.warning(f"Password mismatch for user: {email}")
                    # Проверяем, не используется ли unusable password
                    if user.password.startswith('!'):
                        logger.error("User has unusable password")
                    return Response({"error": "Неверный email или пароль"}, status=status.HTTP_400_BAD_REQUEST)

                # 3. Генерируем JWT токены
                refresh = RefreshToken.for_user(user)
                logger.info(f"Login successful for user: {user.id}")

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

            except CustomUser.DoesNotExist:
                logger.warning(f"User not found: {email}")
                return Response({"error": "Неверный email или пароль"}, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.error(f"Login error: {str(e)}")
            return Response({"error": "Неверный email или пароль"}, status=status.HTTP_400_BAD_REQUEST)


class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            user = request.user
            profile, created = UserProfile.objects.get_or_create(user=user)
            serializer = UserProfileSerializer({
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "username": user.username,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "phone": user.phone,
                },
                "subscription_active": profile.subscription_active,
                "subscription_expires": profile.subscription_expires,
                "tables_limit": profile.tables_limit,
            })
            return Response(serializer.data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def put(self, request):
        try:
            user = request.user
            profile = UserProfile.objects.get(user=user)

            # Обновление данных пользователя
            if "first_name" in request.data:
                user.first_name = request.data["first_name"]
            if "last_name" in request.data:
                user.last_name = request.data["last_name"]
            if "phone" in request.data:
                user.phone = request.data["phone"]
            user.save()

            # Обновление данных профиля
            if "subscription_active" in request.data:
                profile.subscription_active = request.data["subscription_active"]
            if "subscription_expires" in request.data:
                profile.subscription_expires = request.data["subscription_expires"]
            if "tables_limit" in request.data:
                profile.tables_limit = request.data["tables_limit"]
            profile.save()

            serializer = UserProfileSerializer({
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "username": user.username,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "phone": user.phone,
                },
                "subscription_active": profile.subscription_active,
                "subscription_expires": profile.subscription_expires,
                "tables_limit": profile.tables_limit,
            })
            return Response(serializer.data)
        except UserProfile.DoesNotExist:
            return Response({"error": "Profile not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
@method_decorator(csrf_exempt, name='dispatch')
class DebugAuthView(APIView):
    def post(self, request):
        """Endpoint для отладки аутентификации"""
        try:
            data = json.loads(request.body.decode('utf-8'))
            email = data.get('email')
            password = data.get('password')
            
            logger.info(f"Debug auth - Email: {email}, Password: {password}")
            
            # Проверяем существование пользователя
            try:
                user = CustomUser.objects.get(email=email)
                response_data = {
                    'user_exists': True,
                    'has_password': bool(user.password),
                    'password_is_unusable': user.password.startswith('!') if user.password else False,
                    'registration_method': user.registration_method
                }
                
                # Проверяем пароль
                if user.password and not user.password.startswith('!'):
                    password_valid = user.check_password(password)
                    response_data['password_valid'] = password_valid
                
                return Response(response_data)
                
            except CustomUser.DoesNotExist:
                return Response({'user_exists': False})
                
        except Exception as e:
            return Response({'error': str(e)})
        
@method_decorator(csrf_exempt, name='dispatch')
class RegisterView(APIView):  # Убедитесь, что этот класс существует
    def post(self, request):
        try:
            # Парсим данные из запроса
            if isinstance(request.data, dict):
                data = request.data
            else:
                data = json.loads(request.body.decode('utf-8'))

            email = data.get("email")
            password = data.get("password")
            username = data.get("username", email.split("@")[0] if email else "")

            if not email or not password:
                return Response({"error": "Email и пароль обязательны"}, status=status.HTTP_400_BAD_REQUEST)

            # Проверяем существование пользователя в Django
            if CustomUser.objects.filter(email=email).exists():
                return Response({"error": "Пользователь с таким email уже существует"}, status=status.HTTP_400_BAD_REQUEST)

            # Создаем пользователя
            user = CustomUser.objects.create(
                email=email,
                username=username,
                password=make_password(password),
                registration_method="email"
            )

            # Создаем профиль пользователя
            UserProfile.objects.create(user=user)

            # Генерируем JWT токены
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
            return Response({"error": f"Ошибка регистрации: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)