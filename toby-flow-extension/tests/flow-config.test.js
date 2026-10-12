// Chạy: cài jsdom ở đâu đó (npm i jsdom), đặt NODE_PATH tới node_modules đó rồi: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const FlowConfig = require("../flow-config.js");

const MODELS = ["Nano Banana 2.1", "Nano Banana Pro", "Imagen 4"];

// Flow giả: popup cấu hình mô phỏng cấu trúc trong ảnh thật (Hình ảnh/Video, tỷ lệ, model dropdown, x1-x4).
function createMockFlow(init = {}, opts = {}) {
  const dom = new JSDOM("<body></body>", { pretendToBeVisual: true });
  const { document } = dom.window;
  const state = { mode: "image", ratio: "9:16", model: "Nano Banana 2.1", count: 1, panelOpen: false, ddOpen: false, ...init };
  const stats = { clicks: [] };
  const videoRatios = ["16:9", "9:16"];

  const sel = (selected) => {
    if (opts.selection === "visual") return selected ? 'style="background: rgb(60, 60, 60)"' : "";
    return `aria-selected="${selected}"`;
  };
  const btn = (action, value, label, selected) =>
    `<button data-action="${action}" data-value="${value}" ${sel(selected)}><svg></svg><span>${label}</span></button>`;

  function html() {
    const ratios = (state.mode === "video" ? videoRatios : ["16:9", "4:3", "1:1", "3:4", "9:16"])
      .map((r) => btn("ratio", r, r, state.ratio === r)).join("");
    const counts = [1, 2, 3, 4].map((c) => btn("count", c, "x" + c, state.count === c)).join("");
    const panel = state.panelOpen ? `
      <div id="panel">
        <div>${btn("mode", "image", "Hình ảnh", state.mode === "image")}${btn("mode", "video", "Video", state.mode === "video")}</div>
        <div>${ratios}</div>
        <button data-action="model-toggle" aria-haspopup="listbox"><span>${state.model}</span></button>
        <div>${counts}</div>
        <p>Quá trình tạo sẽ tốn 0 tín dụng</p>
      </div>` : "";
    const dd = state.panelOpen && state.ddOpen
      ? `<ul id="overlay">${MODELS.map((m) => `<li role="option" data-action="model" data-value="${m}">${m}</li>`).join("")}</ul>` : "";
    return `
      <nav><a>Tất cả nội dung</a><a>Hình ảnh</a><a>Nhân vật</a></nav>
      ${panel}${dd}
      <div id="composer"><button data-action="pill"><span>${state.model}</span><span>x${state.count}</span></button></div>`;
  }

  function render() {
    if (opts.renderDelay) setTimeout(() => { document.body.innerHTML = html(); }, opts.renderDelay);
    else document.body.innerHTML = html();
  }

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-action]");
    if (!t) return;
    const { action, value } = t.dataset;
    stats.clicks.push(`${action}:${value ?? ""}`);
    if (opts.clickNoop === action) return;
    if (action === "pill") state.panelOpen = !state.panelOpen;
    if (action === "mode") {
      state.mode = value;
      if (opts.resetOnMode) { state.ratio = value === "video" ? "16:9" : "9:16"; state.count = 1; }
    }
    if (action === "ratio") state.ratio = value;
    if (action === "count") state.count = Number(value);
    if (action === "model-toggle") state.ddOpen = !state.ddOpen;
    if (action === "model") { state.model = value; state.ddOpen = false; }
    opts.onClick?.(state, stats);
    render();
  });

  document.body.innerHTML = html();
  const env = {
    document,
    timeout: opts.timeout ?? 500,
    interval: 10,
    log: () => {},
    isVisible: (el) => el.isConnected,
    click: async (el) => { el.click(); },
    pressEscape: async () => { state.panelOpen = false; state.ddOpen = false; render(); }
  };
  return { state, stats, env, document };
}

const cfg = (o) => ({ mode: "image", aspectRatio: "9:16", model: "Nano Banana 2.1", outputCount: 1, ...o });
const nonPillClicks = (stats) => stats.clicks.filter((c) => !c.startsWith("pill"));

for (const selection of ["aria", "visual"]) {
  test(`[${selection}] cấu hình đã đúng từ đầu -> không click trường nào`, async () => {
    const m = createMockFlow({}, { selection });
    const r = await FlowConfig.applyFlowConfiguration(cfg(), m.env);
    assert.equal(r.ok, true);
    assert.deepEqual(nonPillClicks(m.stats), []);
    assert.equal(m.state.panelOpen, false, "bảng phải được đóng");
  });

  test(`[${selection}] đổi từng trường độc lập`, async () => {
    for (const [patch, key, val] of [
      [{ aspectRatio: "16:9" }, "ratio", "16:9"],
      [{ outputCount: 3 }, "count", 3],
      [{ model: "Imagen 4" }, "model", "Imagen 4"]
    ]) {
      const m = createMockFlow({}, { selection });
      const r = await FlowConfig.applyFlowConfiguration(cfg(patch), m.env);
      assert.equal(r.ok, true);
      assert.equal(m.state[key], val);
    }
  });

  test(`[${selection}] đổi nhiều trường cùng lúc`, async () => {
    const m = createMockFlow({}, { selection });
    await FlowConfig.applyFlowConfiguration(cfg({ aspectRatio: "1:1", model: "Nano Banana Pro", outputCount: 4 }), m.env);
    assert.deepEqual([m.state.ratio, m.state.model, m.state.count], ["1:1", "Nano Banana Pro", 4]);
  });
}

test("chuyển từ Video sang Image, mode reset ratio/count -> áp dụng lại", async () => {
  const m = createMockFlow({ mode: "video", ratio: "16:9", count: 1 }, { resetOnMode: true });
  const r = await FlowConfig.applyFlowConfiguration(cfg({ aspectRatio: "3:4", outputCount: 2 }), m.env);
  assert.equal(r.ok, true);
  assert.deepEqual([m.state.mode, m.state.ratio, m.state.count], ["image", "3:4", 2]);
});

test("dropdown đang đóng được mở trước khi chọn option (option nằm ở overlay)", async () => {
  const m = createMockFlow();
  await FlowConfig.applyFlowConfiguration(cfg({ model: "Nano Banana Pro" }), m.env);
  const toggleIdx = m.stats.clicks.indexOf("model-toggle:");
  const pickIdx = m.stats.clicks.indexOf("model:Nano Banana Pro");
  assert.ok(toggleIdx >= 0 && pickIdx > toggleIdx);
});

test("option không tồn tại -> CONFIG_OPTION_UNAVAILABLE, không chọn giá trị khác", async () => {
  const m = createMockFlow();
  await assert.rejects(
    FlowConfig.applyFlowConfiguration(cfg({ model: "Model Không Có" }), m.env),
    (e) => e.code === "CONFIG_OPTION_UNAVAILABLE" && e.details.available.includes("Imagen 4")
  );
  assert.equal(m.state.model, "Nano Banana 2.1");
});

test("tỷ lệ không có ở chế độ Video -> CONFIG_OPTION_UNAVAILABLE", async () => {
  const m = createMockFlow({ mode: "image" }, { resetOnMode: true });
  await assert.rejects(
    FlowConfig.applyFlowConfiguration(cfg({ mode: "video", aspectRatio: "4:3" }), m.env),
    (e) => e.code === "CONFIG_OPTION_UNAVAILABLE"
  );
});

test("click không làm đổi trạng thái -> CONFIG_VERIFY_FAILED (không tự tuyên bố thành công)", async () => {
  const m = createMockFlow({}, { clickNoop: "count" });
  await assert.rejects(
    FlowConfig.applyFlowConfiguration(cfg({ outputCount: 4 }), m.env),
    (e) => e.code === "CONFIG_VERIFY_FAILED"
  );
});

test("DOM render chậm vẫn thành công (chờ bằng điều kiện, không sleep cố định)", async () => {
  const m = createMockFlow({}, { renderDelay: 60, timeout: 1500 });
  const r = await FlowConfig.applyFlowConfiguration(cfg({ aspectRatio: "4:3", outputCount: 2 }), m.env);
  assert.equal(r.ok, true);
  assert.deepEqual([m.state.ratio, m.state.count], ["4:3", 2]);
});

test("người dùng tự đổi cấu hình giữa chừng -> CONFIG_USER_CONFLICT, không ghi đè", async () => {
  let fired = false;
  const m = createMockFlow({}, {
    onClick: (state) => { if (!fired && state.ratio === "16:9") { fired = true; state.count = 3; } }
  });
  await assert.rejects(
    FlowConfig.applyFlowConfiguration({ aspectRatio: "16:9", model: "Imagen 4" }, m.env),
    (e) => e.code === "CONFIG_USER_CONFLICT" && e.details.field === "outputCount"
  );
  assert.equal(m.state.count, 3, "giá trị người dùng đặt không bị ghi đè");
  assert.notEqual(m.state.model, "Imagen 4");
});

test("readFlowConfiguration trả về trạng thái thật và đóng bảng", async () => {
  const m = createMockFlow({ ratio: "3:4", count: 2, model: "Imagen 4" });
  const s = await FlowConfig.readFlowConfiguration(m.env);
  assert.deepEqual(s, { mode: "image", aspectRatio: "3:4", model: "Imagen 4", outputCount: 2 });
  assert.equal(m.state.panelOpen, false);
});

test("mục 'Hình ảnh' ở sidebar không bị nhầm với tab Hình ảnh trong bảng", async () => {
  const m = createMockFlow({ mode: "video" });
  await FlowConfig.applyFlowConfiguration({ mode: "image" }, m.env);
  assert.equal(m.state.mode, "image");
});

test("verify thất bại -> không chạy bước Generate", async () => {
  const m = createMockFlow({}, { clickNoop: "ratio" });
  let generated = false;
  try {
    await FlowConfig.applyFlowConfiguration(cfg({ aspectRatio: "1:1" }), m.env);
    generated = true; // chỉ tới đây nếu cấu hình được xác minh thành công
  } catch (e) {
    assert.equal(e.code, "CONFIG_VERIFY_FAILED");
  }
  assert.equal(generated, false);
});

test("config không hợp lệ bị từ chối ngay, không chạm vào UI", async () => {
  const m = createMockFlow();
  await assert.rejects(FlowConfig.applyFlowConfiguration({ aspectRatio: "21:9" }, m.env), (e) => e.code === "CONFIG_OPTION_UNAVAILABLE");
  await assert.rejects(FlowConfig.applyFlowConfiguration({ outputCount: 9 }, m.env), (e) => e.code === "CONFIG_OPTION_UNAVAILABLE");
  assert.equal(m.stats.clicks.length, 0);
});
