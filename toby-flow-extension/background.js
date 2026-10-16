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
  chatgpt: { match: ["https://chatgpt.com/*", "https://chat.openai.com/*"], open: "https://chatgpt.com/", name: "ChatGPT" },
  grok: { match: ["https://grok.com/*"], open: "https://grok.com/", name: "Grok" },
  gemini: { match: ["https://gemini.google.com/*"], open: "https://gemini.google.com/app", name: "Gemini" },
};

// Hàm này được tiêm vào trang (phải tự đủ, không dùng biến ngoài): kiểm tra đã đăng nhập chưa
function pageLoginProbe(platform) {
  const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const url = location.href;
  if (/accounts\.google\.com|\/login|\/signin|\/sign-in|\/auth\/|\/i\/flow\/login/i.test(url)) return { loggedIn: false, reason: "Đang ở trang đăng nhập" };
  const inputSel = { chatgpt: "#prompt-textarea, div.ProseMirror[contenteditable='true']", gemini: "rich-textarea, .ql-editor", grok: "textarea, div.tiptap[contenteditable='true'], div.ProseMirror[contenteditable='true']" }[platform] || "textarea";
  const hasInput = [...document.querySelectorAll(inputSel)].some(vis);
  const loginRe = /^(log ?in|sign ?in|sign ?up|get started|đăng nhập|đăng ký)$/i;
  const loginBtn = [...document.querySelectorAll("a, button, [role='button']")].filter(vis).some((b) => {
    const t = (b.textContent || "").trim();
    return t.length < 24 && loginRe.test(t);
  });
  if (loginBtn) return { loggedIn: false, reason: "Thấy nút Đăng nhập" };
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
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["guard.js", "chat-content.js"] });
    return await new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, { type: "RUN_CHAT_AUTOMATION", payload }, (res) => {
        resolve(chrome.runtime.lastError ? { success: false, error: chrome.runtime.lastError.message } : (res || { success: true }));
      });
    });
  } catch (e) {
    return { success: false, error: `Không chạy được trên ${cfg.name}: ${e && e.message || e}` };
  }
}

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
