(async function() {
  const listUrl = "/api/media/";
  const uploadUrl = "/api/media/upload/";
  const mediaGrid = document.getElementById("media-grid");
  const fileInput = document.getElementById("file-input");
  const uploadBtn = document.getElementById("upload-btn");
  const status = document.getElementById("upload-status");

  async function fetchList() {
    mediaGrid.innerHTML = "Loading...";
    const r = await fetch(listUrl, { credentials: "same-origin" });
    if (!r.ok) {
      mediaGrid.innerHTML = "Failed to load.";
      return;
    }
    const data = await r.json();
    mediaGrid.innerHTML = "";
    data.forEach(item => {
      const el = document.createElement("div");
      el.style.width = "160px";
      el.style.border = "1px solid #eee";
      el.style.padding = "8px";
      el.style.borderRadius = "6px";
      el.style.textAlign = "center";
      el.innerHTML = `
        <div style="height:100px; display:flex; align-items:center; justify-content:center;">
          <img src="${item.thumbnail_url || item.supabase_url}" style="max-height:100%; max-width:100%; object-fit:cover; border-radius:4px;" />
        </div>
        <div style="font-size:12px; margin-top:6px;">${item.original_filename}</div>
        <div style="margin-top:6px;">
          <button data-id="${item.id}" class="delete-btn">Delete</button>
        </div>
      `;
      mediaGrid.appendChild(el);
    });

    document.querySelectorAll(".delete-btn").forEach(btn=>{
      btn.addEventListener("click", async (e)=>{
        const id = e.target.dataset.id;
        if(!confirm("Удалить файл?")) return;
        const res = await fetch(`/api/media/${id}/`, { method: "DELETE", credentials: "same-origin" });
        if (res.status === 204) {
          fetchList();
        } else {
          alert("Ошибка удаления");
        }
      });
    });
  }

  uploadBtn.addEventListener("click", async ()=>{
    if (!fileInput.files.length) return alert("Выберите файл");
    const file = fileInput.files[0];
    const form = new FormData();
    form.append("file", file);
    status.textContent = "Uploading...";
    const res = await fetch(uploadUrl, { method: "POST", body: form, credentials: "same-origin" });
    if (res.ok) {
      status.textContent = "Uploaded";
      fileInput.value = "";
      fetchList();
    } else {
      const txt = await res.text();
      status.textContent = "Error: " + txt;
    }
  });

  // initial load
  fetchList();
})();
