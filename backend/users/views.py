# backend/users/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.hashers import make_password
from .models import CustomUser, UserProfile
from rest_framework_simplejwt.tokens import RefreshToken
import json

class RegisterView(APIView):
    def post(self, request):
        try:
            data = json.loads(request.body)
            email = data.get('email')
            password = data.get('password')
            
            if not email or not password:
                return Response({"error": "Email and password required"}, 
                              status=status.HTTP_400_BAD_REQUEST)
            
            # Создаем пользователя
            user = CustomUser.objects.create(
                email=email,
                username=email,
                password=make_password(password)
            )
            
            # Создаем профиль
            UserProfile.objects.create(user=user)
            
            # Генерируем токены
            refresh = RefreshToken.for_user(user)
            
            return Response({
                "user": {
                    "id": user.id,
                    "email": user.email
                },
                "tokens": {
                    "refresh": str(refresh),
                    "access": str(refresh.access_token)
                }
            })
            
        except Exception as e:
            return Response({"error": str(e)}, 
                          status=status.HTTP_400_BAD_REQUEST)

class LoginView(APIView):
    def post(self, request):
        try:
            data = json.loads(request.body)
            email = data.get('email')
            password = data.get('password')
            
            user = CustomUser.objects.get(email=email)
            
            if not user.check_password(password):
                return Response({"error": "Invalid credentials"}, 
                              status=status.HTTP_400_BAD_REQUEST)
            
            refresh = RefreshToken.for_user(user)
            
            return Response({
                "user": {
                    "id": user.id,
                    "email": user.email
                },
                "tokens": {
                    "refresh": str(refresh),
                    "access": str(refresh.access_token)
                }
            })
            
        except CustomUser.DoesNotExist:
            return Response({"error": "User not found"}, 
                          status=status.HTTP_400_BAD_REQUEST)