# backend/blog/forms.py
from django import forms
from .models import Post
from .widgets import TipTapWidget
from django.utils import timezone

class PostAdminForm(forms.ModelForm):
    # Добавляем кастомное поле для published_at с правильным виджетом
    published_at = forms.DateTimeField(
        required=False,
        widget=forms.DateTimeInput(attrs={
            'type': 'datetime-local',
            'class': 'form-input'
        }),
        input_formats=['%Y-%m-%dT%H:%M']
    )

    class Meta:
        model = Post
        fields = '__all__'
        widgets = {
            'content': TipTapWidget(),
            'excerpt': forms.Textarea(attrs={'rows': 3, 'placeholder': 'Краткое описание поста...'}),
            'meta_description': forms.Textarea(attrs={'rows': 2, 'placeholder': 'Мета-описание для SEO...'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Add CSS classes for styling
        self.fields['title'].widget.attrs.update({
            'class': 'post-title-field',
            'placeholder': 'Введите заголовок поста...'
        })
        self.fields['slug'].widget.attrs.update({
            'class': 'post-slug-field',
            'placeholder': 'url-slug...'
        })

        # Устанавливаем начальное значение для published_at
        if self.instance and self.instance.published_at:
            self.fields['published_at'].initial = self.instance.published_at.strftime('%Y-%m-%dT%H:%M')
        elif not self.instance.pk:  # Новый пост
            self.fields['published_at'].initial = timezone.now().strftime('%Y-%m-%dT%H:%M')

    def clean(self):
        cleaned_data = super().clean()
        # Добавляем базовую валидацию
        title = cleaned_data.get('title')
        if not title or len(title.strip()) == 0:
            raise forms.ValidationError("Заголовок не может быть пустым")
        return cleaned_data

    def clean_published_at(self):
        published_at = self.cleaned_data.get('published_at')
        # Если поле пустое, возвращаем None - поле в модели допускает null
        return published_at