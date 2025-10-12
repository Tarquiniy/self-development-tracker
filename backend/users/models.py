from django.contrib.auth.models import AbstractUser
from django.db import models

class CustomUser(AbstractUser):
    email = models.EmailField(unique=True)
    supabase_uid = models.CharField(max_length=255, blank=True, null=True)
    registration_method = models.CharField(max_length=20, default='email')

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    class Meta:
        db_table = 'users_customuser'

    def __str__(self):
        return self.email

class UserProfile(models.Model):
    user = models.OneToOneField('CustomUser', on_delete=models.CASCADE, related_name='profile')
    subscription_active = models.BooleanField(default=False)
    subscription_expires = models.DateTimeField(null=True, blank=True)
    tables_limit = models.IntegerField(default=1)

    def __str__(self):
        return f"Profile of {self.user.email}"