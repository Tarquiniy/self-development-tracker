# backend/users/views.py
from django.contrib.auth import authenticate, login
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken

# НЕ вызываем get_user_model() на уровне модуля (оно может вызывать ImproperlyConfigured при раннем импорте).
def _get_user_model():
    from django.contrib.auth import get_user_model as _g
    return _g()

class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        User = _get_user_model()
        data = request.data
        email = data.get('email')
        password = data.get('password')
        username = data.get('username') or (email.split('@')[0] if email else None)

        if not email or not password:
            return Response({'detail': 'email and password are required'}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(email__iexact=email).exists():
            return Response({'detail': 'Email already registered'}, status=status.HTTP_400_BAD_REQUEST)

        user = User(username=username, email=email)
        user.set_password(password)
        user.save()

        # логиним пользователя (создаёт сессию)
        # request._request — используем, чтобы прокинуть реальный django request в DRF контексте
        login(request._request, user)

        # даём JWT на будущее (опционально)
        refresh = RefreshToken.for_user(user)
        return Response({
            'user': {'id': user.id, 'username': user.username, 'email': user.email},
            'tokens': {'refresh': str(refresh), 'access': str(refresh.access_token)}
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        User = _get_user_model()
        data = request.data
        identifier = data.get('username') or data.get('email') or data.get('identifier')
        password = data.get('password')

        if not identifier or not password:
            return Response({'detail': 'identifier and password required'}, status=status.HTTP_400_BAD_REQUEST)

        user = None

        # Попробуем найти по email
        if identifier and '@' in identifier:
            try:
                user_candidate = User.objects.get(email__iexact=identifier)
                if user_candidate.check_password(password):
                    user = user_candidate
            except User.DoesNotExist:
                user = None
        else:
            # попытка обычной аутентификации по username
            user = authenticate(request, username=identifier, password=password)

        if user is None:
            return Response({'detail': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

        # создаём сессию
        login(request._request, user)

        # выдаём JWT на будущее (опционально)
        refresh = RefreshToken.for_user(user)
        return Response({
            'user': {'id': user.id, 'username': user.username, 'email': user.email},
            'tokens': {'refresh': str(refresh), 'access': str(refresh.access_token)}
        }, status=status.HTTP_200_OK)


class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            "id": user.id,
            "username": getattr(user, "username", None),
            "email": getattr(user, "email", None),
            "is_staff": getattr(user, "is_staff", False),
            "date_joined": getattr(user, "date_joined", None),
        })
