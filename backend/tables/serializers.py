from rest_framework import serializers
from .models import ProgressTable, DailyProgress

class DailyProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyProgress
        fields = ['date', 'data', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']

class ProgressTableSerializer(serializers.ModelSerializer):
    progress_entries = DailyProgressSerializer(many=True, read_only=True)
    user = serializers.StringRelatedField(read_only=True)  # Делаем поле только для чтения

    class Meta:
        model = ProgressTable
        fields = ['id', 'user', 'title', 'categories', 'progress_entries', 'created_at', 'updated_at']
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']  # Явно указываем read_only

    def validate_categories(self, value):
        if len(value) < 3:
            raise serializers.ValidationError("Минимум 3 категории")
        if len(value) > 12:
            raise serializers.ValidationError("Максимум 12 категорий")
        
        category_ids = [cat['id'] for cat in value]
        if len(category_ids) != len(set(category_ids)):
            raise serializers.ValidationError("ID категорий должны быть уникальными")
            
        return value

    def create(self, validated_data):
        user = self.context['request'].user
        profile = user.profile

        # Проверяем лимит таблиц
        table_count = ProgressTable.objects.filter(user=user).count()
        if table_count >= profile.tables_limit:
            raise serializers.ValidationError(
                f"Достигнут лимит таблиц. Доступно: {profile.tables_limit}"
            )

        # Убедимся, что user не передается в validated_data
        validated_data.pop('user', None)  # Удаляем user, если он есть

        return ProgressTable.objects.create(user=user, **validated_data)