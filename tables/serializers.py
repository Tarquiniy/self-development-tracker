# backend/tables/serializers.py
from rest_framework import serializers
from .models import ProgressTable, DailyProgress
from django.contrib.auth import get_user_model

User = get_user_model()

class DailyProgressSerializer(serializers.ModelSerializer):
    id = serializers.ReadOnlyField()

    class Meta:
        model = DailyProgress
        fields = ['id', 'table', 'date', 'data', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

class ProgressTableSerializer(serializers.ModelSerializer):
    id = serializers.ReadOnlyField()
    progress_entries = DailyProgressSerializer(source='progress_entries', many=True, read_only=True)
    user = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = ProgressTable
        fields = ['id', 'user', 'title', 'categories', 'created_at', 'updated_at', 'progress_entries']
        read_only_fields = ['id', 'user', 'created_at', 'updated_at', 'progress_entries']

    def validate_categories(self, value):
        # basic JSON structure validation and rules from model.clean()
        if not isinstance(value, list):
            raise serializers.ValidationError("categories must be a list of objects")
        if not (3 <= len(value) <= 12):
            raise serializers.ValidationError("Минимум 3 и максимум 12 категорий")
        seen = set()
        for cat in value:
            if not isinstance(cat, dict):
                raise serializers.ValidationError("Каждая категория должна быть объектом (dict)")
            if 'id' not in cat:
                raise serializers.ValidationError("Каждая категория должна содержать ключ 'id'")
            cid = cat['id']
            if cid in seen:
                raise serializers.ValidationError("ID категорий должны быть уникальными")
            seen.add(cid)
        return value

    def create(self, validated_data):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if user is None or not user.is_authenticated:
            raise serializers.ValidationError("Authentication required to create a table")
        validated_data['user'] = user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # allow updating title and categories only; user should remain unchanged
        instance.title = validated_data.get('title', instance.title)
        instance.categories = validated_data.get('categories', instance.categories)
        instance.save()
        return instance