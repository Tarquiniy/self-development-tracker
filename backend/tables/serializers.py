from rest_framework import serializers
from .models import ProgressTable, DailyProgress


class DailyProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyProgress
        fields = ['date', 'data', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class ProgressTableSerializer(serializers.ModelSerializer):
    progress_entries = DailyProgressSerializer(many=True, read_only=True)
    user = serializers.StringRelatedField(read_only=True)
    
    class Meta:
        model = ProgressTable
        fields = ['id', 'user', 'title', 'categories', 'progress_entries', 'created_at', 'updated_at']
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']
    
    def validate_categories(self, value):
        if len(value) < 3:
            raise serializers.ValidationError("Минимум 3 категории")
        if len(value) > 12:
            raise serializers.ValidationError("Максимум 12 категорий")
        return value
    
    def create(self, validated_data):
        user = self.context['request'].user
        profile = user.profile
        
        # Check table limit
        table_count = ProgressTable.objects.filter(user=user).count()
        if table_count >= profile.tables_limit:
            raise serializers.ValidationError(
                f"Достигнут лимит таблиц. Доступно: {profile.tables_limit}"
            )
        
        return ProgressTable.objects.create(user=user, **validated_data)