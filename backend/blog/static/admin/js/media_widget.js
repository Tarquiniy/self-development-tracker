(function () {

  function openMediaPicker(fieldId) {
    const url = "/admin/media-library/?select=1&field=" + fieldId;
    window.open(url, "media-library", "width=1100,height=750");
  }

  document.addEventListener("click", function (e) {
    const btn = e.target.closest(".media-widget-open");
    if (!btn) return;

    const fieldId = btn.dataset.field;
    openMediaPicker(fieldId);
  });

  window.addEventListener("message", function (e) {
    const msg = e.data;
    if (!msg || msg.type !== "media-selected") return;

    const input = document.getElementById(msg.field);
    if (!input) return;

    input.value = msg.url;

    const widget = input.closest(".media-widget");
    const preview = widget.querySelector(".media-widget-preview");

    preview.innerHTML = `<img src="${msg.url}" alt="">`;
  });

})();
