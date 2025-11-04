# backend/core/authentication.py
from typing import Tuple, Optional
from rest_framework.authentication import BaseAuthentication
from rest_framework import exceptions
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AbstractBaseUser
from .supabase_client import supabase_user_info

UserModel = get_user_model()

class SupabaseBearerAuthentication(BaseAuthentication):
    """
    Accept Authorization: Bearer <supabase_access_token>
    Calls Supabase /auth/v1/user and maps to Django user (creates if absent).
    After this, request.user is standard Django user.
    """

    # Аннотация использует AbstractBaseUser (класс), а не переменную UserModel.
    def authenticate(self, request) -> Optional[Tuple[AbstractBaseUser, None]]:
        auth = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth:
            return None

        parts = auth.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return None

        token = parts[1]
        user_info = supabase_user_info(token)
        if not user_info:
            raise exceptions.AuthenticationFailed("Invalid Supabase token")

        email = user_info.get("email")
        if not email:
            raise exceptions.AuthenticationFailed("Supabase user has no email")

        # Используем runtime-модель для операций с БД
        try:
            user = UserModel.objects.get(email__iexact=email)
        except UserModel.DoesNotExist:
            username = email.split("@")[0]
            user = UserModel.objects.create(username=username, email=email, is_active=True)
            user.set_unusable_password()
            user.save()

        meta = user_info.get("user_metadata") or {}
        if meta:
            changed = False
            if meta.get("full_name") and user.get_full_name() != meta.get("full_name"):
                user.first_name = meta.get("full_name")
                changed = True
            if changed:
                user.save()

        return (user, None)
