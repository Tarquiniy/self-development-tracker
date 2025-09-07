from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from users.models import CustomUser, UserProfile
from rest_framework_simplejwt.tokens import RefreshToken
from supabase import create_client, Client
import logging

logger = logging.getLogger(__name__)
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

class RegisterView(APIView):
    def post(self, request):
        email = request.data.get("email")
        password = request.data.get("password")
        username = request.data.get("username", email.split("@")[0])

        if not email or not password:
            return Response({"error": "Email и пароль обязательны"}, status=status.HTTP_400_BAD_REQUEST)

        # Проверяем существование пользователя в Django
        if CustomUser.objects.filter(email=email).exists():
            return Response({"error": "Пользователь с таким email уже существует"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Регистрируем пользователя в Supabase
            auth_response = supabase.auth.sign_up({
                "email": email,
                "password": password,
                "options": {
                    "data": {
                        "username": username,
                        "registration_method": "email"
                    }
                }
            })

            if auth_response.user:
                # Создаем пользователя в Django
                user = CustomUser.objects.create(
                    email=email,
                    username=username,
                    registration_method='email',
                    supabase_uid=auth_response.user.id
                )
                user.set_unusable_password()  # Не храним пароль в Django
                user.save()

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
            else:
                return Response({"error": "Ошибка регистрации в Supabase"}, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.error(f"Registration error: {str(e)}")
            return Response({"error": f"Ошибка регистрации: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class LoginView(APIView):
    def post(self, request):
        email = request.data.get("email")
        password = request.data.get("password")

        if not email or not password:
            return Response({"error": "Email и пароль обязательны"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Аутентифицируем пользователя в Supabase
            auth_response = supabase.auth.sign_in_with_password({
                "email": email,
                "password": password
            })

            if auth_response.user:
                # Ищем или создаем пользователя в Django
                user, created = CustomUser.objects.get_or_create(
                    email=email,
                    defaults={
                        'username': email.split("@")[0],
                        'registration_method': 'email',
                        'supabase_uid': auth_response.user.id
                    }
                )
                
                if created:
                    user.set_unusable_password()
                    user.save()
                    UserProfile.objects.create(user=user)
                else:
                    # Обновляем supabase_uid если необходимо
                    if not user.supabase_uid:
                        user.supabase_uid = auth_response.user.id
                        user.save()

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
            else:
                return Response({"error": "Неверный email или пароль"}, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.error(f"Login error: {str(e)}")
            return Response({"error": "Неверный email или пароль"}, status=status.HTTP_400_BAD_REQUEST)