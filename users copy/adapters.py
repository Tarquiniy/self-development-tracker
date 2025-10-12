from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from django.contrib.auth import get_user_model
from django.http import JsonResponse

User = get_user_model()

class CustomSocialAccountAdapter(DefaultSocialAccountAdapter):
    def pre_social_login(self, request, sociallogin):
        # Обработка Telegram аутентификации
        if sociallogin.account.provider == 'telegram':
            telegram_data = sociallogin.account.extra_data
            telegram_id = str(telegram_data.get('id'))
            username = telegram_data.get('username', '')
            first_name = telegram_data.get('first_name', '')
            last_name = telegram_data.get('last_name', '')
            
            # Поиск пользователя по telegram_id
            try:
                user = User.objects.get(telegram_id=telegram_id)
                sociallogin.connect(request, user)
            except User.DoesNotExist:
                # Поиск по email (если есть)
                email = telegram_data.get('email')
                if email:
                    try:
                        user = User.objects.get(email=email)
                        user.telegram_id = telegram_id
                        user.telegram_username = username
                        user.telegram_data = telegram_data
                        user.save()
                        sociallogin.connect(request, user)
                    except User.DoesNotExist:
                        # Создание нового пользователя
                        username = f"tg_{telegram_id}"
                        user = User.objects.create(
                            username=username,
                            telegram_id=telegram_id,
                            telegram_username=username,
                            telegram_data=telegram_data,
                            first_name=first_name,
                            last_name=last_name,
                            registration_method='telegram'
                        )
                        sociallogin.connect(request, user)

    def authentication_error(self, request, provider, error=None, exception=None, extra_context=None):
        return JsonResponse({
            'error': 'Authentication failed',
            'details': str(error)
        }, status=400)