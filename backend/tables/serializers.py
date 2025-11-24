from rest_framework import serializers
from .models import ProgressTable, DailyProgress
from django.contrib.auth import get_user_model

User = get_user_model()

class DailyProgressSerializer(serializers.ModelSerializer):
    id = serializers.ReadOnlyField()
    mood_display = serializers.SerializerMethodField()

    class Meta:
        model = DailyProgress
        fields = ['id', 'table', 'date', 'data', 'notes', 'mood', 'mood_display', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_mood_display(self, obj):
        if obj.mood:
            mood_map = {1: '😢', 2: '😞', 3: '😐', 4: '😊', 5: '😁'}
            return mood_map.get(obj.mood, '')
        return ''


class ProgressTableSerializer(serializers.ModelSerializer):
    id = serializers.ReadOnlyField()
    progress_entries = DailyProgressSerializer(many=True, read_only=True)
    user = serializers.StringRelatedField(read_only=True)
    
    # Статистика для календаря
    calendar_stats = serializers.SerializerMethodField()

    class Meta:
        model = ProgressTable
        fields = [
            'id', 'user', 'title', 'categories', 'calendar_enabled', 'default_view',
            'created_at', 'updated_at', 'progress_entries', 'calendar_stats'
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at', 'progress_entries', 'calendar_stats']

    def get_calendar_stats(self, obj):
        """Статистика по месяцам для календаря"""
        from django.db.models import Count, Avg
        from django.utils import timezone
        from datetime import timedelta
        
        # Получаем прогресс за последние 6 месяцев
        six_months_ago = timezone.now().date() - timedelta(days=180)
        
        monthly_stats = obj.progress_entries.filter(
            date__gte=six_months_ago
        ).extra({
            'month': "EXTRACT(month FROM date)",
            'year': "EXTRACT(year FROM date)"
        }).values('year', 'month').annotate(
            entries_count=Count('id'),
            avg_mood=Avg('mood')
        ).order_by('-year', '-month')
        
        return list(monthly_stats)

    def validate_categories(self, value):
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
            if 'name' not in cat:
                raise serializers.ValidationError("Каждая категория должна содержать ключ 'name'")
            if 'color' not in cat:
                raise serializers.ValidationError("Каждая категория должна содержать ключ 'color'")
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
        instance.title = validated_data.get('title', instance.title)
        instance.categories = validated_data.get('categories', instance.categories)
        instance.calendar_enabled = validated_data.get('calendar_enabled', instance.calendar_enabled)
        instance.default_view = validated_data.get('default_view', instance.default_view)
        instance.save()
        return instance