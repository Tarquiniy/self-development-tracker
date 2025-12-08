# backend/users/models.py
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
from django.db.models.signals import post_save
from django.dispatch import receiver


class CustomUser(AbstractUser):
    email = models.EmailField(unique=True)
    supabase_uid = models.CharField(max_length=255, blank=True, null=True)
    registration_method = models.CharField(max_length=20, default='email')

    # email verification
    email_verified = models.BooleanField(default=False)
    verification_token = models.CharField(max_length=100, blank=True, null=True)
    verification_sent_at = models.DateTimeField(null=True, blank=True)

    # password reset
    reset_token = models.CharField(max_length=100, blank=True, null=True)
    reset_sent_at = models.DateTimeField(null=True, blank=True)

    # profile
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


class UserProfile(models.Model):
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name="profile")

    subscription_active = models.BooleanField(default=False)
    subscription_expires = models.DateTimeField(null=True, blank=True)

    tables_limit = models.IntegerField(
        default=1,
        null=True,
        blank=True,
        help_text="Максимум таблиц. -1 = неограниченно."
    )

    # Доп поля
    phone = models.CharField(max_length=20, blank=True)
    website = models.URLField(blank=True)
    location = models.CharField(max_length=100, blank=True)

    email_notifications = models.BooleanField(default=True)
    language = models.CharField(max_length=10, default='ru')

    def __str__(self):
        return f"Profile of {self.user.email}"


# АВТОСОЗДАНИЕ ПРОФИЛЯ
@receiver(post_save, sender=CustomUser)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.get_or_create(user=instance)


# Proxy model to show an admin menu item (no DB table will be created)
class UserTableLimitsProxy(models.Model):
    class Meta:
        proxy = True
        app_label = "users"  # оставляем app_label users, чтобы пункт виделся в секции users
        verbose_name = "Лимиты таблиц"
        verbose_name_plural = "Лимиты таблиц"

    def __str__(self):
        return "Лимиты таблиц"