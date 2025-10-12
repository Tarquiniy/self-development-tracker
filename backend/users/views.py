from django.contrib.auth import get_user_model, authenticate, login
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()

class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
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
        data = request.data
        identifier = data.get('username') or data.get('email') or data.get('identifier')
        password = data.get('password')

        if not identifier or not password:
            return Response({'detail': 'identifier and password required'}, status=status.HTTP_400_BAD_REQUEST)

        user = None

        # Попробуем найти по email
        if '@' in identifier:
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
            "username": user.username,
            "email": user.email,
            "is_staff": user.is_staff,
            "date_joined": user.date_joined,
        })