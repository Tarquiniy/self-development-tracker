// static/admin/js/tiptap_admin_extra.js
// Type: module
// Надёжная загрузка TipTap через esm.sh + graceful fallback.
// Должен быть доступен по /static/admin/js/tiptap_admin_extra.js

const DEBUG = true;

function log(...args){
  if (DEBUG) console.log('[tiptap_admin_extra]', ...args);
}

function getCSRF(){
  const m = document.cookie.match(/csrftoken=([^;]+)/);
  if (m) return m[1];
  const meta = document.querySelector('meta[name="csrfmiddlewaretoken"]');
  return meta ? meta.content : '';
}

async function dynamicImport(spec){
  // ESM CDN через esm.sh поддерживает CORS (обычно).
  // Возвращает модуль namespace.
  try {
    return await import(spec);
  } catch (err) {
    log('dynamicImport failed for', spec, err);
    throw err;
  }
}

async function initTipTapForNode(wrapper){
  const textarea = wrapper.querySelector('textarea');
  const contentEl = wrapper.querySelector('.tiptap-editor') || document.createElement('div');
  contentEl.classList.add('tiptap-content-target');
  // Ensure content element is in DOM
  if (!wrapper.querySelector('.tiptap-editor')) {
    wrapper.appendChild(contentEl);
  }

  // Try to load TipTap modules from esm.sh (CORS-friendly)
  try {
    const [
      coreMod,
      starterMod,
      linkMod,
      imageMod,
      placeholderMod,
      underlineMod,
      tableMod,
      tableRowMod,
      tableCellMod,
      codeLowlightMod,
      historyMod
    ] = await Promise.all([
      dynamicImport('https://esm.sh/@tiptap/core@2.0.0'),
      dynamicImport('https://esm.sh/@tiptap/starter-kit@2.0.0'),
      dynamicImport('https://esm.sh/@tiptap/extension-link@2.0.0'),
      dynamicImport('https://esm.sh/@tiptap/extension-image@2.0.0'),
      dynamicImport('https://esm.sh/@tiptap/extension-placeholder@2.0.0'),
      dynamicImport('https://esm.sh/@tiptap/extension-underline@2.0.0'),
      dynamicImport('https://esm.sh/@tiptap/extension-table@2.0.0'),
      dynamicImport('https://esm.sh/@tiptap/extension-table-row@2.0.0'),
      dynamicImport('https://esm.sh/@tiptap/extension-table-cell@2.0.0'),
      dynamicImport('https://esm.sh/@tiptap/extension-code-block-lowlight@2.0.0'),
      dynamicImport('https://esm.sh/@tiptap/extension-history@2.0.0'),
    ]);

    const Editor = coreMod.Editor || coreMod.default;
    const StarterKit = starterMod.default || starterMod;
    const Link = linkMod.default || linkMod;
    const Image = imageMod.default || imageMod;
    const Placeholder = placeholderMod.default || placeholderMod;
    const Underline = underlineMod.default || underlineMod;
    const Table = tableMod.default || tableMod;
    const TableRow = tableRowMod.default || tableRowMod;
    const TableCell = tableCellMod.default || tableCellMod;
    const CodeBlockLowlight = codeLowlightMod.default || codeLowlightMod;
    const History = historyMod.default || historyMod;

    // Try to import lowlight for code highlighting (optional)
    let lowlight = null;
    try {
      const lowlightMod = await dynamicImport('https://esm.sh/lowlight@2.4.0/lib/core');
      lowlight = lowlightMod && (lowlightMod.default || lowlightMod);
      // try register a couple of languages if available
      try {
        const jsLang = await dynamicImport('https://esm.sh/highlight.js@10.7.2/lib/languages/javascript');
        if (lowlight && jsLang && jsLang.default) lowlight.registerLanguage('javascript', jsLang.default);
      } catch(e){}
      try {
        const pyLang = await dynamicImport('https://esm.sh/highlight.js@10.7.2/lib/languages/python');
        if (lowlight && pyLang && pyLang.default) lowlight.registerLanguage('python', pyLang.default);
      } catch(e){}
    } catch(e){
      log('lowlight import failed, codeblocks will be plain', e);
    }

    const extensions = [
      StarterKit.default ? StarterKit.default() : StarterKit(),
      Link.configure ? Link.configure({ openOnClick: false }) : Link(),
      Image && Image.configure ? Image.configure({ inline: false }) : (Image ? Image() : []),
      Placeholder && Placeholder.configure ? Placeholder.configure({ placeholder: 'Начните вводить текст...' }) : Placeholder(),
      Underline && Underline(),
      History && History(),
      Table && Table(),
      TableRow && TableRow(),
      TableCell && TableCell(),
      ...(CodeBlockLowlight && lowlight ? [ CodeBlockLowlight.configure({ lowlight }) ] : [])
    ];

    // Create editor
    const editor = new Editor({
      element: contentEl,
      extensions,
      content: textarea.value && textarea.value.trim() ? textarea.value : '<p></p>',
      onUpdate: ({ editor }) => {
        textarea.value = editor.getHTML();
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    // Toolbar (simple)
    let toolbar = wrapper.querySelector('.tiptap-toolbar');
    if (!toolbar){
      toolbar = document.createElement('div');
      toolbar.className = 'tiptap-toolbar';
      wrapper.insertBefore(toolbar, contentEl);
    }

    function addButton(html, onClick){
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.innerHTML = html;
      btn.addEventListener('click', onClick);
      toolbar.appendChild(btn);
      return btn;
    }

    addButton('<b>B</b>', ()=>editor.chain().focus().toggleBold().run());
    addButton('<i>I</i>', ()=>editor.chain().focus().toggleItalic().run());
    addButton('<s>S</s>', ()=>editor.chain().focus().toggleStrike().run());
    addButton('H1', ()=>editor.chain().focus().toggleHeading({ level:1 }).run());
    addButton('UL', ()=>editor.chain().focus().toggleBulletList().run());
    addButton('OL', ()=>editor.chain().focus().toggleOrderedList().run());
    addButton('Code', ()=>editor.chain().focus().toggleCodeBlock().run());
    addButton('Table', ()=>editor.chain().focus().insertTable({ rows:3, cols:3 }).run());
    addButton('Link', ()=>{
      const url = prompt('URL (https://...)');
      if (url) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    });

    // Image upload button + input
    const uploadBtn = addButton('Image', ()=>uploadInput.click());
    const uploadInput = document.createElement('input');
    uploadInput.type = 'file';
    uploadInput.accept = 'image/*';
    uploadInput.style.display = 'none';
    wrapper.appendChild(uploadInput);
    uploadInput.addEventListener('change', async (ev)=>{
      const f = ev.target.files && ev.target.files[0];
      if (!f) return;
      try {
        const fd = new FormData();
        fd.append('file', f);
        const uploadUrl = wrapper.dataset.uploadUrl || wrapper.getAttribute('data-upload-url') || '/admin/blog/upload-image/';
        const res = await fetch(uploadUrl, {
          method: 'POST',
          body: fd,
          credentials: 'same-origin',
          headers: { 'X-CSRFToken': getCSRF() }
        });
        const j = await res.json();
        const url = j.url || (j.uploaded && j.uploaded[0] && j.uploaded[0].url);
        if (url) editor.chain().focus().setImage({ src: url }).run();
        else alert('Загружено, но URL не возвращён. Посмотри логи сервера.');
      } catch (e){
        console.error('upload error', e);
        alert('Ошибка загрузки изображения');
      } finally {
        uploadInput.value = '';
      }
    });

    // Drag and drop support
    contentEl.addEventListener('drop', async (ev)=>{
      ev.preventDefault();
      const f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
      if (f){
        try {
          const fd = new FormData(); fd.append('file', f);
          const uploadUrl = wrapper.dataset.uploadUrl || wrapper.getAttribute('data-upload-url') || '/admin/blog/upload-image/';
          const res = await fetch(uploadUrl, {
            method: 'POST',
            body: fd,
            credentials: 'same-origin',
            headers: { 'X-CSRFToken': getCSRF() }
          });
          const j = await res.json();
          const url = j.url || (j.uploaded && j.uploaded[0] && j.uploaded[0].url);
          if (url) editor.chain().focus().setImage({ src: url }).run();
        } catch (e){
          console.error('drop upload failed', e);
        }
      }
    });

    // Save initial HTML into textarea (so Django form sees existing content)
    textarea.value = editor.getHTML();

    // Ensure on form submit textarea is synced
    const form = textarea.closest('form');
    if (form){
      form.addEventListener('submit', ()=>{ textarea.value = editor.getHTML(); });
    }

    log('TipTap initialized for wrapper', wrapper);
    return editor;

  } catch (err){
    // If anything fails (CORS, import error, etc.) — fallback to simple contenteditable
    log('TipTap init failed, using fallback contenteditable', err);

    // Create a contenteditable area bound to textarea
    let fallback = wrapper.querySelector('.tiptap-fallback');
    if (!fallback){
      fallback = document.createElement('div');
      fallback.className = 'tiptap-fallback';
      fallback.contentEditable = 'true';
      fallback.style.minHeight = '300px';
      fallback.style.border = '1px solid #ddd';
      fallback.style.padding = '8px';
      fallback.innerHTML = textarea.value || '<p></p>';
      wrapper.appendChild(fallback);
    }

    const sync = ()=>{ textarea.value = fallback.innerHTML; };
    fallback.addEventListener('input', sync);
    const form = textarea.closest('form');
    if (form) form.addEventListener('submit', sync);

    return null;
  }
}

function initAll() {
  // find all wrappers rendered by widget
  const wrappers = document.querySelectorAll('.admin-tiptap-widget');
  wrappers.forEach(w => {
    // prevent double init
    if (w.dataset.tiptapInit) return;
    w.dataset.tiptapInit = '1';
    initTipTapForNode(w).catch(e=>console.error(e));
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAll);
} else {
  initAll();
}