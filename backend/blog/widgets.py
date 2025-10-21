# backend/blog/widgets.py
"""
CKEditor5-backed admin widget with a robust fallback.

- If django_ckeditor_5 is installed and widget class available, we use CKEditor5Widget.
- Otherwise we render a safe <textarea> enhanced by a lightweight fallback editor (simple_admin_editor.js).
- We also provide admin CSS/JS via the widget's Media so nothing extra is required in templates.
"""

from django import forms
from django.utils.safestring import mark_safe
from django.utils.html import escape
import logging

logger = logging.getLogger(__name__)

# Try to import official CKEditor5 widget
try:
    from django_ckeditor_5.widgets import CKEditor5Widget
    HAS_CKEDITOR_WIDGET = True
except Exception:
    CKEditor5Widget = None
    HAS_CKEDITOR_WIDGET = False

class _BaseAdminTextarea(forms.Textarea):
    def __init__(self, attrs=None):
        base = {
            "class": "vLargeTextField admin-rich-textarea",
            "rows": 10,
        }
        if attrs:
            base.update(attrs)
        super().__init__(attrs=base)

    def _protect_textarea_value(self, value):
        # avoid breaking surrounding HTML when value contains "</textarea>"
        return ("" if value is None else str(value)).replace("</textarea>", "&lt;/textarea&gt;")

    def render(self, name, value, attrs=None, renderer=None):
        final_attrs = self.build_attrs(self.attrs, extra_attrs=attrs)
        final_attrs["name"] = name
        final_attrs.setdefault("id", f"id_{name}")
        html_value = escape(self._protect_textarea_value(value))
        textarea = f'<textarea {forms.widgets.flatatt(final_attrs)}>{html_value}</textarea>'
        return mark_safe(textarea)

    class Media:
        css = {
            "all": (
                "admin/css/admin-fixes.css",
            )
        }
        js = (
            # fallback editor enhancement
            "admin/js/simple_admin_editor.js",
        )

class CKEditorAdminWidget(forms.Widget):
    """
    Widget that uses CKEditor5Widget if available, else fallback to _BaseAdminTextarea (enhanced by simple_admin_editor.js).
    """
    def __init__(self, ckeditor_config_name='extends', attrs=None):
        self.ckeditor_config_name = ckeditor_config_name
        self.attrs = attrs or {}

        if HAS_CKEDITOR_WIDGET:
            # Create an instance of the upstream widget to delegate rendering
            self._delegate = CKEditor5Widget(config_name=ckeditor_config_name, attrs=self.attrs)
        else:
            self._delegate = _BaseAdminTextarea(attrs=self.attrs)

    def render(self, name, value, attrs=None, renderer=None):
        # Delegate rendering to either CKEditor widget or fallback textarea
        try:
            return self._delegate.render(name, value, attrs=attrs, renderer=renderer)
        except Exception as e:
            logger.exception("CKEditorAdminWidget render failed, falling back: %s", e)
            # fallback HTML
            base = _BaseAdminTextarea(attrs=self.attrs)
            return base.render(name, value, attrs=attrs, renderer=renderer)

    def value_from_datadict(self, data, files, name):
        try:
            return self._delegate.value_from_datadict(data, files, name)
        except Exception:
            return data.get(name)

    @property
    def media(self):
        # Combine media from delegate (if available) plus our admin css/js for fallback styling
        media = forms.Media()
        try:
            if hasattr(self._delegate, 'media'):
                media = self._delegate.media + media
        except Exception:
            pass
        # Ensure admin fixes and fallback js are present (duplicates are ok)
        media = media + forms.Media(css={'all': ('admin/css/admin-fixes.css',)}, js=('admin/js/simple_admin_editor.js',))
        return media

# Exported names
CKEditorWidget = CKEditorAdminWidget
