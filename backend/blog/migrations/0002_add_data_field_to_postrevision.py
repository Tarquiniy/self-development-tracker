# backend/blog/migrations/0002_add_data_field_to_postrevision.py
from django.db import migrations, models
import json

def copy_meta_to_data(apps, schema_editor):
    """
    Use raw SQL to copy blog_postrevision.meta -> blog_postrevision.data.
    Avoid using ORM methods so we don't accidentally SELECT non-existent columns.
    This handles cases where DB schema differs from models (missing columns like `note`).
    """
    conn = schema_editor.connection
    table = schema_editor.quote_name("blog_postrevision")
    # We'll try selecting only id + meta. If meta column doesn't exist, abort silently.
    try:
        with conn.cursor() as cur:
            # Check that 'meta' column exists
            cur.execute(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = %s AND column_name = %s",
                ["blog_postrevision", "meta"],
            )
            if cur.fetchone() is None:
                # nothing to copy
                return

            # Ensure data column exists (it should, because AddField runs before RunPython)
            cur.execute(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = %s AND column_name = %s",
                ["blog_postrevision", "data"],
            )
            if cur.fetchone() is None:
                # data column missing — nothing to do
                return

            # Select id and meta only (avoid referencing other columns)
            cur.execute(f"SELECT id, meta FROM blog_postrevision WHERE meta IS NOT NULL")
            rows = cur.fetchall()
            if not rows:
                return

            # Update rows one-by-one using parameterized queries
            for row in rows:
                row_id, meta_val = row[0], row[1]
                # meta_val may be already a Python object (from JSON); pass it directly
                # Use json.dumps to ensure proper JSON string if the DB adapter needs it.
                try:
                    payload = json.dumps(meta_val) if meta_val is not None else None
                except Exception:
                    # fallback: coerce to string
                    payload = str(meta_val)

                cur.execute(
                    "UPDATE blog_postrevision SET data = %s WHERE id = %s",
                    [payload, row_id],
                )
    except Exception:
        # Log nothing in migrations (avoid failing migration due to copy), but re-raise if necessary.
        # We'll be conservative and re-raise so admin notices migration problems.
        raise

class Migration(migrations.Migration):

    dependencies = [
        ('blog', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='postrevision',
            name='data',
            field=models.JSONField(null=True, blank=True),
        ),
        migrations.RunPython(copy_meta_to_data, reverse_code=migrations.RunPython.noop),
    ]
