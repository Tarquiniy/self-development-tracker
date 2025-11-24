import uuid
from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError


class ProgressTable(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='tables')
    title = models.CharField(max_length=255, default='Моя таблица прогресса')
    categories = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Новые поля для календаря
    calendar_enabled = models.BooleanField(default=True, verbose_name="Включить календарь")
    default_view = models.CharField(
        max_length=20,
        choices=[('month', 'Месяц'), ('week', 'Неделя'), ('day', 'День')],
        default='month',
        verbose_name="Вид по умолчанию"
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.email} - {self.title}"

    def clean(self):
        if len(self.categories) < 3:
            raise ValidationError("Минимум 3 категории")
        if len(self.categories) > 12:
            raise ValidationError("Максимум 12 категорий")

        category_ids = [cat['id'] for cat in self.categories]
        if len(category_ids) != len(set(category_ids)):
            raise ValidationError("ID категорий должны быть уникальными")

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)


class DailyProgress(models.Model):
    table = models.ForeignKey(ProgressTable, on_delete=models.CASCADE, related_name='progress_entries')
    date = models.DateField()
    data = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Новые поля для расширенного отслеживания
    notes = models.TextField(blank=True, verbose_name="Заметки")
    mood = models.IntegerField(
        choices=[(1, '😢'), (2, '😞'), (3, '😐'), (4, '😊'), (5, '😁')],
        null=True, blank=True,
        verbose_name="Настроение"
    )

    class Meta:
        unique_together = ['table', 'date']
        ordering = ['date']

    def __str__(self):
        return f"{self.table.title} - {self.date}"

    def clean(self):
        if self.data:
            for category_id, value in self.data.items():
                if not any(cat['id'] == category_id for cat in self.table.categories):
                    raise ValidationError(f"Категория {category_id} не найдена в таблице")

                if not (0 <= int(value) <= 99):
                    raise ValidationError("Значение прогресса должно быть между 0 и 99")

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)