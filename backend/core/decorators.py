# backend/core/decorators.py
from functools import wraps
from django.http import JsonResponse
from .supabase_client import supabase_user_info
from django.contrib.auth import get_user_model

User = get_user_model()

def supabase_auth_required(view_func):
    @wraps(view_func)
    def _wrapped(request, *args, **kwargs):
        auth = request.META.get('HTTP_AUTHORIZATION', '')
        parts = auth.split()
        if len(parts) == 2 and parts[0].lower() == 'bearer':
            token = parts[1]
            info = supabase_user_info(token)
            if info and info.get('email'):
                email = info['email']
                user, _ = User.objects.get_or_create(email=email, defaults={'username': email.split('@')[0]})
                request.user = user
                request.supabase_user = info
                return view_func(request, *args, **kwargs)
        return JsonResponse({'detail': 'Authentication required'}, status=401)
    return _wrapped
