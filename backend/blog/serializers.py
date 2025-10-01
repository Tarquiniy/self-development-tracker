# backend/blog/serializers.py
from rest_framework import serializers
from .models import Post, Category, Tag, Comment, PostReaction
from django.contrib.auth import get_user_model

User = get_user_model()


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ('id', 'title', 'slug', 'description')


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ('id', 'title', 'slug')


class CommentSerializer(serializers.ModelSerializer):
    replies = serializers.SerializerMethodField()
    user = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Comment
        fields = ('id', 'post', 'parent', 'name', 'email', 'user', 'content', 'is_public', 'is_moderated', 'created_at', 'replies')
        read_only_fields = ('is_moderated', 'created_at', 'replies')

    def get_replies(self, obj):
        qs = obj.replies.filter(is_public=True)
        return CommentSerializer(qs, many=True).data


class PostListSerializer(serializers.ModelSerializer):
    excerpt = serializers.CharField()
    # featured_image возвращаем через метод, чтобы гарантированно вернуть public URL (или raw value)
    featured_image = serializers.SerializerMethodField(allow_null=True)
    categories = CategorySerializer(many=True, read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    url = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = ('id', 'title', 'slug', 'excerpt', 'featured_image', 'categories', 'tags', 'published_at', 'url')

    def get_url(self, obj):
        return obj.get_absolute_url()

    def _resolve_file_url(self, file_like):
        """
        Вспомогательный метод: пытаемся корректно получить публичный URL из FileField-like объекта.
        """
        if not file_like:
            return None
        # Если это FieldFile или похожий объект с .url
        try:
            url = getattr(file_like, 'url', None)
            if url:
                return url
        except Exception:
            pass
        # Если пришла строка (например уже URL), возвращаем её
        try:
            if isinstance(file_like, str) and file_like.strip():
                return file_like
        except Exception:
            pass
        return None

    def get_featured_image(self, obj):
        # 1) Попытка: если поле featured_image — FileField-like
        try:
            val = getattr(obj, 'featured_image', None)
            url = self._resolve_file_url(val)
            if url:
                return url
        except Exception:
            pass

        # 2) Fallback: если у модели есть attachments (related_name 'attachments'), используем первый
        try:
            if hasattr(obj, 'attachments'):
                first = obj.attachments.all().order_by('id').first()
                if first and getattr(first, 'file', None):
                    try:
                        return first.file.url
                    except Exception:
                        return None
        except Exception:
            pass

        return None


class PostDetailSerializer(serializers.ModelSerializer):
    author = serializers.StringRelatedField(read_only=True)
    categories = CategorySerializer(many=True, read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    comments = CommentSerializer(many=True, read_only=True)
    likes_count = serializers.SerializerMethodField()
    featured_image = serializers.SerializerMethodField(allow_null=True)

    class Meta:
        model = Post
        fields = (
            'id', 'title', 'slug', 'excerpt', 'content', 'featured_image',
            'categories', 'tags', 'author', 'published_at', 'created_at', 'updated_at',
            'meta_title', 'meta_description', 'og_image', 'status', 'comments', 'likes_count'
        )

    def get_likes_count(self, obj):
        try:
            reaction = obj.reactions.get()
            return reaction.likes_count()
        except PostReaction.DoesNotExist:
            return 0

    def _resolve_file_url(self, file_like):
        # тот же helper как в списковом сериализаторе
        if not file_like:
            return None
        try:
            url = getattr(file_like, 'url', None)
            if url:
                return url
        except Exception:
            pass
        try:
            if isinstance(file_like, str) and file_like.strip():
                return file_like
        except Exception:
            pass
        return None

    def get_featured_image(self, obj):
        # 1) Попытка: FileField-like или строка
        try:
            val = getattr(obj, 'featured_image', None)
            url = self._resolve_file_url(val)
            if url:
                return url
        except Exception:
            pass

        # 2) Fallback на первое вложение
        try:
            if hasattr(obj, 'attachments'):
                first = obj.attachments.all().order_by('id').first()
                if first and getattr(first, 'file', None):
                    try:
                        return first.file.url
                    except Exception:
                        return None
        except Exception:
            pass

        return None


class PostCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Post
        fields = (
            'title', 'slug', 'excerpt', 'content', 'featured_image',
            'categories', 'tags', 'meta_title', 'meta_description', 'og_image', 'status', 'published_at'
        )
