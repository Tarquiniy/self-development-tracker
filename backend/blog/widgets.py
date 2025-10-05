# backend/blog/widgets.py
from django import forms
from django.utils.safestring import mark_safe
from django.template import TemplateDoesNotExist
from django.forms.renderers import get_default_renderer

class TiptapWidget(forms.Textarea):
    # template_name остаётся тем же — шаблон должен быть в templates/admin/widgets/tiptap_widget.html
    template_name = 'admin/widgets/tiptap_widget.html'

    def __init__(self, attrs=None, upload_url=None, preview_token_url=None):
        super().__init__(attrs)
        # удобные значения по умолчанию для шаблона/JS
        self.upload_url = upload_url or '/api/blog/media/upload/'
        self.preview_token_url = preview_token_url or '/api/blog/preview-token/'

    def get_context(self, name, value, attrs):
        context = super().get_context(name, value, attrs)
        final_attrs = context['widget']['attrs']

        # старые ключи с дефисами оставляем (некоторые JS/HTML может их ожидать),
        # но добавляем удобные ключи без дефисов, чтобы шаблон мог безопасно использовать их
        final_attrs['data-tiptap'] = '1'
        final_attrs['data-upload-url'] = self.upload_url
        final_attrs['data-preview-token-url'] = self.preview_token_url

        # удобные (без дефисов) — для использования в Django-шаблонах
        final_attrs['data_upload_url'] = self.upload_url
        final_attrs['data_preview_token_url'] = self.preview_token_url

        final_attrs.setdefault('class', '')
        final_attrs['class'] += ' admin-tiptap-textarea'
        return context

    def render(self, name, value, attrs=None, renderer=None):
        """
        Попытка отрендерить кастомный шаблон виджета.
        Если шаблон отсутствует или при рендеринге падает ошибка — fallback на стандартный Textarea.
        Это предотвращает 500 при ошибках шаблона / отсутствии static/js.
        """
        renderer = renderer or get_default_renderer()
        try:
            # используем стандартный рендерер который попытается загрузить template_name
            return super().render(name, value, attrs, renderer)
        except TemplateDoesNotExist:
            # если шаблон отсутствует — вернуть plain textarea
            return mark_safe(forms.Textarea().render(name, value, attrs))
        except Exception:
            # при любой другой ошибке — безопасный fallback
            return mark_safe(forms.Textarea().render(name, value, attrs))
