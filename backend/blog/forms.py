# backend/blog/forms.py
from django import forms
from .models import Post
from .widgets import TipTapWidget
from django.utils import timezone

class PostAdminForm(forms.ModelForm):
    published_at = forms.DateTimeField(
        required=False,
        widget=forms.DateTimeInput(attrs={
            'type': 'datetime-local',
            'class': 'form-row'  # класс для единобразной стилизации
        }),
        input_formats=['%Y-%m-%dT%H:%M']
    )

    class Meta:
        model = Post
        fields = '__all__'
        widgets = {
            'content': TipTapWidget(),
            'excerpt': forms.Textarea(attrs={'rows': 3, 'class': 'form-row', 'placeholder': 'Краткое описание поста...'}),
            'meta_description': forms.Textarea(attrs={'rows': 2, 'class': 'form-row', 'placeholder': 'Мета-описание для SEO...'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # CSS-классы полей заголовка и slug
        self.fields['title'].widget.attrs.update({
            'class': 'post-title-field form-row',
            'placeholder': 'Введите заголовок поста...'
        })
        self.fields['slug'].widget.attrs.update({
            'class': 'post-slug-field form-row',
            'placeholder': 'url-slug...'
        })
        # Инициализация времени публикации
        if self.instance and self.instance.published_at:
            self.fields['published_at'].initial = self.instance.published_at.strftime('%Y-%m-%dT%H:%M')
        elif not self.instance.pk:
            self.fields['published_at'].initial = timezone.now().strftime('%Y-%m-%dT%H:%M')

    def clean(self):
        cleaned_data = super().clean()
        title = cleaned_data.get('title', '').strip()
        if not title:
            raise forms.ValidationError("Заголовок не может быть пустым")
        return cleaned_data
