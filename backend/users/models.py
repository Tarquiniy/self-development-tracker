# backend/users/models.py
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone

class CustomUser(AbstractUser):
    email = models.EmailField(unique=True)
    supabase_uid = models.CharField(max_length=255, blank=True, null=True)
    registration_method = models.CharField(max_length=20, default='email')
    
    # Добавляем поля для верификации email
    email_verified = models.BooleanField(default=False)
    verification_token = models.CharField(max_length=100, blank=True, null=True)
    verification_sent_at = models.DateTimeField(null=True, blank=True)
    
    # Поля для сброса пароля
    reset_token = models.CharField(max_length=100, blank=True, null=True)
    reset_sent_at = models.DateTimeField(null=True, blank=True)
    
    # Профиль пользователя
    avatar_url = models.URLField(blank=True, null=True)
    bio = models.TextField(blank=True)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    class Meta:
        db_table = 'users_customuser'
        verbose_name = 'Custom User'
        verbose_name_plural = 'Custom Users'

    def __str__(self):
        return self.email

    def generate_verification_token(self):
        import secrets
        self.verification_token = secrets.token_urlsafe(32)
        self.verification_sent_at = timezone.now()
        self.save()

    def generate_reset_token(self):
        import secrets
        self.reset_token = secrets.token_urlsafe(32)
        self.reset_sent_at = timezone.now()
        self.save()

class UserProfile(models.Model):
    user = models.OneToOneField('CustomUser', on_delete=models.CASCADE, related_name='profile')
    subscription_active = models.BooleanField(default=False)
    subscription_expires = models.DateTimeField(null=True, blank=True)
    tables_limit = models.IntegerField(default=1)
    
    # Дополнительные поля профиля
    phone = models.CharField(max_length=20, blank=True)
    website = models.URLField(blank=True)
    location = models.CharField(max_length=100, blank=True)
    
    # Настройки
    email_notifications = models.BooleanField(default=True)
    language = models.CharField(max_length=10, default='ru')

    def __str__(self):
        return f"Profile of {self.user.email}"