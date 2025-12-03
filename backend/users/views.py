# backend/users/views.py
from django.contrib.auth import get_user_model, authenticate, login
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from django.core.mail import send_mail
from django.conf import settings
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.middleware.csrf import get_token
from django.shortcuts import get_object_or_404

from .serializers import (
    UserRegistrationSerializer,
    UserLoginSerializer,
    UserSerializer,
    UserProfileSerializer,
)
from .models import UserProfile

User = get_user_model()


@method_decorator(csrf_exempt, name="dispatch")
class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        """
        Регистрация пользователя.
        После успешного создания пользователя — гарантированно создаём UserProfile.
        Возвращаем JWT токены.
        """
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()

            # Убедимся, что профиль существует
            UserProfile.objects.get_or_create(user=user)

            # Опционально: сгенерировать verification token и отправить письмо
            # если хотите включить автоматическую верификацию по email,
            # раскомментируйте:
            # user.generate_verification_token()
            # self.send_verification_email(user)

            # JWT токены
            refresh = RefreshToken.for_user(user)

            return Response(
                {
                    "user": {"id": user.id, "email": user.email, "username": user.username},
                    "tokens": {"refresh": str(refresh), "access": str(refresh.access_token)},
                },
                status=status.HTTP_201_CREATED,
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def send_verification_email(self, user):
        """
        Простейшая отправка письма с токеном верификации.
        В продакшене можно заменить на асинхронную отправку.
        """
        if not user.email:
            return
        subject = "Verify your email"
        message = f"Please verify your email using this token: {user.verification_token}"
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=False)


@method_decorator(csrf_exempt, name="dispatch")
class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        """
        Аутентификация по email + password (используем вашу сериализацию).
        Возвращаем user и JWT токены.
        """
        serializer = UserLoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data.get("email")
        password = serializer.validated_data.get("password")

        # Попробуем аутентифицировать. У вас USERNAME_FIELD = 'email'
        user = authenticate(request, username=email, password=password)

        # В старых конфигурациях authenticate может принимать email как отдельный аргумент;
        # если ваш бэкенд использует кастомную механику, сохраните прежнюю логику.
        if user is None:
            # Альтернативная попытка: найти user по email и проверить пароль вручную
            try:
                candidate = User.objects.get(email__iexact=email)
                if candidate.check_password(password):
                    user = candidate
            except User.DoesNotExist:
                user = None

        if user is None:
            return Response({"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

        # создаём сессию
        login(request._request, user)

        # JWT токены
        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "user": UserSerializer(user).data,
                "tokens": {"refresh": str(refresh), "access": str(refresh.access_token)},
            },
            status=status.HTTP_200_OK,
        )


class ProfileView(APIView):
    """
    GET /api/auth/profile/  -> возвращает информацию о пользователе + профиль
    PUT  /api/auth/profile/  -> частичное обновление user и/или profile (внешняя форма)
    Ответ GET:
    {
      "id": ...,
      "username": ...,
      "email": ...,
      "is_staff": ...,
      "date_joined": ...,
      "profile": {
         "id": ...,
         "subscription_active": ...,
         "subscription_expires": ...,
         "max_tables": ...,
         "tables_limit": ...,
         "phone": ...,
         ...
      }
    }
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        # Попытка получить связанный профиль (OneToOne). Если нет — не падать.
        profile_obj = None
        try:
            profile_obj = getattr(user, "profile", None)
        except Exception:
            profile_obj = None

        # Если профиля нет — возвращаем структуру по умолчанию (tables_limit = 1)
        if profile_obj is None:
            profile_data = {
                "id": None,
                "subscription_active": False,
                "subscription_expires": None,
                "max_tables": None,
                "tables_limit": 1,
                "phone": "",
                "website": "",
                "location": "",
                "email_notifications": True,
                "language": "ru",
            }
        else:
            # собираем безопасный набор полей для отдачи
            profile_data = {
                "id": getattr(profile_obj, "id", None),
                "subscription_active": getattr(profile_obj, "subscription_active", False),
                "subscription_expires": getattr(profile_obj, "subscription_expires", None),
                # поддерживаем оба имени поля: max_tables (новое) и tables_limit (существующее)
                "max_tables": getattr(profile_obj, "max_tables", None),
                "tables_limit": getattr(profile_obj, "tables_limit", None),
                "phone": getattr(profile_obj, "phone", ""),
                "website": getattr(profile_obj, "website", ""),
                "location": getattr(profile_obj, "location", ""),
                "email_notifications": getattr(profile_obj, "email_notifications", None),
                "language": getattr(profile_obj, "language", None),
            }

        # составляем ответ по пользователю
        user_data = {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "is_staff": user.is_staff,
            "date_joined": user.date_joined,
            "profile": profile_data,
        }

        return Response(user_data, status=status.HTTP_200_OK)

    def put(self, request):
        """
        Частичное обновление: можно передать поля пользователя и/или profile:
        Пример:
        {
          "email": "...",
          "first_name": "...",
          "profile": {
             "max_tables": 3,
             "phone": "...",
          }
        }
        """
        user = request.user

        # Обновляем пользователя частично
        user_serializer = UserSerializer(user, data=request.data, partial=True)
        user_valid = user_serializer.is_valid()
        user_errors = None
        if user_valid:
            user_serializer.save()
        else:
            user_errors = user_serializer.errors

        # Обновляем профиль, если передан
        profile_payload = request.data.get("profile", None)
        profile_errors = None
        if profile_payload is not None:
            # убедимся, что профиль существует
            profile_obj, _created = UserProfile.objects.get_or_create(user=user)
            profile_serializer = UserProfileSerializer(profile_obj, data=profile_payload, partial=True)
            if profile_serializer.is_valid():
                profile_serializer.save()
            else:
                profile_errors = profile_serializer.errors

        errors = {}
        if user_errors:
            errors["user"] = user_errors
        if profile_errors:
            errors["profile"] = profile_errors

        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        # заново соберём ответ
        updated_user = UserSerializer(user).data
        # ensure profile exists and refresh
        try:
            profile_obj = getattr(user, "profile", None)
            if not profile_obj:
                profile_obj = UserProfile.objects.get_or_create(user=user)[0]
        except Exception:
            profile_obj = None

        profile_data = None
        if profile_obj:
            profile_data = UserProfileSerializer(profile_obj).data
        else:
            profile_data = {"tables_limit": 1}

        resp = {**updated_user, "profile": profile_data}
        return Response(resp, status=status.HTTP_200_OK)


class VerifyEmailView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        token = request.data.get("token")

        if not token:
            return Response({"detail": "Token is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(verification_token=token)
            user.email_verified = True
            user.verification_token = None
            user.save()

            return Response({"detail": "Email verified successfully"})
        except User.DoesNotExist:
            return Response({"detail": "Invalid token"}, status=status.HTTP_400_BAD_REQUEST)


class PasswordResetView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email")

        if not email:
            return Response({"detail": "Email is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email=email)
            user.generate_reset_token()

            # Отправка email для сброса пароля
            self.send_reset_email(user)

            return Response({"detail": "Password reset email sent"})
        except User.DoesNotExist:
            # Не раскрываем информацию о существовании email
            return Response({"detail": "If the email exists, a reset link has been sent"})

    def send_reset_email(self, user):
        subject = "Password Reset"
        message = f"Use this token to reset your password: {user.reset_token}"
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=False)


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        token = request.data.get("token")
        new_password = request.data.get("new_password")

        if not token or not new_password:
            return Response(
                {"detail": "Token and new password are required"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = User.objects.get(reset_token=token)
            user.set_password(new_password)
            user.reset_token = None
            user.save()

            return Response({"detail": "Password reset successful"})
        except User.DoesNotExist:
            return Response({"detail": "Invalid token"}, status=status.HTTP_400_BAD_REQUEST)


@method_decorator(csrf_exempt, name="dispatch")
class CSRFTokenView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        token = get_token(request)
        return Response({"csrfToken": token})
