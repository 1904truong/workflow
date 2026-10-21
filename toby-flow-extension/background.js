// Flow Bridge Background Service Worker
console.log("[Flow Bridge] Service Worker Started");

// Mở Side Panel khi click vào icon extension
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.warn("[Flow Bridge] sidePanel error:", err));
}

// ═══════════ Supabase cloud sync ═══════════
importScripts("cloud-sync.js");

function openBlobDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("flowbridge-cloud", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("blobs");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function blobTx(mode, fn) {
  const db = await openBlobDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("blobs", mode);
    const req = fn(tx.objectStore("blobs"));
    tx.oncomplete = () => { db.close(); resolve(req.result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

const cloud = CloudSync.createCloudSync({
  fetch: (...a) => fetch(...a),
  store: {
    get: async (k) => (await chrome.storage.local.get(k))[k],
    set: (k, v) => chrome.storage.local.set({ [k]: v })
  },
  blobs: {
    put: (id, v) => blobTx("readwrite", (s) => s.put(v, id)),
    get: (id) => blobTx("readonly", (s) => s.get(id)),
    del: (id) => blobTx("readwrite", (s) => s.delete(id))
  },
  schedule: (when) => chrome.alarms.create("cloud-queue", { when: Math.max(when, Date.now() + 1000) }),
  notify: (item) => {
    chrome.runtime.sendMessage({ type: "CLOUD_UPDATE", item }).catch(() => {});
    if (item.tabId != null) chrome.tabs.sendMessage(item.tabId, { type: "CLOUD_UPDATE", item }).catch(() => {});
  }
});

// Mỗi lần service worker thức dậy: khôi phục item kẹt và xử lý hàng đợi
cloud.recover().catch((e) => console.warn("[Flow Bridge] cloud recover:", e));
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === "cloud-queue") cloud.processQueue().catch(() => {});
});

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

// Trả lời bất đồng bộ: gói lỗi thành { ok:false, code, error }
function respond(promise, sendResponse) {
  promise
    .then((data) => sendResponse({ ok: true, ...(data && typeof data === "object" && !Array.isArray(data) ? data : { data }) }))
    .catch((e) => sendResponse({ ok: false, code: e.code || "ERROR", error: e.message || String(e) }));
  return true;
}

const CLOUD_HANDLERS = {
  CLOUD_STATUS: () => cloud.status(),
  CLOUD_GET_SETTINGS: async () => ({ settings: await cloud.getSettings() }),
  CLOUD_SET_SETTINGS: async (p) => ({ settings: await cloud.setSettings(p) }),
  CLOUD_SIGN_IN: async (p) => { const s = await cloud.signIn(p.email, p.password); cloud.processQueue(); return { email: s.user.email }; },
  CLOUD_SIGN_OUT: async () => { await cloud.signOut(); return {}; },
  CLOUD_ENQUEUE: async (p, sender) => {
    const r = await cloud.enqueue({
      jobId: p.jobId, meta: p.meta, bytes: b64ToBytes(p.base64), width: p.width, height: p.height,
      tabId: sender.tab ? sender.tab.id : null, source: p.source
    });
    cloud.processQueue().catch(() => {});
    return r;
  },
  CLOUD_FINISH_JOB: async (p) => cloud.finishJob(p.jobId, p.expected),
  CLOUD_QUEUE: async () => ({ queue: await cloud.getQueue() }),
  CLOUD_RETRY: async (p) => { await cloud.retryItem(p.id); return {}; },
  CLOUD_CLEAR_DONE: async () => { await cloud.clearDone(); return {}; },
  CLOUD_LIST: async (p) => ({ rows: await cloud.listImages(p || {}) }),
  CLOUD_SIGN_URLS: async (p) => ({ urls: await cloud.signUrls(p.paths, p.expiresIn || undefined) }),
  CLOUD_DELETE: async (p) => { await cloud.deleteImage(p); return {}; },
  // Content script không đọc được ảnh cross-origin: background (có host permission) tải hộ
  CLOUD_FETCH_IMAGE: async (p) => {
    const res = await fetch(p.url, { credentials: "include" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { base64: bytesToB64(new Uint8Array(await res.arrayBuffer())), type: res.headers.get("content-type") || "" };
  }
};

// Tìm tab Google Flow
async function getFlowTab() {
  const tabs = await chrome.tabs.query({});
  
  // 1. Ưu tiên tab dự án (/project/...)
  const projectTab = tabs.find(
    (t) => t.url && t.url.includes("flow.google.com/project/") && !t.url.includes("404")
  );
  if (projectTab) return projectTab;

  // 2. Tab flow bất kỳ
  const flowTab = tabs.find(
    (t) => t.url && (t.url.includes("flow.google.com") || t.url.includes("labs.google"))
  );
  return flowTab || null;
}

// Đảm bảo tab Google Flow active
async function ensureActiveFlowTab() {
  let tab = await getFlowTab();
  if (tab) {
    await chrome.tabs.update(tab.id, { active: true });
    if (tab.windowId) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }
    return tab;
  }
  // Mở trang Flow nếu chưa có
  tab = await chrome.tabs.create({ url: "https://flow.google.com/", active: true });
  await new Promise((r) => setTimeout(r, 2500));
  return tab;
}

// Gửi click/phím "thật" (isTrusted = true) qua Chrome DevTools Protocol.
// Google Flow bỏ qua các sự kiện click do script tự tạo.
async function trustedInput(tabId, { x, y, pressEnter, pressEscape, pressKeys, pressCombo, pressText }) {
  const target = { tabId };
  await chrome.debugger.attach(target, "1.3");
  try {
    const send = (method, params) => chrome.debugger.sendCommand(target, method, params);
    if (pressEscape) {
      const esc = { key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 };
      await send("Input.dispatchKeyEvent", { type: "keyDown", ...esc });
      await send("Input.dispatchKeyEvent", { type: "keyUp", ...esc });
    }
    if (typeof x === "number" && typeof y === "number") {
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 });
    }
    if (typeof pressText === "string" && pressText) { // gõ ký tự thật vào phần tử đang focus (vd "@")
      await send("Input.insertText", { text: pressText });
      await new Promise((r) => setTimeout(r, 150));
    }
    if (pressCombo) { // vd: Ctrl+Shift+M  { key: "M", code: "KeyM", vk: 77, modifiers: 10 }  (Alt=1, Ctrl=2, Meta=4, Shift=8)
      const c = { key: pressCombo.key, code: pressCombo.code, windowsVirtualKeyCode: pressCombo.vk, nativeVirtualKeyCode: pressCombo.vk, modifiers: pressCombo.modifiers };
      await send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...c });
      await send("Input.dispatchKeyEvent", { type: "keyUp", ...c });
      await new Promise((r) => setTimeout(r, 200));
    }
    if (Array.isArray(pressKeys)) {
      const codes = { Home: 36, End: 35, Backspace: 8, Delete: 46, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Tab: 9, Space: 32 };
      for (const k of pressKeys) {
        const kk = { key: k === "Space" ? " " : k, code: k, windowsVirtualKeyCode: codes[k] || 0, nativeVirtualKeyCode: codes[k] || 0 };
        await send("Input.dispatchKeyEvent", { type: "keyDown", ...kk });
        await send("Input.dispatchKeyEvent", { type: "keyUp", ...kk });
        await new Promise((r) => setTimeout(r, 120));
      }
    }
    if (pressEnter) {
      const key = { key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 };
      await send("Input.dispatchKeyEvent", { type: "keyDown", text: "\r", ...key });
      await send("Input.dispatchKeyEvent", { type: "keyUp", ...key });
    }
  } finally {
    await chrome.debugger.detach(target).catch(() => {});
  }
}

// ChatGPT / Grok / Gemini: tìm tab đang mở (hoặc mở mới), tiêm chat-content.js rồi gửi lệnh chạy
// reqId (từ web Studio) -> tab web đã gửi lệnh
const webRequests = new Map();

const CHAT_PLATFORMS = {
  chatgpt: { match: ["https://chatgpt.com/*", "https://chat.openai.com/*"], open: "https://chatgpt.com/", login: "https://chatgpt.com/auth/login", name: "ChatGPT" },
  grok: { match: ["https://grok.com/*"], open: "https://grok.com/", login: "https://grok.com/sign-in", name: "Grok" },
  gemini: { match: ["https://gemini.google.com/*"], open: "https://gemini.google.com/app", login: "https://accounts.google.com/", name: "Gemini" },
  // Tạo ảnh AI trên web Magnific (cần đăng nhập) và tìm ảnh stock trên Pexels (không cần đăng nhập); mỗi nền tảng có bộ chạy riêng
  magnific: { match: ["https://*.magnific.com/*"], open: "https://www.magnific.com/ai/images", login: "https://www.magnific.com/log-in", name: "Magnific", script: "magnific-content.js" },
  pexels: { match: ["https://*.pexels.com/*"], open: "https://www.pexels.com/", name: "Pexels", script: "pexels-content.js", noLogin: true },
};

// Hàm này được tiêm vào trang (phải tự đủ, không dùng biến ngoài): kiểm tra đã đăng nhập chưa
function pageLoginProbe(platform) {
  const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const url = location.href;
  if (/accounts\.google\.com|\/login|\/signin|\/sign-in|\/auth\/|\/i\/flow\/login/i.test(url)) return { loggedIn: false, reason: "Đang ở trang đăng nhập" };
  // Magnific: các trang công khai (image-generator, stock...) luôn có nút "Get started / Sign up" ở đâu đó dù đã đăng nhập,
  // nên không dò theo nút; chỉ coi là chưa đăng nhập khi đang ở trang đăng nhập (đã kiểm tra URL ở trên)
  if (platform === "magnific") return { loggedIn: true, reason: "OK" };
  const inputSel = { chatgpt: "#prompt-textarea, div.ProseMirror[contenteditable='true']", gemini: "rich-textarea, .ql-editor", grok: "textarea, div.tiptap[contenteditable='true'], div.ProseMirror[contenteditable='true']", magnific: "textarea, div[contenteditable='true']", pexels: "input[type='search'], input[name='search_query'], input[placeholder*='Search' i], input[type='text']" }[platform] || "textarea";
  const hasInput = [...document.querySelectorAll(inputSel)].some(vis);
  // Pexels: tìm ảnh không cần đăng nhập, chỉ cần trang đã tải xong
  if (platform === "pexels") return hasInput ? { loggedIn: true, reason: "OK" } : { loggedIn: false, reason: "Trang Pexels đang tải" };
  const loginRe = /^(log ?in|sign ?in|sign ?up|get started|đăng nhập|đăng ký)$/i;
  const loginBtn = [...document.querySelectorAll("a, button, [role='button']")].filter(vis).some((b) => {
    const t = (b.textContent || "").trim();
    return t.length < 24 && loginRe.test(t);
  });
  if (loginBtn) return { loggedIn: false, reason: "Thấy nút Đăng nhập" };
  // Magnific: không có nút Đăng nhập là đã đăng nhập (trang chủ /app không có ô nhập prompt)
  if (platform === "magnific") return { loggedIn: true, reason: "OK" };
  if (!hasInput) return { loggedIn: false, reason: "Chưa thấy ô nhập (trang đang tải hoặc cần đăng nhập)" };
  return { loggedIn: true, reason: "OK" };
}

async function findPlatformTab(platform) {
  const cfg = CHAT_PLATFORMS[platform];
  let [tab] = await chrome.tabs.query({ url: cfg.match, active: true, currentWindow: true });
  if (!tab) [tab] = await chrome.tabs.query({ url: cfg.match });
  return tab || null;
}

async function waitTabLoaded(tab) {
  await new Promise((resolve) => {
    const listener = (id, info) => { if (id === tab.id && info.status === "complete") { chrome.tabs.onUpdated.removeListener(listener); resolve(); } };
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); resolve(); }, 30000);
  });
  await new Promise((r) => setTimeout(r, 2500));
}

// Kiểm tra đăng nhập; open=true thì mở tab nếu chưa có, activate=true thì chuyển sang tab đó
async function checkPlatform(platform, { open = false, activate = false } = {}) {
  const cfg = CHAT_PLATFORMS[platform];
  if (!cfg) return { ok: false, error: "UNKNOWN_PLATFORM" };
  let tab = await findPlatformTab(platform);
  if (!tab) {
    if (!open) return { ok: true, hasTab: false, loggedIn: false, reason: `Chưa mở ${cfg.name}`, name: cfg.name };
    tab = await chrome.tabs.create({ url: cfg.open, active: true });
    await waitTabLoaded(tab);
  } else if (activate) {
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
  }
  try {
    const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: pageLoginProbe, args: [platform] });
    const res = (r && r.result) || { loggedIn: false, reason: "Không đọc được trang" };
    return { ok: true, hasTab: true, tabId: tab.id, name: cfg.name, ...res };
  } catch (e) {
    return { ok: true, hasTab: true, tabId: tab.id, name: cfg.name, loggedIn: false, reason: "Không đọc được trang: " + (e && e.message || e) };
  }
}

async function dispatchToChatPlatform(payload) {
  const cfg = CHAT_PLATFORMS[payload.platform];
  try {
    // Phải đăng nhập trước: nếu chưa thì chuyển người dùng sang tab đó để đăng nhập
    const st = await checkPlatform(payload.platform, { open: true, activate: true });
    if (!st.loggedIn) return { success: false, error: "NOT_LOGGED_IN", platformName: cfg.name, reason: st.reason };
    const tab = { id: st.tabId };
    // Magnific: công cụ tạo ảnh nằm dưới /ai/...; đang ở trang chủ hay thư viện ảnh thì chuyển sang trang tạo ảnh trước
    if (payload.platform === "magnific") {
      const cur = await chrome.tabs.get(tab.id).catch(() => null);
      if (cur && cur.url && !/magnific\.com\/(?:[a-z]{2}\/)?ai\//i.test(cur.url)) {
        await chrome.tabs.update(tab.id, { url: cfg.open, active: true });
        await waitTabLoaded({ id: tab.id });
      }
    }
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["guard.js", cfg.script || "chat-content.js"] });
    return await new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, { type: "RUN_CHAT_AUTOMATION", payload }, (res) => {
        resolve(chrome.runtime.lastError ? { success: false, error: chrome.runtime.lastError.message } : (res || { success: true }));
      });
    });
  } catch (e) {
    return { success: false, error: `Không chạy được trên ${cfg.name}: ${e && e.message || e}` };
  }
}

// ════════ Tìm ảnh trên Magnific / Pexels theo lệnh từ web Studio ════════
// Web bấm "Tạo ảnh AI" với nguồn Magnific/Pexels -> mở trang tìm kiếm với từ khóa; người dùng tự chọn ảnh và bấm Tải xuống.
// Extension bắt lượt tải đó, lưu bản ảnh lên Supabase và trả link về web để ảnh tự hiện trong khung ảnh của bài.
// ── Bộ lọc ảnh: là tham số trên địa chỉ trang tìm kiếm (lấy từ liên kết của các menu lọc của Magnific), nên không cần bấm chuột ──
// Thứ tự = thứ tự các nút trên hàng lọc, từ TRÁI sang PHẢI.
//   orientation: landscape | portrait | square | panoramic          (Magnific: orientation=...; Pexels: orientation=landscape|portrait|square)
//   fileType:    jpg | ai | eps | svg | png | psd                    (Magnific: file_type=...)
//   ai:          excluded (bỏ ảnh AI) | only (chỉ ảnh AI)             (Magnific: ai=...)
// Giá trị "auto" của orientation = suy từ tỉ lệ khung hình của bài (16:9, 4:3 -> landscape; 9:16, 3:4 -> portrait; 1:1 -> square).
const FILTER_SPECS = {
  magnific: [
    { key: "orientation", param: "orientation", values: ["landscape", "portrait", "square", "panoramic"] },
    { key: "fileType", param: "file_type", values: ["jpg", "ai", "eps", "svg", "png", "psd"] },
    { key: "ai", param: "ai", values: ["excluded", "only"] },
  ],
  pexels: [{ key: "orientation", param: "orientation", values: ["landscape", "portrait", "square"] }],
};
// Mặc định: ảnh ngang/dọc theo bài và chỉ lấy JPG (pipeline lưu Supabase chỉ nhận JPG/PNG/WEBP; vector/zip sẽ bị từ chối)
const DEFAULT_FILTERS = { magnific: { orientation: "auto", fileType: "jpg" }, pexels: { orientation: "auto" } };
const orientationOfRatio = (r) => ({ "16:9": "landscape", "4:3": "landscape", "3:2": "landscape", "9:16": "portrait", "3:4": "portrait", "2:3": "portrait", "1:1": "square" })[r] || "";

// Nhận cấu hình bộ lọc đã gộp: { orientation, fileType, ai } và tỉ lệ khung hình; trả về chuỗi "&a=b&c=d"
function filterQuery(provider, filters) {
  const f = filters || {};
  return (FILTER_SPECS[provider] || []).map((spec) => {
    let v = String(f[spec.key] || "").toLowerCase();
    if (spec.key === "orientation" && v === "auto") v = orientationOfRatio(f.aspectRatio);
    if (provider === "pexels" && v === "panoramic") v = "landscape";
    return spec.values.includes(v) ? `&${spec.param}=${encodeURIComponent(v)}` : "";
  }).join("");
}

async function resolveFilters(provider, fromWeb, aspectRatio) {
  const saved = await chrome.storage.local.get("stockFilters").catch(() => ({}));
  const mine = (saved && saved.stockFilters && saved.stockFilters[provider]) || {};
  const web = fromWeb && typeof fromWeb === "object" && !Array.isArray(fromWeb) ? fromWeb : {};
  return { ...DEFAULT_FILTERS[provider], ...mine, ...web, aspectRatio };
}

const STOCK_SOURCES = {
  magnific: {
    name: "Magnific",
    searchUrl: (kw, filters) => `https://www.magnific.com/search?format=search&query=${encodeURIComponent(kw)}${filterQuery("magnific", filters)}`,
    hostRe: /magnific|freepik|fpcdn/i,
  },
  pexels: {
    name: "Pexels",
    searchUrl: (kw, filters) => { const q = filterQuery("pexels", filters); return `https://www.pexels.com/search/${encodeURIComponent(kw)}/${q ? "?" + q.slice(1) : ""}`; },
    hostRe: /pexels/i,
  },
};
// reqId -> { provider, webTabId, keyword, prompt, startedAt }
const stockPending = new Map();
// Service worker của MV3 tự ngủ sau ít phút không việc: lưu danh sách lệnh đang chờ vào storage để khi lượt tải đến vẫn nhận ra
const stockArea = chrome.storage.session || chrome.storage.local;
let stockLoaded = null;
function ensureStockLoaded() {
  if (!stockLoaded) {
    stockLoaded = stockArea.get("stockPending").then((r) => {
      const saved = (r && r.stockPending) || {};
      Object.entries(saved).forEach(([id, p]) => { if (!stockPending.has(id) && Date.now() - p.startedAt < 20 * 60 * 1000) stockPending.set(id, p); });
    }).catch(() => {});
  }
  return stockLoaded;
}
const persistStock = () => stockArea.set({ stockPending: Object.fromEntries(stockPending) }).catch(() => {});
const STOCK_TIMEOUT_MS = 20 * 60 * 1000;

// Chạy trong trang (phải tự đủ): thanh nhắc nhỏ phía trên
function stockBanner(text) {
  const id = "fb-stock-banner";
  document.getElementById(id)?.remove();
  const el = document.createElement("div");
  el.id = id;
  el.style.cssText = "position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#101012;color:#e8ffb0;border:1px solid #c4f135;border-radius:10px;padding:8px 14px;font:600 13px system-ui,sans-serif;box-shadow:0 4px 20px rgba(0,0,0,.4);display:flex;gap:10px;align-items:center";
  el.textContent = "Flow Bridge • " + text;
  const x = document.createElement("button");
  x.textContent = "✕";
  x.style.cssText = "background:none;border:0;color:#e8ffb0;cursor:pointer;font-size:14px";
  x.onclick = () => el.remove();
  el.appendChild(x);
  document.documentElement.appendChild(el);
}

// Chạy trong trang (phải tự đủ): khung viền xanh quanh cả trang báo "Flow Bridge đang làm việc ở đây"; không chặn chuột
function stockFrame(on) {
  const id = "fb-stock-frame";
  document.getElementById(id)?.remove();
  document.getElementById(id + "-style")?.remove();
  if (!on) return;
  const style = document.createElement("style");
  style.id = id + "-style";
  style.textContent = "@keyframes fbStockPulse{0%,100%{opacity:.75}50%{opacity:1}}";
  const el = document.createElement("div");
  el.id = id;
  el.style.cssText = "position:fixed;inset:0;z-index:2147483646;pointer-events:none;border:4px solid #c4f135;border-radius:6px;box-sizing:border-box;box-shadow:inset 0 0 28px rgba(196,241,53,.45),0 0 18px rgba(196,241,53,.6);animation:fbStockPulse 1.8s ease-in-out infinite";
  document.documentElement.append(style, el);
}
const showStockFrame = (tabId, on) => chrome.scripting.executeScript({ target: { tabId }, func: stockFrame, args: [on] }).catch(() => {});

async function replyToWebTab(reqId, data) {
  await ensureStockLoaded();
  const pend = stockPending.get(reqId);
  const req = webRequests.get(reqId);
  const webTabId = pend ? pend.webTabId : req ? req.webTabId : null;
  webRequests.delete(reqId);
  stockPending.delete(reqId);
  await persistStock();
  if (pend && pend.tabId != null) {
    showStockFrame(pend.tabId, false);
    const text = data.ok ? "Đã đưa ảnh vào bài trên web" : "Chưa đưa được ảnh vào bài: " + (data.message || data.code || "lỗi");
    chrome.scripting.executeScript({ target: { tabId: pend.tabId }, func: stockBanner, args: [text] }).catch(() => {});
  }
  if (webTabId != null) chrome.tabs.sendMessage(webTabId, { type: "WEB_GEN_RESULT", reqId, ...data }).catch(() => {});
}

async function startStockSearch(reqId, provider, keyword, webTabId, filters, aspectRatio) {
  const src = STOCK_SOURCES[provider];
  const kw = String(keyword || "").trim();
  if (!src || !kw) return { ok: false, code: "EMPTY_PROMPT", message: "Thiếu từ khóa tìm ảnh" };
  const cfg = CHAT_PLATFORMS[provider];
  let [tab] = await chrome.tabs.query({ url: cfg.match });
  const url = src.searchUrl(kw, await resolveFilters(provider, filters, aspectRatio));
  if (tab) tab = await chrome.tabs.update(tab.id, { url, active: true });
  else tab = await chrome.tabs.create({ url, active: true });
  if (tab.windowId) await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
  webRequests.set(reqId, { webTabId, startedAt: Date.now() });
  await ensureStockLoaded();
  stockPending.set(reqId, { provider, webTabId, tabId: tab.id, keyword: kw, startedAt: Date.now() });
  await persistStock();
  waitTabLoaded(tab).then(async () => {
    showStockFrame(tab.id, true);
    return chrome.scripting.executeScript({ target: { tabId: tab.id }, func: stockBanner, args: [`Đã tìm "${kw}" — chọn ảnh rồi bấm Tải xuống, ảnh sẽ tự vào bài trên web`] }).catch(() => {});
  });
  setTimeout(() => {
    if (stockPending.has(reqId)) replyToWebTab(reqId, { ok: false, code: "TIMEOUT", message: `Quá thời gian chờ bạn chọn ảnh trên ${src.name}` });
  }, STOCK_TIMEOUT_MS);
  return { ok: true, started: true };
}

const MIME_BY_EXT = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
const EXT_BY_MIME = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// Lưu ảnh đã tải vào Supabase (hàng đợi của extension), chờ upload xong rồi trả link có chữ ký 7 ngày
async function stockSaveAndReply(reqId, pend, bytes, mime, sourceUrl) {
  const st = await cloud.status();
  if (!st.configured || !st.signedIn) {
    return replyToWebTab(reqId, { ok: false, code: "NOT_SIGNED_IN", message: "Extension chưa đăng nhập/cấu hình Supabase nên chưa đưa ảnh vào bài được (ảnh vẫn đã tải về máy)" });
  }
  const bmp = await createImageBitmap(new Blob([bytes], { type: mime }));
  const width = bmp.width, height = bmp.height;
  bmp.close?.();
  const jobId = crypto.randomUUID();
  const src = STOCK_SOURCES[pend.provider];
  const r = await cloud.enqueue({
    jobId, bytes, width, height, tabId: null, source: String(sourceUrl).slice(0, 200),
    meta: { platform: src.name, prompt: pend.keyword, model: `${src.name} (ảnh có sẵn)`, expected: 1, index: 0 },
  });
  cloud.processQueue().catch(() => {});
  await cloud.finishJob(jobId, 1).catch(() => null);
  let item = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 150000) {
    const q = await cloud.getQueue();
    item = (q || []).find((x) => x.id === r.id);
    if (item && item.status === "done") break;
    if (item && item.status === "failed") break;
    await new Promise((res) => setTimeout(res, 1500));
  }
  if (!item || item.status !== "done" || !item.storagePath) {
    return replyToWebTab(reqId, { ok: false, code: "UPLOAD_FAILED", message: "Upload Supabase thất bại hoặc quá lâu: " + ((item && item.error) || "không rõ") });
  }
  const signed = await cloud.signUrls([item.storagePath], 604800);
  const url = signed && signed[item.storagePath];
  if (!url) return replyToWebTab(reqId, { ok: false, code: "SIGN_FAILED", message: "Không tạo được link ảnh Supabase" });
  replyToWebTab(reqId, { ok: true, imageUrl: url, imageUrls: [url], source: "supabase", storagePath: item.storagePath });
}

chrome.tabs.onUpdated.addListener(async (tabId, info) => {
  if (info.status !== "complete") return;
  await ensureStockLoaded();
  if ([...stockPending.values()].some((p) => p.tabId === tabId)) showStockFrame(tabId, true);
});

chrome.downloads.onCreated.addListener(async (item) => {
  try {
    await ensureStockLoaded();
    if (!stockPending.size) return;
    const url = item.finalUrl || item.url || "";
    if (!url || url.startsWith("data:") || url.startsWith("blob:")) return; // lượt tải do chính extension tạo / blob không đọc lại được
    const hay = `${url} ${item.referrer || ""}`;
    if (/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(url)) return;
    let entry = [...stockPending.entries()].find(([, p]) => STOCK_SOURCES[p.provider].hostRe.test(hay));
    if (!entry) {
      // Tải xuống có thể đi qua tên miền khác (CDN): đang chờ đúng một lệnh và file trông như ảnh thì nhận luôn
      const isImg = /\.(jpe?g|png|webp)(\?|$)/i.test(item.filename || "") || /\.(jpe?g|png|webp)(\?|$)/i.test(url) || /^image\//i.test(item.mime || "");
      if (isImg && stockPending.size === 1) entry = [...stockPending.entries()][0];
    }
    if (!entry) return;
    const [reqId, pend] = entry;
    const src = STOCK_SOURCES[pend.provider];
    if (pend.tabId != null) chrome.scripting.executeScript({ target: { tabId: pend.tabId }, func: stockBanner, args: ["Đang đưa ảnh vừa tải lên Supabase…"] }).catch(() => {});

    // Hủy lượt tải gốc, tự tải đúng một lần rồi lưu về máy + đưa lên Supabase
    await chrome.downloads.cancel(item.id).catch(() => {});
    await chrome.downloads.erase({ id: item.id }).catch(() => {});
    let res;
    try { res = await fetch(url, { credentials: "include" }); }
    catch (e) { res = null; }
    const restore = () => chrome.downloads.download({ url, conflictAction: "uniquify" }).catch(() => {});
    if (!res || !res.ok) {
      restore();
      return replyToWebTab(reqId, { ok: false, code: "DOWNLOAD_FETCH_FAILED", message: `Không đọc được file vừa tải từ ${src.name}; ảnh vẫn được tải về máy, hãy thử lại hoặc tải ảnh lên tay` });
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    let mime = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!EXT_BY_MIME[mime]) {
      const ext = ((item.filename || url).split("?")[0].split(".").pop() || "").toLowerCase();
      mime = MIME_BY_EXT[ext] || "";
    }
    const safe = pend.keyword.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "image";
    if (!EXT_BY_MIME[mime]) {
      // Không phải ảnh PNG/JPEG/WEBP (ví dụ file zip): trả lại lượt tải cho trình duyệt và báo web
      restore();
      return replyToWebTab(reqId, { ok: false, code: "UNSUPPORTED_FORMAT", message: `${src.name} trả file không phải ảnh JPG/PNG/WEBP. Hãy chọn kiểu tải ảnh JPG hoặc dùng "Tải ảnh từ máy".` });
    }
    const dataUrl = `data:${mime};base64,${bytesToB64(bytes)}`;
    chrome.downloads.download({ url: dataUrl, filename: `${pend.provider}/${safe}-${Date.now().toString(36)}.${EXT_BY_MIME[mime]}`, conflictAction: "uniquify", saveAs: false }).catch(() => {});
    await stockSaveAndReply(reqId, pend, bytes, mime, url);
  } catch (e) {
    console.warn("[Flow Bridge][Stock] Lỗi xử lý lượt tải:", e);
  }
});

// Xử lý tin nhắn từ Sidepanel & Content Script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object") return;
  const { type, payload } = message;

  if (CLOUD_HANDLERS[type]) {
    return respond(Promise.resolve().then(() => CLOUD_HANDLERS[type](payload || {}, sender)), sendResponse);
  }

  switch (type) {
    case "GET_FLOW_STATUS": {
      getFlowTab().then((tab) => {
        if (!tab) {
          sendResponse({ connected: false, message: "Chưa mở Google Flow" });
        } else {
          const isProject = tab.url && tab.url.includes("/project/");
          sendResponse({
            connected: true,
            isProject: !!isProject,
            tabId: tab.id,
            url: tab.url,
            title: tab.title
          });
        }
      });
      return true;
    }

    case "WEB_FLOW_STATUS": {
      getFlowTab().then((tab) => {
        if (!tab) return sendResponse({ ok: true, status: "FLOW_TAB_NOT_FOUND" });
        // Có tab Flow là đủ: nếu đang ở trang chủ, extension tự bấm "Dự án mới" khi tạo ảnh
        sendResponse({ ok: true, status: "CONNECTED" });
      });
      return true;
    }

    case "WEB_TRIGGER_GENERATE": {
      (async () => {
        const { reqId, prompt, options = {} } = payload || {};
        // Nguồn Magnific / Pexels: mở trang tìm ảnh với từ khóa, người dùng tự chọn ảnh và bấm tải
        if (options.provider && STOCK_SOURCES[options.provider]) {
          return sendResponse(await startStockSearch(reqId, options.provider, options.keyword || prompt, sender.tab ? sender.tab.id : null, options.filters, options.aspectRatio));
        }
        // Hiện prompt + ảnh từ web vào side panel (nếu đang mở) và nhớ lại để lần mở side panel sau vẫn thấy
        const fill = { prompt, referenceImages: Array.isArray(options.referenceImages) ? options.referenceImages.slice(0, 3) : [], at: Date.now() };
        chrome.storage.local.set({ lastWebRequest: fill }).catch?.(() => {});
        chrome.runtime.sendMessage({ type: "WEB_FILL", payload: fill }).catch(() => {});
        // Chưa có tab Flow thì tự mở; đang ở trang chủ Flow thì content.js tự chọn "Dự án mới"
        const tab = await ensureActiveFlowTab();
        if (!tab) return sendResponse({ ok: false, code: "FLOW_TAB_NOT_FOUND", message: "Không mở được tab Google Flow" });
        // nhớ tab web đã gửi lệnh để trả kết quả về đúng chỗ
        webRequests.set(reqId, { webTabId: sender.tab ? sender.tab.id : null, startedAt: Date.now() });
        const saved = await chrome.storage.local.get(["imageSettings"]);
        const s = (saved && saved.imageSettings) || {};
        const runPayload = {
          prompts: [prompt],
          aspectRatio: options.aspectRatio || s.aspectRatio || "16:9",
          batchCount: 1,
          model: options.model || s.model || "",
          autoDownload: false, // ảnh được trả về cho web, không tự tải về máy
          platform: "flow",
          referenceImages: Array.isArray(options.referenceImages) ? options.referenceImages.slice(0, 3) : [],
          _webReq: reqId,
        };
        await chrome.tabs.update(tab.id, { active: true });
        if (tab.windowId) await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
        const send = () => chrome.tabs.sendMessage(tab.id, { type: "RUN_AUTOMATION", payload: runPayload }, (res) => {
          if (chrome.runtime.lastError) {
            chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["guard.js", "flow-config.js", "content.js"] }, () => {
              setTimeout(() => chrome.tabs.sendMessage(tab.id, { type: "RUN_AUTOMATION", payload: runPayload }, () => {}), 500);
            });
          }
        });
        send();
        sendResponse({ ok: true, started: true });
      })().catch((e) => sendResponse({ ok: false, code: "FAILED", message: String(e && e.message || e) }));
      return true;
    }

    case "WEB_ANALYZE_WORKSHEET": {
      // Web Studio gửi nội dung bài tập -> extension gọi Edge Function analyze-worksheet bằng phiên Supabase đang đăng nhập.
      // Khóa Gemini chỉ nằm trong secrets của server; web không giữ khóa hay token nào.
      (async () => {
        const settings = await cloud.getSettings();
        if (!settings.url || !settings.anonKey) return { ok: false, code: "NOT_CONFIGURED", message: "Extension chưa cấu hình Supabase (tab Lịch sử → Cấu hình kết nối)" };
        const sess = await cloud.getSession();
        if (!sess) return { ok: false, code: "NOT_SIGNED_IN", message: "Extension chưa đăng nhập Supabase (tab Lịch sử → Đăng nhập)" };
        const text = (payload && payload.text) || "";
        let res;
        try {
          res = await fetch(`${settings.url}/functions/v1/analyze-worksheet`, {
            method: "POST",
            headers: { apikey: settings.anonKey, Authorization: `Bearer ${sess.access_token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
          });
        } catch (e) {
          return { ok: false, code: "NETWORK", message: "Không gọi được Supabase: " + (e && e.message || e) };
        }
        const data = await res.json().catch(() => ({}));
        if (res.status === 404) return { ok: false, code: "FUNCTION_NOT_DEPLOYED", message: "Chưa triển khai Edge Function analyze-worksheet trên Supabase" };
        if (!res.ok) return { ok: false, code: data.code || ("HTTP_" + res.status), message: data.error || data.message || ("HTTP " + res.status), details: data.details };
        return { ok: true, plan: data.plan, warnings: data.warnings || [], model: data.model };
      })().then(sendResponse).catch((e) => sendResponse({ ok: false, code: "ERROR", message: e.message || String(e) }));
      return true;
    }

    case "WEB_CLOUD_LIST": {
      // Web Studio xin danh sách ảnh đã lưu trên Supabase (kèm link xem có chữ ký 24 giờ)
      (async () => {
        const st = await cloud.status();
        if (!st.configured) return { ok: false, code: "NOT_CONFIGURED", message: "Extension chưa cấu hình Supabase (tab Lịch sử → Cấu hình kết nối)" };
        if (!st.signedIn) return { ok: false, code: "NOT_SIGNED_IN", message: "Extension chưa đăng nhập Supabase (tab Lịch sử → Đăng nhập)" };
        const limit = Math.min(200, Math.max(1, Number(payload && payload.limit) || 60));
        const rows = await cloud.listImages({ search: (payload && payload.search) || "", limit, offset: Number(payload && payload.offset) || 0 });
        const urls = rows.length ? await cloud.signUrls(rows.map((r) => r.storage_path), 86400) : {};
        return {
          ok: true,
          images: rows.map((r) => ({
            id: r.id, prompt: r.prompt, model: r.model, aspectRatio: r.aspect_ratio, createdAt: r.created_at,
            width: r.width, height: r.height, sizeBytes: r.size_bytes, storagePath: r.storage_path, url: urls[r.storage_path] || null,
          })),
        };
      })().then(sendResponse).catch((e) => sendResponse({ ok: false, code: e.code || "ERROR", message: e.message || String(e) }));
      return true;
    }

    case "WEB_GEN_DONE": {
      // content.js (tab Flow) báo kết quả -> chuyển tiếp về tab web đã gửi lệnh
      const { reqId } = payload || {};
      const req = webRequests.get(reqId);
      webRequests.delete(reqId);
      if (req && req.webTabId != null) {
        chrome.tabs.sendMessage(req.webTabId, { type: "WEB_GEN_RESULT", reqId, ...(payload || {}) }).catch(() => {});
      }
      sendResponse({ ok: true });
      return;
    }

    case "DISPATCH_GENERATE": {
      if (payload && payload.platform && payload.platform !== "flow" && CHAT_PLATFORMS[payload.platform]) {
        dispatchToChatPlatform(payload).then(sendResponse);
        return true;
      }
      ensureActiveFlowTab().then(async (tab) => {
        if (!tab) {
          sendResponse({ success: false, error: "CANNOT_OPEN_FLOW" });
          return;
        }

        // Gửi lệnh chạy sang tab Flow
        chrome.tabs.sendMessage(tab.id, { type: "RUN_AUTOMATION", payload }, (res) => {
          if (chrome.runtime.lastError) {
            // Tiêm script nếu chưa có
            chrome.scripting.executeScript(
              { target: { tabId: tab.id }, files: ["guard.js", "flow-config.js", "content.js"] },
              () => {
                setTimeout(() => {
                  chrome.tabs.sendMessage(tab.id, { type: "RUN_AUTOMATION", payload }, (r) => {
                    sendResponse(r || { success: true });
                  });
                }, 500);
              }
            );
          } else {
            sendResponse(res || { success: true });
          }
        });
      });
      return true;
    }

    case "WAIT_DOWNLOAD": {
      // Chờ Chrome bắt đầu một lượt tải mới (để biết chắc cú bấm "Tải xuống" có hiệu lực)
      const timeoutMs = (payload && payload.timeoutMs) || 8000;
      let done = false;
      const finish = (res) => { if (done) return; done = true; chrome.downloads.onCreated.removeListener(onCreated); sendResponse(res); };
      const onCreated = (item) => finish({ started: true, filename: item.filename || "", url: (item.url || "").slice(0, 80) });
      chrome.downloads.onCreated.addListener(onCreated);
      setTimeout(() => finish({ started: false }), timeoutMs);
      return true;
    }

    case "OPEN_LOGIN": {
      // Cửa sổ nhắc đăng nhập: đưa tab nền tảng tới trang đăng nhập (mở tab mới nếu chưa có)
      (async () => {
        const cfg = CHAT_PLATFORMS[payload && payload.platform];
        if (!cfg) return { ok: false, error: "UNKNOWN_PLATFORM" };
        const url = cfg.login || cfg.open;
        let tab = await findPlatformTab(payload.platform);
        tab = tab ? await chrome.tabs.update(tab.id, { url, active: true }) : await chrome.tabs.create({ url, active: true });
        if (tab.windowId) await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
        return { ok: true, url };
      })().then(sendResponse).catch((e) => sendResponse({ ok: false, error: String(e && e.message || e) }));
      return true;
    }

    case "OPEN_PLATFORM": {
      checkPlatform(payload && payload.platform, { open: true, activate: true }).then(sendResponse);
      return true;
    }

    case "CHECK_PLATFORM": {
      checkPlatform(payload && payload.platform).then(sendResponse);
      return true;
    }

    case "TRUSTED_CLICK": {
      if (!sender.tab) {
        sendResponse({ success: false, error: "NO_TAB" });
        return;
      }
      trustedInput(sender.tab.id, payload || {})
        .then(() => sendResponse({ success: true }))
        .catch((err) => sendResponse({ success: false, error: String(err && err.message || err) }));
      return true;
    }

    case "DOWNLOAD_IMAGE": {
      const { url, filename } = payload || {};
      if (url) {
        chrome.downloads.download({
          url,
          filename: filename || `Flow_${Date.now()}.png`,
          conflictAction: "uniquify",
          saveAs: false
        }, (downloadId) => {
          sendResponse({ success: !!downloadId, downloadId });
        });
      } else {
        sendResponse({ success: false, error: "NO_URL" });
      }
      return true;
    }

    case "STOP_ALL_TASKS": {
      Object.values(CHAT_PLATFORMS).forEach((p) => {
        chrome.tabs.query({ url: p.match }, (tabs) => tabs.forEach((t) => chrome.tabs.sendMessage(t.id, { type: "STOP_AUTOMATION" }).catch(() => {})));
      });
      getFlowTab().then((tab) => {
        if (tab) {
          chrome.tabs.sendMessage(tab.id, { type: "STOP_AUTOMATION" });
        }
        sendResponse({ success: true });
      });
      return true;
    }

    default:
      break;
  }
});
