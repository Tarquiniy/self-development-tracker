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

logger = logging.getLogger(__name__)

# Инициализация Supabase клиента
supabase_url = os.environ.get('SUPABASE_URL', settings.SUPABASE_URL)
supabase_key = os.environ.get('SUPABASE_KEY', settings.SUPABASE_KEY)
supabase: Client = create_client(supabase_url, supabase_key)


@method_decorator(csrf_exempt, name='dispatch')
class RegisterView(APIView):
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

            # Проверяем существование пользователя в Supabase
            existing_users = supabase.table('users').select('*').eq('email', email).execute()
            if existing_users.data:
                return Response({"error": "Пользователь с таким email уже существует"}, status=status.HTTP_400_BAD_REQUEST)

            # 1. Регистрируем пользователя в Supabase Auth
            auth_response = supabase.auth.sign_up({
                "email": email,
                "password": password,
            })

            if auth_response.user:
                # 2. Создаем запись в таблице users Supabase
                user_data = {
                    "id": auth_response.user.id,
                    "email": email,
                    "username": username,
                    "created_at": "now()"
                }
                
                # Вставляем данные в таблицу users
                supabase_response = supabase.table("users").insert(user_data).execute()
                
                # 3. Создаем пользователя в Django (для админки и внутренней логики)
                user = CustomUser.objects.create(
                    email=email,
                    username=username,
                    registration_method="email",
                    supabase_uid=auth_response.user.id
                )
                user.set_unusable_password()
                user.save()

                # 4. Создаем профиль пользователя
                UserProfile.objects.create(user=user)

                # 5. Генерируем JWT токены
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

            return Response({"error": "Ошибка регистрации в Supabase"}, status=status.HTTP_400_BAD_REQUEST)

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

            # Аутентифицируем пользователя в Supabase
            auth_response = supabase.auth.sign_in_with_password({
                "email": email,
                "password": password
            })

            if auth_response.user:
                # Ищем или создаем пользователя в Django
                try:
                    user = CustomUser.objects.get(email=email)
                    # Обновляем supabase_uid если необходимо
                    if not user.supabase_uid:
                        user.supabase_uid = auth_response.user.id
                        user.save()
                except CustomUser.DoesNotExist:
                    # Создаем нового пользователя в Django
                    user = CustomUser.objects.create(
                        email=email,
                        username=email.split("@")[0],
                        registration_method="email",
                        supabase_uid=auth_response.user.id
                    )
                    user.set_unusable_password()
                    user.save()
                    # Создаем профиль
                    UserProfile.objects.create(user=user)

                # Генерируем JWT токены
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