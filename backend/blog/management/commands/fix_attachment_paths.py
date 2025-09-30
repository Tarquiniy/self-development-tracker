import os
from django.core.management.base import BaseCommand
from blog.models import PostAttachment


class Command(BaseCommand):
    help = "Очищает file.name: убирает лишний 'post_attachments/' префикс, оставляет только basename"

    def handle(self, *args, **options):
        fixed = 0
        skipped = 0

        for a in PostAttachment.objects.all():
            if not a.file or not a.file.name:
                skipped += 1
                continue

            old_name = a.file.name.strip()
            base = os.path.basename(old_name)

            if old_name != base:
                new_name = base
                self.stdout.write(f"Fixing: {old_name} -> {new_name}")
                a.file.name = new_name
                a.save(update_fields=["file"])
                fixed += 1
            else:
                skipped += 1

        self.stdout.write(self.style.SUCCESS(f"Готово! Исправлено: {fixed}, пропущено: {skipped}"))
