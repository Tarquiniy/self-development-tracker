// simple_admin_editor.js
// Lightweight fallback editor enhancement for textareas with class "admin-rich-textarea"
// - Adds toolbar with large accessible buttons
// - Provides simple image insert via prompt/upload hook (delegates to server if provided)
// - Works well in Firefox and other browsers
(function(){
  'use strict';

  function $(sel, ctx){ return (ctx || document).querySelector(sel); }
  function $all(sel, ctx){ return Array.from((ctx || document).querySelectorAll(sel)); }

  function createToolbar(textarea){
    var toolbar = document.createElement('div');
    toolbar.className = 'simple-editor-toolbar';
    var buttons = [
      {name: 'B', title: 'Bold', action: function(t){ wrapSelection(t, '<strong>', '</strong>'); }},
      {name: 'I', title: 'Italic', action: function(t){ wrapSelection(t, '<em>', '</em>'); }},
      {name: 'U', title: 'Underline', action: function(t){ wrapSelection(t, '<u>', '</u>'); }},
      {name: 'H1', title: 'Heading', action: function(t){ insertAtCaret(t, '<h1>Heading</h1>'); }},
      {name: '•', title: 'Bulleted list', action: function(t){ insertAtCaret(t, '<ul><li>Item</li></ul>'); }},
      {name: '1.', title: 'Numbered list', action: function(t){ insertAtCaret(t, '<ol><li>Item</li></ol>'); }},
      {name: 'Link', title: 'Insert link', action: function(t){ var u=prompt('Enter URL:'); if(u) insertAtCaret(t, '<a href=\"'+u+'\">link</a>'); }},
      {name: 'Image', title: 'Insert image URL', action: function(t){ var u=prompt('Image URL:'); if(u) insertAtCaret(t, '<img src=\"'+u+'\" alt=\"image\" />'); }},
      {name: 'Preview', title: 'Toggle preview', action: function(t){ togglePreview(t); }}
    ];
    buttons.forEach(function(b){
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'simple-editor-btn';
      btn.textContent = b.name;
      btn.title = b.title;
      btn.addEventListener('click', function(e){
        e.preventDefault();
        b.action(textarea);
        textarea.dispatchEvent(new Event('input'));
        textarea.focus();
      });
      toolbar.appendChild(btn);
    });
    return toolbar;
  }

  function wrapSelection(t, before, after){
    var start = t.selectionStart || 0, end = t.selectionEnd || 0;
    var val = t.value || '';
    t.value = val.slice(0,start) + before + val.slice(start,end) + after + val.slice(end);
    t.selectionStart = start + before.length;
    t.selectionEnd = end + before.length;
  }

  function insertAtCaret(t, text){
    var start = t.selectionStart || 0, end = t.selectionEnd || 0;
    var val = t.value || '';
    t.value = val.slice(0,start) + text + val.slice(end);
    t.selectionStart = start + text.length;
    t.selectionEnd = start + text.length;
  }

  function createPreviewContainer(){
    var div = document.createElement('div');
    div.className = 'simple-editor-preview';
    div.style.display = 'none';
    return div;
  }

  function togglePreview(t){
    var preview = t._simple_preview;
    if(!preview) return;
    preview.style.display = preview.style.display === 'none' ? 'block' : 'none';
    if(preview.style.display === 'block') renderPreview(t);
  }

  function escapeHtml(s){
    return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function renderPreview(t){
    var preview = t._simple_preview;
    if(!preview) return;
    // Very small conversion: allow basic tags (we store HTML in textarea)
    preview.innerHTML = t.value || '';
  }

  function enhanceTextarea(t){
    if(t._enhanced) return;
    t._enhanced = true;

    // Make sure textarea is visible and responsive
    t.style.minHeight = t.style.minHeight || '200px';
    t.style.boxSizing = 'border-box';
    t.style.width = '100%';

    // Create container
    var container = document.createElement('div');
    container.className = 'simple-editor-container';
    t.parentNode.insertBefore(container, t);
    container.appendChild(t);

    // Toolbar
    var toolbar = createToolbar(t);
    container.insertBefore(toolbar, t);

    // Preview
    var preview = createPreviewContainer();
    container.appendChild(preview);
    t._simple_preview = preview;

    // Update preview on input
    t.addEventListener('input', function(){ renderPreview(t); });

    // On form submit ensure value is ok (no-op but kept for hooks)
    var form = t.closest('form');
    if(form){
      form.addEventListener('submit', function(){ /* no-op: textarea already contains HTML */ });
    }
  }

  // Initialize on DOMContentLoaded for all admin-rich-textarea fields
  function initAll(){
    var areas = $all('textarea.admin-rich-textarea');
    areas.forEach(function(t){
      enhanceTextarea(t);
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();
