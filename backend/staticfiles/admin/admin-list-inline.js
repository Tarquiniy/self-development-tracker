// backend/blog/static/admin/admin-list-inline.js
(function () {
    // Helper to read cookie
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

    // send update request
    function sendUpdate(postId, field, value, onSuccess, onError) {
        fetch('/admin/posts/update/', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken
            },
            body: JSON.stringify({ post_id: postId, field: field, value: value })
        })
        .then(r => r.json().then(data => ({ ok: r.ok, status: r.status, data })))
        .then(resp => {
            if (!resp.ok || !resp.data.success) {
                const msg = resp.data && resp.data.message ? resp.data.message : 'Ошибка при сохранении';
                if (onError) onError(msg);
            } else {
                if (onSuccess) onSuccess(resp.data);
            }
        })
        .catch(err => {
            if (onError) onError(err && err.message ? err.message : 'Network error');
        });
    }

    // Attach handlers
    function attachInlineHandlers() {
        // Title inputs
        document.querySelectorAll('.inline-title-input').forEach(input => {
            // Save on blur
            input.addEventListener('blur', function () {
                const postId = this.dataset.postId;
                const value = this.value.trim();
                if (!postId) return;
                // visual feedback
                this.classList.add('saving');
                sendUpdate(postId, 'title', value, (data) => {
                    input.classList.remove('saving');
                    input.classList.add('saved');
                    setTimeout(() => input.classList.remove('saved'), 1200);
                }, (errMsg) => {
                    input.classList.remove('saving');
                    input.classList.add('error');
                    alert('Не удалось сохранить: ' + errMsg);
                    setTimeout(() => input.classList.remove('error'), 2000);
                });
            });

            // Save on Enter
            input.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.blur();
                }
            });
        });

        // Status selects
        document.querySelectorAll('.inline-status-select').forEach(select => {
            select.addEventListener('change', function () {
                const postId = this.dataset.postId;
                const value = this.value;
                if (!postId) return;
                this.classList.add('saving');
                sendUpdate(postId, 'status', value, (data) => {
                    select.classList.remove('saving');
                    select.classList.add('saved');
                    setTimeout(() => select.classList.remove('saved'), 1200);
                }, (errMsg) => {
                    select.classList.remove('saving');
                    select.classList.add('error');
                    alert('Не удалось сохранить статус: ' + errMsg);
                    setTimeout(() => select.classList.remove('error'), 2000);
                });
            });
        });
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachInlineHandlers);
    } else {
        attachInlineHandlers();
    }
})();
