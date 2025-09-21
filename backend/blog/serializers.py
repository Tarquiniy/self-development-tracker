# backend/blog/serializers.py
from rest_framework import serializers
from .models import PostReaction

class PostReactionSerializer(serializers.ModelSerializer):
    likes_count = serializers.SerializerMethodField()
    liked_by_current_user = serializers.SerializerMethodField()

    class Meta:
        model = PostReaction
        fields = ('post_identifier', 'likes_count', 'liked_by_current_user')

    def get_likes_count(self, obj):
        return obj.likes_count()

    def get_liked_by_current_user(self, obj):
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return False
        return obj.users.filter(pk=request.user.pk).exists()
