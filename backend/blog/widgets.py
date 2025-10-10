#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
backend/blog/widgets.py
CKEditor 5 admin widget replacement for TipTap.

This file defines CKEditorWidget which renders a textarea fallback and a wrapper
with JSON config that the client-side init script reads to create CKEditor.
"""
import json
from django import forms
from django.utils.html import escape
from django.utils.safestring import mark_safe

CKEDITOR_CDN = "https://cdn.jsdelivr.net/npm/@ckeditor/ckeditor5-build-classic@44.3.0/build/ckeditor.js"


class CKEditorWidget(forms.Textarea):
    """
    Django form widget that renders a textarea plus a div wrapper with
    data-ckeditor-config which the admin/frontend JS will use to initialize CKEditor.
    """
    template_name = None  # we're rendering manually in render()

    class Media:
        js = (
            CKEDITOR_CDN,
            "admin/js/ckeditor_upload_adapter.js",
            "admin/js/ckeditor_init.js",
        )
        css = {
            "all": (
                "admin/css/ckeditor_admin.css",
            )
        }

    def __init__(self, attrs=None):
        base_attrs = {
            "class": "admin-advanced-editor admin-ckeditor-textarea",
            # defaults that can be overridden via attrs
            "data-editor": "auto",  # 'auto'|'ckeditor'|'fallback'
            "data-upload-url": "/api/blog/media/upload/",
            "data-preview-token-url": "/admin/posts/preview-token/",
        }
        if attrs:
            base_attrs.update(attrs)
        super().__init__(attrs=base_attrs)

    def get_config(self, name, value, attrs):
        """
        Return a serializable config dict for the client-side initializer.
        """
        final = attrs or {}
        cfg = {
            "editor": final.get("data-editor", "auto"),
            "uploadUrl": final.get("data-upload-url", "/api/blog/media/upload/"),
            "previewTokenUrl": final.get("data-preview-token-url", "/admin/posts/preview-token/"),
            "name": name,
            "id": final.get("id") or f"id_{name}",
            "initialData": value or "",
        }
        extra = final.get("data-ckeditor-extra")
        if extra:
            try:
                if isinstance(extra, str):
                    extra_parsed = json.loads(extra)
                else:
                    extra_parsed = extra
                if isinstance(extra_parsed, dict):
                    cfg.update(extra_parsed)
            except Exception:
                pass
        return cfg

    def render(self, name, value, attrs=None, renderer=None):
        final_attrs = self.build_attrs(self.attrs, attrs or {})
        textarea_value = escape(self.format_value(value) or "")
        # ensure id exists
        final_id = final_attrs.get("id") or f"id_{name}"
        final_attrs["id"] = final_id

        # build attribute string safely
        parts = []
        for k, v in final_attrs.items():
            if v is None or v == "":
                continue
            parts.append(f'{k}="{escape(str(v))}"')
        attr_str = " ".join(parts)

        config = self.get_config(name, value, final_attrs)
        try:
            cfg_json = json.dumps(config, ensure_ascii=False)
        except Exception:
            cfg_json = "{}"

        # wrapper for the visual editor — JS will replace the inner container with CKEditor instance
        wrapper_html = (
            f'<div class="admin-ckeditor-widget" data-ckeditor-config="{escape(cfg_json)}" '
            f'id="{escape(final_id)}_ckeditor_wrapper">'
            f'<div class="ckeditor-toolbar"></div><div class="ckeditor-editor" contenteditable="true"></div>'
            f'</div>'
        )

        textarea_html = f'<textarea {attr_str}>{textarea_value}</textarea>'
        noscript_html = '<noscript><p>Включите JavaScript для использования визуального редактора; доступен простой textarea.</p></noscript>'

        # Combine: textarea first (keeps forms working without JS), then wrapper
        html = textarea_html + wrapper_html + noscript_html
        return mark_safe(html)


class SimpleEditorWidget(CKEditorWidget):
    """
    Alias for CKEditorWidget — kept for backward compatibility with code that
    referenced SimpleEditorWidget.
    """
    pass


__all__ = ["CKEditorWidget", "SimpleEditorWidget"]
