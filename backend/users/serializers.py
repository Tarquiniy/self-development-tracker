# backend/users/serializers.py
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from django.db import IntegrityError

from .models import UserProfile

User = get_user_model()


class UserRegistrationSerializer(serializers.ModelSerializer):
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
        # remove password_confirm from data
        validated_data.pop("password_confirm", None)
        password = validated_data.pop("password")

        try:
            # try using create_user if available on custom user manager
            user = None
            try:
                user = User.objects.create_user(password=password, **validated_data)
            except TypeError:
                # fallback if create_user has different signature
                user = User(**validated_data)
                user.set_password(password)
                user.save()
        except IntegrityError as exc:
            # Convert DB integrity errors into serializer validation errors
            raise serializers.ValidationError({"detail": "Could not create user: integrity error", "error": str(exc)})
        except Exception as exc:
            raise serializers.ValidationError({"detail": "Could not create user", "error": str(exc)})

        # If CustomUser has a helper to generate verification token — call it
        try:
            if hasattr(user, "generate_verification_token") and callable(user.generate_verification_token):
                try:
                    user.generate_verification_token()
                except Exception:
                    # don't fail registration if token generation fails
                    logger = getattr(self, "logger", None)
                    if logger:
                        logger.debug("generate_verification_token failed for user %s", getattr(user, "id", None))
        except Exception:
            # swallow any unexpected problems
            pass

        # Ensure UserProfile exists (also covered by signal, but do it explicitly to be deterministic)
        try:
            UserProfile.objects.get_or_create(user=user)
        except Exception:
            # Not fatal for user creation
            pass

        return user


class UserLoginSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(required=True, write_only=True)


class UserProfileSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)

    class Meta:
        model = UserProfile
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
