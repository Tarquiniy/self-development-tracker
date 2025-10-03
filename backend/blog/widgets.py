# backend/blog/widgets.py
from django import forms
from django.utils.safestring import mark_safe

class TipTapWidget(forms.Textarea):
    template_name = 'admin/widgets/tiptap_widget.html'

    def __init__(self, attrs=None, upload_url=None, preview_token_url=None):
        super().__init__(attrs)
        self.upload_url = upload_url or '/admin/blog/media-library/'
        self.preview_token_url = preview_token_url or '/admin/blog/preview-token/'

    def get_context(self, name, value, attrs):
        context = super().get_context(name, value, attrs)
        final_attrs = context['widget']['attrs']
        final_attrs['data-tiptap'] = '1'
        final_attrs['data-upload-url'] = self.upload_url
        final_attrs['data-preview-token-url'] = self.preview_token_url
        final_attrs.setdefault('class', '')
        final_attrs['class'] += ' admin-tiptap-textarea'
        return context

    def render(self, name, value, attrs=None, renderer=None):
        html = super().render(name, value, attrs, renderer)
        return mark_safe(html)
