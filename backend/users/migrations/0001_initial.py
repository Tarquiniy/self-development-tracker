# Generated minimal initial migration to satisfy dependency chain.
from django.db import migrations


class Migration(migrations.Migration):
    """
    Minimal "initial" migration for the users app.
    It intentionally contains no operations — its purpose is only to
    serve as a parent node for later migrations (safe when the DB
    tables are already present).
    """
    initial = True
    dependencies = []
    operations = []
