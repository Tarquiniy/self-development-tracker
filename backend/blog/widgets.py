# backend/blog/widgets.py
from django import forms
from django.utils.safestring import mark_safe
from django.template.loader import render_to_string

class TipTapWidget(forms.Textarea):
    """
    Robust admin widget: renders a normal <textarea> and a visual editor container.
    Template is admin/widgets/tiptap_widget.html (placed in templates/).
    """
    template_name = 'admin/widgets/tiptap_widget.html'

    def __init__(self, attrs=None, upload_url=None, preview_token_url=None):
        super().__init__(attrs)
        # Defaults (these endpoints must exist in your urls)
        self.upload_url = upload_url or '/api/blog/media/upload/'
        self.preview_token_url = preview_token_url or '/admin/posts/preview-token/'

    def get_context(self, name, value, attrs):
        context = super().get_context(name, value, attrs)
        final_attrs = context['widget']['attrs']
        # Add dataset attributes for JS
        final_attrs['data-upload-url'] = self.upload_url
        final_attrs['data-preview-token-url'] = self.preview_token_url
        final_attrs.setdefault('class', '')
        final_attrs['class'] += ' admin-tiptap-textarea'
        return context

    def render(self, name, value, attrs=None, renderer=None):
        # We render via template so the visual container is placed next to textarea
        final_attrs = self.build_attrs(self.attrs, attrs or {})
        context = {
            'widget': {
                'name': name,
                'value': '' if value is None else value,
                'attrs': final_attrs,
            }
        }
        # render the custom template (which itself calls the default textarea rendering)
        html = render_to_string(self.template_name, context)
        return mark_safe(html)

# older code or other modules may expect other capitalization — provide alias
TiptapWidget = TipTapWidget
