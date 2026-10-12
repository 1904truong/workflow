// Flow Bridge - Supabase cloud sync (auth + persistent upload queue + library API)
//
// Thiết kế:
//  - Không phụ thuộc chrome.*: mọi thứ (fetch, storage, blob store, timer) được inject -> test được bằng Node.
//  - Hàng đợi lưu trong storage bền vững; blob ảnh lưu trong blob store (IndexedDB ở background).
//  - Đường dẫn object tất định: <user_id>/<job_id>/<sha256[0:32]>.<ext> => retry an toàn, không ghi đè ảnh khác.
//  - Chỉ đánh dấu "done" sau khi xác minh cả Storage lẫn Database.
(function (root) {
  "use strict";

  const BUCKET = "flow-images";
  const MAX_ATTEMPTS = 6;
  const MIN_ORIGINAL_DIM = 512;
  const MIME_EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
  const K = { settings: "cloud.settings", session: "cloud.session", queue: "cloud.queue" };

  class CloudError extends Error {
    constructor(code, message, retryable = false) {
      super(message || code);
      this.name = "CloudError";
      this.code = code;
      this.retryable = retryable;
    }
  }

  // ───────────── Ảnh: nhận dạng định dạng & băm ─────────────
  function sniffMime(b) {
    if (!b || b.length < 12) return null;
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
    if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
        b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
    return null;
  }

  async function sha256Hex(bytes) {
    const digest = await root.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest)).map((x) => x.toString(16).padStart(2, "0")).join("");
  }

  const encodePath = (p) => p.split("/").map(encodeURIComponent).join("/");

  function createCloudSync(deps) {
    const { fetch: doFetch, store, blobs } = deps;
    const now = deps.now || (() => Date.now());
    const notify = deps.notify || (() => {});
    const schedule = deps.schedule || (() => {});
    const backoff = deps.backoff || ((attempts) => Math.min(300000, 5000 * 2 ** (attempts - 1)));

    // ───────────── Settings / Session ─────────────
    async function getSettings() {
      const s = (await store.get(K.settings)) || {};
      return { url: "", anonKey: "", autoSave: true, ...s, url: (s.url || "").replace(/\/+$/, "") };
    }
    async function setSettings(patch) {
      const cur = await getSettings();
      await store.set(K.settings, { ...cur, ...patch });
      return getSettings();
    }
    const configured = (s) => !!(s.url && s.anonKey);

    async function rawFetch(url, init) {
      try {
        return await doFetch(url, init);
      } catch (e) {
        throw new CloudError("NETWORK", "Lỗi mạng: " + (e && e.message), true);
      }
    }

    async function authRequest(grant, body) {
      const s = await getSettings();
      if (!configured(s)) throw new CloudError("NOT_CONFIGURED", "Chưa nhập URL/anon key Supabase");
      const res = await rawFetch(`${s.url}/auth/v1/token?grant_type=${grant}`, {
        method: "POST",
        headers: { apikey: s.anonKey, "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = json.error_description || json.msg || json.message || `HTTP ${res.status}`;
        throw new CloudError(res.status >= 500 ? "AUTH_SERVER" : "AUTH_FAILED", msg, res.status >= 500);
      }
      const session = {
        access_token: json.access_token,
        refresh_token: json.refresh_token,
        expires_at: json.expires_at || Math.floor(now() / 1000) + (json.expires_in || 3600),
        user: { id: json.user && json.user.id, email: json.user && json.user.email }
      };
      await store.set(K.session, session);
      return session;
    }

    const signIn = (email, password) => authRequest("password", { email, password });
    async function signOut() { await store.set(K.session, null); }

    let refreshing = null;
    async function getSession({ forceRefresh = false } = {}) {
      const sess = await store.get(K.session);
      if (!sess || !sess.access_token) return null;
      if (!forceRefresh && sess.expires_at - 60 > Math.floor(now() / 1000)) return sess;
      if (!refreshing) {
        refreshing = authRequest("refresh_token", { refresh_token: sess.refresh_token })
          .catch(async (e) => {
            if (e.code === "AUTH_FAILED") { await store.set(K.session, null); return null; }
            throw e;
          })
          .finally(() => { refreshing = null; });
      }
      return refreshing;
    }

    // ───────────── HTTP với auth + phân loại lỗi ─────────────
    function classify(res, body, area) {
      const msg = (body && (body.message || body.error || body.msg)) || `HTTP ${res.status}`;
      const status = Number((body && body.statusCode) || res.status);
      const text = String(msg).toLowerCase();
      if (status === 401 || /jwt expired|invalid jwt/.test(text)) return new CloudError("AUTH_EXPIRED", msg);
      if (status === 404 && area === "storage") return new CloudError("BUCKET_MISSING", `Bucket "${BUCKET}" không tồn tại hoặc không truy cập được: ${msg}`);
      if (status === 413 || /quota|exceeded the maximum|too large/.test(text)) return new CloudError("QUOTA", "Vượt dung lượng/giới hạn file Supabase: " + msg);
      if (status === 403 || /row-level security|violates row|permission|not authorized|unauthorized/.test(text)) {
        return new CloudError("PERMISSION_DENIED", "Không có quyền (kiểm tra policy RLS/Storage): " + msg);
      }
      if (status === 409) return new CloudError("CONFLICT", msg);
      if (status >= 500 || status === 429 || status === 408) return new CloudError("SERVER", msg, true);
      return new CloudError("HTTP_" + status, msg);
    }

    async function api(area, path, init = {}, attempt = 0) {
      const s = await getSettings();
      if (!configured(s)) throw new CloudError("NOT_CONFIGURED", "Chưa cấu hình Supabase");
      const sess = await getSession();
      if (!sess) throw new CloudError("NO_SESSION", "Chưa đăng nhập Supabase");
      const base = area === "storage" ? `${s.url}/storage/v1` : `${s.url}/rest/v1`;
      const res = await rawFetch(base + path, {
        ...init,
        headers: { apikey: s.anonKey, Authorization: `Bearer ${sess.access_token}`, ...(init.headers || {}) }
      });
      if (res.ok) return res;
      const body = await res.json().catch(() => null);
      const err = classify(res, body, area);
      if (err.code === "AUTH_EXPIRED" && attempt === 0) {
        const fresh = await getSession({ forceRefresh: true });
        if (fresh) return api(area, path, init, 1);
      }
      throw err;
    }

    const jsonHeaders = { "Content-Type": "application/json" };

    // ───────────── Queue storage ─────────────
    let queueLock = Promise.resolve();
    function withQueue(fn) {
      const run = queueLock.then(fn, fn);
      queueLock = run.catch(() => {});
      return run;
    }
    const loadQueue = async () => (await store.get(K.queue)) || [];
    const saveQueue = (q) => store.set(K.queue, q);
    const view = (item) => ({ ...item });

    async function updateItem(id, patch) {
      return withQueue(async () => {
        const q = await loadQueue();
        const it = q.find((x) => x.id === id);
        if (!it) return null;
        Object.assign(it, patch, { updatedAt: now() });
        await saveQueue(q);
        notify(view(it));
        return it;
      });
    }

    // ───────────── Enqueue ─────────────
    async function enqueue({ jobId, meta, bytes, width, height, tabId, source }) {
      if (!jobId) throw new CloudError("INVALID", "Thiếu jobId");
      if (!bytes || !bytes.length) throw new CloudError("EMPTY_IMAGE", "Ảnh rỗng");
      const mime = sniffMime(bytes);
      if (!mime) throw new CloudError("UNSUPPORTED_FORMAT", "Định dạng ảnh không hỗ trợ (chỉ PNG/JPEG/WEBP)");
      if (Math.max(width || 0, height || 0) < MIN_ORIGINAL_DIM) {
        throw new CloudError("THUMBNAIL", `Ảnh ${width}x${height} có vẻ là thumbnail, không phải ảnh gốc`);
      }
      const sha = await sha256Hex(bytes);
      const id = `${jobId}:${sha.slice(0, 32)}`;

      return withQueue(async () => {
        const q = await loadQueue();
        const existing = q.find((x) => x.id === id || (x.sha256 === sha && x.status !== "failed"));
        if (existing) return { duplicate: true, id: existing.id, status: existing.status };
        await blobs.put(id, { bytes, mime });
        const item = {
          id, jobId, sha256: sha, mime, size: bytes.length, width: width || null, height: height || null,
          meta: meta || {}, tabId: tabId ?? null, source: source || null,
          status: "queued", attempts: 0, nextAt: 0, error: null, storagePath: null,
          createdAt: now(), updatedAt: now()
        };
        q.push(item);
        await saveQueue(q);
        notify(view(item));
        return { duplicate: false, id, status: "queued" };
      });
    }

    // ───────────── Xử lý 1 item ─────────────
    async function processItem(item) {
      const sess = await getSession();
      if (!sess) {
        await updateItem(item.id, { status: "waiting_auth", error: "Chưa đăng nhập Supabase", nextAt: now() + 30000 });
        schedule(now() + 30000);
        return;
      }
      const uid = sess.user.id;
      const path = `${uid}/${item.jobId}/${item.sha256.slice(0, 32)}.${MIME_EXT[item.mime]}`;
      await updateItem(item.id, { status: "uploading", error: null, storagePath: path });

      const blob = await blobs.get(item.id);
      if (!blob) throw new CloudError("BLOB_LOST", "Mất dữ liệu ảnh trong bộ nhớ tạm, cần tạo lại ảnh");

      // 1. job row (idempotent)
      await api("rest", "/generation_jobs?on_conflict=id", {
        method: "POST",
        headers: { ...jsonHeaders, Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({
          id: item.jobId, user_id: uid, prompt: item.meta.prompt || "", model: item.meta.model || null,
          aspect_ratio: item.meta.aspectRatio || null, expected_count: item.meta.expected || 1, status: "running"
        })
      });

      // 2. object (đường dẫn tất định; 409 = đã upload đúng ảnh này ở lần trước)
      try {
        await api("storage", `/object/${BUCKET}/${encodePath(path)}`, {
          method: "POST",
          headers: { "Content-Type": item.mime, "x-upsert": "false", "cache-control": "max-age=31536000" },
          body: blob.bytes
        });
      } catch (e) {
        if (e.code !== "CONFLICT") throw e;
      }

      // 3. metadata (idempotent theo user_id+sha256)
      await updateItem(item.id, { status: "verifying" });
      await api("rest", "/generated_images?on_conflict=user_id,sha256", {
        method: "POST",
        headers: { ...jsonHeaders, Prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify({
          job_id: item.jobId, user_id: uid, storage_path: path, sha256: item.sha256, mime_type: item.mime,
          width: item.width, height: item.height, size_bytes: item.size, prompt: item.meta.prompt || "",
          model: item.meta.model || null, aspect_ratio: item.meta.aspectRatio || null, image_index: item.meta.index || 0
        })
      });

      // 4. xác minh DB + Storage trước khi báo thành công
      const rowRes = await api("rest", `/generated_images?select=id,storage_path,size_bytes&user_id=eq.${uid}&sha256=eq.${item.sha256}`);
      const rows = await rowRes.json();
      if (!Array.isArray(rows) || rows.length !== 1) throw new CloudError("VERIFY_DB", "Không thấy bản ghi metadata sau khi lưu", true);
      const dbPath = rows[0].storage_path;
      const infoRes = await api("storage", `/object/info/${BUCKET}/${encodePath(dbPath)}`).catch((e) => {
        throw e.code === "HTTP_404" || e.code === "BUCKET_MISSING"
          ? new CloudError("VERIFY_STORAGE", "Không thấy file trong Storage sau khi upload", true) : e;
      });
      const info = await infoRes.json().catch(() => ({}));
      const remoteSize = info.size ?? (info.metadata && info.metadata.size);
      if (remoteSize != null && Number(remoteSize) !== item.size) {
        throw new CloudError("VERIFY_SIZE", `Kích thước lưu (${remoteSize}) khác ảnh gốc (${item.size})`, true);
      }

      await blobs.del(item.id);
      await updateItem(item.id, { status: "done", error: null, storagePath: dbPath, imageId: rows[0].id, attempts: item.attempts });
    }

    async function runItem(item) {
      try {
        await processItem(item);
      } catch (e) {
        const err = e instanceof CloudError ? e : new CloudError("UNKNOWN", e && e.message, true);
        if (err.code === "NO_SESSION" || err.code === "AUTH_EXPIRED") {
          await updateItem(item.id, { status: "waiting_auth", error: err.message, nextAt: now() + 30000 });
          schedule(now() + 30000);
          return;
        }
        const attempts = item.attempts + 1;
        if (err.retryable && attempts < MAX_ATTEMPTS) {
          const nextAt = now() + backoff(attempts);
          await updateItem(item.id, { status: "retry", attempts, error: `${err.code}: ${err.message}`, nextAt });
          schedule(nextAt);
        } else {
          await updateItem(item.id, { status: "failed", attempts, error: `${err.code}: ${err.message}` });
        }
      }
    }

    let processing = false;
    async function processQueue() {
      if (processing) return;
      processing = true;
      try {
        for (;;) {
          const q = await withQueue(loadQueue);
          const due = q.find((x) => ["queued", "retry", "waiting_auth"].includes(x.status) && x.nextAt <= now());
          if (!due) break;
          await runItem(due);
        }
      } finally {
        processing = false;
      }
    }

    // Service worker bị suspend giữa chừng: item kẹt ở uploading/verifying quay lại hàng đợi
    async function recover() {
      await withQueue(async () => {
        const q = await loadQueue();
        let changed = false;
        for (const it of q) {
          if (it.status === "uploading" || it.status === "verifying") { it.status = "queued"; it.nextAt = 0; changed = true; }
        }
        if (changed) await saveQueue(q);
      });
      return processQueue();
    }

    async function retryItem(id) {
      await updateItem(id, { status: "queued", attempts: 0, nextAt: 0, error: null });
      return processQueue();
    }

    async function finishJob(jobId, expected) {
      const q = await withQueue(loadQueue);
      const mine = q.filter((x) => x.jobId === jobId);
      const done = mine.filter((x) => x.status === "done").length;
      const pending = mine.some((x) => !["done", "failed"].includes(x.status));
      if (pending) return { pending: true };
      const status = done >= expected ? "completed" : done > 0 ? "partial" : "failed";
      const sess = await getSession();
      if (!sess) return { pending: false, status };
      await api("rest", `/generation_jobs?id=eq.${jobId}`, {
        method: "PATCH",
        headers: { ...jsonHeaders, Prefer: "return=minimal" },
        body: JSON.stringify({ status, saved_count: done, updated_at: new Date(now()).toISOString() })
      });
      return { pending: false, status };
    }

    // ───────────── Library API ─────────────
    async function listImages({ search = "", limit = 60, offset = 0 } = {}) {
      let qs = `?select=*&order=created_at.desc&limit=${limit}&offset=${offset}`;
      if (search) qs += `&prompt=ilike.${encodeURIComponent("*" + search.replace(/[*,()]/g, " ") + "*")}`;
      return (await api("rest", "/generated_images" + qs)).json();
    }

    async function signUrls(paths, expiresIn = 3600) {
      if (!paths.length) return {};
      const s = await getSettings();
      const res = await api("storage", `/object/sign/${BUCKET}`, {
        method: "POST", headers: jsonHeaders, body: JSON.stringify({ expiresIn, paths })
      });
      const out = {};
      for (const r of await res.json()) {
        if (r.signedURL && !r.error) out[r.path] = `${s.url}/storage/v1${r.signedURL}`;
      }
      return out;
    }

    async function deleteImage({ id, storage_path }) {
      await api("storage", `/object/${BUCKET}`, {
        method: "DELETE", headers: jsonHeaders, body: JSON.stringify({ prefixes: [storage_path] })
      });
      await api("rest", `/generated_images?id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    }

    async function status() {
      const s = await getSettings();
      const sess = await store.get(K.session);
      const q = await withQueue(loadQueue);
      return {
        configured: configured(s), autoSave: s.autoSave, url: s.url,
        signedIn: !!(sess && sess.access_token), email: sess && sess.user && sess.user.email,
        enabled: configured(s) && s.autoSave,
        pending: q.filter((x) => !["done", "failed"].includes(x.status)).length,
        failed: q.filter((x) => x.status === "failed").length
      };
    }

    const getQueue = async () => (await withQueue(loadQueue)).map(view);
    async function clearDone() {
      await withQueue(async () => saveQueue((await loadQueue()).filter((x) => x.status !== "done")));
    }

    return {
      getSettings, setSettings, signIn, signOut, getSession, status,
      enqueue, processQueue, recover, retryItem, finishJob, getQueue, clearDone,
      listImages, signUrls, deleteImage
    };
  }

  const api = { createCloudSync, CloudError, sniffMime, sha256Hex, MIN_ORIGINAL_DIM, MAX_ATTEMPTS, BUCKET };
  root.CloudSync = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
