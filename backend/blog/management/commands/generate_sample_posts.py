from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from blog.models import Post, Category, Tag
from django.utils import timezone
from django.utils.text import slugify
import random

CustomUser = get_user_model()

class Command(BaseCommand):
    help = 'Генерирует примеры постов для тестирования админки'

    def handle(self, *args, **options):
        # Создаем тестовые категории
        categories = []
        category_names = ['Технологии', 'Путешествия', 'Здоровье', 'Образование', 'Бизнес']
        for name in category_names:
            cat, created = Category.objects.get_or_create(
                title=name,
                defaults={'slug': slugify(name)}
            )
            categories.append(cat)
            if created:
                self.stdout.write(f'Создана категория: {name}')

        # Создаем тестовые теги
        tags = []
        tag_names = ['python', 'django', 'react', 'javascript', 'html', 'css', 'startup', 'productivity']
        for name in tag_names:
            tag, created = Tag.objects.get_or_create(
                title=name,
                defaults={'slug': slugify(name)}
            )
            tags.append(tag)
            if created:
                self.stdout.write(f'Создан тег: {name}')

        # Получаем или создаем тестового пользователя
        user, created = CustomUser.objects.get_or_create(
            username='admin',
            defaults={
                'email': 'admin@example.com',
                'is_staff': True,
                'is_superuser': True
            }
        )
        if created:
            user.set_password('admin')
            user.save()
            self.stdout.write('Создан тестовый пользователь: admin')

        # Создаем примеры постов
        post_templates = [
            {
                'title': 'Введение в Django для начинающих',
                'excerpt': 'Полное руководство по началу работы с Django фреймворком',
                'content': '<p>Django - это мощный фреймворк для веб-разработки на Python...</p>',
            },
            {
                'title': 'Лучшие практики React разработки в 2025 году',
                'excerpt': 'Современные подходы к разработке на React',
                'content': '<p>React продолжает развиваться и в 2025 году...</p>',
            },
            {
                'title': 'Как повысить продуктивность в работе',
                'excerpt': 'Проверенные методы для увеличения эффективности',
                'content': '<p>Продуктивность - ключевой фактор успеха...</p>',
            },
        ]

        for i, template in enumerate(post_templates):
            post, created = Post.objects.get_or_create(
                title=template['title'],
                defaults={
                    'author': user,
                    'slug': slugify(template['title']),
                    'excerpt': template['excerpt'],
                    'content': template['content'],
                    'status': 'published' if i % 2 == 0 else 'draft',
                    'published_at': timezone.now() if i % 2 == 0 else timezone.now() - timezone.timedelta(days=1)
                }
            )
            
            if created:
                # Добавляем случайные категории и теги
                post.categories.set(random.sample(categories, 2))
                post.tags.set(random.sample(tags, 3))
                self.stdout.write(f'Создан пост: {template["title"]}')

        self.stdout.write(
            self.style.SUCCESS('Успешно созданы тестовые данные для админки!')
        )