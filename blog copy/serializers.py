# backend/blog/serializers.py
from rest_framework import serializers
from .models import Post, Category, Tag, Comment, PostReaction, PostAttachment

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

class AttachmentSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    filename = serializers.SerializerMethodField()
    class Meta:
        model = PostAttachment
        fields = ('id', 'title', 'filename', 'url', 'uploaded_at', 'post_id')

    def get_url(self, obj):
        try:
            return obj.file.url
        except Exception:
            return None

    def get_filename(self, obj):
        try:
            return obj.file.name and obj.file.name.split('/')[-1]
        except Exception:
            return None

class PostListSerializer(serializers.ModelSerializer):
    excerpt = serializers.CharField()
    featured_image = serializers.SerializerMethodField()
    categories = CategorySerializer(many=True, read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    url = serializers.SerializerMethodField()
    class Meta:
        model = Post
        fields = ('id', 'title', 'slug', 'excerpt', 'featured_image', 'categories', 'tags', 'published_at', 'url')

    def get_url(self, obj):
        return obj.get_absolute_url()

    def _file_url(self, file_like):
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
        # If featured_image (string URL) provided — return it (may be full URL)
        try:
            val = getattr(obj, 'featured_image', None)
            url = self._file_url(val)
            if url:
                return url
        except Exception:
            pass
        # fallback to first attachment
        try:
            if hasattr(obj, 'attachments'):
                first_obj = obj.attachments.all().order_by('id').first()
                if first_obj and getattr(first_obj, 'file', None):
                    try:
                        return first_obj.file.url
                    except Exception:
                        # as very last resort, return name
                        return getattr(first_obj.file, 'name', None)
        except Exception:
            pass
        return None

class PostDetailSerializer(PostListSerializer):
    author = serializers.StringRelatedField(read_only=True)
    comments = CommentSerializer(many=True, read_only=True)
    likes_count = serializers.SerializerMethodField()
    attachments = AttachmentSerializer(many=True, read_only=True)

    class Meta(PostListSerializer.Meta):
        model = Post
        fields = PostListSerializer.Meta.fields + ('content', 'author', 'created_at', 'updated_at', 'meta_title', 'meta_description', 'og_image', 'status', 'comments', 'likes_count', 'attachments')

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
