from rest_framework import serializers

# Для UserSerializer — будем лениво брать модель пользователя внутри методов/Meta установки
# Чтобы избежать вызова get_user_model() при импорте модуля (это приводило к проблемам при старте)

class UserProfileSerializer(serializers.Serializer):
    user = serializers.DictField()
    subscription_active = serializers.BooleanField()
    subscription_expires = serializers.DateTimeField(allow_null=True)
    tables_limit = serializers.IntegerField()

    class Meta:
        # Model не задаём здесь жёстко, сериализатор — не ModelSerializer
        fields = ['user', 'subscription_active', 'subscription_expires', 'tables_limit']


# ModelSerializer для пользователя — установим модель лениво
class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = None  # установим ниже
        fields = ["id", "email", "username", "password", "first_name", "last_name"]
        extra_kwargs = {
            "username": {"required": True},
            "email": {"required": True},
        }

    def create(self, validated_data):
        # лениво импортируем модель пользователя
        from django.contrib.auth import get_user_model
        User = get_user_model()
        user = User(
            email=validated_data["email"],
            username=validated_data["username"],
            first_name=validated_data.get("first_name", ""),
            last_name=validated_data.get("last_name", ""),
        )
        user.set_password(validated_data["password"])
        user.save()
        return user

# Попытка безопасно установить Meta.model сейчас (если приложения уже готовы)
try:
    from django.contrib.auth import get_user_model
    UserSerializer.Meta.model = get_user_model()
except Exception:
    # Если получаем ошибку (например, при раннем импорте во время настройки apps) — отложим
    pass
