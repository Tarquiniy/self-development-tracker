# backend/blog/forms.py
from django import forms
from .models import Post
from .widgets import TipTapWidget

class PostAdminForm(forms.ModelForm):
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
        
    def clean(self):
        cleaned_data = super().clean()
        # Добавляем базовую валидацию
        title = cleaned_data.get('title')
        if not title or len(title.strip()) == 0:
            raise forms.ValidationError("Заголовок не может быть пустым")
        return cleaned_data