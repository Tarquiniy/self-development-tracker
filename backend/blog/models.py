# backend/blog/models.py
from django.db import models
from django.conf import settings

class PostReaction(models.Model):
    """
    Храним реакции (лайки) на посты. Используем идентификатор поста WordPress
    в поле post_identifier (может быть slug или numeric id, в зависимости от фронтенда).
    """
    post_identifier = models.CharField(max_length=255, db_index=True)
    users = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name='liked_posts')  # если юзер зарегался
    # Для анонимных лайков — храним счётчик
    anon_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('post_identifier',)

    def likes_count(self):
        return self.anon_count + self.users.count()

    def __str__(self):
        return f"{self.post_identifier} likes={self.likes_count()}"
