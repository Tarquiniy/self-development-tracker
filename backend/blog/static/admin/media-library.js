// backend/blog/static/admin/media-library.js
(function () {
    'use strict';

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

    // Elements
    const mediaGrid = document.getElementById('media-grid');
    const searchInput = document.getElementById('media-search');
    const unattachedCheckbox = document.getElementById('filter-unattached');
    const fileInput = document.getElementById('file-input');
    const uploadBtn = document.getElementById('upload-open-btn');
    const dropzone = document.getElementById('dropzone');
    const refreshBtn = document.getElementById('refresh-btn');
    const progressList = document.getElementById('upload-progress-list');

    function apiUrl(path) { return `/api/blog/media/${path}`; }

    // Fetch and render media list
    function fetchMedia(page=1) {
        const q = encodeURIComponent((searchInput && searchInput.value) ? searchInput.value.trim() : '');
        const unattached = (unattachedCheckbox && unattachedCheckbox.checked) ? '1' : '0';
        const url = `${apiUrl('list/')}?page=${page}&page_size=48&q=${q}&unattached_only=${unattached}`;
        fetch(url, { credentials: 'same-origin' })
            .then(r => r.json())
            .then(json => {
                renderGrid(json.results || []);
            })
            .catch(err => {
                console.error('fetchMedia error', err);
                showToast('Ошибка загрузки списка файлов', true);
            });
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
            el.className = 'media-item card';
            el.dataset.id = item.id;

            el.style.display = 'flex';
            el.style.gap = '12px';
            el.style.padding = '12px';
            el.style.alignItems = 'center';

            const thumb = document.createElement('div'); thumb.className='media-thumb';
            thumb.style.width = '96px'; thumb.style.height = '72px'; thumb.style.borderRadius = '8px';
            thumb.style.overflow = 'hidden'; thumb.style.display='flex'; thumb.style.alignItems='center';
            thumb.style.justifyContent='center'; thumb.style.background='#f8fafc';
            if (item.url && /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(item.filename || '')) {
                const img = document.createElement('img'); img.src = item.url; img.alt = item.title||item.filename||'';
                img.style.width='100%'; img.style.height='100%'; img.style.objectFit='cover';
                thumb.appendChild(img);
            } else {
                const txt = document.createElement('div'); txt.style.padding='8px'; txt.style.color='#6b7280';
                txt.textContent = item.filename || item.title || '—';
                thumb.appendChild(txt);
            }

            const metaWrap = document.createElement('div');
            metaWrap.style.flex='1'; metaWrap.style.display='flex'; metaWrap.style.flexDirection='column'; metaWrap.style.gap='6px';

            const rowTop = document.createElement('div');
            rowTop.style.display='flex'; rowTop.style.justifyContent='space-between'; rowTop.style.alignItems='center';
            const title = document.createElement('div'); title.style.fontWeight='700';
            title.textContent = item.title || item.filename || '';
            const uploaded = document.createElement('div'); uploaded.style.fontSize='12px'; uploaded.style.color='#6b7280';
            uploaded.textContent = item.uploaded_at ? new Date(item.uploaded_at).toLocaleString() : '';
            rowTop.appendChild(title); rowTop.appendChild(uploaded);

            const rowActions = document.createElement('div'); rowActions.style.display='flex'; rowActions.style.gap='8px'; rowActions.style.alignItems='center';
            const selectBtn = document.createElement('button'); selectBtn.className='small-btn select-btn'; selectBtn.textContent='Выбрать';
            selectBtn.addEventListener('click', function () {
                const payload = { source: 'media-library', action: 'select', attachment: item };
                if (window.opener && !window.opener.closed) {
                    window.opener.postMessage(payload, '*');
                    window.close();
                    return;
                }
                window.parent.postMessage(payload, '*');
                showToast('Выбран файл: ' + (item.filename || item.title || ''), false);
            });
            rowActions.appendChild(selectBtn);

            if (item.url) {
                const openBtn = document.createElement('a'); openBtn.className='small-btn'; openBtn.textContent='Открыть';
                openBtn.href = item.url; openBtn.target = '_blank'; rowActions.appendChild(openBtn);
            }

            const delBtn = document.createElement('button'); delBtn.className='small-btn delete-btn'; delBtn.textContent='Удалить';
            delBtn.addEventListener('click', function () {
                if (!confirm('Удалить файл?')) return;
                fetch(apiUrl('delete/'), {
                    method:'POST', credentials:'same-origin',
                    headers:{ 'Content-Type':'application/json', 'X-CSRFToken': csrftoken },
                    body: JSON.stringify({ ids: [item.id] })
                }).then(r=>r.json()).then(j=>{
                    if (j.success) {
                        showToast('Файл удалён', false);
                        fetchMedia();
                    } else {
                        showToast('Ошибка удаления: ' + (j.message || 'unknown'), true);
                    }
                }).catch(e=>{ console.error(e); showToast('Network error', true); });
            });
            rowActions.appendChild(delBtn);

            metaWrap.appendChild(rowTop);
            metaWrap.appendChild(rowActions);

            el.appendChild(thumb);
            el.appendChild(metaWrap);
            mediaGrid.appendChild(el);
        });
    }

    // Upload logic with progress (XMLHttpRequest to show progress)
    function uploadFiles(files) {
        if (!files || !files.length) return;
        const fd = new FormData();
        // Append each file; backend expects 'file' field as list
        Array.from(files).forEach(f => fd.append('file', f, f.name));

        // Optional: a title param for each file is not included here; server will use filename
        // Create a progress row
        const row = document.createElement('div');
        row.style.display='flex'; row.style.flexDirection='column'; row.style.gap='6px'; row.style.marginBottom='8px';
        const label = document.createElement('div'); label.textContent = `Загрузка ${files.length} файлов...`;
        const barWrap = document.createElement('div'); barWrap.style.width='100%'; barWrap.style.background='#eef2f6'; barWrap.style.borderRadius='8px';
        const bar = document.createElement('div'); bar.style.height='10px'; bar.style.width='0%'; bar.style.borderRadius='8px'; bar.style.transition='width .2s';
        bar.style.background='linear-gradient(90deg,#0ea5e9,#7c3aed)';
        barWrap.appendChild(bar);
        row.appendChild(label); row.appendChild(barWrap);
        progressList.appendChild(row);

        // Use XHR for progress events
        const xhr = new XMLHttpRequest();
        xhr.open('POST', apiUrl('upload/'), true);
        xhr.withCredentials = true;
        xhr.setRequestHeader('X-CSRFToken', csrftoken);

        xhr.upload.addEventListener('progress', function (e) {
            if (!e.lengthComputable) return;
            const pct = Math.round((e.loaded / e.total) * 100);
            bar.style.width = pct + '%';
        });

        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) return;
            try {
                if (xhr.status >= 200 && xhr.status < 300) {
                    const resp = JSON.parse(xhr.responseText || '{}');
                    if (resp.success) {
                        label.textContent = 'Готово';
                        bar.style.width = '100%';
                        showToast(`Загружено ${resp.uploaded ? resp.uploaded.length : files.length}`, false);
                        // refresh media grid
                        fetchMedia();
                    } else {
                        label.textContent = 'Ошибка: ' + (resp.message || 'unknown');
                        showToast('Ошибка загрузки: ' + (resp.message || ''), true);
                    }
                } else {
                    showToast('Upload failed: ' + xhr.status, true);
                    label.textContent = 'Ошибка';
                }
            } catch (err) {
                console.error('uploadFiles parse error', err);
                showToast('Ошибка ответа сервера', true);
            } finally {
                // remove progress item через 3 секунды
                setTimeout(()=>{ try{ progressList.removeChild(row); }catch(e){} }, 3000);
            }
        };

        xhr.send(fd);
    }

    // small toast
    function showToast(msg, isError) {
        try {
            const t = document.createElement('div');
            t.textContent = msg;
            t.style.position = 'fixed';
            t.style.bottom = '18px';
            t.style.right = '18px';
            t.style.padding = '10px 14px';
            t.style.borderRadius = '10px';
            t.style.boxShadow = '0 6px 18px rgba(2,6,23,0.12)';
            t.style.background = isError ? 'linear-gradient(90deg,#ef4444,#f97316)' : 'linear-gradient(90deg,#10b981,#0ea5e9)';
            t.style.color = '#fff';
            t.style.zIndex = 99999;
            document.body.appendChild(t);
            setTimeout(()=>{ t.style.opacity='0'; t.style.transition='opacity .4s'; setTimeout(()=>{ try{ document.body.removeChild(t); }catch(e){} }, 400); }, 3500);
        } catch (e) {
            console.log(msg);
        }
    }

    // Event bindings
    if (uploadBtn) {
        uploadBtn.addEventListener('click', function (e) {
            e.preventDefault();
            if (fileInput) fileInput.click();
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', function () {
            if (this.files && this.files.length) {
                uploadFiles(this.files);
                // Reset input to allow same-file reupload next time
                this.value = '';
            }
        });
    }

    // dropzone handlers
    if (dropzone) {
        dropzone.addEventListener('dragover', function (e) {
            e.preventDefault(); dropzone.style.borderColor = 'var(--primary)';
        });
        dropzone.addEventListener('dragleave', function (e) {
            e.preventDefault(); dropzone.style.borderColor = '';
        });
        dropzone.addEventListener('drop', function (e) {
            e.preventDefault(); dropzone.style.borderColor = '';
            const dt = e.dataTransfer;
            if (dt && dt.files && dt.files.length) {
                uploadFiles(dt.files);
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', debounce(()=>fetchMedia(1), 350));
    }
    if (unattachedCheckbox) {
        unattachedCheckbox.addEventListener('change', ()=>fetchMedia(1));
    }
    if (refreshBtn) {
        refreshBtn.addEventListener('click', ()=>fetchMedia(1));
    }

    // delegate delete/select clicks for grid rendered from server side
    document.addEventListener('click', function (e) {
        const sel = e.target;
        if (sel.classList && sel.classList.contains('select-btn')) {
            // handled in renderGrid (for dynamic items), but keep fallback for server-side rendered items
            const item = sel.closest('.media-item');
            if (!item) return;
            const payload = {
                source: 'media-library',
                action: 'select',
                attachment: {
                    id: item.dataset.id,
                    url: item.dataset.url,
                    filename: item.dataset.filename,
                    title: item.dataset.title
                }
            };
            if (window.opener && !window.opener.closed) {
                window.opener.postMessage(payload, '*');
                window.close();
                return;
            }
            window.parent.postMessage(payload, '*');
            showToast('Выбран файл', false);
        }
        if (sel.classList && sel.classList.contains('delete-btn')) {
            const id = sel.dataset.id || (sel.closest('.media-item') && sel.closest('.media-item').dataset.id);
            if (!id) return;
            if (!confirm('Удалить файл?')) return;
            fetch(apiUrl('delete/'), {
                method:'POST', credentials:'same-origin',
                headers:{ 'Content-Type':'application/json', 'X-CSRFToken': csrftoken },
                body: JSON.stringify({ ids: [Number(id)] })
            }).then(r=>r.json()).then(j=>{
                if (j.success) {
                    showToast('Файл удалён', false);
                    fetchMedia();
                } else {
                    showToast('Ошибка удаления: ' + (j.message || ''), true);
                }
            }).catch(e=>{ console.error(e); showToast('Network error', true); });
        }
    });

    // debounce helper
    function debounce(fn,t){ let id; return (...a)=>{ clearTimeout(id); id=setTimeout(()=>fn(...a), t||200); }; }

    // initial load
    fetchMedia(1);

})();
