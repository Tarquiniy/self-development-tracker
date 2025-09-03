from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _

class CustomUser(AbstractUser):
    email = models.EmailField(_('email address'), unique=True)
    phone = models.CharField(max_length=15, blank=True, null=True)
    email_verified = models.BooleanField(default=False)
    phone_verified = models.BooleanField(default=False)

    # Telegram
    telegram_id = models.BigIntegerField(
        blank=True,
        null=True,
        unique=True,
        help_text="ID пользователя Telegram"
    )
    telegram_username = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="username из Telegram"
    )
    telegram_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="Сырые данные, которые вернул Telegram Login Widget"
    )

    # Analytics
    registration_method = models.CharField(max_length=20, default='email')
    registration_date = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def __str__(self):
        return self.email if self.email else f"tg:{self.telegram_id}"


class UserProfile(models.Model):
    user = models.OneToOneField(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='profile'
    )
    subscription_active = models.BooleanField(default=False)
    subscription_expires = models.DateTimeField(null=True, blank=True)
    tables_limit = models.IntegerField(default=1)

    def __str__(self):
        return f"{self.user.email or self.user.telegram_username} - {'Premium' if self.subscription_active else 'Free'}"
