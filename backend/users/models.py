from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _


class CustomUser(AbstractUser):
    email = models.EmailField(_('email address'), unique=True)
    phone = models.CharField(max_length=15, blank=True, null=True)
    email_verified = models.BooleanField(default=False)
    phone_verified = models.BooleanField(default=False)
    supabase_uid = models.CharField(max_length=255, blank=True, null=True)

    # Analytics fields
    registration_method = models.CharField(max_length=20, default='email')
    registration_date = models.DateTimeField(auto_now_add=True)

    # Telegram fields
    telegram_id = models.CharField(max_length=255, blank=True, null=True, unique=True)
    telegram_username = models.CharField(max_length=255, blank=True, null=True)
    telegram_data = models.JSONField(default=dict, blank=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def __str__(self):
        return self.email

    class Meta:
        db_table = 'users_customuser'
        verbose_name = 'Пользователь'
        verbose_name_plural = 'Пользователи'


class UserProfile(models.Model):
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name='profile')
    subscription_active = models.BooleanField(default=False)
    subscription_expires = models.DateTimeField(null=True, blank=True)
    tables_limit = models.IntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.email} - {'Premium' if self.subscription_active else 'Free'}"

    class Meta:
        db_table = 'users_userprofile'
        verbose_name = 'Профиль пользователя'
        verbose_name_plural = 'Профили пользователей'