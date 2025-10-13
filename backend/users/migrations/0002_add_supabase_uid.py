# backend/users/migrations/0002_add_supabase_uid.py
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        # предполагаем, что у вас есть 0001_initial. Если имя другое — замените.
        ("users", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="customuser",
            name="supabase_uid",
            field=models.CharField(max_length=255, null=True, blank=True),
        ),
    ]
