# backend/users/models.py
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class CustomUser(AbstractUser):
    """
    Расширенная модель пользователя, совместимая с админкой и кастомными полями.
    """
    display_name = models.CharField(
        max_length=150,
        blank=True,
        null=True,
        verbose_name="Отображаемое имя"
    )

    # Новые поля, чтобы убрать ошибки админки
    is_verified = models.BooleanField(
        default=False,
        verbose_name="Проверен",
        help_text="Пользователь прошёл общую верификацию (например, по номеру или документам)"
    )

    email_verified = models.BooleanField(
        default=False,
        verbose_name="Email подтверждён",
        help_text="Флаг, указывающий, что пользователь подтвердил свой адрес электронной почты"
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Дата создания"
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="Дата обновления"
    )

    # Уникальные related_name для избежания конфликтов с auth.User
    groups = models.ManyToManyField(
        "auth.Group",
        related_name="customuser_set",
        blank=True,
        help_text="Группы, в которых состоит пользователь",
        verbose_name="Группы",
    )

    user_permissions = models.ManyToManyField(
        "auth.Permission",
        related_name="customuser_user_permissions",
        blank=True,
        help_text="Права, назначенные этому пользователю",
        verbose_name="Права пользователя",
    )

    def __str__(self):
        return self.username or self.email or f"User {self.pk}"

    class Meta:
        verbose_name = "Пользователь"
        verbose_name_plural = "Пользователи"
        ordering = ["-created_at"]
