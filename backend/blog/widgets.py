# backend/blog/widgets.py
import json
from django import forms
from django.utils.safestring import mark_safe

class TiptapWidget(forms.Textarea):
    """
    Современный TipTap widget for Django admin.
    - Передаёт в шаблон upload_url и preview_token_url через контекст
    - Устанавливает data-* атрибуты и CSS-класс
    - Название шаблона: admin/widgets/tiptap_widget.html
    """
    template_name = 'admin/widgets/tiptap_widget.html'

    def __init__(self, attrs=None, upload_url=None, preview_token_url=None):
        super().__init__(attrs)
        # значения по умолчанию — можно переопределить при создании виджета
        self.upload_url = upload_url or '/api/blog/media/upload/'
        self.preview_token_url = preview_token_url or '/api/blog/preview-token/'

    # get_context обязательно добавляет upload_url в context, потому что
    # в Django шаблонизаторе обращение к widget.attrs['data-upload-url']
    # с дефисом неудобно — поэтому экспортируем отдельно.
    def get_context(self, name, value, attrs):
        context = super().get_context(name, value, attrs)
        final_attrs = context['widget'].setdefault('attrs', {})
        # mark widget as tiptap-enabled
        final_attrs['data-tiptap'] = '1'
        # also keep hyphen-style attrs for compatibility (JS может читать dataset)
        final_attrs['data-upload-url'] = self.upload_url
        final_attrs['data-preview-token-url'] = self.preview_token_url
        # ensure a sensible id/class
        final_attrs.setdefault('id', final_attrs.get('id', f'id_{name}'))
        final_attrs.setdefault('class', '')
        if 'admin-tiptap-textarea' not in final_attrs['class']:
            final_attrs['class'] += ' admin-tiptap-textarea'
        # Provide explicit context variables that are simple to access in template
        context['upload_url'] = self.upload_url
        context['preview_token_url'] = self.preview_token_url
        # Provide a JSON blob of attrs (if someone wants to consume it in template)
        try:
            context['attrs_json'] = json.dumps(final_attrs)
        except Exception:
            context['attrs_json'] = '{}'
        return context

    # render — оставляем стандартный механизм (он использует template_name)
    def render(self, name, value, attrs=None, renderer=None):
        return super().render(name, value, attrs, renderer)

# Backwards compatibility: многие места импортировали TipTapWidget / TipTapWidget with different case
TipTapWidget = TiptapWidget
