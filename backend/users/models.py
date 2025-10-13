# backend/users/models.py
from django.contrib.auth.models import AbstractUser
from django.db import models

class CustomUser(AbstractUser):
    """
    Простая кастомная модель пользователя.
    Важно: AUTH_USER_MODEL в settings должна быть 'users.CustomUser'
    """
    email = models.EmailField(unique=True)
    supabase_uid = models.CharField(max_length=255, blank=True, null=True)
    registration_method = models.CharField(max_length=20, default='email')

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    class Meta:
        verbose_name = 'Custom User'
        verbose_name_plural = 'Custom Users'
        # db_table можно указать, если нужно: 'users_customuser'

    def __str__(self):
        return self.email or self.username or str(self.pk)


class UserProfile(models.Model):
    """
    Профиль пользователя — ссылаемся на модель через строку 'users.CustomUser'
    чтобы избежать проблем с импортами.
    """
    user = models.OneToOneField('users.CustomUser', on_delete=models.CASCADE, related_name='profile')
    subscription_active = models.BooleanField(default=False)
    subscription_expires = models.DateTimeField(null=True, blank=True)
    tables_limit = models.IntegerField(default=1)

    def __str__(self):
        return f"Profile of {getattr(self.user, 'email', self.user.pk)}"
