from django.contrib.auth.models import AbstractUser
from django.db import models

class CustomUser(AbstractUser):
    email = models.EmailField(unique=True)

    class Meta:
        app_label = 'users'

    def __str__(self):
        return self.username
