from rest_framework import serializers
from .models import MediaFile

class MediaFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = MediaFile
        fields = [
            "id", "original_filename", "supabase_url", "thumbnail_url",
            "content_type", "size", "width", "height", "uploaded_by", "created_at"
        ]
        read_only_fields = ["id", "supabase_url", "thumbnail_url", "width", "height", "size", "created_at", "uploaded_by"]
