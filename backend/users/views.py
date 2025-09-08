from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from users.models import CustomUser, UserProfile
from rest_framework_simplejwt.tokens import RefreshToken
from supabase import create_client, Client
import logging
from .serializers import UserProfileSerializer
from rest_framework.permissions import IsAuthenticated

logger = logging.getLogger(__name__)
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)


class RegisterView(APIView):
    def post(self, request):
        email = request.data.get("email")
        password = request.data.get("password")
        username = request.data.get("username", email.split("@")[0] if email else "")

        if not email or not password:
            return Response({"error": "Email и пароль обязательны"}, status=status.HTTP_400_BAD_REQUEST)

        if CustomUser.objects.filter(email=email).exists():
            return Response({"error": "Пользователь с таким email уже существует"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Регистрация в Supabase
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
                user = CustomUser.objects.create(
                    email=email,
                    username=username,
                    registration_method="email",
                    supabase_uid=auth_response.user.id
                )
                user.set_unusable_password()
                user.save()

                UserProfile.objects.create(user=user)

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


class LoginView(APIView):
    def post(self, request):
        email = request.data.get("email")
        password = request.data.get("password")

        if not email or not password:
            return Response({"error": "Email и пароль обязательны"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            auth_response = supabase.auth.sign_in_with_password({
                "email": email,
                "password": password
            })

            if auth_response.user:
                user, created = CustomUser.objects.get_or_create(
                    email=email,
                    defaults={
                        "username": email.split("@")[0],
                        "registration_method": "email",
                        "supabase_uid": auth_response.user.id
                    }
                )

                if created:
                    user.set_unusable_password()
                    user.save()
                    UserProfile.objects.create(user=user)
                elif not user.supabase_uid:
                    user.supabase_uid = auth_response.user.id
                    user.save()

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
        user = request.user
        profile, _ = UserProfile.objects.get_or_create(user=user)
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

    def put(self, request):
        try:
            user = request.user
            profile = UserProfile.objects.get(user=user)

            if "first_name" in request.data:
                user.first_name = request.data["first_name"]
            if "last_name" in request.data:
                user.last_name = request.data["last_name"]
            if "phone" in request.data:
                user.phone = request.data["phone"]
            user.save()

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
