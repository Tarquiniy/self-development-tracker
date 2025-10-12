from django.contrib.auth.models import AbstractUser
from django.db import models

class CustomUser(AbstractUser):
    """
    Явная, простая CustomUser модель.
    Добавляем Meta.app_label = 'users' чтобы гарантировать регистрацию под ярлыком 'users'
    независимо от нюансов импорта/путей.
    """
    email = models.EmailField(unique=True)

    class Meta:
        app_label = 'users'  # критично: гарантирует, что модель привязана к ярлыку users

    def __str__(self):
        return self.username
