# backend/blog/widgets.py
"""
Robust admin textarea widget for TipTap / fallback editor.

Behaviour:
- Renders a plain <textarea> with marker classes.
- Renders a small widget container and an inline script that:
  - tries to initialise TipTap if it's available globally (so you can still
    load TipTap from your static files or CDN if you want),
  - otherwise initialises a solid contentEditable fallback (toolbar, image upload,
    autosave hook and preview hook).
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
        # avoid breaking surrounding HTML when value contains "</textarea>"
        return str(value).replace("</textarea>", "&lt;/textarea&gt;")

    def render(self, name, value, attrs=None, renderer=None):
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
        # We keep the container right after textarea for easy discovery.
        widget_id = f'{escape(final_attrs.get("id"))}_widget'
        upload_url = escape(final_attrs.get("data-upload-url", "/admin/media-library/"))
        preview_url = escape(final_attrs.get("data-preview-token-url", "/admin/posts/preview-token/"))
        editor_mode = escape(final_attrs.get("data-editor", "auto"))

        widget_html = (
            f'<div id="{widget_id}" class="admin-tiptap-widget" '
            f'data-editor="{editor_mode}" data-upload-url="{upload_url}" data-preview-token-url="{preview_url}">'
            f'<div class="tiptap-toolbar"></div><div class="tiptap-editor" contenteditable="true" spellcheck="true"></div>'
            f'</div>'
        )

        # Inline initializer script (idempotent: only one instance runs even with multiple widgets)
        # - tries to use TipTap if window.tiptap (or window["@tiptap/core"]) is available
        # - otherwise uses a robust fallback (contentEditable + toolbar + upload/autosave)
        # The script contains a more resilient detection/normalization for StarterKit/Extensions:
        inline_script = r"""
<script>
(function(){
  // idempotent guard
  if (window._admin_tiptap_widget_inited) {
    // already inited once on this page
    // but continue to bootstrap any newly added textareas
  } else {
    window._admin_tiptap_widget_inited = true;
  }

  function qs(sel, ctx){ return (ctx || document).querySelector(sel); }
  function qsa(sel, ctx){ return Array.from((ctx || document).querySelectorAll(sel)); }
  function getCookie(name) {
    const v = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return v ? v.pop() : '';
  }

  function exec(cmd, value) {
    try { document.execCommand(cmd, false, value); }
    catch(e){ console.warn('execCommand failed', cmd, e); }
  }

  function insertHtmlAtCaret(html) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const div = document.createElement('div');
    div.innerHTML = html;
    const frag = document.createDocumentFragment();
    let node;
    while ((node = div.firstChild)) frag.appendChild(node);
    range.deleteContents();
    range.insertNode(frag);
    sel.removeAllRanges();
    const newRange = document.createRange();
    newRange.setStartAfter(frag.lastChild || frag);
    newRange.collapse(true);
    sel.addRange(newRange);
  }

  async function uploadImage(file, uploadUrl, csrfToken) {
    const fd = new FormData();
    fd.append('file', file, file.name);
    const resp = await fetch(uploadUrl, {
      method: 'POST',
      body: fd,
      credentials: 'same-origin',
      headers: {'X-CSRFToken': csrfToken}
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error('Upload failed: ' + resp.status + ' ' + text);
    }
    const data = await resp.json();
    if (!data) throw new Error('No JSON from upload');
    if (data.url) return data.url;
    if (Array.isArray(data.uploaded) && data.uploaded.length) return data.uploaded[0].url || '';
    if (data.uploaded && data.uploaded[0] && data.uploaded[0].url) return data.uploaded[0].url;
    throw new Error('No URL returned from upload');
  }

  function syncEditableToTextarea(ed, textarea) {
    textarea.value = ed.innerHTML;
    textarea.dispatchEvent(new Event('change', {bubbles:true}));
  }

  function initFallbackForWidget(textarea, widget) {
    try {
      var toolbar = widget.querySelector('.tiptap-toolbar');
      var ed = widget.querySelector('.tiptap-editor');
      if (!ed) {
        ed = document.createElement('div');
        ed.className = 'tiptap-editor';
        ed.contentEditable = 'true';
        ed.spellcheck = true;
        widget.appendChild(ed);
      }
      // initialize content
      ed.innerHTML = textarea.value || '';

      // build toolbar buttons if not present
      if (!toolbar || toolbar.children.length === 0) {
        toolbar = toolbar || document.createElement('div');
        toolbar.className = 'tiptap-toolbar';
        var btns = [
          {label:'<b>B</b>', title:'Bold', cmd: function(){ exec('bold'); }},
          {label:'<i>I</i>', title:'Italic', cmd: function(){ exec('italic'); }},
          {label:'U', title:'Underline', cmd: function(){ exec('underline'); }},
          {label:'H1', title:'Heading 1', cmd: function(){ insertHtmlAtCaret('<h1>'+ (window.getSelection().toString() || 'Heading') +'</h1>'); }},
          {label:'• List', title:'Bulleted list', cmd: function(){ exec('insertUnorderedList'); }},
          {label:'1. List', title:'Numbered list', cmd: function(){ exec('insertOrderedList'); }},
          {label:'</> Code', title:'Code block', cmd: function(){ insertHtmlAtCaret('<pre><code>'+ (window.getSelection().toString() || '') +'</code></pre>'); }},
          {label:'❝', title:'Quote', cmd: function(){ insertHtmlAtCaret('<blockquote>'+ (window.getSelection().toString() || '') +'</blockquote>'); }},
          {label:'🔗', title:'Insert link', cmd: function(){ var u=prompt('Enter URL:'); if(u) exec('createLink', u); }},
          {label:'🖼️', title:'Image', cmd: function(){ imageInput.click(); }},
          {label:'Undo', title:'Undo', cmd: function(){ exec('undo'); }},
          {label:'Redo', title:'Redo', cmd: function(){ exec('redo'); }}
        ];
        btns.forEach(function(b){
          var btn = document.createElement('button');
          btn.type='button';
          btn.className='tiptap-btn';
          btn.innerHTML = b.label;
          if (b.title) btn.title = b.title;
          btn.addEventListener('click', function(e){ e.preventDefault(); try{ b.cmd(); } catch(er){ console.error(er); } ed.focus(); });
          toolbar.appendChild(btn);
        });
        widget.insertBefore(toolbar, ed);
      }

      // image input
      var imageInput = widget._imageInput;
      if (!imageInput) {
        imageInput = document.createElement('input');
        imageInput.type = 'file';
        imageInput.accept = 'image/*';
        imageInput.style.display = 'none';
        imageInput.addEventListener('change', async function(){
          var f = this.files && this.files[0];
          if(!f) return;
          var placeholder = document.createElement('p');
          placeholder.textContent = 'Uploading image...';
          ed.appendChild(placeholder);
          try {
            var uploadUrl = widget.dataset.uploadUrl || '/admin/media-library/';
            var csrf = getCookie('csrftoken');
            var url = await uploadImage(f, uploadUrl, csrf);
            placeholder.outerHTML = '<img src="'+url+'" alt="'+ (f.name||'image') +'" />';
            syncEditableToTextarea(ed, textarea);
          } catch(err){
            placeholder.remove();
            alert('Image upload failed: ' + err.message);
          }
        });
        widget.appendChild(imageInput);
        widget._imageInput = imageInput;
      }

      // sync on input/blur
      ed.addEventListener('input', function(){ syncEditableToTextarea(ed, textarea); });
      ed.addEventListener('blur', function(){ syncEditableToTextarea(ed, textarea); });

      // sync before submit
      var f = textarea.closest('form');
      if (f) {
        f.addEventListener('submit', function(){ syncEditableToTextarea(ed, textarea); });
      }

      // simple autosave (if /admin/posts/autosave/ exists)
      (function(){
        var timer = null;
        var AUTOSAVE_INTERVAL = 30000;
        function schedule(){
          if(timer) clearTimeout(timer);
          timer = setTimeout(async function(){
            try {
              var payload = {
                id: textarea.dataset.postId || null,
                title: (document.querySelector('#id_title') && document.querySelector('#id_title').value) || '',
                excerpt: (document.querySelector('#id_excerpt') && document.querySelector('#id_excerpt').value) || '',
                content: ed.innerHTML,
                content_json: null,
                published_at: (document.querySelector('#id_published_at') && document.querySelector('#id_published_at').value) || null,
                featured_image: (document.querySelector('#id_featured_image') && document.querySelector('#id_featured_image').value) || ''
              };
              var resp = await fetch('/admin/posts/autosave/', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {'Content-Type':'application/json', 'X-CSRFToken': getCookie('csrftoken')},
                body: JSON.stringify(payload)
              });
              try {
                var data = await resp.json();
                if (data && data.success && data.id) textarea.dataset.postId = data.id;
              } catch(e){}
            } catch(e){ console.debug('autosave failed', e); }
            schedule();
          }, AUTOSAVE_INTERVAL);
        }
        schedule();
      })();

      // initial sync
      syncEditableToTextarea(ed, textarea);
    } catch(e){
      console.warn('fallback editor init failed', e);
    }
  }

  // --- Helpers to normalize potential extension exports from various bundles ---
  function normalizeCandidates(raw) {
    // return list of plausible "usable" candidates derived from raw export
    const res = [];
    if (raw === undefined || raw === null) return res;
    res.push(raw);
    if (raw && raw.default && raw.default !== raw) res.push(raw.default);
    try {
      if (typeof raw === 'function') {
        // maybe raw is a factory that returns the extension when called
        try {
          const inst = raw();
          if (inst) res.push(inst);
        } catch (e) { /* noop */ }
        res.push(raw); // keep function itself as fallback (some APIs accept functions)
      }
    } catch (e){}
    try {
      if (raw && typeof raw.configure === 'function') {
        // some extensions provide .configure()
        try {
          const cfg = raw.configure();
          if (cfg) res.push(cfg);
        } catch(e){}
      }
    } catch(e){}
    // remove duplicates & falsy
    return res.filter((v,i,arr)=>v!=null && arr.indexOf(v)===i);
  }

  function tryCreateEditorWithExtensions(extensions) {
    try {
      const Editor = (window.tiptap && window.tiptap.Editor) || (window.tiptapCore && window.tiptapCore.Editor) || (window['@tiptap/core'] && window['@tiptap/core'].Editor) || (window.TipTap && window.TipTap.Editor) || null;
      if (!Editor) { return { ok: false, err: new Error('Editor class not found') }; }
      const el = document.createElement('div');
      // create short-lived editor instance to validate schema
      const inst = new Editor({ element: el, content: '', extensions: extensions });
      try { inst.destroy && inst.destroy(); } catch(e){}
      const hasDoc = inst && inst.schema && inst.schema.nodes && inst.schema.nodes.doc;
      if (!hasDoc) {
        return { ok: false, err: new Error('schema missing doc') };
      }
      return { ok: true, err: null };
    } catch (e) {
      return { ok: false, err: e };
    }
  }

  function buildExtensionsFromRaw(StarterRaw, ImageRaw) {
    // produce best-effort normalized list of extensions or null
    const starterCands = normalizeCandidates(StarterRaw);
    const imageCands = normalizeCandidates(ImageRaw);
    // try combos: starter + image, starter alone, image alone, none
    const combos = [];
    starterCands.forEach(s => {
      if (imageCands.length) {
        imageCands.forEach(img => combos.push([s, img]));
      }
      combos.push([s]);
    });
    imageCands.forEach(img => combos.push([img]));
    combos.push([]); // ultimately try empty (will likely fail)
    // Normalize items: if candidate is function and calling yields extension, use that result
    const normalizedCombos = combos.map(c => {
      try {
        const arr = [];
        c.forEach(item => {
          if (typeof item === 'function') {
            try {
              const called = item();
              if (called) arr.push(called);
              else arr.push(item);
            } catch (e) {
              // keep function itself (Editor may accept class/function)
              arr.push(item);
            }
          } else {
            arr.push(item);
          }
        });
        return arr;
      } catch (e) {
        return c;
      }
    });
    // remove duplicate combos by stringify-ish key
    const seen = new Set();
    const uniq = [];
    normalizedCombos.forEach(c => {
      const key = c.map(x => (x && x.name) || (x && x.constructor && x.constructor.name) || String(x)).join('|');
      if (!seen.has(key)) {
        seen.add(key);
        uniq.push(c);
      }
    });
    return uniq;
  }

  function tryInitTipTapForWidget(textarea, widget) {
    // Attempt to initialise TipTap when available. Conservative and tolerant to different bundle shapes.
    // We first detect Editor class; then attempt to detect StarterKit/Image and try combos to find one
    // that produces a valid schema (doc node). If any attempt throws or fails, we fall back gracefully.
    try {
      // quick check for obvious globals
      if (typeof window === 'undefined') return false;

      const EditorClass = (window.tiptap && window.tiptap.Editor) || (window.tiptapCore && window.tiptapCore.Editor) || (window['@tiptap/core'] && window['@tiptap/core'].Editor) || (window.TipTap && window.TipTap.Editor) || null;
      if (!EditorClass) return false;

      // Try to find StarterKit and Image exports in known global locations
      const StarterRaw =
        (window.tiptap && window.tiptap.StarterKit) ||
        (window.TipTap && window.TipTap.StarterKit) ||
        (window.tiptapCore && window.tiptapCore.StarterKit) ||
        (window['@tiptap/starter-kit']) ||
        (window['@tiptap/starterkit']) ||
        null;

      const ImageRaw =
        (window.tiptap && window.tiptap.Image) ||
        (window.TipTap && window.TipTap.Image) ||
        (window.tiptapCore && window.tiptapCore.Image) ||
        (window['@tiptap/image']) ||
        null;

      // Build candidate extension sets and probe them by attempting a short-lived Editor creation.
      const combos = buildExtensionsFromRaw(StarterRaw, ImageRaw);
      for (let i = 0; i < combos.length; i++) {
        const candidate = combos[i];
        try {
          const probe = tryCreateEditorWithExtensions(candidate);
          if (probe.ok) {
            // Found working extension set. Create real editor hooked to DOM.
            try {
              var el = widget.querySelector('.tiptap-editor');
              if (!el) {
                el = document.createElement('div');
                el.className = 'tiptap-editor';
                widget.appendChild(el);
              }
              // Instantiate TipTap Editor with the found extensions
              var editor = new EditorClass({
                element: el,
                content: textarea.value || '',
                extensions: candidate,
                onUpdate: function({ editor: e }) {
                  // different tiptap builds have different methods; prefer getHTML
                  var html = '';
                  try { html = typeof e.getHTML === 'function' ? e.getHTML() : (e.getHTML ? e.getHTML() : ''); } catch (err) {}
                  if (!html) {
                    // fallback to DOM content
                    html = el.innerHTML || '';
                  }
                  textarea.value = html || '';
                  textarea.dispatchEvent(new Event('change', {bubbles:true}));
                }
              });
              widget._tiptap_editor = editor;
              return true;
            } catch (errInit) {
              // try next candidate
              console.warn('TipTap live init with candidate failed, trying next candidate', errInit);
              continue;
            }
          } else {
            // candidate probe failed - continue trying others
            console.debug('Probe failed for candidate', i, combos[i], probe.err && probe.err.message);
          }
        } catch (e) {
          console.warn('Candidate test error', e);
        }
      }
      // No candidate worked
      return false;
    } catch (err) {
      console.warn('TipTap init attempt failed (outer)', err);
      return false;
    }
  }

  function bootstrapOne(textarea) {
    try {
      var widget = textarea.nextElementSibling && textarea.nextElementSibling.classList && textarea.nextElementSibling.classList.contains('admin-tiptap-widget')
        ? textarea.nextElementSibling
        : (function(){
            // find first .admin-tiptap-widget in parent
            return (textarea.parentNode && textarea.parentNode.querySelector && textarea.parentNode.querySelector('.admin-tiptap-widget')) || null;
          })();
      if (!widget) return;
      // If widget already initialised for this textarea, skip
      if (widget.dataset && widget.dataset._inited_for === textarea.id) return;
      // Strategy depending on data-editor
      var mode = (widget.dataset.editor || 'auto').toLowerCase();
      var triedTipTap = false;
      if (mode === 'tiptap') {
        triedTipTap = tryInitTipTapForWidget(textarea, widget);
        if (!triedTipTap) { initFallbackForWidget(textarea, widget); }
      } else if (mode === 'fallback') {
        initFallbackForWidget(textarea, widget);
      } else { // auto
        triedTipTap = tryInitTipTapForWidget(textarea, widget);
        if (!triedTipTap) initFallbackForWidget(textarea, widget);
      }
      if (widget.dataset) widget.dataset._inited_for = textarea.id;
    } catch(e){
      console.warn('bootstrapOne failed', e);
    }
  }

  function bootstrapAll() {
    var tareas = qsa('textarea.admin-tiptap-textarea');
    tareas.forEach(function(t){
      bootstrapOne(t);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapAll);
  } else {
    // run ASAP
    bootstrapAll();
  }

})();
</script>
"""

        full = textarea_html + widget_html + inline_script
        return mark_safe(full)


class TipTapWidget(_BaseSimpleTextarea, forms.Textarea):
    """
    Backwards-compatible widget name.
    Use attrs to override data-upload-url, data-preview-token-url or data-editor ('auto'|'tiptap'|'fallback').
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
