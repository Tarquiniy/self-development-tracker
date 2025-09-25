# backend/blog/revalidation.py
import requests
import os
from django.conf import settings

def send_revalidation_request(post_slug=None):
    """
    Отправляет запрос на ревалидацию в Next.js при изменении постов
    """
    frontend_url = os.environ.get('FRONTEND_URL', 'https://positive-theta.vercel.app')
    secret_key = os.environ.get('REVALIDATION_SECRET')
    
    if not secret_key:
        print("REVALIDATION_SECRET not set")
        return False
    
    paths = ['/blog']
    tags = ['posts']
    
    # Если передан slug поста, добавляем его страницу для ревалидации
    if post_slug:
        paths.append(f'/blog/{post_slug}')
        tags.append(f'post-{post_slug}')
    
    try:
        response = requests.post(
            f'{frontend_url}/api/revalidate',
            json={
                'paths': paths,
                'tags': tags
            },
            headers={
                'x-revalidation-secret': secret_key,
                'Content-Type': 'application/json'
            },
            timeout=10
        )
        
        if response.status_code == 200:
            print(f"Revalidation successful: {response.json()}")
            return True
        else:
            print(f"Revalidation failed: {response.status_code} - {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"Revalidation request error: {e}")
        return False

# Сигнал для автоматической ревалидации при сохранении поста
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import Post

@receiver(post_save, sender=Post)
def revalidate_on_post_save(sender, instance, **kwargs):
    """
    Автоматически отправляет запрос на ревалидацию при сохранении поста
    """
    if instance.status == 'published':
        send_revalidation_request(instance.slug)

@receiver(post_delete, sender=Post)
def revalidate_on_post_delete(sender, instance, **kwargs):
    """
    Автоматически отправляет запрос на ревалидацию при удалении поста
    """
    send_revalidation_request()