import os
from django.core.management.base import BaseCommand
from django.db import connections, transaction
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()

class Command(BaseCommand):
    help = "Import users from Supabase 'profiles' table into Django CustomUser"

    def handle(self, *args, **kwargs):
        self.stdout.write("Reading Supabase profiles...")

        with connections['default'].cursor() as cursor:
            cursor.execute("SELECT id, email, full_name FROM public.profiles")
            rows = cursor.fetchall()

        created = 0
        updated = 0

        for supa_id, email, full_name in rows:
            if not email:
                continue

            username = email.split("@")[0]

            with transaction.atomic():
                user, is_new = User.objects.get_or_create(
                    email=email,
                    defaults={
                        "username": username,
                        "is_active": True,
                        "is_staff": False,
                        "is_superuser": False,
                        "date_joined": timezone.now(),
                        "registration_method": "supabase",
                        "first_name": full_name or "",
                        "supabase_uid": str(supa_id),
                        "email_verified": True,
                        "bio": "",
                    }
                )

                if not is_new:
                    updated += 1
                else:
                    created += 1

        self.stdout.write(self.style.SUCCESS(
            f"Import finished. Created: {created}, Updated: {updated}"
        ))
