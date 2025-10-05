# backend/blog/widgets.py
from django import forms
from django.utils.safestring import mark_safe

class TiptapWidget(forms.Textarea):
    """
    Совместимый виджет для TipTap (шаблон: templates/admin/widgets/tiptap_widget.html).
    - Добавляет data-атрибуты upload/preview для шаблона.
    - Не выполняет импортов, которые могут вызвать циклическую зависимость при autodiscover admin.
    """
    template_name = 'admin/widgets/tiptap_widget.html'

    def __init__(self, attrs=None, upload_url=None, preview_token_url=None):
        # Не используем аннотации вида str|None для лучшей совместимости
        attrs = dict(attrs) if attrs else {}
        # default upload/preview endpoints — можно переопределить при создании виджета
        self.upload_url = upload_url or '/admin/blog/media-library/'
        self.preview_token_url = preview_token_url or '/admin/blog/preview-token/'
        # гарантируем базовый класс поведения Textarea
        super().__init__(attrs=attrs)

    def get_context(self, name, value, attrs):
        """
        Добавляем данные в attrs, которые шаблон читает через widget.attrs.
        Пример итоговых атрибутов: data-tiptap="1", data-upload-url="...", class="admin-tiptap-textarea"
        """
        context = super().get_context(name, value, attrs)
        final_attrs = context['widget'].setdefault('attrs', {})
        # Помещаем data-* атрибуты для шаблона
        final_attrs['data-tiptap'] = '1'
        final_attrs['data-upload-url'] = self.upload_url
        final_attrs['data-preview-token-url'] = self.preview_token_url
        # добавляем CSS-класс, не ломая существующие классы
        existing = final_attrs.get('class', '')
        if existing:
            final_attrs['class'] = f"{existing} admin-tiptap-textarea"
        else:
            final_attrs['class'] = "admin-tiptap-textarea"
        return context

    def render(self, name, value, attrs=None, renderer=None):
        """
        Оставляем стандартный рендеринг textarea, шаблон admin/widgets/tiptap_widget.html
        подхватит нужные атрибуты (и покажет TipTap).
        mark_safe здесь — чтобы быть совместимым с вашим текущим шаблоном.
        """
        html = super().render(name, value, attrs, renderer)
        return mark_safe(html)

# Алиас для обратной совместимости: некоторые места в коде могли импортировать TipTapWidget
TipTapWidget = TiptapWidget
