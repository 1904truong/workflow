// Flow Bridge - Google Flow configuration automation (mode / ratio / model / output count)
//
// Nguyên tắc:
//  - Không hardcode selector CSS dài, không hardcode toạ độ: tìm phần tử theo text hiển thị,
//    role/aria, rồi suy ra trạng thái "đang chọn" từ aria-*/data-state/class hoặc nền (visual).
//  - Không tin click: mỗi thay đổi đều đọc lại trạng thái thật để xác nhận.
//  - Chờ bằng MutationObserver + kiểm tra điều kiện (có timeout), không sleep cố định.
//  - Không tự đổi sang giá trị khác: thiếu option -> CONFIG_OPTION_UNAVAILABLE.
(function (root) {
  "use strict";

  const TAG = "[Flow Bridge][Config]";

  const RATIOS = ["16:9", "4:3", "1:1", "3:4", "9:16"];
  const COUNTS = [1, 2, 3, 4];
  const MODE_LABELS = {
    image: /^(hình ảnh|image|images)$/i,
    video: /^video$/i
  };
  const MODEL_HINT = /nano banana|imagen|veo|gemini/i;
  const FIELD_ORDER = ["mode", "aspectRatio", "model", "outputCount"];
  const INTERACTIVE =
    "button, [role='button'], [role='tab'], [role='option'], [role='radio'], [role='menuitem'], " +
    "[role='menuitemradio'], [role='combobox'], [role='switch'], [aria-haspopup]";
  const ICON_SELECTOR = "svg, mat-icon, md-icon, pat-icon, i, [class*='icon' i], [aria-hidden='true']";

  const ERR = {
    UNAVAILABLE: "CONFIG_OPTION_UNAVAILABLE",
    NOT_FOUND: "CONFIG_ELEMENT_NOT_FOUND",
    PANEL_NOT_FOUND: "CONFIG_PANEL_NOT_FOUND",
    PANEL_NOT_CLOSED: "CONFIG_PANEL_NOT_CLOSED",
    VERIFY_FAILED: "CONFIG_VERIFY_FAILED",
    USER_CONFLICT: "CONFIG_USER_CONFLICT",
    INVALID: "CONFIG_INVALID",
    CANCELLED: "CONFIG_CANCELLED"
  };

  class FlowConfigError extends Error {
    constructor(code, message, details) {
      super(`${code}: ${message}`);
      this.name = "FlowConfigError";
      this.code = code;
      this.details = details || {};
    }
  }

  // ───────────────────────── Env ─────────────────────────
  const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function defaultIsVisible(el) {
    if (!el || !el.isConnected || el.hidden) return false;
    const win = el.ownerDocument.defaultView;
    const st = win.getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden") return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  // Click: cuộn phần tử vào view, ưu tiên click thật (isTrusted) qua background (CDP),
  // fallback el.click(). Kết quả click KHÔNG được coi là thành công - caller phải đọc lại state.
  async function defaultClick(el) {
    el.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    try {
      const r = el.getBoundingClientRect();
      const res = await root.chrome?.runtime?.sendMessage({
        type: "TRUSTED_CLICK",
        payload: { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
      });
      if (res && res.success) return "trusted";
    } catch (_) { /* fallthrough */ }
    el.click();
    return "synthetic";
  }

  async function defaultPressEscape() {
    try {
      await root.chrome?.runtime?.sendMessage({ type: "TRUSTED_CLICK", payload: { pressEscape: true } });
    } catch (_) { /* ignore */ }
  }

  function makeEnv(opts = {}) {
    return {
      document: opts.document || root.document,
      click: opts.click || defaultClick,
      pressEscape: opts.pressEscape || defaultPressEscape,
      isVisible: opts.isVisible || defaultIsVisible,
      sleep: opts.sleep || defaultSleep,
      timeout: opts.timeout ?? 4000,
      interval: opts.interval ?? 80,
      shouldAbort: opts.shouldAbort || (() => false),
      log: opts.log || ((...a) => console.log(TAG, ...a))
    };
  }

  // ───────────────────────── Helpers ─────────────────────────
  const norm = (s) => (s || "").normalize("NFC").replace(/\s+/g, " ").trim();
  const modelKey = (s) => norm(s).toLowerCase().replace(/[^\p{L}\p{N}.]+/gu, " ").trim();
  const stripLeadingSymbols = (s) => s.replace(/^[^\p{L}\p{N}]+/u, "");

  // Text hiển thị của phần tử, bỏ qua icon (ligature kiểu "image", "arrow_forward").
  function labelOf(el) {
    let out = "";
    const walk = (node) => {
      for (const c of node.childNodes) {
        if (c.nodeType === 3) out += c.data;
        else if (c.nodeType === 1 && !c.matches(ICON_SELECTOR)) walk(c);
      }
    };
    walk(el);
    out = norm(out);
    return out || norm(el.getAttribute?.("aria-label") || "");
  }

  function checkAbort(env) {
    if (env.shouldAbort()) throw new FlowConfigError(ERR.CANCELLED, "Tác vụ đã bị người dùng hủy");
  }

  // Chờ điều kiện đúng: MutationObserver + vòng kiểm tra an toàn (bắt thay đổi style/layout), có timeout.
  function waitFor(env, predicate, timeout = env.timeout) {
    return new Promise((resolve) => {
      let finished = false;
      let observer = null;
      const finish = (value) => {
        if (finished) return;
        finished = true;
        observer?.disconnect();
        clearInterval(tick);
        clearTimeout(timer);
        resolve(value);
      };
      const check = () => {
        try {
          const v = predicate();
          if (v) finish(v);
        } catch (_) { /* predicate lỗi tạm thời khi DOM đang đổi */ }
      };
      const MO = env.document.defaultView?.MutationObserver || root.MutationObserver;
      if (MO) {
        observer = new MO(check);
        observer.observe(env.document.documentElement || env.document, {
          subtree: true, childList: true, attributes: true, characterData: true
        });
      }
      const tick = setInterval(check, env.interval);
      const timer = setTimeout(() => finish(null), timeout);
      check();
    });
  }

  // Các phần tử cha của text node có nội dung (trim) khớp regex.
  function textElements(env, re, scope) {
    const doc = env.document;
    const walker = doc.createTreeWalker(scope || doc.body, 4 /* SHOW_TEXT */);
    const out = [];
    let n;
    while ((n = walker.nextNode())) {
      const t = norm(n.data);
      if (t && re.test(t) && n.parentElement && env.isVisible(n.parentElement)) out.push(n.parentElement);
    }
    return out;
  }

  // Tìm phần tử tương tác có label khớp matcher trong scope (innermost, dedupe theo wrapper tương tác).
  function findByLabel(env, scope, matcher, exclude) {
    const test = typeof matcher === "function"
      ? matcher
      : matcher instanceof RegExp
        ? (t) => matcher.test(t)
        : (t) => t.toLowerCase() === String(matcher).toLowerCase();
    const matched = [];
    for (const el of scope.querySelectorAll("*")) {
      if (exclude && (el === exclude || exclude.contains(el) || el.contains(exclude))) continue;
      if (!env.isVisible(el)) continue;
      if (test(labelOf(el))) matched.push(el);
    }
    const innermost = matched.filter((el) => !matched.some((o) => o !== el && el.contains(o)));
    const targets = [];
    for (const el of innermost) {
      const t = el.closest(INTERACTIVE);
      const target = t && scope.contains(t) ? t : el;
      if (!targets.includes(target)) targets.push(target);
    }
    return targets;
  }

  function isDisabled(el) {
    return !!(el.disabled || el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true" ||
      el.closest("[aria-disabled='true']"));
  }

  // ───────────────────────── Selected state ─────────────────────────
  const POS = /^(true|on|active|selected|checked|open|pressed|current|page|step|location|date|time)$/i;
  const NEG = /^(false|off|inactive|unselected|unchecked|closed|unpressed)$/i;

  function explicitState(el) {
    const nodes = [el, ...Array.from(el.querySelectorAll("*")).slice(0, 12)];
    let sawFalse = false;
    for (const n of nodes) {
      for (const attr of ["aria-selected", "aria-checked", "aria-pressed", "aria-current", "data-state", "data-selected", "data-active", "data-checked"]) {
        if (!n.hasAttribute(attr)) continue;
        const v = n.getAttribute(attr);
        if (v === "" && attr.startsWith("data-")) return true;
        if (POS.test(v)) return true;
        if (NEG.test(v)) sawFalse = true;
      }
      const cls = typeof n.className === "string" ? n.className : "";
      if (/(^|[\s_-])(is-)?(selected|checked|active)(?=$|[\s_-])/i.test(cls) && !/(^|[\s_-])(un|in)(selected|checked|active)/i.test(cls)) return true;
    }
    return sawFalse ? false : null;
  }

  function parseColor(str) {
    if (!str || str === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
    const m = str.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)/i);
    if (!m) return { r: 0, g: 0, b: 0, a: 0 };
    let a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { r: +m[1], g: +m[2], b: +m[3], a };
  }

  // Nền riêng (không kế thừa) của phần tử hoặc con trực tiếp của nó.
  function ownBackground(el) {
    const win = el.ownerDocument.defaultView;
    const nodes = [el, ...Array.from(el.children).slice(0, 4)];
    let best = { r: 0, g: 0, b: 0, a: 0 };
    for (const n of nodes) {
      const c = parseColor(win.getComputedStyle(n).backgroundColor);
      if (c.a > best.a) best = c;
    }
    return best;
  }
  const luminance = (c) => (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;

  // Trả về index phần tử đang được chọn trong nhóm, hoặc -1 nếu không xác định chắc chắn.
  function selectedIndex(group) {
    if (group.length === 0) return -1;
    const explicit = group.map(explicitState);
    if (explicit.some((s) => s !== null)) {
      const trues = explicit.map((s, i) => (s === true ? i : -1)).filter((i) => i >= 0);
      return trues.length === 1 ? trues[0] : -1;
    }
    // Không có thuộc tính trạng thái: dùng nền. Option được chọn là cái duy nhất có nền không trong suốt.
    const bgs = group.map(ownBackground);
    const filled = bgs.map((c, i) => (c.a > 0.05 ? i : -1)).filter((i) => i >= 0);
    if (filled.length === 1) return filled[0];
    if (filled.length === group.length && group.length >= 3) {
      const lums = bgs.map(luminance);
      const sorted = [...lums].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      let bestI = -1, bestD = 0.04;
      lums.forEach((l, i) => { if (Math.abs(l - median) > bestD) { bestD = Math.abs(l - median); bestI = i; } });
      return bestI;
    }
    return -1;
  }

  // ───────────────────────── Locate panel / pill ─────────────────────────
  const RATIO_RE = /^(16:9|4:3|1:1|3:4|9:16)$/;

  function findPanel(env) {
    for (const leaf of textElements(env, RATIO_RE)) {
      let a = leaf;
      while (a && a !== env.document.body) {
        const txt = a.textContent || "";
        if (env.isVisible(a) && /video/i.test(txt) && /x[1-4]/i.test(txt)) return a;
        a = a.parentElement;
      }
    }
    return null;
  }

  function findPill(env, panel) {
    const outside = (el) => !panel || !panel.contains(el);
    const climb = (el) => {
      let a = el;
      for (let i = 0; a && i < 6; i++, a = a.parentElement) {
        if (MODEL_HINT.test(a.textContent || "") && a.matches(INTERACTIVE)) return a;
      }
      return el.closest(INTERACTIVE);
    };
    for (const el of textElements(env, /^x[1-4]$/i)) {
      if (!outside(el)) continue;
      const pill = climb(el);
      if (pill && outside(pill) && MODEL_HINT.test(pill.textContent || "")) return pill;
    }
    for (const el of textElements(env, MODEL_HINT)) {
      if (!outside(el)) continue;
      const pill = el.closest(INTERACTIVE);
      if (pill && outside(pill)) return pill;
    }
    return null;
  }

  async function ensurePanelOpen(env) {
    checkAbort(env);
    let panel = findPanel(env);
    if (panel) return panel;
    let pillInfo = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const pill = findPill(env, null);
      if (!pill) throw new FlowConfigError(ERR.NOT_FOUND, "Không tìm thấy nút mở bảng cấu hình (pill model/số lượng)");
      pillInfo = { label: labelOf(pill), tag: pill.tagName, w: Math.round(pill.getBoundingClientRect().width) };
      env.log(`Mở bảng cấu hình (lần ${attempt})`, pillInfo);
      // Lần 1: click của env (thật). Lần 2+: click phụ trợ - thử lại từ đầu, kiểm tra không phải panel đã mở trễ.
      if (attempt === 1) await env.click(pill);
      else if (attempt === 2) pill.click();
      else { pill.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); pill.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })); pill.click(); }
      panel = await waitFor(env, () => findPanel(env), env.timeout);
      if (panel) return panel;
    }
    throw new FlowConfigError(ERR.PANEL_NOT_FOUND, "Bấm pill nhưng bảng cấu hình không xuất hiện", { pill: pillInfo });
  }

  async function closePanel(env) {
    if (!findPanel(env)) return;
    await env.pressEscape();
    if (await waitFor(env, () => !findPanel(env), 1500)) return;
    const pill = findPill(env, findPanel(env));
    if (pill) {
      await env.click(pill);
      if (await waitFor(env, () => !findPanel(env), 1500)) return;
    }
    throw new FlowConfigError(ERR.PANEL_NOT_CLOSED, "Không đóng được bảng cấu hình");
  }

  // ───────────────────────── Read ─────────────────────────
  function modeButtons(env, panel) {
    return {
      image: findByLabel(env, panel, MODE_LABELS.image)[0] || null,
      video: findByLabel(env, panel, MODE_LABELS.video)[0] || null
    };
  }

  function ratioButtons(env, panel) {
    return RATIOS.map((r) => ({ value: r, el: findByLabel(env, panel, r)[0] || null })).filter((x) => x.el);
  }

  function countButtons(env, panel) {
    return COUNTS.map((c) => ({ value: c, el: findByLabel(env, panel, `x${c}`)[0] || null })).filter((x) => x.el);
  }

  function modelTrigger(env, panel) {
    return findByLabel(env, panel, (t) => MODEL_HINT.test(t) && t.length < 60)[0] || null;
  }

  function readModeFrom(env, panel) {
    const b = modeButtons(env, panel);
    const group = [b.image, b.video].filter(Boolean);
    const idx = selectedIndex(group);
    if (idx < 0) return null;
    return group[idx] === b.image ? "image" : "video";
  }

  function readRatioFrom(env, panel) {
    const g = ratioButtons(env, panel);
    const idx = selectedIndex(g.map((x) => x.el));
    return idx < 0 ? null : g[idx].value;
  }

  function readCountFrom(env, panel) {
    const g = countButtons(env, panel);
    const idx = selectedIndex(g.map((x) => x.el));
    return idx < 0 ? null : g[idx].value;
  }

  function readModelFrom(env, panel) {
    const t = modelTrigger(env, panel);
    return t ? stripLeadingSymbols(labelOf(t)) || null : null;
  }

  function readAll(env, panel) {
    return {
      mode: readModeFrom(env, panel),
      aspectRatio: readRatioFrom(env, panel),
      model: readModelFrom(env, panel),
      outputCount: readCountFrom(env, panel)
    };
  }

  function sameValue(field, a, b) {
    if (a == null || b == null) return false;
    if (field === "model") return modelKey(a) === modelKey(b);
    return String(a) === String(b);
  }

  // Đọc cấu hình hiện tại. Mở bảng nếu cần; đóng lại nếu chính hàm này đã mở (trừ khi keepOpen).
  async function readFlowConfiguration(opts = {}) {
    const env = makeEnv(opts);
    const wasOpen = !!findPanel(env);
    const panel = await ensurePanelOpen(env);
    const state = readAll(env, panel);
    if (!wasOpen && !opts.keepOpen) await closePanel(env);
    return state;
  }

  // ───────────────────────── Apply ─────────────────────────
  function validate(config) {
    const c = config || {};
    const bad = (msg) => { throw new FlowConfigError(ERR.INVALID, msg, { config }); };
    if (c.mode != null && !MODE_LABELS[c.mode]) bad(`mode không hợp lệ: ${c.mode}`);
    if (c.aspectRatio != null && !RATIOS.includes(c.aspectRatio)) {
      throw new FlowConfigError(ERR.UNAVAILABLE, `Tỷ lệ không hỗ trợ: ${c.aspectRatio}`, { config });
    }
    if (c.outputCount != null && !COUNTS.includes(Number(c.outputCount))) {
      throw new FlowConfigError(ERR.UNAVAILABLE, `Số lượng không hỗ trợ: ${c.outputCount}`, { config });
    }
    const out = {};
    if (c.mode) out.mode = c.mode;
    if (c.aspectRatio) out.aspectRatio = c.aspectRatio;
    if (c.model) out.model = String(c.model);
    if (c.outputCount != null) out.outputCount = Number(c.outputCount);
    return out;
  }

  const readField = {
    mode: readModeFrom,
    aspectRatio: readRatioFrom,
    model: readModelFrom,
    outputCount: readCountFrom
  };

  function listOptionLabels(env) {
    const seen = new Set();
    for (const el of env.document.querySelectorAll("[role='option'], [role='menuitem'], [role='menuitemradio'], [role='listitem'], li")) {
      if (env.isVisible(el)) seen.add(labelOf(el));
    }
    return [...seen].filter(Boolean);
  }

  // Chọn model: mở dropdown -> tìm option trong TOÀN document (overlay) -> click.
  async function pickModel(env, panel, desired) {
    const trigger = modelTrigger(env, panel);
    if (!trigger) throw new FlowConfigError(ERR.NOT_FOUND, "Không tìm thấy dropdown model");
    if (isDisabled(trigger)) throw new FlowConfigError(ERR.UNAVAILABLE, "Dropdown model đang bị khóa");
    await env.click(trigger);
    const want = modelKey(desired);
    const option = await waitFor(env, () => {
      const cands = [];
      for (const el of env.document.body.querySelectorAll("*")) {
        if (el === trigger || trigger.contains(el) || el.contains(trigger)) continue;
        if (!env.isVisible(el)) continue;
        if (modelKey(stripLeadingSymbols(labelOf(el))) === want) cands.push(el);
      }
      const inner = cands.filter((el) => !cands.some((o) => o !== el && el.contains(o)));
      if (!inner.length) return null;
      const el = inner[0];
      return el.closest("[role='option'], [role='menuitem'], [role='menuitemradio'], button, li") || el;
    });
    if (!option) {
      const available = listOptionLabels(env);
      await env.pressEscape();
      throw new FlowConfigError(ERR.UNAVAILABLE, `Model "${desired}" không có trong danh sách`, { available });
    }
    if (isDisabled(option)) throw new FlowConfigError(ERR.UNAVAILABLE, `Model "${desired}" đang bị khóa`);
    await env.click(option);
  }

  async function pickSimple(env, panel, field, desired) {
    let el = null;
    if (field === "mode") el = modeButtons(env, panel)[desired];
    if (field === "aspectRatio") el = ratioButtons(env, panel).find((x) => x.value === desired)?.el;
    if (field === "outputCount") el = countButtons(env, panel).find((x) => x.value === desired)?.el;
    if (!el) {
      // Có thể UI chưa render xong (Case 4): chờ thêm một lần rồi mới kết luận.
      el = await waitFor(env, () => {
        const p = findPanel(env);
        if (!p) return null;
        if (field === "mode") return modeButtons(env, p)[desired];
        if (field === "aspectRatio") return ratioButtons(env, p).find((x) => x.value === desired)?.el;
        return countButtons(env, p).find((x) => x.value === desired)?.el;
      }, 1500);
    }
    if (!el) throw new FlowConfigError(ERR.UNAVAILABLE, `Không có tùy chọn ${field}="${desired}" trong chế độ hiện tại`);
    if (isDisabled(el)) throw new FlowConfigError(ERR.UNAVAILABLE, `Tùy chọn ${field}="${desired}" đang bị khóa`);
    await env.click(el);
  }

  // Áp dụng 1 trường, đọc lại để xác nhận. Trả về true nếu có click (có thay đổi), false nếu đã đúng sẵn.
  async function applyField(env, field, desired) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      checkAbort(env);
      const panel = await ensurePanelOpen(env);
      const current = readField[field](env, panel);
      if (sameValue(field, current, desired)) {
        env.log(`${field}: đã là "${desired}", bỏ qua`);
        return attempt > 1;
      }
      env.log(`${field}: "${current}" -> "${desired}" (lần ${attempt})`);
      if (field === "model") await pickModel(env, panel, desired);
      else await pickSimple(env, panel, field, desired);

      const ok = await waitFor(env, () => {
        const p = findPanel(env);
        return p && sameValue(field, readField[field](env, p), desired);
      }, 1800);
      if (ok) return true;
      env.log(`${field}: click xong nhưng trạng thái chưa đổi, thử lại`);
    }
    const panel = findPanel(env);
    const actual = panel ? readField[field](env, panel) : null;
    throw new FlowConfigError(
      ERR.VERIFY_FAILED,
      actual == null
        ? `Không đọc được trạng thái "${field}" để xác nhận (cần chạy DEBUG_FLOW_CONFIG để xem DOM)`
        : `${field} vẫn là "${actual}" sau khi chọn "${desired}"`,
      { field, desired, actual }
    );
  }

  function diff(env, panel, target) {
    const state = readAll(env, panel);
    const mismatches = [];
    for (const f of FIELD_ORDER) {
      if (target[f] != null && !sameValue(f, state[f], target[f])) {
        mismatches.push({ field: f, expected: target[f], actual: state[f] });
      }
    }
    return { state, mismatches };
  }

  // Kiểm tra cuối: mở lại bảng, đọc thực tế, so từng trường.
  async function verifyFlowConfiguration(config, opts = {}) {
    const env = makeEnv(opts);
    const target = validate(config);
    const wasOpen = !!findPanel(env);
    const panel = await ensurePanelOpen(env);
    const { state, mismatches } = diff(env, panel, target);
    if (!wasOpen && !opts.keepOpen) await closePanel(env);
    return { ok: mismatches.length === 0, state, mismatches };
  }

  async function applyFlowConfiguration(config, opts = {}) {
    const env = makeEnv(opts);
    const target = validate(config);
    const changes = [];
    env.log("Áp dụng cấu hình:", target);

    let panel = await ensurePanelOpen(env);
    let expected = readAll(env, panel); // snapshot để phát hiện người dùng tự đổi giữa chừng
    env.log("Cấu hình hiện tại:", expected);

    const assertNoConflict = () => {
      const p = findPanel(env);
      if (!p) return;
      const now = readAll(env, p);
      for (const f of FIELD_ORDER) {
        if (now[f] != null && expected[f] != null && !sameValue(f, now[f], expected[f])) {
          throw new FlowConfigError(
            ERR.USER_CONFLICT,
            `Cấu hình "${f}" bị đổi ngoài automation ("${expected[f]}" -> "${now[f]}")`,
            { field: f, expected: expected[f], actual: now[f] }
          );
        }
      }
    };

    for (let pass = 1; pass <= 3; pass++) {
      for (const field of FIELD_ORDER) {
        if (target[field] == null) continue;
        assertNoConflict();
        const changed = await applyField(env, field, target[field]);
        if (changed) changes.push(field);
        panel = await ensurePanelOpen(env);
        if (field === "mode" && changed) {
          // Đổi mode có thể reset các trường khác: lấy trạng thái đọc lại làm mốc, các bước sau áp dụng lại.
          expected = readAll(env, panel);
          env.log("Đổi mode -> đọc lại toàn bộ cấu hình:", expected);
        } else {
          expected = { ...expected, [field]: target[field] };
        }
      }
      panel = await ensurePanelOpen(env);
      const { mismatches } = diff(env, panel, target);
      if (mismatches.length === 0) break;
      env.log(`Vòng ${pass}: còn lệch`, mismatches);
      expected = readAll(env, panel); // cấu hình bị reset -> áp dụng lại
    }

    await closePanel(env);

    // Phase 5: xác minh cuối cùng bằng cách mở lại bảng.
    const verdict = await verifyFlowConfiguration(config, { ...opts, document: env.document });
    if (!verdict.ok) {
      throw new FlowConfigError(
        ERR.VERIFY_FAILED,
        "Cấu hình thực tế không khớp: " + verdict.mismatches.map((m) => `${m.field} (cần "${m.expected}", đang "${m.actual}")`).join("; "),
        { mismatches: verdict.mismatches }
      );
    }
    env.log("Cấu hình đã xác minh:", verdict.state);
    return { ok: true, config: verdict.state, changes };
  }

  // ───────────────────────── Diagnostics ─────────────────────────
  // Dump cấu trúc bảng cấu hình để tinh chỉnh bộ nhận diện khi DOM Flow thay đổi.
  async function dumpConfigurationDom(opts = {}) {
    const env = makeEnv(opts);
    const wasOpen = !!findPanel(env);
    const panel = await ensurePanelOpen(env);
    const rows = [];
    const walk = (el, depth) => {
      if (depth > 9 || rows.length > 250) return;
      const attrs = {};
      for (const a of el.attributes) {
        if (/^(role|aria-|data-|type|disabled)/.test(a.name)) attrs[a.name] = a.value.slice(0, 60);
      }
      const win = el.ownerDocument.defaultView;
      const bg = win.getComputedStyle(el).backgroundColor;
      rows.push({
        d: depth,
        tag: el.tagName.toLowerCase(),
        cls: (typeof el.className === "string" ? el.className : "").slice(0, 70),
        attrs,
        label: labelOf(el).slice(0, 40),
        bg: parseColor(bg).a > 0.05 ? bg : "",
        sel: explicitState(el)
      });
      for (const c of el.children) walk(c, depth + 1);
    };
    walk(panel, 0);
    const pill = findPill(env, panel);
    const state = readAll(env, panel);
    if (!wasOpen) await closePanel(env);
    return { state, pill: pill ? labelOf(pill) : null, dom: rows };
  }

  const api = {
    ERR, FlowConfigError, RATIOS, COUNTS,
    readFlowConfiguration, applyFlowConfiguration, verifyFlowConfiguration, dumpConfigurationDom
  };
  root.FlowConfig = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
