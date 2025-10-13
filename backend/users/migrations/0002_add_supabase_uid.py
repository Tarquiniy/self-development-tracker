# Migration: add supabase_uid field to CustomUser
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="customuser",
            name="supabase_uid",
            field=models.CharField(max_length=255, null=True, blank=True),
        ),
    ]
