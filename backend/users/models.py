# backend/users/models.py
from django.contrib.auth.models import AbstractUser
from django.db import models

class CustomUser(AbstractUser):
    """Кастомная модель пользователя"""
    
    # Добавляем дополнительные поля если нужно
    bio = models.TextField(blank=True, verbose_name="Биография")
    avatar = models.URLField(blank=True, verbose_name="Аватар")
    phone = models.CharField(max_length=20, blank=True, verbose_name="Телефон")
    
    # Social media fields
    website = models.URLField(blank=True, verbose_name="Веб-сайт")
    github = models.URLField(blank=True, verbose_name="GitHub")
    twitter = models.URLField(blank=True, verbose_name="Twitter")
    linkedin = models.URLField(blank=True, verbose_name="LinkedIn")
    
    # Metadata
    email_verified = models.BooleanField(default=False, verbose_name="Email подтвержден")
    is_verified = models.BooleanField(default=False, verbose_name="Верифицирован")
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Создан")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Обновлен")

    class Meta:
        verbose_name = "Пользователь"
        verbose_name_plural = "Пользователи"
        db_table = 'users_customuser'

    def __str__(self):
        return self.username