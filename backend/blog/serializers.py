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
    featured_image = serializers.URLField(allow_null=True, required=False)
    categories = CategorySerializer(many=True, read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    url = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = ('id', 'title', 'slug', 'excerpt', 'featured_image', 'categories', 'tags', 'published_at', 'url')

    def get_url(self, obj):
        return obj.get_absolute_url()


class PostDetailSerializer(serializers.ModelSerializer):
    author = serializers.StringRelatedField(read_only=True)
    categories = CategorySerializer(many=True, read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    comments = CommentSerializer(many=True, read_only=True)
    likes_count = serializers.SerializerMethodField()

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


class PostCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Post
        fields = (
            'title', 'slug', 'excerpt', 'content', 'featured_image',
            'categories', 'tags', 'meta_title', 'meta_description', 'og_image', 'status', 'published_at'
        )
