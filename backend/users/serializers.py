from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.conf import settings
from .models import UserProfile
from .telegram_utils import verify_telegram_authentication
from .exceptions import TelegramDataIsOutdatedError, NotTelegramDataError

User = get_user_model()

class TelegramAuthSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    username = serializers.CharField(required=False, allow_blank=True)
    photo_url = serializers.CharField(required=False, allow_blank=True)
    auth_date = serializers.IntegerField()
    hash = serializers.CharField()

    def validate(self, attrs):
        try:
            verified_data = verify_telegram_authentication(
                bot_token=settings.TELEGRAM_BOT_TOKEN,
                request_data=attrs
            )
        except NotTelegramDataError as e:
            raise serializers.ValidationError({'hash': str(e)})
        except TelegramDataIsOutdatedError as e:
            raise serializers.ValidationError({'auth_date': str(e)})
        
        return verified_data

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'email', 'username', 'first_name', 'last_name', 'phone',
                 'telegram_id', 'telegram_username', 'registration_method')
        read_only_fields = ('id', 'registration_method')

class UserProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = UserProfile
        fields = ('user', 'subscription_active', 'subscription_expires', 'tables_limit')
        read_only_fields = ('user',)

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('email', 'username', 'password', 'confirm_password', 
                 'first_name', 'last_name', 'phone')

    def validate(self, attrs):
        if attrs['password'] != attrs['confirm_password']:
            raise serializers.ValidationError(
                {"confirm_password": "Passwords do not match"}
            )
        return attrs

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        user = User.objects.create_user(
            email=validated_data['email'],
            username=validated_data['username'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            phone=validated_data.get('phone', '')
        )
        return user