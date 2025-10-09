# backend/blog/widgets.py
"""
Robust admin textarea widget for TipTap / fallback editor.

Behaviour:
- Renders a plain <textarea> with marker classes.
- Renders a small widget container and an inline script that:
  - if a global loader exists (window._sdr_tiptap_bootstrapOne) — defers init to it,
  - otherwise tries a conservative TipTap init only when StarterKit (schema) is present,
  - otherwise initialises a solid contentEditable fallback (toolbar, image upload, autosave hook and preview hook).
- All attribute values are escaped safely. We protect against literal </textarea> in value.
- Default data attributes:
    data-editor="auto"  (auto = try tiptap, else fallback)
    data-upload-url="/admin/media-library/"  (can be overridden)
    data-preview-token-url="/admin/posts/preview-token/" (can be overridden)
  You can override via attrs when creating the widget in forms/admin.
"""

from django import forms
from django.utils.safestring import mark_safe
from django.utils.html import escape


class _BaseSimpleTextarea(forms.Widget):
    input_type = "textarea"

    def __init__(self, attrs=None):
        super().__init__(attrs=attrs or {})

    def get_attrs(self, name, attrs=None):
        """
        Produce merged attrs dict, guaranteeing an id.
        """
        result = {}
        if getattr(self, "attrs", None):
            result.update(self.attrs)
        if attrs:
            result.update(attrs)
        if "id" not in result:
            result["id"] = f"id_{name}"
        return result

    def build_attr_string(self, attrs_dict):
        """
        Convert attrs dict into HTML attributes string, escaping values.
        Boolean True -> attribute presence without value.
        Skip False and None.
        """
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
        # avoid breaking surrounding HTML when value contains "</textarea>"
        return str(value).replace("</textarea>", "&lt;/textarea&gt;")

    def render(self, name, value, attrs=None, renderer=None):
        """
        Renders:
          <textarea ...>...</textarea>
          <div class="admin-tiptap-widget" ...>...fallback editor DOM...</div>
          <script> ... inline bootstrap that will either call global loader
                  or perform conservative init/fallback (safe, no globals leaked) ...</script>
        """
        value = "" if value is None else value
        final_attrs = self.get_attrs(name, attrs or {})
        final_attrs["name"] = name

        # Merge / ensure classes
        existing_class = final_attrs.get("class", "")
        classes = []
        if existing_class:
            classes.extend(existing_class.split())
        if "admin-tiptap-textarea" not in classes:
            classes.append("admin-tiptap-textarea")
        if "admin-advanced-editor" not in classes:
            classes.append("admin-advanced-editor")
        final_attrs["class"] = " ".join(classes)

        # Provide sensible data-* defaults if not present
        if "data-editor" not in final_attrs:
            final_attrs["data-editor"] = "auto"  # auto = try tiptap then fallback
        if "data-upload-url" not in final_attrs:
            final_attrs["data-upload-url"] = "/admin/media-library/"
        if "data-preview-token-url" not in final_attrs:
            final_attrs["data-preview-token-url"] = "/admin/posts/preview-token/"

        attr_str = self.build_attr_string(final_attrs)
        html_value = self._protect_textarea_value(value)

        textarea_html = f'<textarea {attr_str}>{escape(html_value)}</textarea>'

        # Widget container that our inline initializer will enhance
        widget_id = f'{escape(final_attrs.get("id"))}_widget'
        upload_url = escape(final_attrs.get("data-upload-url", "/admin/media-library/"))
        preview_url = escape(final_attrs.get("data-preview-token-url", "/admin/posts/preview-token/"))
        editor_mode = escape(final_attrs.get("data-editor", "auto"))

        widget_html = (
            f'<div id="{widget_id}" class="admin-tiptap-widget" '
            f'data-editor="{editor_mode}" data-upload-url="{upload_url}" data-preview-token-url="{preview_url}">'
            f'<div class="tiptap-toolbar"></div>'
            f'<div class="tiptap-editor" contenteditable="true" spellcheck="true"></div>'
            f'</div>'
        )

        # Inline initializer script (idempotent)
        # Strategy:
        # 1) If global loader exists (window._sdr_tiptap_bootstrapOne) - call it for this textarea and exit.
        # 2) Otherwise try a conservative tiptap init only if StarterKit is present (to avoid "schema missing doc").
        # 3) Otherwise initialize the fallback rich text (contentEditable toolbar + upload/autosave).
        #
        # The script avoids creating globals and uses 'use strict'. All potentially-throwing operations
        # are wrapped in try/catch to avoid breaking the admin page.
        textarea_id = escape(final_attrs.get("id", ""))
        inline_script = (
            '<script>(function(){\n'
            "  'use strict';\n"
            "  try {\n"
            f'    var textarea = document.getElementById(\"{textarea_id}\");\n'
            "    if (!textarea) return;\n"
            "    // If there is a global loader (sdr script), defer to it — it handles UMD + starter-kit loading reliably.\n"
            "    if (typeof window !== 'undefined' && window._sdr_tiptap_bootstrapOne && typeof window._sdr_tiptap_bootstrapOne === 'function') {\n"
            "      try { window._sdr_tiptap_bootstrapOne(textarea); return; } catch(e) { console && console.warn && console.warn('global bootstrapOne failed', e); }\n"
            "    }\n"
            "    // Local helpers (no globals)\n"
            "    function qs(sel, ctx){ return (ctx || document).querySelector(sel); }\n"
            "    function qsa(sel, ctx){ return Array.from((ctx || document).querySelectorAll(sel)); }\n"
            "    function getCookie(name) {\n"
            "      var m = document.cookie.match('(^|;)\\\\s*' + name + '\\\\s*=\\\\s*([^;]+)');\n"
            "      return m ? m.pop() : '';\n"
            "    }\n"
            "    function exec(cmd, value) { try { document.execCommand(cmd, false, value); } catch(e) { console && console.warn && console.warn('execCommand failed', cmd, e); } }\n"
            "    function insertHtmlAtCaret(html) {\n"
            "      var sel = window.getSelection && window.getSelection();\n"
            "      if (!sel || sel.rangeCount === 0) return;\n"
            "      var range = sel.getRangeAt(0);\n"
            "      var div = document.createElement('div'); div.innerHTML = html;\n"
            "      var frag = document.createDocumentFragment(); var node;\n"
            "      while ((node = div.firstChild)) frag.appendChild(node);\n"
            "      range.deleteContents(); range.insertNode(frag);\n"
            "      sel.removeAllRanges(); var newRange = document.createRange(); newRange.setStartAfter(frag.lastChild || frag); newRange.collapse(true); sel.addRange(newRange);\n"
            "    }\n"
            "    async function uploadImage(file, uploadUrl) {\n"
            "      var fd = new FormData(); fd.append('file', file, file.name);\n"
            "      var csrf = getCookie('csrftoken');\n"
            "      var resp = await fetch(uploadUrl, { method: 'POST', body: fd, credentials: 'same-origin', headers: {'X-CSRFToken': csrf} });\n"
            "      if (!resp.ok) { var txt = ''; try{ txt = await resp.text(); }catch(e){}; throw new Error('Upload failed: ' + resp.status + ' ' + txt); }\n"
            "      var j = await resp.json(); return j && (j.url || (j.uploaded && j.uploaded[0] && j.uploaded[0].url)) || null;\n"
            "    }\n"
            "    function syncEditableToTextarea(ed, ta) {\n"
            "      try { ta.value = ed.innerHTML; ta.dispatchEvent(new Event('change', {bubbles:true})); } catch(e) { console && console.warn && console.warn('sync failed', e); }\n"
            "    }\n"
            "    // Fallback editor init (contentEditable + toolbar + upload + autosave)\n"
            "    function initFallbackForWidget(ta, widget) {\n"
            "      try {\n"
            "        var toolbar = widget.querySelector('.tiptap-toolbar');\n"
            "        var ed = widget.querySelector('.tiptap-editor');\n"
            "        if (!ed) { ed = document.createElement('div'); ed.className = 'tiptap-editor'; ed.contentEditable = 'true'; ed.spellcheck = true; widget.appendChild(ed); }\n"
            "        ed.innerHTML = ta.value || '';\n"
            "        // build toolbar if empty\n"
            "        if (!toolbar || toolbar.children.length === 0) {\n"
            "          toolbar = toolbar || document.createElement('div'); toolbar.className = 'tiptap-toolbar';\n"
            "          var btns = [\n"
            "            {label:'<b>B</b>', title:'Bold', cmd:function(){ exec('bold'); }},\n"
            "            {label:'<i>I</i>', title:'Italic', cmd:function(){ exec('italic'); }},\n"
            "            {label:'U', title:'Underline', cmd:function(){ exec('underline'); }},\n"
            "            {label:'• List', title:'Bulleted list', cmd:function(){ exec('insertUnorderedList'); }},\n"
            "            {label:'1. List', title:'Numbered list', cmd:function(){ exec('insertOrderedList'); }},\n"
            "            {label:'</> Code', title:'Code block', cmd:function(){ insertHtmlAtCaret('<pre><code>'+ (window.getSelection && window.getSelection().toString ? window.getSelection().toString() : '') +'</code></pre>'); }},\n"
            "            {label:'🔗', title:'Insert link', cmd:function(){ var u=prompt('Enter URL:'); if(u) exec('createLink', u); }},\n"
            "            {label:'🖼️', title:'Image', cmd:function(){ if (imageInput) imageInput.click(); }},\n"
            "            {label:'Undo', title:'Undo', cmd:function(){ exec('undo'); }},\n"
            "            {label:'Redo', title:'Redo', cmd:function(){ exec('redo'); }}\n"
            "          ];\n"
            "          btns.forEach(function(b){ var btn = document.createElement('button'); btn.type='button'; btn.className='tiptap-btn'; btn.innerHTML = b.label; if (b.title) btn.title = b.title; btn.addEventListener('click', function(e){ e.preventDefault(); try { b.cmd(); } catch(er) { console && console.error && console.error(er); } ed.focus(); }); toolbar.appendChild(btn); });\n"
            "          widget.insertBefore(toolbar, ed);\n"
            "        }\n"
            "        // image input (hidden)\n"
            "        var imageInput = widget._imageInput;\n"
            "        if (!imageInput) {\n"
            "          imageInput = document.createElement('input'); imageInput.type = 'file'; imageInput.accept = 'image/*'; imageInput.style.display = 'none';\n"
            "          imageInput.addEventListener('change', async function(){ var f = this.files && this.files[0]; if(!f) return; var placeholder = document.createElement('p'); placeholder.textContent = 'Uploading image...'; ed.appendChild(placeholder); try { var upUrl = widget.dataset.uploadUrl || widget.getAttribute('data-upload-url') || '/admin/media-library/'; var url = await uploadImage(f, upUrl); if(url) placeholder.outerHTML = '<img src=\"'+url+'\" alt=\"'+(f.name||'image')+'\" />'; syncEditableToTextarea(ed, ta); } catch(err){ placeholder.remove(); alert('Image upload failed: ' + (err && err.message)); } });\n"
            "          widget.appendChild(imageInput); widget._imageInput = imageInput;\n"
            "        }\n"
            "        // events\n"
            "        ed.addEventListener('input', function(){ syncEditableToTextarea(ed, ta); });\n"
            "        ed.addEventListener('blur', function(){ syncEditableToTextarea(ed, ta); });\n"
            "        var form = ta.closest && ta.closest('form'); if (form) { form.addEventListener('submit', function(){ syncEditableToTextarea(ed, ta); }); }\n"
            "        // autosave (best-effort, non-blocking)\n"
            "        (function(){ var timer = null; var INTERVAL = 30000; function schedule(){ if(timer) clearTimeout(timer); timer = setTimeout(async function(){ try { var payload = { id: ta.dataset.postId || null, title: (document.querySelector('#id_title') && document.querySelector('#id_title').value) || '', excerpt: (document.querySelector('#id_excerpt') && document.querySelector('#id_excerpt').value) || '', content: ed.innerHTML, content_json: null, published_at: (document.querySelector('#id_published_at') && document.querySelector('#id_published_at').value) || null, featured_image: (document.querySelector('#id_featured_image') && document.querySelector('#id_featured_image').value) || '' }; var resp = await fetch('/admin/posts/autosave/', { method: 'POST', credentials: 'same-origin', headers: {'Content-Type':'application/json','X-CSRFToken': getCookie('csrftoken')}, body: JSON.stringify(payload) }); try { var dd = await resp.json(); if (dd && dd.success && dd.id) ta.dataset.postId = dd.id; } catch(e){} } catch(e){ /* ignore autosave errors */ } schedule(); }, INTERVAL); } schedule(); })();\n"
            "        widget.dataset._inited_for = ta.id;\n"
            "        // initial sync\n"
            "        syncEditableToTextarea(ed, ta);\n"
            "        return true;\n"
            "      } catch(e) { console && console.warn && console.warn('fallback editor init failed', e); return false; }\n"
            "    }\n"
            "\n"
            "    // Conservative TipTap init attempt for single widget\n"
            "    // IMPORTANT: only attempt TipTap init locally if StarterKit (schema) is present to avoid 'schema missing doc' errors\n"
            "    function tryInitTipTapForWidget(ta, widget) {\n"
            "      try {\n"
            "        // require both Editor and StarterKit to be present (otherwise core-only leads to schema errors)\n"
            "        var hasEditor = (window.tiptap && window.tiptap.Editor) || (window.tiptapCore && window.tiptapCore.Editor) || (window['@tiptap/core'] && window['@tiptap/core'].Editor);\n"
            "        var hasStarter = (window.tiptap && window.tiptap.StarterKit) || (window.TipTap && window.TipTap.StarterKit) || (window['@tiptap/starter-kit']);\n"
            "        if (!hasEditor || !hasStarter) return false;\n"
            "        var CoreEditor = window.tiptap && window.tiptap.Editor ? window.tiptap.Editor : (window.tiptapCore && window.tiptapCore.Editor) || (window['@tiptap/core'] && window['@tiptap/core'].Editor);\n"
            "        if (!CoreEditor) return false;\n"
            "        var el = widget.querySelector('.tiptap-editor'); if (!el) { el = document.createElement('div'); el.className = 'tiptap-editor'; widget.appendChild(el); }\n"
            "        // Use StarterKit from global exports (most common UMD exposes window.tiptap.StarterKit)\n"
            "        var Starter = (window.tiptap && window.tiptap.StarterKit) || (window.TipTap && window.TipTap.StarterKit) || (window['@tiptap/starter-kit'] && window['@tiptap/starter-kit'].default) || null;\n"
            "        var extensions = [];\n"
            "        if (Starter) {\n"
            "          try { extensions.push(typeof Starter === 'function' ? Starter() : (Starter.default && typeof Starter.default === 'function' ? Starter.default() : Starter)); } catch(e) { try { extensions.push(Starter); } catch(_){} }\n"
            "        }\n"
            "        var editor = new CoreEditor({ element: el, content: ta.value || '', extensions: extensions, onUpdate: function(payload){ try { var e = payload && payload.editor ? payload.editor : payload; var html = (e && typeof e.getHTML === 'function') ? e.getHTML() : (el && el.innerHTML) || ''; ta.value = html; ta.dispatchEvent(new Event('change', {bubbles:true})); } catch(err) {} } });\n"
            "        widget._tiptap_editor = editor;\n"
            "        widget.dataset._inited_for = ta.id;\n"
            "        return true;\n"
            "      } catch(err) { console && console.warn && console.warn('TipTap init attempt failed, falling back', err); return false; }\n"
            "    }\n"
            "\n"
            "    // bootstrap logic: prefer global loader, then conservative tiptap (only if StarterKit present), otherwise fallback\n"
            "    (function(){\n"
            "      try {\n"
            "        var widget = textarea.nextElementSibling && textarea.nextElementSibling.classList && textarea.nextElementSibling.classList.contains('admin-tiptap-widget') ? textarea.nextElementSibling : (textarea.parentNode && textarea.parentNode.querySelector ? textarea.parentNode.querySelector('.admin-tiptap-widget') : null);\n"
            "        if (!widget) return;\n            if (widget.dataset && widget.dataset._inited_for === textarea.id) return;\n            var mode = (widget.dataset && widget.dataset.editor) ? widget.dataset.editor.toLowerCase() : 'auto';\n            if (mode === 'fallback') { initFallbackForWidget(textarea, widget); return; }\n            // if a global loader has become available meanwhile, call it\n            if (typeof window !== 'undefined' && window._sdr_tiptap_bootstrapOne && typeof window._sdr_tiptap_bootstrapOne === 'function') {\n              try { window._sdr_tiptap_bootstrapOne(textarea); return; } catch(e) { console && console.warn && console.warn('deferred global bootstrapOne failed', e); }\n            }\n            // Try conservative TipTap init only if StarterKit is present (to avoid schema errors)\n            var tried = false;\n            try {\n              var hasStarterNow = (window.tiptap && window.tiptap.StarterKit) || (window.TipTap && window.TipTap.StarterKit) || (window['@tiptap/starter-kit']);\n              if (hasStarterNow) {\n                tried = tryInitTipTapForWidget(textarea, widget);\n                if (tried) return;\n              }\n            } catch(e) { console && console.debug && console.debug('local tiptap attempt error', e); }\n            // fallback\n            initFallbackForWidget(textarea, widget);\n      } catch(e) { console && console.warn && console.warn('bootstrapOne failed', e); try { initFallbackForWidget(textarea, widget); } catch(_) {} }\n    })();\n"
            "\n"
            "  } catch (e) {\n"
            "    try { console && console.warn && console.warn('tiptap widget inline script top-level error', e); } catch(_){}\n"
            "  }\n"
            "})();</script>"
        )

        full = textarea_html + widget_html + inline_script
        return mark_safe(full)


class TipTapWidget(_BaseSimpleTextarea, forms.Textarea):
    """
    Backwards-compatible widget name.

    Use attrs to override:
      - data-upload-url
      - data-preview-token-url
      - data-editor ('auto'|'tiptap'|'fallback').
    """
    def __init__(self, attrs=None):
        base_attrs = {
            "class": "admin-advanced-editor admin-tiptap-textarea",
            # default data attributes (can be overridden by passing attrs)
            "data-editor": "auto",
            "data-upload-url": "/admin/media-library/",
            "data-preview-token-url": "/admin/posts/preview-token/",
        }
        if attrs:
            base_attrs.update(attrs)
        super().__init__(attrs=base_attrs)


class TiptapWidget(TipTapWidget):
    pass


class SimpleEditorWidget(TipTapWidget):
    # alias - you can set data-editor="fallback" to force fallback behavior
    pass


__all__ = ["TipTapWidget", "TiptapWidget", "SimpleEditorWidget"]
