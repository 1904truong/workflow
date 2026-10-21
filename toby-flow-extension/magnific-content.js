// Flow Bridge — bộ chạy cho Magnific (tạo ảnh AI).
// Được background tiêm vào tab magnific.com khi bấm "Tạo" với nền tảng Magnific.
// Giao diện Magnific không cố định nên chỗ nào cũng tìm theo dấu hiệu chung (ô nhập lớn nhất, nút có chữ Generate/Create),
// nếu trang đổi giao diện thì chỉ cần chỉnh các hàm findInput / findGenerate bên dưới.
(() => {
  if (window.__fbMagnificLoaded) return;
  window.__fbMagnificLoaded = true;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const visible = (el) => !!el && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
  let stopped = false;
  let running = false;

  async function waitFor(fn, timeoutMs = 8000, step = 250) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      if (stopped) return null;
      const v = fn();
      if (v) return v;
      await sleep(step);
    }
    return null;
  }

  // ── Thông báo nhỏ góc trên ──
  let toast;
  function say(text, isError) {
    console.log("[Flow Bridge][Magnific]", text);
    if (!toast) {
      toast = document.createElement("div");
      toast.style.cssText = "position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#101012;color:#e8ffb0;border:1px solid #c4f135;border-radius:10px;padding:8px 14px;font:600 13px system-ui,sans-serif;box-shadow:0 4px 20px rgba(0,0,0,.4)";
      document.documentElement.appendChild(toast);
    }
    toast.style.color = isError ? "#ffb4b4" : "#e8ffb0";
    toast.style.borderColor = isError ? "#e5484d" : "#c4f135";
    toast.textContent = "Flow Bridge • " + text;
  }
  const hideToast = (ms = 4000) => setTimeout(() => { toast?.remove(); toast = null; }, ms);

  // ── Ô nhập prompt: ô văn bản (hoặc vùng soạn thảo) lớn nhất đang hiện ──
  function findInput() {
    const area = (el) => { const r = el.getBoundingClientRect(); return r.width * r.height; };
    const boxes = [...document.querySelectorAll("textarea, div[contenteditable='true'][role='textbox'], div[contenteditable='true'], div.ProseMirror")]
      .filter(visible)
      .filter((el) => !el.closest("#fb-guard-frame"));
    boxes.sort((a, b) => area(b) - area(a));
    return boxes[0] || null;
  }

  function setPromptText(el, text) {
    el.focus();
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    const sel = getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand("delete", false, null);
    document.execCommand("insertText", false, text);
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
  }

  // ── Nút Tạo: nút có chữ Generate/Create/Tạo, ưu tiên nút gần ô nhập nhất ──
  const GENERATE_RE = /^(generate|create|imagine|tạo|tạo ảnh|generar|générer)\b/i;
  function findGenerate(inputEl) {
    const label = (b) => ((b.textContent || "") + " " + (b.getAttribute("aria-label") || "")).trim();
    const all = [...document.querySelectorAll("button, [role='button']")].filter(visible).filter((b) => !b.disabled && b.getAttribute("aria-disabled") !== "true");
    const matches = all.filter((b) => GENERATE_RE.test(label(b).replace(/\s+/g, " ")));
    if (!matches.length) return null;
    // Leo dần từ ô nhập lên: nút nào nằm trong vùng bao gần nhất thì chọn
    let scope = inputEl.parentElement;
    for (let depth = 0; scope && depth < 8; depth++, scope = scope.parentElement) {
      const hit = matches.find((b) => scope.contains(b));
      if (hit) return hit;
    }
    return matches[0];
  }

  const tClick = async (el) => {
    const r = el.getBoundingClientRect();
    try {
      const res = await FBGuard.send({ type: "TRUSTED_CLICK", payload: { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) } });
      if (res && res.success) return true;
    } catch (_) {}
    el.click();
    return false;
  };

  // ── Nhận biết ảnh mới ──
  const bigImgs = () => new Set([...document.querySelectorAll("img")].filter((im) => {
    const r = im.getBoundingClientRect();
    return r.width >= 200 && r.height >= 200 && !String(im.src).startsWith("data:image/svg");
  }));
  const isBusy = () => [...document.querySelectorAll("button, [role='progressbar'], [aria-busy='true']")].filter(visible).some((el) => {
    const t = ((el.textContent || "") + " " + (el.getAttribute("aria-label") || "")).toLowerCase();
    return /generating|processing|đang tạo|đang xử lý|cancel|stop|dừng/.test(t) || el.getAttribute("role") === "progressbar" || el.getAttribute("aria-busy") === "true";
  });

  const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error || new Error("Không đọc được ảnh"));
    fr.readAsDataURL(blob);
  });
  const b64ToBlob = (b64, type) => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: type || "image/png" });
  };
  async function fetchBlob(src) {
    try {
      const r = await fetch(src, { credentials: "include" });
      if (r.ok) { const b = await r.blob(); if (b.size) return b; }
    } catch (_) {}
    const res = await chrome.runtime.sendMessage({ type: "CLOUD_FETCH_IMAGE", payload: { url: src } });
    if (!res || !res.ok || !res.base64) throw new Error("Không tải được dữ liệu ảnh");
    return b64ToBlob(res.base64, res.type);
  }

  async function downloadImage(img, prompt, index) {
    const src = img.currentSrc || img.src;
    const blob = await fetchBlob(src);
    const ext = (blob.type.split("/")[1] || "png").replace("jpeg", "jpg");
    const safe = String(prompt).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "image";
    const url = /^https?:/.test(src) ? src : await blobToDataUrl(blob);
    const r = await chrome.runtime.sendMessage({ type: "DOWNLOAD_IMAGE", payload: { url, filename: `magnific/${safe}-${Date.now().toString(36)}-${index}.${ext}` } });
    if (!r || !r.success) throw new Error("Không tải được ảnh về máy");
    return blob;
  }

  async function saveToCloud(blob, src, prompt, opts, index) {
    const st = await chrome.runtime.sendMessage({ type: "CLOUD_STATUS" }).catch(() => null);
    if (!st || !st.ok || !st.enabled) return false;
    if (!st.signedIn) say("Supabase: chưa đăng nhập — ảnh sẽ chờ trong hàng đợi, hãy đăng nhập trong Cài đặt cloud", true);
    const bmp = await createImageBitmap(blob);
    const dims = { width: bmp.width, height: bmp.height };
    bmp.close?.();
    const jobId = crypto.randomUUID();
    const base64 = (await blobToDataUrl(blob)).split(",")[1] || "";
    const r = await chrome.runtime.sendMessage({
      type: "CLOUD_ENQUEUE",
      payload: {
        jobId, base64, width: dims.width, height: dims.height, source: String(src).slice(0, 200),
        meta: { platform: "Magnific", prompt, model: "Magnific", aspectRatio: opts.aspectRatio || null, expected: 1, index },
      },
    });
    if (!r || !r.ok) throw new Error(`${r && r.code}: ${r && r.error}`);
    await chrome.runtime.sendMessage({ type: "CLOUD_FINISH_JOB", payload: { jobId, expected: 1 } }).catch(() => null);
    return true;
  }

  async function runOne(prompt, opts) {
    const inputEl = await waitFor(findInput, 20000);
    if (!inputEl) throw new Error("Không tìm thấy ô nhập prompt của Magnific (hãy mở trang tạo ảnh)");
    const before = bigImgs();
    setPromptText(inputEl, prompt + opts.suffix);
    await sleep(600);
    const btn = await waitFor(() => findGenerate(inputEl), 8000);
    if (!btn) throw new Error("Không thấy nút Tạo (Generate) trên Magnific");
    await tClick(btn);

    // Chờ có ảnh mới và trang hết trạng thái đang tạo, giữ ổn định vài giây mới coi là xong
    let stableSince = 0;
    let fresh = [];
    const t0 = Date.now();
    while (Date.now() - t0 < opts.timeoutMs) {
      if (stopped) return 0;
      await sleep(1500);
      const now = bigImgs();
      fresh = [...now].filter((im) => !before.has(im) && visible(im));
      if (fresh.length && !isBusy()) {
        if (!stableSince) stableSince = Date.now();
        if (Date.now() - stableSince >= 3000) break;
      } else {
        stableSince = 0;
      }
    }
    if (!fresh.length || !stableSince) throw new Error("Quá thời gian chờ ảnh (hoặc Magnific không trả ảnh)");

    // Ảnh mới nhất nằm thấp nhất trên trang
    fresh.sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom);
    const take = fresh.slice(0, opts.count);
    for (let i = 0; i < take.length; i++) {
      const src = take[i].currentSrc || take[i].src;
      let blob = null;
      if (opts.autoDownload) {
        try { blob = await downloadImage(take[i], prompt, i); }
        catch (e) { console.warn("[Flow Bridge][Magnific] Tải ảnh thất bại:", e.message); say("Ảnh đã tạo nhưng chưa tải được: " + e.message, true); await sleep(2000); }
      }
      try { await saveToCloud(blob || await fetchBlob(src), src, prompt, opts, i); }
      catch (e) { console.warn("[Flow Bridge][Magnific] Lưu Supabase thất bại:", e.message); say("Ảnh đã tạo nhưng chưa lưu được lên Supabase: " + e.message, true); await sleep(2000); }
    }
    return take.length;
  }

  async function runQueue(payload) {
    if (running) { say("Đang có tác vụ chạy, bỏ qua", true); hideToast(); return; }
    running = true; stopped = false;
    FBGuard.show();
    const prompts = (payload.prompts || []).filter((p) => p && p.trim());
    const opts = {
      suffix: payload.aspectRatio ? `, aspect ratio ${payload.aspectRatio}` : "",
      aspectRatio: payload.aspectRatio,
      count: Math.min(4, Math.max(1, +payload.batchCount || 1)),
      timeoutMs: 240000,
      autoDownload: payload.autoDownload !== false,
    };
    try {
      for (let i = 0; i < prompts.length; i++) {
        if (stopped) break;
        say(`Prompt ${i + 1}/${prompts.length}...`);
        const n = await runOne(prompts[i], opts);
        say(`Xong prompt ${i + 1}/${prompts.length} (${n} ảnh)`);
        await sleep(2000);
      }
      if (stopped) say("Đã dừng", true); else say(`Hoàn tất ${prompts.length} prompt`);
    } catch (e) {
      console.error("[Flow Bridge][Magnific]", e);
      say("Lỗi: " + e.message, true);
    } finally {
      running = false;
      FBGuard.hide();
      hideToast(6000);
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "RUN_CHAT_AUTOMATION") { runQueue(message.payload); sendResponse({ success: true }); return true; }
    if (message.type === "STOP_AUTOMATION") { stopped = true; }
  });
})();
