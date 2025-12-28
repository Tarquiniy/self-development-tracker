# backend/users/serializers.py
import logging
from django.db import IntegrityError
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

logger = logging.getLogger(__name__)
User = get_user_model()


class UserRegistrationSerializer(serializers.ModelSerializer):
    """
    Полноценный сериализатор регистрации: валидация пароля, create -> create_user,
    после создания явно гарантируем создание UserProfile (get_or_create).
    """
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = [
            "email",
            "username",
            "password",
            "password_confirm",
            "first_name",
            "last_name",
        ]
        extra_kwargs = {
            "email": {"required": True},
            "username": {"required": True},
        }

    def validate(self, attrs):
        if attrs.get("password") != attrs.get("password_confirm"):
            raise serializers.ValidationError({"password_confirm": "Password fields didn't match."})
        return attrs

    def create(self, validated_data):
        # remove confirm and extract password
        validated_data.pop("password_confirm", None)
        password = validated_data.pop("password")

        try:
            # Prefer custom manager's create_user when signature allows
            try:
                user = User.objects.create_user(password=password, **validated_data)
            except TypeError:
                # Fallback for custom user model with different create_user signature
                user = User(**validated_data)
                user.set_password(password)
                user.save()
        except IntegrityError as exc:
            raise serializers.ValidationError({"detail": "Could not create user: integrity error", "error": str(exc)})
        except Exception as exc:
            raise serializers.ValidationError({"detail": "Could not create user", "error": str(exc)})

        # If model exposes generate_verification_token — call it but don't fail on error
        try:
            if hasattr(user, "generate_verification_token") and callable(user.generate_verification_token):
                try:
                    user.generate_verification_token()
                except Exception:
                    logger.exception("generate_verification_token failed for user %s", getattr(user, "id", None))
        except Exception:
            # swallow any unexpected issues
            pass

        # Явно гарантируем создание профиля (сигнал тоже должен покрывать это, но дублируем для надёжности)
        try:
            from .models import UserProfile  # локальный импорт, чтобы избежать циклов при импортировании
            UserProfile.objects.get_or_create(user=user)
        except Exception:
            logger.exception("Failed to ensure UserProfile for user %s", getattr(user, "id", None))

        return user


# Backwards-compatible alias — многие места в коде импортируют RegisterSerializer
RegisterSerializer = UserRegistrationSerializer


class UserLoginSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(required=True, write_only=True)


class UserProfileSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)

    class Meta:
        # импорт модели профиля локально — избежать проблем при цикличных зависимостях
        from .models import UserProfile as _UP  # type: ignore
        model = _UP
        fields = [
            "email",
            "username",
            "first_name",
            "last_name",
            "subscription_active",
            "subscription_expires",
            "tables_limit",
            "phone",
            "website",
            "location",
            "email_notifications",
            "language",
        ]


class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "username",
            "first_name",
            "last_name",
            "is_staff",
            "date_joined",
            "email_verified",
            "profile",
        ]
