# backend/blog/migrations/000X_rename_postrevision_data_to_meta.py
from django.db import migrations

class Migration(migrations.Migration):
    dependencies = [
        ('blog', '__init__.cpython-313.pyc'),  # <-- замените на вашу последнюю миграцию
    ]

    operations = [
        migrations.RenameField(
            model_name='postrevision',
            old_name='data',
            new_name='meta',
        ),
    ]
