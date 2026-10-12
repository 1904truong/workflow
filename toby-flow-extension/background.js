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
  CLOUD_SIGN_URLS: async (p) => ({ urls: await cloud.signUrls(p.paths) }),
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
async function trustedInput(tabId, { x, y, pressEnter, pressEscape }) {
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
    if (pressEnter) {
      const key = { key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 };
      await send("Input.dispatchKeyEvent", { type: "keyDown", text: "\r", ...key });
      await send("Input.dispatchKeyEvent", { type: "keyUp", ...key });
    }
  } finally {
    await chrome.debugger.detach(target).catch(() => {});
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

    case "DISPATCH_GENERATE": {
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
              { target: { tabId: tab.id }, files: ["flow-config.js", "content.js"] },
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
