// backend/blog/static/admin/admin-post-form.js
(function () {
    // Helper
    function $(sel){ return document.querySelector(sel); }
    function $all(sel){ return Array.from(document.querySelectorAll(sel)); }

    const titleInput = $('#id_title') || $('#id_title') || document.getElementById('id_title');
    const excerptField = document.getElementById('id_excerpt') || document.querySelector('[name=excerpt]');
    const contentField = document.getElementById('id_content') || document.querySelector('[name=content]');
    const featuredInput = document.getElementById('id_featured_image') || document.querySelector('[name=featured_image]');
    const featuredPreview = document.getElementById('featured-preview');
    const previewTitle = document.getElementById('preview-title');
    const previewExcerpt = document.getElementById('preview-excerpt');
    const previewThumb = document.getElementById('preview-thumb');
    const previewReading = document.getElementById('preview-reading');
    const previewBody = document.getElementById('preview-body');
    const previewLink = document.getElementById('preview-link');
    const openMediaBtn = document.getElementById('open-media-btn');
    const clearFeaturedBtn = document.getElementById('clear-featured-btn');
    const publishBtn = document.getElementById('publish-button');
    const previewBtn = document.getElementById('preview-button');

    // Update preview function
    function updatePreview() {
        const title = (titleInput && titleInput.value) ? titleInput.value : 'Заголовок поста';
        const excerpt = (excerptField && excerptField.value) ? excerptField.value : (contentField && contentField.value ? contentField.value.slice(0, 200) : 'Краткое описание появится здесь');
        const content = (contentField && contentField.value) ? contentField.value : '';
        const featured = featuredInput ? featuredInput.value : '';

        if (previewTitle) previewTitle.textContent = title;
        if (previewExcerpt) previewExcerpt.textContent = excerpt;
        if (previewBody) previewBody.innerHTML = content ? content.slice(0, 400).replace(/\n/g, '<br/>') : '<em>Здесь будет отрывок содержимого</em>';
        if (previewReading) {
            const words = content ? content.split(/\s+/).filter(Boolean).length : (excerpt ? excerpt.split(/\s+/).length : 0);
            const mins = Math.max(1, Math.round(words / 200));
            previewReading.textContent = `~${mins} мин чтения`;
        }
        if (previewThumb) {
            previewThumb.innerHTML = '';
            if (featured) {
                const img = document.createElement('img');
                img.src = featured;
                previewThumb.appendChild(img);
            } else {
                previewThumb.textContent = '';
                previewThumb.style.background = '#f3f4f6';
            }
        }
        if (previewLink) {
            // If there's slug or post URL input? we can't compute exact URL here; leave link blank
            previewLink.href = '#';
        }
    }

    // Debounce
    function debounce(fn, t){ let id; return (...a)=>{ clearTimeout(id); id=setTimeout(()=>fn(...a), t||250); }; }

    // Event bindings
    if (titleInput) titleInput.addEventListener('input', debounce(updatePreview, 120));
    if (excerptField) excerptField.addEventListener('input', debounce(updatePreview, 200));
    if (contentField) contentField.addEventListener('input', debounce(updatePreview, 300));
    if (featuredInput) featuredInput.addEventListener('input', updatePreview);

    // Open media library popup to select image
    if (openMediaBtn){
        openMediaBtn.addEventListener('click', function (e){
            e.preventDefault();
            const w = Math.min(1100, window.innerWidth - 80);
            const h = Math.min(800, window.innerHeight - 80);
            const left = Math.round((screen.width - w)/2);
            const top = Math.round((screen.height - h)/2);
            const popup = window.open('/admin/media-library/', 'media-library', `width=${w},height=${h},left=${left},top=${top}`);
            // Listen for message from media library
            window.addEventListener('message', function handler(ev){
                if (!ev.data || ev.data.source !== 'media-library') return;
                // payload: { attachment: { id, url, filename, title } , action: 'select' }
                const payload = ev.data;
                if (payload && payload.attachment) {
                    const url = payload.attachment.url;
                    if (featuredInput) {
                        featuredInput.value = url;
                        const evt = new Event('input', { bubbles: true });
                        featuredInput.dispatchEvent(evt);
                    }
                    updatePreview();
                }
                window.removeEventListener('message', handler);
                if (popup && !popup.closed) popup.close();
            }, false);
        });
    }

    if (clearFeaturedBtn) {
        clearFeaturedBtn.addEventListener('click', function () {
            if (featuredInput) {
                featuredInput.value = '';
                updatePreview();
            }
        });
    }

    // publish button: set status and submit
    if (publishBtn) {
        publishBtn.addEventListener('click', function (e){
            e.preventDefault();
            // try to set status select if exists
            const status = document.querySelector('select[name=status]');
            if (status) {
                // find option with value 'published' if exists
                const opt = Array.from(status.options).find(o => o.value === 'published');
                if (opt) {
                    opt.selected = true;
                }
            }
            // submit the form
            const form = document.getElementById('post-form') || document.querySelector('form');
            if (form) form.submit();
        });
    }

    // preview button — open new window with client-side preview (not published)
    if (previewBtn) {
        previewBtn.addEventListener('click', function (e){
            e.preventDefault();
            // open simple preview page using a blob
            const html = `
                <html><head><meta charset="utf-8"><title>${titleInput.value || 'Preview'}</title>
                <style>body{font-family:Inter,Arial;padding:28px;max-width:880px;margin:auto}h1{font-size:28px}img{max-width:100%}</style>
                </head><body>
                <h1>${(titleInput && titleInput.value) ? escapeHtml(titleInput.value) : 'Preview'}</h1>
                ${(featuredInput && featuredInput.value) ? `<img src="${escapeHtml(featuredInput.value)}" alt="featured" />` : ''}
                <p style="color:#6b7280">${(excerptField && excerptField.value) ? escapeHtml(excerptField.value) : ''}</p>
                <div>${(contentField && contentField.value) ? escapeHtml(contentField.value).replace(/\n/g,'<br/>') : ''}</div>
                </body></html>`;
            const w = window.open();
            w.document.open();
            w.document.write(html);
            w.document.close();
        });
    }

    // simple escaper
    function escapeHtml(s){ return String(s).replace(/[&<>"']/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]; }); }

    // Listen for media-library selection when opened in the same window (click on item sends postMessage)
    window.addEventListener('message', function (ev){
        if (!ev.data || ev.data.source !== 'media-library') return;
        const att = ev.data.attachment;
        if (att && featuredInput) {
            featuredInput.value = att.url;
            updatePreview();
        }
    });

    // init
    updatePreview();
})();
