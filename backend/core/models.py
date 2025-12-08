# backend/core/models.py
from django.db import models

class TableLimitsProxy(models.Model):
    class Meta:
        managed = False      # Django НЕ создаёт таблицу
        abstract = True      # «виртуальная» модель
        verbose_name = "Лимиты таблиц"
        verbose_name_plural = "Лимиты таблиц"

    def __str__(self):
        return "Настройки лимитов таблиц"
