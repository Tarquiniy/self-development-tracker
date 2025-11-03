# backend/blog/forms.py
from django import forms
from .models import Post
from django.utils.translation import gettext_lazy as _

class PostAdminForm(forms.ModelForm):
    class Meta:
        model = Post
        fields = '__all__'
        widgets = {
            # Делает поле content обычным textarea, чтобы CKEditor мог к нему привязаться
            'content': forms.Textarea(attrs={
                'class': 'admin-ckeditor-textarea',
                'rows': 24,
                'name': 'content'  # на всякий случай, но Django сам ставит name
            }),
            # короткий отрывок пусть останется textarea
            'excerpt': forms.Textarea(attrs={'class': 'admin-ckeditor-textarea', 'rows':12}),
        }
