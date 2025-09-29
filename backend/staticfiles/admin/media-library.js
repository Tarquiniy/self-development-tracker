// backend/blog/static/admin/media-library.js
(function () {
    // CSRF helper
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
    const uploader = document.getElementById('uploader');
    const fileInput = document.getElementById('file-input');
    const mediaGrid = document.getElementById('media-grid');
    const paginationEl = document.getElementById('media-pagination');
    const searchInput = document.getElementById('media-search');
    const unattachedCheckbox = document.getElementById('filter-unattached');
    const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
    const attachPostSelect = document.getElementById('attach-post-select');
    const attachToPostBtn = document.getElementById('attach-to-post-btn');

    let page = 1;
    const pageSize = 24;
    let totalPages = 1;
    let selectedIds = new Set();

    function apiUrl(path) {
        return `/api/blog/media/${path}`;
    }

    // Fetch and render media list
    function fetchMedia(p = 1) {
        const q = encodeURIComponent(searchInput.value.trim());
        const unattached = unattachedCheckbox.checked ? '1' : '0';
        const url = `${apiUrl('list/')}?page=${p}&page_size=${pageSize}&q=${q}&unattached_only=${unattached}`;
        fetch(url, { credentials: 'same-origin' })
            .then(r => r.json())
            .then(json => {
                renderGrid(json.results || []);
                page = json.page || 1;
                totalPages = json.total_pages || 1;
                renderPagination();
            })
            .catch(err => {
                console.error(err);
            });
    }

    function renderGrid(items) {
        mediaGrid.innerHTML = '';
        if (!items.length) {
            mediaGrid.innerHTML = '<div style="grid-column:1/-1;padding:20px;color:#6b7280">Файлы не найдены</div>';
            return;
        }
        items.forEach(item => {
            const el = document.createElement('div');
            el.className = 'media-item';
            el.dataset.id = item.id;

            // thumb
            const thumb = document.createElement('div');
            thumb.className = 'media-thumb';
            if (item.url && /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(item.filename || '')) {
                const img = document.createElement('img');
                img.src = item.url;
                img.alt = item.title || item.filename;
                thumb.appendChild(img);
            } else {
                thumb.textContent = item.filename || item.title || '—';
            }

            // meta
            const meta = document.createElement('div');
            meta.className = 'media-meta';

            const left = document.createElement('div');
            left.style.flex = '1';

            const title = document.createElement('div');
            title.className = 'media-title';
            title.textContent = item.title || item.filename || '—';
            left.appendChild(title);

            const sub = document.createElement('div');
            sub.style.fontSize = '12px';
            sub.style.color = '#6b7280';
            sub.textContent = item.uploaded_at ? new Date(item.uploaded_at).toLocaleString() : '';
            left.appendChild(sub);

            const actions = document.createElement('div');
            actions.className = 'media-actions';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.style.marginRight = '6px';
            checkbox.addEventListener('change', function () {
                const id = item.id;
                if (this.checked) selectedIds.add(id); else selectedIds.delete(id);
            });
            actions.appendChild(checkbox);

            const downloadBtn = document.createElement('a');
            downloadBtn.className = 'small-btn';
            downloadBtn.href = item.url || '#';
            downloadBtn.target = '_blank';
            downloadBtn.textContent = 'Открыть';
            actions.appendChild(downloadBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'small-btn danger';
            deleteBtn.textContent = 'Удалить';
            deleteBtn.addEventListener('click', function () {
                if (!confirm('Удалить файл?')) return;
                deleteAttachments([item.id]);
            });
            actions.appendChild(deleteBtn);

            meta.appendChild(left);
            meta.appendChild(actions);

            el.appendChild(thumb);
            el.appendChild(meta);

            mediaGrid.appendChild(el);
        });
    }

    function renderPagination() {
        paginationEl.innerHTML = '';
        if (totalPages <= 1) return;
        const prev = document.createElement('button');
        prev.className = 'small-btn';
        prev.textContent = '◀';
        prev.disabled = page <= 1;
        prev.addEventListener('click', function () {
            if (page > 1) fetchMedia(page - 1);
        });
        paginationEl.appendChild(prev);

        const info = document.createElement('span');
        info.textContent = `Страница ${page} / ${totalPages}`;
        info.style.margin = '0 8px';
        paginationEl.appendChild(info);

        const next = document.createElement('button');
        next.className = 'small-btn';
        next.textContent = '▶';
        next.disabled = page >= totalPages;
        next.addEventListener('click', function () {
            if (page < totalPages) fetchMedia(page + 1);
        });
        paginationEl.appendChild(next);
    }

    // Upload handlers
    function uploadFiles(files) {
        const fd = new FormData();
        // We'll do multiple requests (one-by-one) to provide per-file progress later if needed
        Array.from(files).forEach(file => {
            const fdata = new FormData();
            fdata.append('file', file);
            // optional: send title
            fdata.append('title', file.name);
            fetch(apiUrl('upload/'), {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'X-CSRFToken': csrftoken
                },
                body: fdata
            })
            .then(r => r.json())
            .then(json => {
                if (json.success) {
                    // refresh list after upload
                    fetchMedia(page);
                } else {
                    alert('Ошибка загрузки: ' + (json.message || 'unknown'));
                }
            })
            .catch(err => {
                console.error(err);
                alert('Ошибка сети при загрузке');
            });
        });
    }

    // delete
    function deleteAttachments(ids) {
        fetch(apiUrl('delete/'), {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken
            },
            body: JSON.stringify({ ids: ids })
        })
        .then(r => r.json())
        .then(json => {
            if (json.success) {
                selectedIds.clear();
                fetchMedia(page);
            } else {
                alert('Ошибка удаления: ' + (json.message || 'unknown'));
            }
        })
        .catch(err => {
            console.error(err);
            alert('Ошибка сети при удалении');
        });
    }

    // Attach selected to post
    function attachSelectedToPost(postId) {
        if (!postId) {
            // detach selected
        }
        if (!selectedIds.size) {
            alert('Ничего не выбрано');
            return;
        }
        const promises = [];
        const ids = Array.from(selectedIds);
        // We'll attach attachments one by one (could be batched)
        fetch(apiUrl('attach/'), {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken
            },
            body: JSON.stringify({ attachment_id: ids[0], post_id: postId })
        })
        .then(r => r.json())
        .then(json => {
            if (json.success) {
                // For simplicity attach remaining via separate requests
                const remaining = ids.slice(1);
                const tasks = remaining.map(id => {
                    return fetch(apiUrl('attach/'), {
                        method: 'POST',
                        credentials: 'same-origin',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': csrftoken
                        },
                        body: JSON.stringify({ attachment_id: id, post_id: postId })
                    }).then(r => r.json());
                });
                return Promise.all(tasks);
            } else {
                throw new Error(json.message || 'attach failed');
            }
        })
        .then(() => {
            selectedIds.clear();
            fetchMedia(page);
            alert('Привязано');
        })
        .catch(err => {
            console.error(err);
            alert('Ошибка привязки: ' + (err.message || err));
        });
    }

    // Load posts for attach select (first 200 posts for convenience)
    function loadPostsForSelect() {
        // We can reuse existing API /api/blog/posts/?page=1&page_size=200
        fetch('/api/blog/posts/?page=1&page_size=200', { credentials: 'same-origin' })
            .then(r => r.json())
            .then(json => {
                let items = [];
                if (Array.isArray(json)) {
                    items = json;
                } else if (json.results) {
                    items = json.results;
                }
                items.forEach(it => {
                    const opt = document.createElement('option');
                    opt.value = it.id || it.pk || it.id;
                    opt.textContent = it.title || it.slug || (`post ${it.id}`);
                    attachPostSelect.appendChild(opt);
                });
            })
            .catch(err => {
                console.warn('Не удалось загрузить посты для списка', err);
            });
    }

    // Event bindings
    fileInput.addEventListener('change', function (e) {
        if (this.files && this.files.length) {
            uploadFiles(this.files);
            this.value = '';
        }
    });

    // drag/drop
    ['dragenter', 'dragover'].forEach(evt => {
        uploader.addEventListener(evt, function (e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.add('dragover');
        });
    });
    ['dragleave', 'drop'].forEach(evt => {
        uploader.addEventListener(evt, function (e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.remove('dragover');
        });
    });
    uploader.addEventListener('drop', function (e) {
        const dt = e.dataTransfer;
        if (dt && dt.files && dt.files.length) {
            uploadFiles(dt.files);
        }
    });

    // search
    let searchTimer = null;
    searchInput.addEventListener('input', function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => fetchMedia(1), 300);
    });
    unattachedCheckbox.addEventListener('change', function () {
        fetchMedia(1);
    });

    bulkDeleteBtn.addEventListener('click', function () {
        if (!selectedIds.size) {
            alert('Ничего не выбрано');
            return;
        }
        if (!confirm('Удалить выбранные файлы?')) return;
        deleteAttachments(Array.from(selectedIds));
    });

    attachToPostBtn.addEventListener('click', function () {
        const pid = attachPostSelect.value || null;
        attachSelectedToPost(pid);
    });

    // init
    fetchMedia(1);
    loadPostsForSelect();
})();
