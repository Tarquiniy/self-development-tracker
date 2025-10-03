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
        }
