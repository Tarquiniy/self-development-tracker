from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import authenticate
from django.contrib.auth.hashers import make_password
from django.conf import settings
from users.models import CustomUser
from rest_framework_simplejwt.tokens import RefreshToken
from supabase import create_client, Client

supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)


class RegisterView(APIView):
    def post(self, request):
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

        # Создаём пользователя в Supabase
        try:
            result = supabase.auth.sign_up({
                "email": email,
                "password": password
            })
            if result.get("error"):
                return Response({"error": str(result["error"])}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": f"Supabase error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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


class LoginView(APIView):
    def post(self, request):
        email = request.data.get("email")
        password = request.data.get("password")

        if not email or not password:
            return Response({"error": "Email и пароль обязательны"}, status=status.HTTP_400_BAD_REQUEST)

        # Сначала проверим в Django
        user = authenticate(request, username=email, password=password)
        if not user:
            return Response({"error": "Неверный email или пароль"}, status=status.HTTP_400_BAD_REQUEST)

        # Проверим в Supabase (на всякий случай синхронизируем)
        try:
            result = supabase.auth.sign_in_with_password({
                "email": email,
                "password": password
            })
            if result.get("error"):
                return Response({"error": "Ошибка входа в Supabase"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": f"Supabase error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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
