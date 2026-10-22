// Flow Bridge — cầu nối giữa web "Flow Bridge Studio" (localhost) và extension.
// Giao thức (đã có sẵn bên web): trang gửi window.postMessage({ id, type, source: "web", payload }),
// extension trả lời cùng id với source: "extension".
//   GET_FLOW_STATUS   -> payload.status: CONNECTED | FLOW_TAB_NOT_FOUND | PROJECT_NOT_OPEN
//   TRIGGER_GENERATE  -> payload.status: GENERATED + imageUrl  |  error: { code, message }
(() => {
  if (window.__fbWebBridge) return;
  window.__fbWebBridge = true;
  const ORIGIN = window.location.origin;

  const reply = (id, type, payload, error) => {
    window.postMessage({ id, type, source: "extension", timestamp: Date.now(), payload: payload ?? null, ...(error ? { error } : {}) }, ORIGIN);
  };

  // Báo cho trang biết extension đang có mặt
  const announce = () => window.postMessage({ type: "EXTENSION_DETECTED", source: "extension", timestamp: Date.now(), payload: null }, ORIGIN);
  announce();

  const safeSend = (message) => new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (res) => {
        if (chrome.runtime.lastError) resolve({ ok: false, code: "EXTENSION_UNAVAILABLE", message: chrome.runtime.lastError.message });
        else resolve(res || { ok: false, code: "EXTENSION_UNAVAILABLE", message: "Extension không phản hồi" });
      });
    } catch (e) {
      // Extension vừa được reload: trang này đang giữ bản script cũ -> cần F5
      resolve({ ok: false, code: "EXTENSION_UNAVAILABLE", message: String(e && e.message || e) });
    }
  });

  window.addEventListener("message", async (event) => {
    if (event.source !== window || event.origin !== ORIGIN) return;
    const data = event.data;
    if (!data || typeof data !== "object" || data.source !== "web" || !data.id) return;

    if (data.type === "GET_FLOW_STATUS") {
      const res = await safeSend({ type: "WEB_FLOW_STATUS" });
      reply(data.id, "GET_FLOW_STATUS", { status: res.ok ? res.status : "UNKNOWN", message: res.message });
      return;
    }

    if (data.type === "ANALYZE_WORKSHEET") {
      const text = data.payload && data.payload.text;
      const res = await safeSend({ type: "WEB_ANALYZE_WORKSHEET", payload: { text } });
      if (res.ok) reply(data.id, "ANALYZE_WORKSHEET", { plan: res.plan, warnings: res.warnings, model: res.model });
      else reply(data.id, "ANALYZE_WORKSHEET", null, { code: res.code || "ERROR", message: res.message || "Phân tích bằng AI thất bại", details: res.details });
      return;
    }

    if (data.type === "REWRITE_WORKSHEET") {
      const p = data.payload || {};
      const res = await safeSend({ type: "WEB_REWRITE_WORKSHEET", payload: { text: p.text, kind: p.kind, hint: p.hint, example: p.example, peek: !!p.peek } });
      if (res.ok) reply(data.id, "REWRITE_WORKSHEET", { text: res.text, notes: res.notes, usage: res.usage });
      else reply(data.id, "REWRITE_WORKSHEET", { usage: res.usage || null }, { code: res.code || "ERROR", message: res.message || "Viết lại bằng AI thất bại" });
      return;
    }

    if (data.type === "LIST_CLOUD_IMAGES") {
      const res = await safeSend({ type: "WEB_CLOUD_LIST", payload: data.payload || {} });
      if (res.ok) reply(data.id, "LIST_CLOUD_IMAGES", { images: res.images });
      else reply(data.id, "LIST_CLOUD_IMAGES", { images: [] }, { code: res.code || "ERROR", message: res.message || "Không lấy được danh sách ảnh Supabase" });
      return;
    }

    if (data.type === "TRIGGER_GENERATE") {
      const prompt = data.payload && data.payload.prompt;
      if (!prompt || !String(prompt).trim()) {
        reply(data.id, "TRIGGER_GENERATE", { status: "FAILED" }, { code: "EMPTY_PROMPT", message: "Prompt trống" });
        return;
      }
      const res = await safeSend({ type: "WEB_TRIGGER_GENERATE", payload: { reqId: data.id, prompt: String(prompt), options: { ...(data.payload.options || {}), referenceImages: data.payload.referenceImages || [] } } });
      if (!res.ok) {
        // Không khởi động được (không có tab Flow, chưa vào Project, extension lỗi...)
        reply(data.id, "TRIGGER_GENERATE", { status: res.code || "FAILED", message: res.message }, { code: res.code || "FAILED", message: res.message || "Không thể bắt đầu tạo ảnh" });
      }
      // Nếu ok: kết quả cuối cùng sẽ đến sau qua WEB_GEN_RESULT (bên dưới)
    }
  });

  // Kết quả tạo ảnh từ Flow (background chuyển tiếp tới tab web)
  chrome.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== "WEB_GEN_RESULT") return;
    if (message.ok && message.imageUrl) {
      reply(message.reqId, "TRIGGER_GENERATE", { status: "GENERATED", imageUrl: message.imageUrl, imageUrls: message.imageUrls || [message.imageUrl] });
    } else {
      reply(message.reqId, "TRIGGER_GENERATE", { status: message.code || "FAILED", message: message.message }, { code: message.code || "FAILED", message: message.message || "Tạo ảnh thất bại" });
    }
  });
})();
