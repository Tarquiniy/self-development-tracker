# backend/blog/management/commands/init_admin.py
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.conf import settings
from django.db import connection
from django.db.utils import ProgrammingError, OperationalError

User = get_user_model()

class Command(BaseCommand):
    help = 'Initialize admin user and site for the blog'

    def handle(self, *args, **options):
        # Создаем суперпользователя если его нет
        if not User.objects.filter(is_superuser=True).exists():
            try:
                User.objects.create_superuser(
                    username='admin',
                    email='admin@example.com',
                    password='adminpassword'
                )
                self.stdout.write(
                    self.style.SUCCESS('✅ Superuser created: admin/adminpassword')
                )
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'❌ Error creating superuser: {e}')
                )
                return
        
        # Обновляем сайт только если приложение sites установлено и таблица существует
        if 'django.contrib.sites' in settings.INSTALLED_APPS:
            try:
                from django.contrib.sites.models import Site
                
                # Проверяем существование таблицы
                try:
                    Site.objects.first()
                except (ProgrammingError, OperationalError):
                    self.stdout.write(
                        self.style.WARNING('⚠️ Sites table does not exist. Run: python manage.py migrate sites')
                    )
                    return
                
                site, created = Site.objects.get_or_create(
                    id=settings.SITE_ID,
                    defaults={
                        'domain': 'positive-theta.vercel.app',
                        'name': 'Positive Theta'
                    }
                )
                
                if not created:
                    site.domain = 'positive-theta.vercel.app'
                    site.name = 'Positive Theta'
                    site.save()
                    
                self.stdout.write(
                    self.style.SUCCESS('✅ Site configuration updated')
                )
            except Exception as e:
                self.stdout.write(
                    self.style.WARNING(f'⚠️ Error updating site: {e}')
                )
        else:
            self.stdout.write(
                self.style.WARNING('⚠️ Sites app not installed, skipping site configuration')
            )
        
        self.stdout.write(
            self.style.SUCCESS('🎉 Admin setup completed successfully!')
        )