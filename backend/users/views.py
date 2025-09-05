from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model, authenticate
from .serializers import UserSerializer
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
import requests
import json

User = get_user_model()
SUPABASE_URL = settings.SUPABASE_URL
SUPABASE_KEY = settings.SUPABASE_KEY

class RegisterView(generics.CreateAPIView):
    """Регистрация нового пользователя"""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        refresh = RefreshToken.for_user(user)
        return Response({
            "user": UserSerializer(user).data,
            "refresh": str(refresh),
            "access": str(refresh.access_token),
        }, status=status.HTTP_201_CREATED)


class LoginView(generics.GenericAPIView):
    """Вход по email и паролю"""
    serializer_class = UserSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        email = request.data.get("email")
        password = request.data.get("password")

        user = authenticate(request, email=email, password=password)
        if not user:
            return Response({"error": "Неверный email или пароль"},
                            status=status.HTTP_401_UNAUTHORIZED)

        refresh = RefreshToken.for_user(user)
        return Response({
            "user": UserSerializer(user).data,
            "refresh": str(refresh),
            "access": str(refresh.access_token),
        })


class ProfileView(generics.RetrieveAPIView):
    """Получение профиля авторизованного пользователя"""
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user
    
@csrf_exempt
def register(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            email = data.get("email")
            password = data.get("password")

            if not email or not password:
                return JsonResponse({"error": "Email и пароль обязательны"}, status=400)

            # Запрос в Supabase Auth API
            response = requests.post(
                f"{SUPABASE_URL}/auth/v1/signup",
                headers={
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                    "Content-Type": "application/json",
                },
                json={"email": email, "password": password},
            )

            if response.status_code >= 400:
                return JsonResponse(response.json(), status=response.status_code)

            return JsonResponse(response.json(), status=201)

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Метод не разрешён"}, status=405)

@csrf_exempt
def login(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            email = data.get("email")
            password = data.get("password")

            if not email or not password:
                return JsonResponse({"error": "Email и пароль обязательны"}, status=400)

            # Авторизация через Supabase
            response = requests.post(
                f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
                headers={
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                    "Content-Type": "application/json",
                },
                json={"email": email, "password": password},
            )

            if response.status_code >= 400:
                return JsonResponse(response.json(), status=response.status_code)

            result = response.json()
            # Возвращаем access_token и user
            return JsonResponse(
                {
                    "access_token": result.get("access_token"),
                    "refresh_token": result.get("refresh_token"),
                    "user": result.get("user"),
                    "redirect": "/dashboard",  # 👈 фронт поймает и сделает редирект
                },
                status=200,
            )

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Метод не разрешён"}, status=405)