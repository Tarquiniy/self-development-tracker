// backend/blog/static/admin/media-library.js
(function () {
    'use strict';
    // defensive wrapper — если файл загружается дважды, не ломаемся
    if (window._mediaLibraryLoaded) {
        console.log('[media-library.js] already loaded — skipping re-init');
        return;
    }
    window._mediaLibraryLoaded = true;

    // --- helpers for cookies / CSRF / DOM ---
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
    console.log('[media-library.js] csrftoken', !!csrftoken);

    function $(id) { return document.getElementById(id); }
    function apiUrl(path) { return `/api/blog/media/${path}`; }
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
        } catch (e) { console.log(msg); }
    }

    // Read post_id from query string or from global variable window.ADMIN_CURRENT_POST_ID
    function getQueryParam(name) {
        try {
            const params = new URLSearchParams(window.location.search);
            return params.get(name);
        } catch (e) {
            return null;
        }
    }
    const CURRENT_POST_ID = (function(){
        const q = getQueryParam('post_id');
        if (q && q !== 'null' && q !== '') return q;
        if (typeof window.ADMIN_CURRENT_POST_ID !== 'undefined' && window.ADMIN_CURRENT_POST_ID !== null) return String(window.ADMIN_CURRENT_POST_ID);
        return null;
    })();

    // main variables (DOM)
    var mediaGrid = $('media-grid');
    var searchInput = $('media-search');
    var unattachedCheckbox = $('filter-unattached');
    var fileInput = $('file-input');
    var uploadBtn = $('upload-open-btn');
    var dropzone = $('dropzone');
    var refreshBtn = $('refresh-btn');
    var progressList = $('upload-progress-list');

    // create fallback fileInput if not present
    if (!fileInput) {
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.multiple = true;
        fileInput.id = 'file-input';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);
        console.log('[media-library.js] created fallback file-input');
    }

    // expose uploadFiles on window for fallback inline script
    window.uploadFiles = uploadFiles;

    // fetch media
    function fetchMedia(page=1) {
        var q = encodeURIComponent((searchInput && searchInput.value) ? searchInput.value.trim() : '');
        var unatt = (unattachedCheckbox && unattachedCheckbox.checked) ? '1' : '0';
        var url = apiUrl('list/') + '?page=' + page + '&page_size=48&q=' + q + '&unattached_only=' + unatt;
        console.log('[media-library.js] fetching', url);
        fetch(url, { credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (json) {
                renderGrid(json.results || []);
            })
            .catch(function (err) {
                console.error('[media-library.js] fetchMedia error', err);
                showToast('Ошибка загрузки списка файлов', true);
            });
    }

    // Render single item — includes Attach / Unlink buttons
    function renderGrid(items) {
        if (!mediaGrid) return;
        mediaGrid.innerHTML = '';
        if (!items.length) {
            mediaGrid.innerHTML = '<div style="grid-column:1/-1;padding:18px;color:#6b7280">Файлы не найдены</div>';
            return;
        }
        items.forEach(function (item) {
            var el = document.createElement('div');
            el.className = 'media-item card';
            el.dataset.id = item.id;
            el.dataset.url = item.url || '';
            el.dataset.filename = item.filename || '';
            el.dataset.title = item.title || '';
            el.style.display = 'flex'; el.style.gap = '12px'; el.style.padding = '12px'; el.style.alignItems = 'center';

            var thumb = document.createElement('div'); thumb.className='media-thumb';
            thumb.style.width='96px'; thumb.style.height='72px'; thumb.style.borderRadius='8px'; thumb.style.overflow='hidden';
            thumb.style.display='flex'; thumb.style.alignItems='center'; thumb.style.justifyContent='center'; thumb.style.background='#f8fafc';
            if (item.url && /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(item.filename || '')) {
                var img = document.createElement('img'); img.src = item.url; img.alt = item.title||item.filename||'';
                img.style.width='100%'; img.style.height='100%'; img.style.objectFit='cover';
                thumb.appendChild(img);
            } else {
                var txt = document.createElement('div'); txt.style.padding='8px'; txt.style.color='#6b7280';
                txt.textContent = item.filename || item.title || '—';
                thumb.appendChild(txt);
            }

            var metaWrap = document.createElement('div'); metaWrap.style.flex='1'; metaWrap.style.display='flex'; metaWrap.style.flexDirection='column'; metaWrap.style.gap='6px';

            var rowTop = document.createElement('div'); rowTop.style.display='flex'; rowTop.style.justifyContent='space-between'; rowTop.style.alignItems='center';
            var title = document.createElement('div'); title.style.fontWeight='700'; title.textContent = item.title || item.filename || '';
            var uploaded = document.createElement('div'); uploaded.style.fontSize='12px'; uploaded.style.color='#6b7280';
            uploaded.textContent = item.uploaded_at ? new Date(item.uploaded_at).toLocaleString() : '';
            rowTop.appendChild(title); rowTop.appendChild(uploaded);

            var rowActions = document.createElement('div'); rowActions.style.display='flex'; rowActions.style.gap='8px'; rowActions.style.alignItems='center';

            // Select button (for window.postMessage usage)
            var selectBtn = document.createElement('button'); selectBtn.className='small-btn select-btn'; selectBtn.textContent='Выбрать';
            selectBtn.addEventListener('click', function () {
                var payload = { source: 'media-library', action: 'select', attachment: item };
                if (window.opener && !window.opener.closed) {
                    window.opener.postMessage(payload, '*');
                    window.close();
                    return;
                }
                window.parent.postMessage(payload, '*');
                showToast('Выбран файл: ' + (item.filename || item.title || ''), false);
            });
            rowActions.appendChild(selectBtn);

            // Attach to post button
            var attachBtn = document.createElement('button'); attachBtn.className='small-btn attach-btn'; attachBtn.textContent='Прикрепить к посту';
            attachBtn.addEventListener('click', function () {
                var postId = CURRENT_POST_ID;
                if (!postId) {
                    postId = prompt('Введите ID поста, к которому прикрепить изображение (число):');
                    if (!postId) return;
                }
                attachToPost(item.id, postId, el);
            });
            rowActions.appendChild(attachBtn);

            // Unlink button
            var unlinkBtn = document.createElement('button'); unlinkBtn.className='small-btn unlink-btn'; unlinkBtn.textContent='Открепить';
            unlinkBtn.addEventListener('click', function () {
                if (!confirm('Открепить файл от поста?')) return;
                attachToPost(item.id, null, el);
            });
            rowActions.appendChild(unlinkBtn);

            if (item.url) {
                var openBtn = document.createElement('a'); openBtn.className='small-btn'; openBtn.textContent='Открыть';
                openBtn.href = item.url; openBtn.target = '_blank'; rowActions.appendChild(openBtn);
            }

            var delBtn = document.createElement('button'); delBtn.className='small-btn delete-btn'; delBtn.textContent='Удалить';
            delBtn.addEventListener('click', function () {
                if (!confirm('Удалить файл?')) return;
                fetch(apiUrl('delete/'), {
                    method:'POST', credentials:'same-origin',
                    headers:{ 'Content-Type':'application/json', 'X-CSRFToken': csrftoken },
                    body: JSON.stringify({ ids: [item.id] })
                }).then(function (r){ return r.json(); }).then(function (j){
                    if (j.success) {
                        showToast('Файл удалён', false);
                        fetchMedia();
                    } else {
                        showToast('Ошибка удаления: ' + (j.message || 'unknown'), true);
                    }
                }).catch(function (e){ console.error(e); showToast('Network error', true); });
            });
            rowActions.appendChild(delBtn);

            metaWrap.appendChild(rowTop); metaWrap.appendChild(rowActions);
            el.appendChild(thumb); el.appendChild(metaWrap);
            mediaGrid.appendChild(el);
        });
    }

    // Attach file to post (attachment_id, post_id or null)
    function attachToPost(attachmentId, postId, el) {
        try {
            var body = { attachment_id: Number(attachmentId) };
            if (postId === null || postId === undefined || postId === '' || String(postId).toLowerCase() === 'null') {
                body.post_id = null;
            } else {
                body.post_id = Number(postId);
            }
            fetch(apiUrl('attach/'), {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken
                },
                body: JSON.stringify(body)
            }).then(function (r) { return r.json().then(function (j) { return {status: r.status, ok: r.ok, json: j}; }); })
            .then(function (res) {
                if (!res.ok || !res.json.success) {
                    showToast('Ошибка: ' + (res.json.message || res.statusText || 'unknown'), true);
                    return;
                }
                // success
                var att = res.json.attachment || {};
                showToast(postId ? ('Прикреплено к посту ' + att.post_id) : 'Откреплено', false);
                // Update UI meta if present
                try {
                    var meta = el && el.querySelector && el.querySelector('div[style*="font-size:12px"]');
                    if (meta) {
                        // append or replace post info
                        var base = (meta.dataset && meta.dataset.base) ? meta.dataset.base : meta.textContent.split('·')[0].trim();
                        meta.dataset.base = base;
                        meta.textContent = base + (att.post_id ? (' · post:' + att.post_id) : '');
                    }
                } catch (e) { /* ignore UI update errors */ }
            }).catch(function (err) {
                console.error('[media-library.js] attachToPost error', err);
                showToast('Сетевая ошибка при привязке', true);
            });
        } catch (ex) {
            console.error(ex);
            showToast('Ошибка при подготовке запроса', true);
        }
    }

    // Upload with progress (exposed as window.uploadFiles)
    function uploadFiles(files) {
        try {
            if (!files || !files.length) return;
            var form = new FormData();
            Array.from(files).forEach(function (f) { form.append('file', f, f.name); });

            var row = document.createElement('div'); row.style.display='flex'; row.style.flexDirection='column'; row.style.gap='6px'; row.style.marginBottom='8px';
            var label = document.createElement('div'); label.textContent = 'Загрузка ' + files.length + ' файлов...';
            var barWrap = document.createElement('div'); barWrap.style.width='100%'; barWrap.style.background='#eef2f6'; barWrap.style.borderRadius='8px';
            var bar = document.createElement('div'); bar.style.height='10px'; bar.style.width='0%'; bar.style.borderRadius='8px'; bar.style.transition='width .2s';
            bar.style.background='linear-gradient(90deg,#0ea5e9,#7c3aed)';
            barWrap.appendChild(bar);
            row.appendChild(label); row.appendChild(barWrap);
            if (progressList) progressList.appendChild(row);

            var xhr = new XMLHttpRequest();
            xhr.open('POST', apiUrl('upload/'), true);
            xhr.withCredentials = true;
            if (csrftoken) xhr.setRequestHeader('X-CSRFToken', csrftoken);

            xhr.upload.addEventListener('progress', function (e) {
                if (!e.lengthComputable) return;
                var pct = Math.round((e.loaded / e.total) * 100);
                bar.style.width = pct + '%';
            });

            xhr.onreadystatechange = function () {
                if (xhr.readyState !== 4) return;
                try {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        var resp = JSON.parse(xhr.responseText || '{}');
                        if (resp.success) {
                            label.textContent = 'Готово';
                            bar.style.width = '100%';
                            showToast('Загрузка завершена', false);
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
                    console.error('[media-library.js] upload parse error', err);
                    showToast('Ошибка ответа сервера', true);
                } finally {
                    setTimeout(function(){ try{ progressList.removeChild(row); }catch(e){} }, 3000);
                }
            };

            xhr.send(form);
        } catch (ex) {
            console.error('[media-library.js] uploadFiles exception', ex);
            showToast('Непредвиденная ошибка при загрузке', true);
        }
    }

    // Attach events (robustly)
    function attachEvents() {
        try {
            if (uploadBtn) {
                uploadBtn.addEventListener('click', function (e) {
                    e.preventDefault();
                    console.log('[media-library.js] upload button clicked');
                    fileInput.click();
                });
            } else {
                console.warn('[media-library.js] upload button not found');
            }

            if (fileInput) {
                fileInput.addEventListener('change', function (e) {
                    if (this.files && this.files.length) {
                        uploadFiles(this.files);
                        this.value = '';
                    }
                });
            }

            if (dropzone) {
                dropzone.addEventListener('dragover', function (e) { e.preventDefault(); dropzone.style.borderColor = 'var(--primary)'; });
                dropzone.addEventListener('dragleave', function (e) { e.preventDefault(); dropzone.style.borderColor = ''; });
                dropzone.addEventListener('drop', function (e) {
                    e.preventDefault(); dropzone.style.borderColor = '';
                    var dt = e.dataTransfer;
                    if (dt && dt.files && dt.files.length) uploadFiles(dt.files);
                });
            }

            if (searchInput) searchInput.addEventListener('input', debounce(function(){ fetchMedia(1); }, 350));
            if (unattachedCheckbox) unattachedCheckbox.addEventListener('change', function(){ fetchMedia(1); });
            if (refreshBtn) refreshBtn.addEventListener('click', function(){ fetchMedia(1); });

            // delegate for server-rendered grid items (fallback)
            document.addEventListener('click', function (e) {
                var el = e.target;
                // handled by per-button listeners already added during renderGrid
            });

            console.log('[media-library.js] events attached');
        } catch (err) {
            console.error('[media-library.js] attachEvents error', err);
        }
    }

    // simple debounce
    function debounce(fn,t){ var id; return function(){ var a=arguments; clearTimeout(id); id=setTimeout(function(){ fn.apply(null,a); }, t||200); }; }

    // init after DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function(){ attachEvents(); fetchMedia(1); });
    } else {
        attachEvents(); fetchMedia(1);
    }

})();
