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
        # attrs is expected to be a dict or None
        super().__init__(attrs=attrs or {})

    def get_attrs(self, name, attrs=None):
        """
        Merge widget attrs (self.attrs) with call-time attrs and ensure an id exists.
        """
        result = {}
        if getattr(self, "attrs", None):
            # copy to avoid mutating original
            result.update(self.attrs)
        if attrs:
            result.update(attrs)
        # ensure id present for admin JS
        if "id" not in result:
            result["id"] = f"id_{name}"
        return result

    def build_attr_string(self, attrs_dict):
        """
        Build HTML attribute string, escaping attribute names and values where appropriate.
        - True boolean attribute -> presence-only (e.g. "required")
        - False/None -> skip
        - other -> k="v" with v escaped
        """
        parts = []
        for k, v in attrs_dict.items():
            if v is True:
                parts.append(f"{escape(k)}")
            elif v is False or v is None:
                continue
            else:
                # Convert to str and escape value. Keep attribute name safe too.
                parts.append(f'{escape(k)}="{escape(str(v))}"')
        return " ".join(parts)

    def render(self, name, value, attrs=None, renderer=None):
        """
        Return a safe textarea HTML string. Avoid templates to prevent template parsing errors.
        Notes:
         - value is inserted as-is (not HTML-escaped) because we expect HTML content inside textarea
           that will be consumed by JS-based editor. To avoid accidental markup breaking we escape
           any literal '</textarea>' sequence.
         - attribute values are escaped.
        """
        value = "" if value is None else value

        final_attrs = self.get_attrs(name, attrs or {})
        # ensure name attribute present
        final_attrs["name"] = name

        # Build default classes: keep provided classes and add ours.
        existing_class = final_attrs.get("class", "")
        classes = []
        if existing_class:
            classes.extend(existing_class.split())
        # ensure both marker classes exist (admin JS expects 'admin-tiptap-textarea')
        if "admin-tiptap-textarea" not in classes:
            classes.append("admin-tiptap-textarea")
        if "admin-advanced-editor" not in classes:
            classes.append("admin-advanced-editor")
        final_attrs["class"] = " ".join(classes)

        # Build attribute string safely
        attr_str = self.build_attr_string(final_attrs)

        # Protect against breaking the surrounding textarea: replace any literal closing tag
        html_value = str(value).replace("</textarea>", "&lt;/textarea&gt;")

        html = f"<textarea {attr_str}>{html_value}</textarea>"
        return mark_safe(html)


class TipTapWidget(_BaseSimpleTextarea, forms.Textarea):
    """
    Backwards-compatible widget name. Renders a plain textarea.
    JS on the page can enhance it (by class name) into a rich editor.

    Accepts attrs dict; you can pass data-upload-url and data-preview-token-url via attrs to
    configure upload / preview endpoints the frontend should use.
    """

    def __init__(self, attrs=None):
        base_attrs = {"class": "admin-advanced-editor admin-tiptap-textarea"}
        if attrs:
            # merge without overwriting base classes entirely; let _BaseSimpleTextarea handle merging
            # but ensure incoming attrs does not remove our defaults.
            # We'll let get_attrs + render handle combining.
            base_attrs.update(attrs)
        super().__init__(attrs=base_attrs)


# alias with alternative capitalization/spelling used elsewhere
class TiptapWidget(TipTapWidget):
    pass


# Provide a simple alias for clarity
class SimpleEditorWidget(TipTapWidget):
    pass


# Explicit exports
__all__ = ["TipTapWidget", "TiptapWidget", "SimpleEditorWidget"]
