# backend/blog/widgets.py
"""
Безопасный, минимальный виджет-заместитель для редактора.
Не использует render_to_string / шаблоны — рендерит чистый <textarea>.
Обеспечивает TipTapWidget и TiptapWidget (алиасы) чтобы существующие импорты не ломались.
"""

from django import forms
from django.utils.safestring import mark_safe
from django.utils.html import escape

class _BaseSimpleTextarea(forms.Widget):
    input_type = "textarea"

    def __init__(self, attrs=None):
        super().__init__(attrs=attrs or {})

    def get_attrs(self, name, attrs=None):
        # merge attrs: widget attrs <- call attrs
        result = {}
        if getattr(self, "attrs", None):
            result.update(self.attrs)
        if attrs:
            result.update(attrs)
        # ensure an id exists to play nicely with admin JS
        if 'id' not in result:
            result['id'] = f'id_{name}'
        return result

    def build_attr_string(self, attrs_dict):
        parts = []
        for k, v in attrs_dict.items():
            if v is True:
                parts.append(f'{escape(k)}')
            elif v is False or v is None:
                continue
            else:
                parts.append(f'{escape(k)}="{escape(str(v))}"')
        return " ".join(parts)

    def render(self, name, value, attrs=None, renderer=None):
        """
        Return a safe textarea HTML string. Avoids using templates to prevent
        template parsing errors on servers with custom templates.
        """
        value = "" if value is None else value
        final_attrs = self.get_attrs(name, attrs or {})
        # ensure name attr present (some callers expect it)
        final_attrs['name'] = name
        # preserve classes if any, and provide a default marker class for JS
        if 'class' in final_attrs:
            final_attrs['class'] = final_attrs['class']
        else:
            final_attrs['class'] = 'django-admin-textarea'
        attr_str = self.build_attr_string(final_attrs)
        # Escape value for safe inline HTML
        html_value = escape(str(value))
        html = f'<textarea {attr_str}>{html_value}</textarea>'
        return mark_safe(html)


class TipTapWidget(_BaseSimpleTextarea, forms.Textarea):
    """
    Backwards-compatible widget name. Renders a plain textarea.
    JS on the page can enhance it (by class name) into a rich editor.
    """
    def __init__(self, attrs=None):
        # keep default class that admin JS can target (e.g. 'admin-advanced-editor')
        base_attrs = {'class': 'admin-advanced-editor'}
        if attrs:
            base_attrs.update(attrs)
        super().__init__(attrs=base_attrs)

# alias with alternative capitalization/spelling used elsewhere
class TiptapWidget(TipTapWidget):
    pass

# export simple fallback too
class SimpleEditorWidget(TipTapWidget):
    pass

# Provide __all__ for clearer imports
__all__ = ["TipTapWidget", "TiptapWidget", "SimpleEditorWidget"]
