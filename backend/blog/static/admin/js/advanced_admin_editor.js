// blog/static/admin/js/advanced_admin_editor.js
(function () {
  // safe init after DOM ready
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $all(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

  function initAdvancedEditors() {
    $all('textarea.admin-advanced-editor').forEach(function (ta) {
      if (ta.__advanced_inited) return;
      ta.__advanced_inited = true;

      // build toolbar
      var toolbar = document.createElement('div');
      toolbar.className = 'admin-advanced-toolbar';

      var btn = function (label, title, cb) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'aae-btn';
        b.innerHTML = label;
        b.title = title || label;
        b.addEventListener('click', function (e) {
          e.preventDefault();
          cb && cb();
        });
        return b;
      };

      // actions
      toolbar.appendChild(btn('<b>B</b>', 'Bold', function () { wrapSelection(ta, '**', '**'); }));
      toolbar.appendChild(btn('<i>I</i>', 'Italic', function () { wrapSelection(ta, '*', '*'); }));
      toolbar.appendChild(btn('H1', 'Heading 1', function () { insertAtLineStart(ta, '# '); }));
      toolbar.appendChild(btn('UL', 'Unordered list', function () { insertAtLineStart(ta, '- '); }));
      toolbar.appendChild(btn('OL', 'Ordered list', function () { insertAtLineStart(ta, '1. '); }));
      toolbar.appendChild(btn('Code', 'Inline code', function () { wrapSelection(ta, '`', '`'); }));
      toolbar.appendChild(btn('Link', 'Insert link', function () {
        var url = prompt('URL');
        if (!url) return;
        var text = window.getSelection().toString() || prompt('Link text', 'link');
        if (!text) return;
        insertTextAtSelection(ta, '[' + text + '](' + url + ')');
      }));
      toolbar.appendChild(btn('Image', 'Insert image from media library', function () {
        // media_picker provides window.openMediaPicker(cb)
        if (window.openMediaPicker) {
          window.openMediaPicker(function (file) {
            if (file && file.url) {
              insertTextAtSelection(ta, '\n![' + (file.title||'image') + '](' + file.url + ')\n');
            }
          });
        } else {
          alert('Media picker not available');
        }
      }));

      // markdown toggle + preview
      var previewBtn = btn('Preview', 'Toggle preview', function () {
        var pv = ta.parentNode.querySelector('.aae-preview');
        if (!pv) {
          pv = document.createElement('div');
          pv.className = 'aae-preview';
          ta.parentNode.appendChild(pv);
        }
        if (pv.style.display === 'none' || !pv.style.display) {
          pv.style.display = 'block';
          pv.innerHTML = markdownToHtml(ta.value);
        } else {
          pv.style.display = 'none';
        }
      });
      toolbar.appendChild(previewBtn);

      // autosave indicator
      var autoIndicator = document.createElement('span');
      autoIndicator.className = 'aae-autosave-indicator';
      autoIndicator.textContent = '';
      toolbar.appendChild(autoIndicator);

      // insert toolbar before textarea
      ta.parentNode.insertBefore(toolbar, ta);

      // preview container
      var preview = document.createElement('div');
      preview.className = 'aae-preview';
      preview.style.display = 'none';
      ta.parentNode.appendChild(preview);

      // helpers
      function wrapSelection(el, before, after) {
        var s = el.selectionStart, e = el.selectionEnd;
        var val = el.value;
        el.value = val.slice(0, s) + before + val.slice(s, e) + after + val.slice(e);
        el.selectionStart = s + before.length;
        el.selectionEnd = e + before.length;
        el.focus();
      }
      function insertAtLineStart(el, prefix) {
        var s = el.selectionStart;
        var before = el.value.slice(0, s);
        var lastLineBreak = before.lastIndexOf('\n');
        var insertPos = lastLineBreak + 1;
        el.value = el.value.slice(0, insertPos) + prefix + el.value.slice(insertPos);
      }
      function insertTextAtSelection(el, text) {
        var s = el.selectionStart, e = el.selectionEnd;
        var val = el.value;
        el.value = val.slice(0, s) + text + val.slice(e);
        el.selectionStart = el.selectionEnd = s + text.length;
        el.focus();
      }

      // simple markdown -> html converter (very small, no dependency)
      function markdownToHtml(md) {
        // escape
        var html = md
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // code blocks ``` ```
        html = html.replace(/```([\s\S]*?)```/g, function (m, code) {
          return '<pre class="aae-code"><code>' + code.replace(/</g, '&lt;') + '</code></pre>';
        });
        // inline code `x`
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        // headers
        html = html.replace(/^###### (.*$)/gim, '<h6>$1</h6>');
        html = html.replace(/^##### (.*$)/gim, '<h5>$1</h5>');
        html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
        // bold, italic
        html = html.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*([^\*]+)\*/g, '<em>$1</em>');
        // links [text](url)
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
        // images ![alt](url)
        html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="aae-img" />');
        // lists
        html = html.replace(/^\s*-\s+(.*)/gim, '<li>$1</li>');
        html = html.replace(/(<li>[\s\S]*?<\/li>)/g, function(m){
          return '<ul>' + m + '</ul>';
        });
        // paragraphs
        html = html.replace(/\n{2,}/g, '</p><p>');
        html = '<p>' + html + '</p>';
        // tidy multiple paragraphs
        html = html.replace(/<\/p>\s*<p>/g, '</p><p>');
        return html;
      }

      // autosave every 12 seconds if changed
      var lastSaved = null;
      var lastValue = ta.value;
      setInterval(function () {
        if (ta.value === lastValue) return;
        lastValue = ta.value;
        autoIndicator.textContent = 'Сохраняю...';
        // post JSON to autosave endpoint
        var payload = {
          id: (function () {
            // attempt to detect object id from admin form hidden inputs
            var mid = document.querySelector('#id_id') || document.querySelector('input[name="_save"]');
            var pkInput = document.querySelector('input[name="id"]') || document.querySelector('input#id_id');
            // better try to read current window location (change page)
            var m = window.location.pathname.match(/\/(\d+)\/change\/$/);
            if (m) return parseInt(m[1], 10);
            var hidden = document.querySelector('input[name="id"]');
            if (hidden) return hidden.value;
            return null;
          })(),
          content: ta.value,
          title: (document.querySelector('#id_title') ? document.querySelector('#id_title').value : ''),
          excerpt: (document.querySelector('#id_excerpt') ? document.querySelector('#id_excerpt').value : '')
        };
        fetch('/admin/posts/autosave/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCsrfToken(),
          },
          body: JSON.stringify(payload),
          credentials: 'same-origin',
        }).then(function (r) {
          return r.json();
        }).then(function (data) {
          if (data && data.success && data.id) {
            lastSaved = Date.now();
            autoIndicator.textContent = 'Сохранено';
            setTimeout(function(){ autoIndicator.textContent = ''; }, 1500);
            // if new post, set hidden id input so inline updates work
            var idInput = document.querySelector('input[name="id"]') || document.querySelector('input#id_id');
            if (!idInput) {
              // insert hidden
              var input = document.createElement('input');
              input.type = 'hidden';
              input.name = 'id';
              input.value = data.id;
              var form = ta.closest('form');
              if (form) form.appendChild(input);
            }
          } else {
            autoIndicator.textContent = 'Ошибка сохранения';
          }
        }).catch(function (err) {
          console.error('autosave error', err);
          autoIndicator.textContent = 'Ошибка';
        });
      }, 12000);

    });
  }

  // simple csrf helper
  function getCsrfToken() {
    var v = null;
    var c = document.cookie.split(';').map(function (s) { return s.trim(); });
    c.forEach(function (s) {
      if (s.indexOf('csrftoken=') === 0) v = s.substring('csrftoken='.length);
    });
    return v;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdvancedEditors);
  } else {
    initAdvancedEditors();
  }
})();