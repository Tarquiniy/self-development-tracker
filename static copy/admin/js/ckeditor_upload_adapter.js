// static/admin/js/ckeditor_upload_adapter.js
// CKEditor 5 — Django / generic upload adapter
// - Берёт CSRF из cookie (если есть) и добавляет X-CSRFToken
// - Использует credentials: 'include' чтобы куки проходили
// - Ожидает JSON-ответ: { "url": "<public file url>" }
// - Поддерживает abort (через fetch controller)

(function () {
  "use strict";

  // Получить cookie (Django csrftoken)
  function getCookie(name) {
    if (!document.cookie) return null;
    const cookies = document.cookie.split(";").map(c => c.trim());
    for (let i = 0; i < cookies.length; i++) {
      const parts = cookies[i].split("=");
      if (parts[0] === name) {
        return decodeURIComponent(parts.slice(1).join("="));
      }
    }
    return null;
  }

  class DjangoUploadAdapter {
    /**
     * loader - object provided by CKEditor (files: Promise<File>)
     * uploadUrl - endpoint string
     */
    constructor(loader, uploadUrl) {
      this.loader = loader;
      this.uploadUrl = uploadUrl || "/api/blog/media/upload/";
      this.xhr = null;
      this._abortController = null;
    }

    upload() {
      return this.loader.file.then(file => {
        return new Promise((resolve, reject) => {
          // create controller for aborting
          this._abortController = new AbortController();
          const signal = this._abortController.signal;

          const formData = new FormData();
          formData.append("file", file);

          // Additional metadata fields can be added if backend expects them:
          // formData.append("filename", file.name);

          // Use fetch
          const headers = {};
          // CSRF token for Django
          const csrfToken = getCookie("csrftoken");
          if (csrfToken) {
            headers["X-CSRFToken"] = csrfToken;
          }

          // If your backend requires Authorization header, set it here:
          // headers["Authorization"] = "Bearer " + YOUR_TOKEN_HERE;

          fetch(this.uploadUrl, {
            method: "POST",
            body: formData,
            credentials: "include", // important if backend relies on session cookies
            headers: headers,
            signal: signal,
          }).then(response => {
            if (!response.ok) {
              // Try to parse json/text error
              return response.text().then(text => {
                let msg = text || response.statusText;
                try {
                  const j = JSON.parse(text);
                  if (j && j.error) msg = j.error;
                } catch (e) { /* ignore */ }
                throw new Error(msg);
              });
            }
            return response.json();
          }).then(json => {
            // Normalize response - support a few common shapes
            const fileUrl = json.url || json.file_url || (json.data && json.data.url);
            if (!fileUrl) {
              reject("Upload response did not contain a file URL.");
              return;
            }
            resolve({ default: fileUrl });
          }).catch(err => {
            if (err.name === "AbortError") {
              reject("Upload aborted");
            } else {
              console.error("Upload error:", err);
              reject(err.message || "Upload failed");
            }
          });
        });
      });
    }

    abort() {
      if (this._abortController) {
        this._abortController.abort();
      }
    }
  }

  // Plugin factory used by ckeditor_init.js
  function DjangoUploadAdapterPlugin(editor) {
    editor.plugins.get("FileRepository").createUploadAdapter = (loader) => {
      // Allow overriding upload URL via editor.config.get("uploader.uploadUrl")
      const configuredUrl = (editor.config.get && editor.config.get("uploader") && editor.config.get("uploader").uploadUrl) || null;
      return new DjangoUploadAdapter(loader, configuredUrl);
    };
  }

  // Expose plugin globally
  window.DjangoUploadAdapterPlugin = DjangoUploadAdapterPlugin;
})();
