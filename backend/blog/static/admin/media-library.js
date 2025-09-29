// backend/blog/static/admin/media-library.js
(function () {
    // existing functions (CSRF etc) — full implementation updated to allow selection messaging
    function getCookie(name) {
        if (!document.cookie) return null;
        const cookies = document.cookie.split(';').map(c => c.trim());
        for (let c of cookies) {
            if (c.startsWith(name + '=')) {
                return decodeURIComponent(c.split('=')[1]);
            }
        }
        return null;
    }
    const csrftoken = getCookie('csrftoken');

    // DOM
    const mediaGrid = document.getElementById('media-grid');
    const searchInput = document.getElementById('media-search');
    const unattachedCheckbox = document.getElementById('filter-unattached');

    // page fetch (simplified)
    function apiUrl(path) { return `/api/blog/media/${path}`; }

    function fetchMedia(page=1) {
        const q = encodeURIComponent((searchInput && searchInput.value) ? searchInput.value.trim() : '');
        const unattached = (unattachedCheckbox && unattachedCheckbox.checked) ? '1' : '0';
        const url = `${apiUrl('list/')}?page=${page}&page_size=24&q=${q}&unattached_only=${unattached}`;
        fetch(url, { credentials: 'same-origin' })
            .then(r => r.json())
            .then(json => {
                renderGrid(json.results || []);
            })
            .catch(err => console.error(err));
    }

    function renderGrid(items) {
        if (!mediaGrid) return;
        mediaGrid.innerHTML = '';
        if (!items.length) {
            mediaGrid.innerHTML = '<div style="grid-column:1/-1;padding:18px;color:#6b7280">Файлы не найдены</div>';
            return;
        }
        items.forEach(item => {
            const el = document.createElement('div');
            el.className = 'media-item';
            el.dataset.id = item.id;
            el.dataset.url = item.url || '';
            el.dataset.title = item.title || '';
            el.dataset.filename = item.filename || '';

            const thumb = document.createElement('div'); thumb.className='media-thumb';
            if (item.url && /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(item.filename || '')) {
                const img = document.createElement('img'); img.src = item.url; img.alt = item.title||item.filename||'';
                thumb.appendChild(img);
            } else {
                thumb.textContent = item.filename || item.title || '—';
            }

            const meta = document.createElement('div'); meta.className = 'media-meta';
            const left = document.createElement('div'); left.style.flex='1';
            const title = document.createElement('div'); title.className='media-title'; title.textContent = item.title || item.filename || '—';
            left.appendChild(title);
            const sub = document.createElement('div'); sub.style.fontSize='12px'; sub.style.color='#6b7280';
            sub.textContent = item.uploaded_at ? new Date(item.uploaded_at).toLocaleString() : '';
            left.appendChild(sub);

            const actions = document.createElement('div'); actions.className='media-actions';
            const selectBtn = document.createElement('button'); selectBtn.className='small-btn'; selectBtn.textContent='Выбрать';
            selectBtn.addEventListener('click', function () {
                // If opened as popup from admin, postMessage to opener and close
                const payload = { source: 'media-library', action: 'select', attachment: item };
                if (window.opener && !window.opener.closed) {
                    window.opener.postMessage(payload, '*');
                    window.close();
                    return;
                }
                // Otherwise try broadcasting for parent frames
                window.parent.postMessage(payload, '*');
                // also update UI: mark selected
                alert('Выбрано: ' + (item.filename || item.title || 'файл'));
            });
            actions.appendChild(selectBtn);

            const downloadBtn = document.createElement('a'); downloadBtn.className='small-btn'; downloadBtn.textContent='Открыть';
            downloadBtn.href = item.url || '#'; downloadBtn.target='_blank';
            actions.appendChild(downloadBtn);

            const deleteBtn = document.createElement('button'); deleteBtn.className='small-btn danger'; deleteBtn.textContent='Удалить';
            deleteBtn.addEventListener('click', function () {
                if (!confirm('Удалить файл?')) return;
                fetch(apiUrl('delete/'), {
                    method:'POST', credentials:'same-origin',
                    headers:{ 'Content-Type':'application/json', 'X-CSRFToken': csrftoken },
                    body: JSON.stringify({ ids: [item.id] })
                }).then(r=>r.json()).then(j=>{
                    if (j.success) fetchMedia();
                    else alert('Ошибка удаления: ' + (j.message || 'unknown'));
                }).catch(e=>{console.error(e); alert('Network error');});
            });
            actions.appendChild(deleteBtn);

            meta.appendChild(left); meta.appendChild(actions);
            el.appendChild(thumb); el.appendChild(meta);
            mediaGrid.appendChild(el);
        });
    }

    // init
    if (searchInput) searchInput.addEventListener('input', debounce(()=>fetchMedia(1), 300));
    if (unattachedCheckbox) unattachedCheckbox.addEventListener('change', ()=>fetchMedia(1));

    // file input handling
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
        fileInput.addEventListener('change', function () {
            if (this.files && this.files.length) {
                Array.from(this.files).forEach(f=>{
                    const fd = new FormData(); fd.append('file', f); fd.append('title', f.name);
                    fetch(apiUrl('upload/'), { method:'POST', credentials:'same-origin', headers:{ 'X-CSRFToken': csrftoken }, body: fd })
                        .then(r=>r.json()).then(j=>{ if (j.success) fetchMedia(1); else alert('Ошибка: '+(j.message||'')); })
                        .catch(e=>{ console.error(e); alert('Network error'); });
                });
            }
        });
    }

    function debounce(fn,t){ let id; return (...a)=>{ clearTimeout(id); id=setTimeout(()=>fn(...a), t||200); }; }

    // load first
    fetchMedia(1);
})();
