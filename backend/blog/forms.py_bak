# backend/blog/forms.py
from django import forms
from .models import Post
from .widgets import CKEditor5Widget

class PostAdminForm(forms.ModelForm):
    class Meta:
        model = Post
        fields = '__all__'
        widgets = {
            'content': CKEditor5Widget(attrs={'rows': 20}),
        }