from django.contrib.auth.models import AbstractUser
from django.db import models

class CustomUser(AbstractUser):
    """Модель пользователя с возможностью расширения под нужды проекта."""
    email = models.EmailField(unique=True)

    def __str__(self):
        return self.username