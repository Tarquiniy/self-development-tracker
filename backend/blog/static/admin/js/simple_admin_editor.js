// simple_admin_editor.js
// Minimal editor enhancement for Django admin textarea with class "admin-simple-editor"
// - toolbar for bold/italic/link/image (inserts markdown-like syntax)
// - simple live preview

(function(){
  function $(s, ctx){ return (ctx || document).querySelector(s); }
  function $all(s, ctx){ return Array.from((ctx || document).querySelectorAll(s)); }

  function createToolbar(textarea){
    var toolbar = document.createElement('div');
    toolbar.className = 'simple-editor-toolbar';
    var buttons = [
      {name: 'B', title: 'Bold', insert: function(t){ wrapSelection(t, '**', '**'); }},
      {name: 'I', title: 'Italic', insert: function(t){ wrapSelection(t, '_', '_'); }},
      {name: 'Link', title: 'Link', insert: function(t){ insertAtCaret(t, '[link text](https://)'); }},
      {name: 'Image', title: 'Image', insert: function(t){ insertAtCaret(t, '![alt text](https://)'); }},
      {name: 'Preview', title: 'Toggle preview', insert: function(t){ togglePreview(t); }}
    ];
    buttons.forEach(function(b){
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'simple-editor-btn';
      btn.textContent = b.name;
      btn.title = b.title;
      btn.addEventListener('click', function(e){
        e.preventDefault();
        b.insert(textarea);
        // trigger input event for preview
        textarea.dispatchEvent(new Event('input'));
      });
      toolbar.appendChild(btn);
    });
    return toolbar;
  }

  function wrapSelection(t, prefix, suffix){
    var start = t.selectionStart, end = t.selectionEnd;
    var val = t.value;
    t.value = val.slice(0,start) + prefix + val.slice(start,end) + suffix + val.slice(end);
    t.selectionStart = start + prefix.length;
    t.selectionEnd = end + prefix.length;
    t.focus();
  }

  function insertAtCaret(t, text){
    var start = t.selectionStart, end = t.selectionEnd;
    var val = t.value;
    t.value = val.slice(0,start) + text + val.slice(end);
    t.selectionStart = start + text.length;
    t.selectionEnd = start + text.length;
    t.focus();
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
    // update content
    renderPreview(t);
  }

  function renderPreview(t){
    var preview = t._simple_preview;
    if(!preview) return;
    // super-simple markdown -> HTML conversion
    var v = escapeHtml(t.value || '');
    // headings
    v = v.replace(/^###### (.*$)/gim, '<h6>$1</h6>');
    v = v.replace(/^##### (.*$)/gim, '<h5>$1</h5>');
    v = v.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
    v = v.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    v = v.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    v = v.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    // bold/italic
    v = v.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    v = v.replace(/\_(.*?)\_/g, '<em>$1</em>');
    // links
    v = v.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    // images
    v = v.replace(/\!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;">');
    // paragraphs
    v = v.replace(/\n{2,}/g, '</p><p>');
    v = '<p>' + v.replace(/\n/g, '<br>') + '</p>';
    preview.innerHTML = v;
  }

  function escapeHtml(str){
    return str.replace(/[&<>"']/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]; });
  }

  function enhanceTextarea(t){
    if(t._simple_enhanced) return;
    t._simple_enhanced = true;

    var toolbar = createToolbar(t);
    var preview = createPreviewContainer();
    t._simple_preview = preview;

    // insert toolbar before textarea
    t.parentNode.insertBefore(toolbar, t);
    t.parentNode.insertBefore(preview, t.nextSibling);

    // listen to input -> update preview if visible
    t.addEventListener('input', function(){ renderPreview(t); });

    // initial render
    renderPreview(t);

    // allow TAB to insert tab char
    t.addEventListener('keydown', function(e){
      if(e.key === 'Tab'){
        e.preventDefault();
        var start = t.selectionStart, end = t.selectionEnd;
        t.value = t.value.substring(0,start) + '    ' + t.value.substring(end);
        t.selectionStart = t.selectionEnd = start + 4;
      }
    });
  }

  // On DOM ready, find textareas with class admin-simple-editor
  document.addEventListener('DOMContentLoaded', function(){
    var areas = $all('textarea.admin-simple-editor');
    areas.forEach(function(t){
      enhanceTextarea(t);
    });
  });

})();
