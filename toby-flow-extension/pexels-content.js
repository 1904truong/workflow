// Flow Bridge — bộ chạy cho Pexels (kho ảnh stock).
// Được background tiêm vào tab pexels.com khi bấm "Tạo" với nền tảng Pexels.
// Pexels không tạo ảnh mà TÌM ảnh: mỗi prompt là một từ khóa tìm kiếm, lấy ảnh đầu tiên (hoặc N ảnh) và tải về.
// Trang kết quả của Pexels có sẵn địa chỉ ảnh trong HTML nên chỉ cần gọi cùng trang (same-origin) rồi đọc ra, không cần bấm chuột.
(() => {
  if (window.__fbPexelsLoaded) return;
  window.__fbPexelsLoaded = true;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let stopped = false;
  let running = false;

  // ── Thông báo nhỏ góc trên ──
  let toast;
  function say(text, isError) {
    console.log("[Flow Bridge][Pexels]", text);
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

  // Tỉ lệ khung hình -> bộ lọc hướng ảnh của Pexels
  const orientationOf = (ratio) => {
    if (ratio === "1:1") return "square";
    if (ratio === "9:16" || ratio === "3:4") return "portrait";
    if (ratio === "16:9" || ratio === "4:3") return "landscape";
    return "";
  };

  const slug = (s) => String(s).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "photo";

  // Đọc trang kết quả tìm kiếm và lấy các ảnh khác nhau (theo mã ảnh), giữ đúng thứ tự xuất hiện
  async function searchPhotos(query, orientation, count) {
    const qs = orientation ? `?orientation=${orientation}` : "";
    const url = `${location.origin}/search/${encodeURIComponent(query)}/${qs}`;
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error(`Pexels trả lỗi ${res.status} khi tìm "${query}"`);
    const html = await res.text();
    const re = /https:\/\/images\.pexels\.com\/photos\/(\d+)\/([^"'\s?\\)]+\.(?:jpe?g|png|webp))/gi;
    const seen = new Set();
    const out = [];
    let m;
    while ((m = re.exec(html)) && out.length < count) {
      if (seen.has(m[1])) continue;
      seen.add(m[1]);
      out.push({ id: m[1], base: m[0] });
    }
    return out;
  }

  const blobToBase64 = (blob) => new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(",")[1] || "");
    fr.onerror = () => reject(fr.error || new Error("Không đọc được ảnh"));
    fr.readAsDataURL(blob);
  });
  const b64ToBlob = (b64, type) => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: type || "image/jpeg" });
  };
  async function fetchBlob(src) {
    try {
      const r = await fetch(src);
      if (r.ok) { const b = await r.blob(); if (b.size) return b; }
    } catch (_) {}
    // Trang không đọc được ảnh ở tên miền khác: nhờ background tải hộ
    const res = await chrome.runtime.sendMessage({ type: "CLOUD_FETCH_IMAGE", payload: { url: src } });
    if (!res || !res.ok || !res.base64) throw new Error("Không tải được dữ liệu ảnh");
    return b64ToBlob(res.base64, res.type);
  }

  // Khi bật Auto Save Cloud: đưa ảnh vào hàng đợi Supabase như các nền tảng khác
  async function saveToCloud(src, query, opts, index) {
    const st = await chrome.runtime.sendMessage({ type: "CLOUD_STATUS" }).catch(() => null);
    if (!st || !st.ok || !st.enabled) return false;
    if (!st.signedIn) { say("Supabase: chưa đăng nhập — ảnh sẽ chờ trong hàng đợi, hãy đăng nhập trong Cài đặt cloud", true); }
    const blob = await fetchBlob(src);
    const bmp = await createImageBitmap(blob);
    const dims = { width: bmp.width, height: bmp.height };
    bmp.close?.();
    const jobId = crypto.randomUUID();
    const r = await chrome.runtime.sendMessage({
      type: "CLOUD_ENQUEUE",
      payload: {
        jobId, base64: await blobToBase64(blob), width: dims.width, height: dims.height, source: src.slice(0, 200),
        meta: { platform: "Pexels", prompt: query, model: "Pexels (ảnh stock)", aspectRatio: opts.aspectRatio || null, expected: 1, index },
      },
    });
    if (!r || !r.ok) throw new Error(`${r && r.code}: ${r && r.error}`);
    await chrome.runtime.sendMessage({ type: "CLOUD_FINISH_JOB", payload: { jobId, expected: 1 } }).catch(() => null);
    return true;
  }

  async function runOne(query, opts) {
    const photos = await searchPhotos(query, opts.orientation, opts.count);
    if (!photos.length) throw new Error(`Không thấy ảnh nào cho "${query}"`);
    for (let i = 0; i < photos.length; i++) {
      if (stopped) break;
      const p = photos[i];
      const src = `${p.base}?auto=compress&cs=tinysrgb&w=${opts.width}`;
      if (opts.autoDownload) {
        const name = `pexels/${slug(query)}-${p.id}.jpeg`;
        const r = await chrome.runtime.sendMessage({ type: "DOWNLOAD_IMAGE", payload: { url: src, filename: name } });
        if (!r || !r.success) say("Không tải được ảnh " + p.id, true);
      }
      try { await saveToCloud(src, query, opts, i); }
      catch (e) { console.warn("[Flow Bridge][Pexels] Lưu Supabase thất bại:", e.message); say("Ảnh đã lấy nhưng chưa lưu được lên Supabase: " + e.message, true); await sleep(2000); }
    }
    return photos.length;
  }

  async function runQueue(payload) {
    if (running) { say("Đang có tác vụ chạy, bỏ qua", true); hideToast(); return; }
    running = true; stopped = false;
    const queries = (payload.prompts || []).map((p) => String(p || "").trim()).filter(Boolean);
    // Độ phân giải 1K/2K/4K của ô chọn chung -> chiều rộng ảnh tải về
    const widthOf = { "1K": 1280, "2K": 1920, "4K": 3000 };
    const opts = {
      orientation: orientationOf(payload.aspectRatio),
      aspectRatio: payload.aspectRatio,
      count: Math.min(4, Math.max(1, +payload.batchCount || 1)),
      width: widthOf[payload.resolution] || 1920,
      autoDownload: payload.autoDownload !== false,
    };
    try {
      for (let i = 0; i < queries.length; i++) {
        if (stopped) break;
        say(`Tìm ảnh ${i + 1}/${queries.length}: ${queries[i].slice(0, 40)}...`);
        const n = await runOne(queries[i], opts);
        say(`Xong ${i + 1}/${queries.length} (${n} ảnh)`);
        await sleep(800);
      }
      if (stopped) say("Đã dừng", true); else say(`Hoàn tất ${queries.length} từ khóa`);
    } catch (e) {
      console.error("[Flow Bridge][Pexels]", e);
      say("Lỗi: " + e.message, true);
    } finally {
      running = false;
      hideToast(6000);
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "RUN_CHAT_AUTOMATION") { runQueue(message.payload); sendResponse({ success: true }); return true; }
    if (message.type === "STOP_AUTOMATION") { stopped = true; }
  });
})();
