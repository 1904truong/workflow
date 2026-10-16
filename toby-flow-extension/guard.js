// Flow Bridge — khung viền sáng + khóa chuột trong lúc đang tự động tạo ảnh (giống TobyFlow).
// Dùng chung cho Flow / ChatGPT / Grok / Gemini. Lớp khóa chỉ chặn chuột của NGƯỜI DÙNG;
// các cú bấm tự động của extension đi qua FBGuard.send() sẽ tạm mở lớp khóa đúng lúc bấm.
(() => {
  if (window.FBGuard) return;
  let depth = 0;
  let root = null;
  let blocker = null;

  function build() {
    if (root) return;
    root = document.createElement("div");
    root.id = "fb-guard-frame";
    root.style.cssText = [
      "position:fixed", "inset:0", "z-index:99999990", "pointer-events:none",
      "border:4px solid #c4f135", "border-radius:6px", "box-sizing:border-box",
      "box-shadow:inset 0 0 28px rgba(196,241,53,.45), 0 0 18px rgba(196,241,53,.6)",
      "animation:fbGuardPulse 1.8s ease-in-out infinite",
    ].join(";");
    const style = document.createElement("style");
    style.textContent = "@keyframes fbGuardPulse{0%,100%{opacity:.75}50%{opacity:1}}";
    root.appendChild(style);

    blocker = document.createElement("div");
    blocker.id = "fb-guard-blocker";
    blocker.title = "Flow Bridge đang chạy tự động — vui lòng không thao tác trên trang này";
    blocker.style.cssText = "position:fixed;inset:0;z-index:99999989;pointer-events:auto;cursor:not-allowed;background:transparent";
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
    ["click", "dblclick", "mousedown", "mouseup", "contextmenu", "wheel", "touchstart"].forEach((t) => blocker.addEventListener(t, stop, { passive: false }));

    (document.documentElement || document.body).append(blocker, root);
  }

  const api = {
    show() {
      depth++;
      if (depth === 1) build();
    },
    hide() {
      depth = Math.max(0, depth - 1);
      if (depth === 0) {
        blocker?.remove(); root?.remove();
        blocker = null; root = null;
      }
    },
    // Gửi lệnh bấm/phím thật qua background; tạm mở lớp khóa để cú bấm tự động chạm được vào trang
    async send(message) {
      if (blocker) blocker.style.pointerEvents = "none";
      try {
        return await chrome.runtime.sendMessage(message);
      } finally {
        if (blocker && depth > 0) blocker.style.pointerEvents = "auto";
      }
    },
  };
  // Tên file tải về: tên ảnh NGẮN (tối đa ~20 ký tự, bỏ dấu, cắt theo từ) + giờ-phút + ngày-tháng, vd: tao_anh_con_meo_15-30_13-10.png
  api.fileName = (prompt, index = 0, total = 1, ext = "png") => {
    const full = String(prompt || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d")
      .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    let slug = full;
    if (full.length > 20) {
      const cut = full.slice(0, 20);
      const lastSep = cut.lastIndexOf("_");
      slug = lastSep >= 8 ? cut.slice(0, lastSep) : cut; // cắt ở ranh giới từ nếu được
    }
    slug = slug.replace(/_+$/g, "") || "anh";
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    const time = `${p(d.getHours())}-${p(d.getMinutes())}`; // giờ-phút
    const date = `${p(d.getDate())}-${p(d.getMonth() + 1)}`; // ngày-tháng
    return `${slug}_${time}_${date}${total > 1 ? "_" + (index + 1) : ""}.${ext}`;
  };
  window.FBGuard = api;
})();
