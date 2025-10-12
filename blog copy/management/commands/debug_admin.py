# backend/blog/management/commands/debug_admin.py
from django.core.management.base import BaseCommand
from django.conf import settings

class Command(BaseCommand):
    help = 'Debug admin configuration'

    def handle(self, *args, **options):
        self.stdout.write("=== Admin Configuration Debug ===")
        
        # Проверяем middleware
        self.stdout.write("\n1. Middleware:")
        for mw in settings.MIDDLEWARE:
            self.stdout.write(f"   - {mw}")
            
        # Проверяем установленные приложения
        self.stdout.write("\n2. Installed Apps:")
        for app in settings.INSTALLED_APPS:
            self.stdout.write(f"   - {app}")
            
        # Проверяем настройки CSRF
        self.stdout.write("\n3. CSRF Settings:")
        self.stdout.write(f"   - CSRF_USE_SESSIONS: {getattr(settings, 'CSRF_USE_SESSIONS', 'Not set')}")
        self.stdout.write(f"   - CSRF_COOKIE_HTTPONLY: {getattr(settings, 'CSRF_COOKIE_HTTPONLY', 'Not set')}")
        
        self.stdout.write("\n✅ Debug information printed")