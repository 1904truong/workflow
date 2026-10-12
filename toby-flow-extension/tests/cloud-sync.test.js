// node --test tests/cloud-sync.test.js   (không cần jsdom; Node >= 20)
const test = require("node:test");
const assert = require("node:assert/strict");
const { createCloudSync, CloudError } = require("../cloud-sync.js");

const URL_ = "https://proj.supabase.co";
const UID = "11111111-1111-1111-1111-111111111111";
const JOB = "22222222-2222-2222-2222-222222222222";

function png(seed) {
  const b = new Uint8Array(600);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  for (let i = 8; i < b.length; i++) b[i] = (seed * 31 + i) & 255;
  return b;
}

// Supabase giả: auth + PostgREST + Storage, có thể chèn lỗi theo từng bước
function createMockSupabase(opts = {}) {
  const db = { jobs: new Map(), images: [] };
  const objects = new Map();
  const calls = [];
  const faults = { ...opts.faults };
  let tokenSeq = 0;
  let validToken = "tok0";
  const J = (status, body) => ({ ok: status < 300, status, json: async () => body });
  const take = (k) => { if (faults[k] > 0) { faults[k]--; return true; } return false; };

  async function fetch(url, init = {}) {
    const u = new URL(url);
    const method = init.method || "GET";
    const path = u.pathname;
    calls.push(`${method} ${path}`);
    if (take("network")) throw new Error("fetch failed");

    if (path === "/auth/v1/token") {
      if (u.searchParams.get("grant_type") === "password") {
        const body = JSON.parse(init.body);
        if (body.password !== "good") return J(400, { error_description: "Invalid login credentials" });
      } else if (take("refreshFail")) return J(400, { error_description: "bad refresh" });
      tokenSeq++;
      validToken = "tok" + tokenSeq;
      return J(200, { access_token: validToken, refresh_token: "r" + tokenSeq, expires_in: 3600, user: { id: UID, email: "a@b.c" } });
    }
    const auth = (init.headers || {}).Authorization;
    if (auth !== `Bearer ${validToken}`) return J(401, { message: "JWT expired", statusCode: "401" });
    if (take("forbidden")) return J(403, { message: "new row violates row-level security policy", statusCode: "403" });

    if (path.startsWith("/storage/v1/object/info/")) {
      const key = decodeURIComponent(path.replace("/storage/v1/object/info/flow-images/", ""));
      if (faults.infoMissing || !objects.has(key)) return J(404, { message: "Object not found", statusCode: "404" });
      return J(200, { size: objects.get(key).size });
    }
    if (path.startsWith("/storage/v1/object/sign/")) {
      const { paths } = JSON.parse(init.body);
      return J(200, paths.map((p) => ({ path: p, signedURL: `/object/sign/flow-images/${p}?token=x` })));
    }
    if (path.startsWith("/storage/v1/object/flow-images") && method === "DELETE") {
      for (const p of JSON.parse(init.body).prefixes) objects.delete(p);
      return J(200, []);
    }
    if (path.startsWith("/storage/v1/object/flow-images/") && method === "POST") {
      if (faults.bucketMissing) return J(404, { message: "Bucket not found", statusCode: "404" });
      if (faults.quota) return J(413, { message: "The object exceeded the maximum allowed size", statusCode: "413" });
      const key = decodeURIComponent(path.replace("/storage/v1/object/flow-images/", ""));
      if (objects.has(key)) return J(409, { message: "The resource already exists", statusCode: "409" });
      objects.set(key, { size: init.body.length, mime: init.headers["Content-Type"] });
      return J(200, { Key: key });
    }
    if (path === "/rest/v1/generation_jobs" && method === "POST") {
      const b = JSON.parse(init.body);
      db.jobs.set(b.id, { ...(db.jobs.get(b.id) || {}), ...b });
      return J(201, null);
    }
    if (path === "/rest/v1/generation_jobs" && method === "PATCH") {
      const id = u.searchParams.get("id").replace("eq.", "");
      Object.assign(db.jobs.get(id), JSON.parse(init.body));
      return J(204, null);
    }
    if (path === "/rest/v1/generated_images" && method === "POST") {
      if (take("dbInsert")) return J(500, { message: "internal error" });
      const b = JSON.parse(init.body);
      if (!db.images.some((r) => r.sha256 === b.sha256 && r.user_id === b.user_id)) {
        db.images.push({ id: "img" + (db.images.length + 1), ...b });
      }
      return J(201, null);
    }
    if (path === "/rest/v1/generated_images" && method === "GET") {
      const sha = (u.searchParams.get("sha256") || "").replace("eq.", "");
      return J(200, db.images.filter((r) => !sha || r.sha256 === sha));
    }
    if (path === "/rest/v1/generated_images" && method === "DELETE") {
      const id = u.searchParams.get("id").replace("eq.", "");
      db.images = db.images.filter((r) => r.id !== id);
      return J(204, null);
    }
    return J(404, { message: "unknown " + path, statusCode: "404" });
  }
  return { fetch, db, objects, calls, faults, expireToken: () => { validToken = "expired"; } };
}

async function setup({ faults, signedIn = true, settings } = {}) {
  const server = createMockSupabase({ faults });
  const mem = new Map();
  const blobMem = new Map();
  let clock = 1_000_000;
  const notifications = [];
  const cs = createCloudSync({
    fetch: server.fetch,
    store: { get: async (k) => mem.get(k), set: async (k, v) => { mem.set(k, v); } },
    blobs: { put: async (k, v) => blobMem.set(k, v), get: async (k) => blobMem.get(k), del: async (k) => blobMem.delete(k) },
    now: () => clock,
    notify: (it) => notifications.push(it.status),
    backoff: () => 10
  });
  await cs.setSettings(settings || { url: URL_, anonKey: "anon", autoSave: true });
  if (signedIn) await cs.signIn("a@b.c", "good");
  const advance = (ms) => { clock += ms; };
  return { cs, server, mem, blobMem, advance, notifications };
}

const meta = (i = 0) => ({ prompt: "con mèo", model: "Nano Banana 2.1", aspectRatio: "9:16", expected: 1, index: i });
const big = { width: 1024, height: 1024 };

test("đường đi chuẩn: upload + metadata + xác minh -> done", async () => {
  const { cs, server, blobMem } = await setup();
  const r = await cs.enqueue({ jobId: JOB, meta: meta(), bytes: png(1), ...big });
  assert.equal(r.duplicate, false);
  await cs.processQueue();
  const [it] = await cs.getQueue();
  assert.equal(it.status, "done");
  assert.equal(server.objects.size, 1);
  assert.equal(server.db.images.length, 1);
  assert.ok([...server.objects.keys()][0].startsWith(`${UID}/${JOB}/`), "đường dẫn theo user/job");
  assert.equal(blobMem.size, 0, "blob tạm được dọn sau khi xác minh");
  assert.equal(server.db.jobs.get(JOB).user_id, UID);
});

test("chống trùng: cùng ảnh enqueue 2 lần chỉ upload 1 lần", async () => {
  const { cs, server } = await setup();
  await cs.enqueue({ jobId: JOB, meta: meta(), bytes: png(1), ...big });
  const again = await cs.enqueue({ jobId: JOB, meta: meta(), bytes: png(1), ...big });
  assert.equal(again.duplicate, true);
  await cs.processQueue();
  assert.equal(server.objects.size, 1);
  assert.equal((await cs.getQueue()).length, 1);
});

test("nhiều ảnh (x1..x4) của một job không lẫn nhau", async () => {
  for (const n of [1, 2, 3, 4]) {
    const { cs, server } = await setup();
    for (let i = 0; i < n; i++) await cs.enqueue({ jobId: JOB, meta: meta(i), bytes: png(10 + i), ...big });
    await cs.processQueue();
    assert.equal(server.objects.size, n);
    assert.equal(server.db.images.length, n);
    assert.equal(new Set(server.db.images.map((r) => r.storage_path)).size, n);
    assert.equal(server.db.jobs.size, 1);
    const fin = await cs.finishJob(JOB, n);
    assert.equal(fin.status, "completed");
    assert.equal(server.db.jobs.get(JOB).saved_count, n);
  }
});

test("hai job tuần tự không trộn ảnh", async () => {
  const { cs, server } = await setup();
  const JOB2 = "33333333-3333-3333-3333-333333333333";
  await cs.enqueue({ jobId: JOB, meta: meta(), bytes: png(1), ...big });
  await cs.enqueue({ jobId: JOB2, meta: { ...meta(), prompt: "con chó" }, bytes: png(2), ...big });
  await cs.processQueue();
  const byJob = (j) => server.db.images.filter((r) => r.job_id === j);
  assert.equal(byJob(JOB).length, 1);
  assert.equal(byJob(JOB2)[0].prompt, "con chó");
});

test("chưa đăng nhập -> waiting_auth, giữ ảnh; đăng nhập xong thì tải lên", async () => {
  const { cs, server, advance } = await setup({ signedIn: false });
  await cs.enqueue({ jobId: JOB, meta: meta(), bytes: png(1), ...big });
  await cs.processQueue();
  let [it] = await cs.getQueue();
  assert.equal(it.status, "waiting_auth");
  assert.equal(it.attempts, 0, "thiếu session không tính là lần thử");
  assert.equal(server.objects.size, 0);
  await cs.signIn("a@b.c", "good");
  advance(60000);
  await cs.processQueue();
  [it] = await cs.getQueue();
  assert.equal(it.status, "done");
});

test("lỗi mạng tạm thời -> retry rồi thành công", async () => {
  const { cs, server, advance } = await setup();
  server.faults.network = 2; // chỉ bật sau khi đăng nhập xong
  await cs.enqueue({ jobId: JOB, meta: meta(), bytes: png(1), ...big });
  await cs.processQueue();
  let [it] = await cs.getQueue();
  assert.equal(it.status, "retry");
  assert.equal(it.attempts, 1);
  for (let i = 0; i < 4 && it.status !== "done"; i++) {
    advance(1000);
    await cs.processQueue();
    [it] = await cs.getQueue();
  }
  assert.equal(it.status, "done");
  assert.equal(server.objects.size, 1);
});

test("upload Storage xong nhưng insert DB lỗi -> retry, không upload trùng/ghi đè", async () => {
  const { cs, server, advance } = await setup({ faults: { dbInsert: 1 } });
  await cs.enqueue({ jobId: JOB, meta: meta(), bytes: png(1), ...big });
  await cs.processQueue();
  let [it] = await cs.getQueue();
  assert.equal(it.status, "retry");
  assert.equal(server.objects.size, 1, "file đã lên Storage");
  assert.equal(server.db.images.length, 0);
  advance(1000);
  await cs.processQueue();
  [it] = await cs.getQueue();
  assert.equal(it.status, "done", "lần 2 gặp 409 ở Storage vẫn tiếp tục insert DB");
  assert.equal(server.objects.size, 1);
  assert.equal(server.db.images.length, 1);
});

test("verify Storage thất bại -> KHÔNG báo done", async () => {
  const { cs, advance } = await setup({ faults: { infoMissing: true } });
  await cs.enqueue({ jobId: JOB, meta: meta(), bytes: png(1), ...big });
  await cs.processQueue();
  let [it] = await cs.getQueue();
  assert.equal(it.status, "retry");
  assert.match(it.error, /VERIFY_STORAGE/);
  assert.notEqual(it.status, "done");
  // hết số lần thử thì failed, vẫn không done
  for (let i = 0; i < 10; i++) { advance(1000); await cs.processQueue(); }
  [it] = await cs.getQueue();
  assert.equal(it.status, "failed");
});

test("403 RLS/permission -> failed ngay, không retry", async () => {
  const { cs } = await setup({ faults: { forbidden: 99 } });
  await cs.enqueue({ jobId: JOB, meta: meta(), bytes: png(1), ...big });
  await cs.processQueue();
  const [it] = await cs.getQueue();
  assert.equal(it.status, "failed");
  assert.match(it.error, /PERMISSION_DENIED/);
  assert.equal(it.attempts, 1);
});

test("thiếu bucket -> failed BUCKET_MISSING", async () => {
  const { cs } = await setup({ faults: { bucketMissing: true } });
  await cs.enqueue({ jobId: JOB, meta: meta(), bytes: png(1), ...big });
  await cs.processQueue();
  const [it] = await cs.getQueue();
  assert.equal(it.status, "failed");
  assert.match(it.error, /BUCKET_MISSING/);
});

test("hết dung lượng 413 -> failed QUOTA", async () => {
  const { cs } = await setup({ faults: { quota: true } });
  await cs.enqueue({ jobId: JOB, meta: meta(), bytes: png(1), ...big });
  await cs.processQueue();
  const [it] = await cs.getQueue();
  assert.equal(it.status, "failed");
  assert.match(it.error, /QUOTA/);
});

test("token hết hạn giữa chừng -> tự refresh rồi thành công", async () => {
  const { cs, server } = await setup();
  await cs.enqueue({ jobId: JOB, meta: meta(), bytes: png(1), ...big });
  server.expireToken();
  await cs.processQueue();
  const [it] = await cs.getQueue();
  assert.equal(it.status, "done");
});

test("refresh thất bại -> waiting_auth, không mất ảnh", async () => {
  const { cs, server, blobMem } = await setup({ faults: { refreshFail: 5 } });
  await cs.enqueue({ jobId: JOB, meta: meta(), bytes: png(1), ...big });
  server.expireToken();
  await cs.processQueue();
  const [it] = await cs.getQueue();
  assert.equal(it.status, "waiting_auth");
  assert.equal(blobMem.size, 1);
});

test("định dạng không hỗ trợ / ảnh rỗng / thumbnail bị từ chối khi enqueue", async () => {
  const { cs } = await setup();
  const gif = new Uint8Array(100); gif.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
  await assert.rejects(cs.enqueue({ jobId: JOB, meta: meta(), bytes: gif, ...big }), (e) => e.code === "UNSUPPORTED_FORMAT");
  await assert.rejects(cs.enqueue({ jobId: JOB, meta: meta(), bytes: new Uint8Array(0), ...big }), (e) => e.code === "EMPTY_IMAGE");
  await assert.rejects(cs.enqueue({ jobId: JOB, meta: meta(), bytes: png(1), width: 200, height: 200 }), (e) => e.code === "THUMBNAIL");
  assert.equal((await cs.getQueue()).length, 0);
});

test("service worker bị suspend: item kẹt 'uploading' được khôi phục", async () => {
  const { cs, mem, server } = await setup();
  await cs.enqueue({ jobId: JOB, meta: meta(), bytes: png(1), ...big });
  const q = mem.get("cloud.queue");
  q[0].status = "uploading";
  mem.set("cloud.queue", q);
  await cs.recover();
  const [it] = await cs.getQueue();
  assert.equal(it.status, "done");
  assert.equal(server.objects.size, 1);
});

test("hàng đợi bền vững: instance mới đọc lại được queue đang chờ", async () => {
  const { cs, mem, blobMem, server, advance } = await setup({ signedIn: false });
  await cs.enqueue({ jobId: JOB, meta: meta(), bytes: png(1), ...big });
  const cs2 = createCloudSync({
    fetch: server.fetch,
    store: { get: async (k) => mem.get(k), set: async (k, v) => { mem.set(k, v); } },
    blobs: { put: async (k, v) => blobMem.set(k, v), get: async (k) => blobMem.get(k), del: async (k) => blobMem.delete(k) },
    now: () => 1_000_000 + 100000
  });
  await cs2.signIn("a@b.c", "good");
  await cs2.processQueue();
  assert.equal((await cs2.getQueue())[0].status, "done");
});

test("thư viện: list, ký URL, xóa ảnh (Storage + DB)", async () => {
  const { cs, server } = await setup();
  await cs.enqueue({ jobId: JOB, meta: meta(), bytes: png(1), ...big });
  await cs.processQueue();
  const rows = await cs.listImages();
  assert.equal(rows.length, 1);
  const urls = await cs.signUrls([rows[0].storage_path]);
  assert.ok(urls[rows[0].storage_path].startsWith(URL_ + "/storage/v1/object/sign/"));
  await cs.deleteImage(rows[0]);
  assert.equal(server.objects.size, 0);
  assert.equal(server.db.images.length, 0);
});

test("đăng nhập sai -> AUTH_FAILED; chưa cấu hình -> NOT_CONFIGURED", async () => {
  const { cs } = await setup({ signedIn: false });
  await assert.rejects(cs.signIn("a@b.c", "bad"), (e) => e.code === "AUTH_FAILED");
  const empty = await setup({ signedIn: false, settings: { url: "", anonKey: "" } });
  await assert.rejects(empty.cs.signIn("a@b.c", "good"), (e) => e.code === "NOT_CONFIGURED");
});
