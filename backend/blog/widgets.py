# backend/blog/widgets.py
from django import forms
from django.utils.safestring import mark_safe
from django.utils.html import escape
import json

"""
Widget compatibility layer.
Ранее назывался TipTapWidget. Чтобы не ломать существующие imports,
мы сохраняем имя TipTapWidget, но реализация использует CKEditor 5.
Выводит обычный <textarea> (для работы Django forms/admin) и
вставляет контейнер, который инициализирует CKEditor через
статический скрипт admin/js/ckeditor_admin_extra.js.
"""

class _BaseSimpleTextarea(forms.Widget):
    input_type = "textarea"

    def __init__(self, attrs=None):
        super().__init__(attrs=attrs or {})

    def get_attrs(self, name, attrs=None):
        result = {}
        if getattr(self, "attrs", None):
            result.update(self.attrs)
        if attrs:
            result.update(attrs)
        if "id" not in result:
            result["id"] = f"id_{name}"
        return result

    def build_attr_string(self, attrs_dict):
        parts = []
        for k, v in attrs_dict.items():
            if v is True:
                parts.append(f"{escape(k)}")
            elif v is False or v is None:
                continue
            else:
                parts.append(f'{escape(k)}="{escape(str(v))}"')
        return " ".join(parts)

    def _protect_textarea_value(self, value):
        return str(value).replace("</textarea>", "&lt;/textarea&gt;")

    def render(self, name, value, attrs=None, renderer=None):
        value = "" if value is None else value
        final_attrs = self.get_attrs(name, attrs or {})
        final_attrs["name"] = name
        existing_class = final_attrs.get("class", "")
        classes = []
        if existing_class:
            classes.extend(existing_class.split())
        # Keep legacy class name so admin templates that expect it continue to work.
        if "admin-tiptap-textarea" not in classes:
            classes.append("admin-tiptap-textarea")
        if "admin-ckeditor-textarea" not in classes:
            classes.append("admin-ckeditor-textarea")
        if "admin-advanced-editor" not in classes:
            classes.append("admin-advanced-editor")
        final_attrs["class"] = " ".join(classes)

        # sensible data-* defaults
        if "data-upload-url" not in final_attrs:
            final_attrs["data-upload-url"] = "/api/blog/media/upload/"
        if "data-preview-token-url" not in final_attrs:
            final_attrs["data-preview-token-url"] = "/admin/posts/preview-token/"

        attr_str = self.build_attr_string(final_attrs)
        html_value = self._protect_textarea_value(value)
        textarea_html = f'<textarea {attr_str}>{escape(html_value)}</textarea>'

        # editor container that will be enhanced by admin/js/ckeditor_admin_extra.js
        widget_id = f'{escape(final_attrs.get("id"))}_ckeditor_widget'
        upload_url = escape(final_attrs.get("data-upload-url", "/api/blog/media/upload/"))
        preview_url = escape(final_attrs.get("data-preview-token-url", "/admin/posts/preview-token/"))

        widget_html = (
            f'<div id="{widget_id}" class="admin-ckeditor-widget" '
            f'data-upload-url="{upload_url}" data-preview-token-url="{preview_url}" '
            f'aria-hidden="false">'
            f'<div class="ckeditor-toolbar" aria-hidden="true"></div>'
            f'<div class="ckeditor-editor" contenteditable="true"></div>'
            f'</div>'
        )

        # Return textarea + widget container. External static JS will init CKEditor.
        return mark_safe(textarea_html + widget_html)


class TipTapWidget(_BaseSimpleTextarea, forms.Textarea):
    """
    Backwards-compatible name. Uses CKEditor 5 under the hood.
    Use attrs to override data-upload-url, data-preview-token-url.
    """
    def __init__(self, attrs=None):
        base_attrs = {
            "class": "admin-advanced-editor admin-tiptap-textarea admin-ckeditor-textarea",
            "data-upload-url": "/api/blog/media/upload/",
            "data-preview-token-url": "/admin/posts/preview-token/",
        }
        if attrs:
            base_attrs.update(attrs)
        super().__init__(attrs=base_attrs)


# Aliases for compatibility
class TiptapWidget(TipTapWidget):
    pass

class SimpleEditorWidget(TipTapWidget):
    pass

__all__ = ["TipTapWidget", "TiptapWidget", "SimpleEditorWidget"]
