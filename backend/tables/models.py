import uuid
from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator


class ProgressTable(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='tables')
    title = models.CharField(max_length=255, default='Моя таблица прогресса')
    categories = models.JSONField(default=list)  # [{"id": "c1", "name": "Обучение"}, ...]
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.email} - {self.title}"


class DailyProgress(models.Model):
    table = models.ForeignKey(ProgressTable, on_delete=models.CASCADE, related_name='progress_entries')
    date = models.DateField()
    data = models.JSONField()  # {"c1": 1, "c2": 0, ...}
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['table', 'date']
        ordering = ['date']
    
    def __str__(self):
        return f"{self.table.title} - {self.date}"