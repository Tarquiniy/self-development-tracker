# backend/blog/management/commands/check_admin.py
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from blog.models import Post

User = get_user_model()

class Command(BaseCommand):
    help = 'Check if admin can create and save posts'

    def handle(self, *args, **options):
        # Проверяем существование суперпользователя
        superusers = User.objects.filter(is_superuser=True)
        if not superusers.exists():
            self.stdout.write(
                self.style.ERROR('❌ No superusers found. Run: python manage.py createsuperuser')
            )
            return
        
        self.stdout.write(
            self.style.SUCCESS(f'✅ Found {superusers.count()} superuser(s)')
        )

        # Пробуем создать тестовый пост
        try:
            post, created = Post.objects.get_or_create(
                title='Test Post',
                defaults={
                    'content': 'Test content',
                    'excerpt': 'Test excerpt',
                    'status': 'draft'
                }
            )
            
            if created:
                self.stdout.write(
                    self.style.SUCCESS('✅ Successfully created test post via ORM')
                )
            else:
                self.stdout.write(
                    self.style.WARNING('ℹ️ Test post already exists')
                )
                
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'❌ Error creating test post: {e}')
            )