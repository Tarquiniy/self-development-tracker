import logging
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from .models import UserProfile
from .telegram_utils import verify_telegram_authentication
from django.conf import settings

logger = logging.getLogger(__name__)
User = get_user_model()

@csrf_exempt
@require_POST
def telegram_callback(request):
    """
    Обработчик callback от Telegram Web App
    """
    try:
        logger.info("Telegram callback received")
        
        # Получаем данные из request.POST или request.body
        if request.POST:
            telegram_data = request.POST.dict()
        else:
            import json
            telegram_data = json.loads(request.body)
        
        logger.debug(f"Telegram data: {telegram_data}")
        
        # Верифицируем данные Telegram
        verified_data = verify_telegram_authentication(
            settings.TELEGRAM_BOT_TOKEN,
            telegram_data
        )
        
        telegram_id = str(verified_data['id'])
        
        # Ищем или создаем пользователя
        try:
            user = User.objects.get(telegram_id=telegram_id)
            logger.info(f"Found existing user: {user.username}")
        except User.DoesNotExist:
            # Создаем нового пользователя
            username = f"tg_{telegram_id}"
            user = User.objects.create(
                username=username,
                telegram_id=telegram_id,
                telegram_username=verified_data.get('username', ''),
                first_name=verified_data.get('first_name', ''),
                last_name=verified_data.get('last_name', ''),
                registration_method='telegram'
            )
            UserProfile.objects.create(user=user)
            logger.info(f"Created new user: {username}")
        
        # Генерируем JWT токены
        refresh = RefreshToken.for_user(user)
        
        return JsonResponse({
            'status': 'success',
            'user': {
                'id': user.id,
                'email': user.email,
                'username': user.username,
                'telegram_id': user.telegram_id,
                'telegram_username': user.telegram_username
            },
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        })
        
    except Exception as e:
        logger.error(f"Telegram callback error: {str(e)}")
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=400)