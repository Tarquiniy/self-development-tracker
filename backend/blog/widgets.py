# backend/blog/widgets.py
"""
CKEditor5-based admin widget (replaces TipTap implementation).

Backwards-compatible class name TipTapWidget is kept intentionally so existing
imports/usages keep working. Internally it renders a normal <textarea> and a
wrapper that CKEditor will enhance via static JS.
"""

import json
from django import forms
from django.utils.safestring import mark_safe
from django.utils.html import escape


class TipTapWidget(forms.Textarea):
    """
    Backwards-compatible name: TipTapWidget. Internally initialises CKEditor5 Classic.
    """

    def __init__(self, attrs=None, upload_url="/api/blog/media/upload/"):
        base_attrs = {
            "class": "admin-advanced-editor admin-tiptap-textarea",
            "data-upload-url": upload_url,
            "rows": 18,
        }
        if attrs:
            base_attrs.update(attrs)
        super().__init__(attrs=base_attrs)

    def render(self, name, value, attrs=None, renderer=None):
        final_attrs = self.build_attrs(self.attrs, extra_attrs=attrs)
        final_attrs['name'] = name
        if 'id' not in final_attrs:
            final_attrs['id'] = f"id_{name}"

        textarea_value = "" if value is None else str(value)
        attr_pairs = []
        for k, v in final_attrs.items():
            if v is None:
                continue
            attr_pairs.append(f'{escape(k)}="{escape(str(v))}"')
        textarea_html = f'<textarea {" ".join(attr_pairs)}>{escape(textarea_value)}</textarea>'

        editor_wrapper_id = f'{escape(final_attrs.get("id"))}_cke_wrapper'
        wrapper_html = (
            f'<div id="{editor_wrapper_id}" class="admin-ckeditor-widget" '
            f'data-upload-url="{escape(final_attrs.get("data-upload-url","/api/blog/media/upload/"))}">'
            f'  <div class="ckeditor-toolbar-placeholder" aria-hidden="true"></div>'
            f'  <div class="ckeditor-editor-placeholder" contenteditable="false"></div>'
            f'</div>'
        )

        # The JS file name preserved on purpose (admin/js/tiptap_admin_extra.js),
        # but its content now initializes CKEditor.
        return mark_safe(textarea_html + wrapper_html)

    class Media:
        js = (
            'admin/js/tiptap_admin_extra.js',
        )
        css = {
            'all': (
                'admin/css/tiptap_admin.css',
            )
        }
