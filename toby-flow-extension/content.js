// Flow Bridge Content Script - Google Flow Automation Engine v5.0
// PHASE 1-6 FIX: Proper button detection + verified generation confirmation
console.log("[Flow Bridge] Engine v5.0 loaded on:", window.location.href);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ════════════════════════════════════════════════════════════
// GENERATION STATES (Phase 6 - No fake progress)
// ════════════════════════════════════════════════════════════
const GEN_STATE = {
  IDLE: "IDLE",
  PREPARING_INPUT: "PREPARING_INPUT",
  AWAITING_BUTTON: "AWAITING_BUTTON",
  SUBMITTING: "SUBMITTING",
  GENERATION_CONFIRMED: "GENERATION_CONFIRMED",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  UNCONFIRMED: "GENERATION_START_UNCONFIRMED"
};

// ════════════════════════════════════════════════════════════
// 1. BANNER CẢNH BÁO TRÊN TOP
// ════════════════════════════════════════════════════════════
let activeNoticeBanner = null;

function showTopNoticeBanner(text = "Flow Bridge • Đang tự động tạo ảnh trên Google Flow...") {
  if (activeNoticeBanner) return;

  activeNoticeBanner = document.createElement("div");
  activeNoticeBanner.id = "flowbridge-top-notice";
  activeNoticeBanner.style.cssText = `
    position: fixed;
    top: 72px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(18, 22, 31, 0.95);
    color: #e2e8f0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    padding: 9px 20px;
    border-radius: 9999px;
    border: 1px solid rgba(56, 189, 248, 0.35);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6);
    z-index: 999999;
    display: flex;
    align-items: center;
    gap: 10px;
    pointer-events: none;
    animation: fadeInDown 0.3s ease;
  `;

  activeNoticeBanner.innerHTML = `
    <span style="display:inline-block; width:10px; height:10px; border-radius:50%; border:2px solid #38bdf8; border-top-color:transparent; animation:spin 1s linear infinite;"></span>
    <span>${text}</span>
  `;

  document.body.appendChild(activeNoticeBanner);
}

function hideTopNoticeBanner() {
  if (activeNoticeBanner) {
    activeNoticeBanner.remove();
    activeNoticeBanner = null;
  }
}

// ════════════════════════════════════════════════════════════
// 2. FLOATING MONITOR WIDGET (Phase 6 - Spinner + elapsed only)
// ════════════════════════════════════════════════════════════
class FlowFloatingMonitor {
  constructor() {
    this.container = null;
    this.timerInterval = null;
    this.startTime = null;
    this.isStopped = false;
    this.currentState = GEN_STATE.IDLE;
    this.tasks = [];
    this.currentTask = null;
    this.nextId = 1;
    this.counts = { sent: 0, wait: 0, done: 0, err: 0 };
    this.onRetry = null;
    this.init();
  }

  $(sel) {
    return this.container ? this.container.querySelector(sel) : null;
  }

  init() {
    if (document.getElementById("flowbridge-floating-monitor")) return;

    this.container = document.createElement("div");
    this.container.id = "flowbridge-floating-monitor";
    this.container.innerHTML = `
      <div class="monitor-header" data-drag>
        <div class="monitor-header-left">
          <div class="monitor-logo-circle">✦</div>
          <span class="monitor-title">Flow Bridge</span>
          <span class="monitor-tag auto">⚡ Auto</span>
        </div>
        <div class="monitor-header-right">
          <button class="monitor-icon-btn" data-act="min" title="Thu nhỏ">─</button>
          <button class="monitor-icon-btn stop" data-act="stop" title="Dừng tác vụ">⏹</button>
          <button class="monitor-icon-btn" data-act="clear" title="Xóa các thẻ đã xong">🗑</button>
          <button class="monitor-icon-btn" data-act="close" title="Đóng">✕</button>
        </div>
      </div>
      <div class="monitor-stats-bar">
        <div class="stats-counter-row">
          <span class="counter-item sent">▶ <span data-stat="sent">0</span> đã gửi</span>
          <span class="counter-dot">•</span>
          <span class="counter-item wait">⏸ <span data-stat="wait">0</span> chờ Flow</span>
          <span class="counter-dot">•</span>
          <span class="counter-item done">✓ <span data-stat="done">0</span> xong</span>
          <span class="counter-dot">•</span>
          <span class="counter-item err">✕ <span data-stat="err">0</span> lỗi</span>
        </div>
      </div>
      <div class="monitor-progress-row">
        <div class="progress-left">
          <span class="pulse-blue-dot"></span>
          <span class="timer-display" data-timer>Auto Gen 00:00:00</span>
        </div>
        <div class="progress-right">
          <span class="pct-val" data-state-label>Sẵn sàng</span>
        </div>
      </div>
      <div class="monitor-bar-track"><div class="monitor-bar-fill" data-bar style="width:0%"></div></div>
      <div class="monitor-items-feed" data-feed></div>
    `;
    document.body.appendChild(this.container);

    // Kéo thả bằng header
    let drag = null;
    this.container.addEventListener("mousedown", (e) => {
      if (e.button !== 0 || e.target.closest("button") || !e.target.closest("[data-drag]")) return;
      const rect = this.container.getBoundingClientRect();
      drag = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
      this.container.style.right = "auto";
      this.container.style.bottom = "auto";
      this.container.style.left = `${rect.left}px`;
      this.container.style.top = `${rect.top}px`;
      e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (!drag) return;
      const maxLeft = window.innerWidth - this.container.offsetWidth - 6;
      const maxTop = window.innerHeight - this.container.offsetHeight - 6;
      this.container.style.left = `${Math.max(6, Math.min(maxLeft, e.clientX - drag.dx))}px`;
      this.container.style.top = `${Math.max(6, Math.min(maxTop, e.clientY - drag.dy))}px`;
    });
    window.addEventListener("mouseup", () => { drag = null; });

    // Mọi nút dùng event delegation
    this.container.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-act]");
      if (!btn || btn.disabled) return;
      const card = btn.closest("[data-task]");
      const task = card ? this.tasks.find((t) => String(t.id) === card.dataset.task) : null;
      switch (btn.dataset.act) {
        case "min": this.container.classList.toggle("minimized"); break;
        case "close": this.container.style.display = "none"; break;
        case "stop": this.stop(); break;
        case "clear": this.clearFinished(); break;
        case "download": if (task) this.downloadTask(task); break;
        case "delete": if (task) this.removeTask(task); break;
        case "retry": if (task && this.onRetry) this.onRetry(task.payload); break;
      }
    });
  }

  show() {
    this.isStopped = false;
    if (this.container) {
      this.container.style.display = "block";
      this.container.classList.remove("minimized");
    }
  }

  stop() {
    this.isStopped = true;
    this.stopTimer();
    hideTopNoticeBanner();
    const running = this.tasks.find((t) => t.status === "running");
    if (running) this.finishTask(running, "stopped");
    this.setState(GEN_STATE.IDLE, "Đã dừng bởi người dùng");
  }

  fmt(ms) {
    const s = Math.floor(ms / 1000);
    const p = (n) => String(n).padStart(2, "0");
    return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
  }

  startTimer() {
    this.isStopped = false;
    this.startTime = Date.now();
    clearInterval(this.timerInterval);
    const tick = () => {
      const t = this.$("[data-timer]");
      if (t) t.textContent = `Auto Gen ${this.fmt(Date.now() - this.startTime)}`;
      for (const task of this.tasks) {
        if (task.status === "running") this.renderTask(task);
      }
    };
    tick();
    this.timerInterval = setInterval(tick, 1000);
  }

  // Dừng đồng hồ; thời gian cuối được giữ nguyên trên màn hình
  stopTimer() {
    clearInterval(this.timerInterval);
    this.timerInterval = null;
    const t = this.$("[data-timer]");
    if (t && this.startTime) t.textContent = `Auto Gen ${this.fmt(Date.now() - this.startTime)}`;
    const dot = this.$(".pulse-blue-dot");
    if (dot) dot.classList.add("idle");
  }

  setState(state, label = "") {
    this.currentState = state;
    const stateEl = this.$("[data-state-label]");
    const bar = this.$("[data-bar]");
    const labels = {
      [GEN_STATE.IDLE]: "Sẵn sàng",
      [GEN_STATE.PREPARING_INPUT]: "Đang chuẩn bị...",
      [GEN_STATE.AWAITING_BUTTON]: "Chờ nút tạo...",
      [GEN_STATE.SUBMITTING]: "Đang submit...",
      [GEN_STATE.GENERATION_CONFIRMED]: "Đã xác nhận tạo ảnh",
      [GEN_STATE.PROCESSING]: "Flow đang tạo...",
      [GEN_STATE.COMPLETED]: "Hoàn tất",
      [GEN_STATE.FAILED]: "Thất bại",
      [GEN_STATE.UNCONFIRMED]: "Chưa xác nhận"
    };
    if (stateEl) stateEl.textContent = label || labels[state] || state;
    const dot = this.$(".pulse-blue-dot");
    if (dot) {
      const idle = [GEN_STATE.IDLE, GEN_STATE.COMPLETED, GEN_STATE.FAILED, GEN_STATE.UNCONFIRMED].includes(state);
      dot.classList.toggle("idle", idle);
    }
    if (bar) {
      const indeterminate = state === GEN_STATE.PROCESSING || state === GEN_STATE.GENERATION_CONFIRMED;
      bar.classList.toggle("indeterminate", indeterminate);
      bar.classList.toggle("error", state === GEN_STATE.FAILED || state === GEN_STATE.UNCONFIRMED);
      const w = {
        [GEN_STATE.COMPLETED]: "100%", [GEN_STATE.SUBMITTING]: "40%", [GEN_STATE.PREPARING_INPUT]: "15%",
        [GEN_STATE.AWAITING_BUTTON]: "25%", [GEN_STATE.FAILED]: "100%", [GEN_STATE.UNCONFIRMED]: "100%"
      }[state];
      bar.style.width = w || (indeterminate ? "35%" : "5%");
    }
  }

  setCounts(counts) {
    this.counts = { ...this.counts, ...counts };
    for (const k of ["sent", "wait", "done", "err"]) {
      const el = this.$(`[data-stat="${k}"]`);
      if (el) el.textContent = this.counts[k];
    }
  }

  // ── Thẻ tác vụ ──
  addTask(prompt, payload) {
    const task = { id: this.nextId++, prompt, payload, status: "running", start: Date.now(), end: null, results: [], note: "" };
    this.tasks.push(task);
    const card = document.createElement("div");
    card.className = "mon-task-card";
    card.dataset.task = String(task.id);
    card.innerHTML = `
      <div class="mon-thumb-wrap"><img class="mon-task-thumb" alt="" hidden><span class="mon-spinner"></span></div>
      <div class="mon-task-info">
        <div class="mon-task-title"></div>
        <div class="mon-task-sub"><span class="mon-task-duration">00:00</span><span class="mon-task-status-text"></span></div>
      </div>
      <div class="mon-task-actions">
        <button class="mon-card-btn" data-act="retry" title="Tạo lại">↻</button>
        <button class="mon-card-btn" data-act="download" title="Tải ảnh">⬇</button>
        <button class="mon-card-btn" data-act="delete" title="Xóa thẻ">🗑</button>
      </div>`;
    card.querySelector(".mon-task-title").textContent = `#${task.id} ${prompt}`;
    task.el = card;
    const feed = this.$("[data-feed]");
    if (feed) feed.prepend(card);
    this.renderTask(task);
    return task;
  }

  renderTask(task) {
    const card = task.el;
    if (!card) return;
    const elapsed = (task.end || Date.now()) - task.start;
    const s = Math.floor(elapsed / 1000);
    card.querySelector(".mon-task-duration").textContent =
      `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    const statusEl = card.querySelector(".mon-task-status-text");
    const text = { running: "Đang tạo...", done: "Xong", failed: "Lỗi", stopped: "Đã dừng", timeout: "Quá thời gian" }[task.status];
    let cloudText = "";
    if (task.cloud) {
      const c = task.cloud;
      if (c.failed && !c.queued && !c.done) cloudText = `☁ lỗi (${c.errors[0] || ""})`.slice(0, 70);
      else if (c.done >= c.total) cloudText = `☁ đã lưu ${c.done}/${c.total}`;
      else if (c.waitingAuth) cloudText = "☁ cần đăng nhập Supabase";
      else if (c.error) cloudText = `☁ ${c.error}`.slice(0, 70);
      else cloudText = `☁ đang lưu ${c.done}/${c.total}`;
      if (c.failed && (c.queued || c.done)) cloudText += ` · ${c.failed} lỗi`;
    }
    statusEl.textContent = [task.note ? `${text} · ${task.note}` : text, cloudText].filter(Boolean).join(" · ");
    statusEl.className = `mon-task-status-text st-${task.status}`;
    card.classList.toggle("is-running", task.status === "running");

    const img = card.querySelector(".mon-task-thumb");
    const spinner = card.querySelector(".mon-spinner");
    if (task.results.length) {
      if (img.getAttribute("src") !== task.results[0]) img.src = task.results[0];
      img.hidden = false;
      spinner.hidden = true;
    } else {
      img.hidden = true;
      spinner.hidden = task.status !== "running";
    }
    card.querySelector('[data-act="download"]').disabled = task.results.length === 0;
    card.querySelector('[data-act="retry"]').disabled = task.status === "running" || !task.payload;
    card.querySelector('[data-act="delete"]').disabled = task.status === "running";
  }

  finishTask(task, status, { results = [], note = "" } = {}) {
    if (!task || task.status !== "running") return;
    task.status = status;
    task.end = Date.now();
    task.results = results;
    task.note = note;
    this.renderTask(task);
    const wait = Math.max(0, this.counts.wait - 1);
    if (status === "done") this.setCounts({ wait, done: this.counts.done + 1 });
    else this.setCounts({ wait, err: this.counts.err + 1 });
  }

  removeTask(task) {
    if (task.status === "running") return;
    task.el?.remove();
    this.tasks = this.tasks.filter((t) => t !== task);
  }

  clearFinished() {
    for (const t of [...this.tasks]) this.removeTask(t);
  }

  downloadTask(task) {
    task.results.forEach((url, i) => downloadResult(url, `Flow_${task.id}_${Date.now()}_${i + 1}.png`));
  }
}

const monitor = new FlowFloatingMonitor();

// Tải ảnh qua background; blob: URL chỉ đọc được trong trang nên đổi sang data URL trước.
async function downloadResult(url, filename) {
  try {
    let finalUrl = url;
    if (url.startsWith("blob:")) {
      const blob = await (await fetch(url)).blob();
      finalUrl = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = reject;
        fr.readAsDataURL(blob);
      });
    }
    chrome.runtime.sendMessage({ type: "DOWNLOAD_IMAGE", payload: { url: finalUrl, filename } });
  } catch (err) {
    console.error("[Flow Bridge] Download failed:", err);
  }
}

// Helper: Unicode and whitespace normalization (NFC)
function normalizeText(text) {
  if (!text) return "";
  return text
    .normalize("NFC")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

// ════════════════════════════════════════════════════════════
// 3. GENERATE BUTTON CONTROLLER (Scored & Ambiguity-Safe)
// ════════════════════════════════════════════════════════════
const GenerateButtonController = {
  /**
   * Scored, scoped detection of the Generate button inside composerBox.
   * Matches the white circular button [➔] to the right of the model pill (Docx Step 5 / image 4).
   */
  find(composerBox) {
    let box = composerBox;
    if (!box || !box.isConnected || box.getBoundingClientRect().width > 1000) {
      box = Flow.findComposerBox();
    }
    if (!box || !box.isConnected) {
      return { status: "NOT_FOUND", reason: "Khung soạn thảo không tồn tại trong DOM", btn: null };
    }

    const cRect = box.getBoundingClientRect();
    const inputEl = Flow.findInput(box);
    const inputBottom = inputEl ? inputEl.getBoundingClientRect().bottom : cRect.top + 30;

    // Anchor: Model Pill (Nano Banana Pro / Nano Banana / Imagen)
    let pillRect = null;
    const allEls = Array.from(box.querySelectorAll("*"));
    for (const el of allEls) {
      const txt = (el.textContent || "").toLowerCase();
      if (txt.includes("nano banana") || txt.includes("banana pro") || txt.includes("imagen")) {
        const pill = el.closest("button, [role='button'], div") || el;
        const pr = pill.getBoundingClientRect();
        if (pr.width > 35 && pr.height > 16) {
          pillRect = pr;
          break;
        }
      }
    }

    // Gather candidate interactive elements strictly inside composerBox
    const rawCandidates = Array.from(
      box.querySelectorAll("button, [role='button'], md-icon-button, md-filled-icon-button, pat-icon-button, mat-icon-button, [tabindex='0']")
    ).filter((el) => {
      if (!box.contains(el) || el === box) return false;
      if (!el.isConnected) return false;
      const r = el.getBoundingClientRect();
      if (r.width < 16 || r.height < 16 || r.width > 90 || r.height > 90) return false;
      if (r.top < inputBottom - 18) return false; // Must be in bottom toolbar

      const txt = (el.textContent || "").toLowerCase().trim();
      const aria = (el.getAttribute("aria-label") || "").toLowerCase().trim();
      if (txt.includes("tác nhân") || txt.includes("nano banana") || txt.includes("imagen") || txt.includes("banana pro")) return false;
      if (aria.includes("close") || aria.includes("đóng") || txt === "close" || txt === "✕") return false;
      if (txt === "+" && r.left < cRect.left + 80) return false;
      return true;
    });

    // Also collect any clickable element containing SVG/icon in bottom-right area
    const icons = Array.from(box.querySelectorAll("svg, pat-icon, mat-icon, md-icon")).filter(icon => {
      const ir = icon.getBoundingClientRect();
      return ir.top >= inputBottom - 18 && ir.left >= cRect.left + 80;
    });
    for (const icon of icons) {
      const p = icon.closest("button, [role='button'], md-icon-button, md-filled-icon-button, div") || icon;
      if (box.contains(p) && !rawCandidates.includes(p)) {
        const r = p.getBoundingClientRect();
        if (r.width >= 16 && r.height >= 16 && r.width <= 90 && r.height <= 90) {
          const txt = (p.textContent || "").toLowerCase().trim();
          const aria = (p.getAttribute("aria-label") || "").toLowerCase().trim();
          if (!txt.includes("tác nhân") && !txt.includes("nano banana") && !aria.includes("close") && txt !== "✕") {
            rawCandidates.push(p);
          }
        }
      }
    }

    if (rawCandidates.length === 0) {
      return { status: "NOT_FOUND", reason: "Không tìm thấy nút bấm phù hợp trong khung soạn thảo", btn: null };
    }

    // Score candidates
    const scored = rawCandidates.map((btn) => {
      const r = btn.getBoundingClientRect();
      const txt = (btn.textContent || "").trim().toLowerCase();
      const aria = (btn.getAttribute("aria-label") || "").toLowerCase();
      let score = 0;

      // 1. Dimension: roughly square/circular ~22-55px
      const isCircular = Math.abs(r.width - r.height) <= 12 && r.width >= 22 && r.width <= 55;
      if (isCircular) score += 30;

      // 2. Position: right neighbor of model pill (Step 5 docx)
      if (pillRect) {
        const isRightNeighbor = r.left >= pillRect.right - 10 && r.left <= pillRect.right + 75;
        const isVertAligned = Math.abs((r.top + r.height / 2) - (pillRect.top + pillRect.height / 2)) <= 22;
        if (isRightNeighbor && isVertAligned) score += 45;
      }

      // 3. Position: near right edge of composer
      const distFromRight = cRect.right - r.right;
      if (distFromRight >= 0 && distFromRight <= 70) score += 25;

      // 4. Semantics & icon content (Arrow icon [➔])
      const hasArrowIcon = txt === "arrow_forward" || txt === "send" || txt === "➔" || txt === "→" ||
                           aria.includes("generate") || aria.includes("tạo") || aria.includes("send");
      const hasSvg = !!btn.querySelector("svg, pat-icon, mat-icon, md-icon");
      if (hasArrowIcon) score += 35;
      else if (hasSvg) score += 20;

      // 5. Visual styling: White background circle when active (as in Docx image 4)
      try {
        const comp = window.getComputedStyle(btn);
        const bg = comp.backgroundColor || "";
        if (bg.includes("255, 255, 255") || bg.includes("rgb(255") || bg === "#ffffff" || bg === "white") {
          score += 25;
        }
      } catch (_) {}

      return { btn, score, rect: r, tag: btn.tagName, aria, txt };
    });

    scored.sort((a, b) => b.score - a.score);

    // Ambiguity Check: Multiple candidates with competing top scores
    if (scored.length > 1 && scored[0].score >= 50 && scored[1].score >= 50 && Math.abs(scored[0].score - scored[1].score) < 10) {
      console.warn("[Flow Bridge] AMBIGUOUS generate buttons detected:", scored);
      return {
        status: "AMBIGUOUS",
        reason: `Phát hiện ${scored.length} nút ứng viên không thể phân biệt an toàn`,
        btn: null,
        candidates: scored
      };
    }

    const winner = scored[0];
    if (winner.score < 30) {
      return { status: "LOW_CONFIDENCE", reason: "Điểm tin cậy ứng viên quá thấp (<30)", btn: null, candidates: scored };
    }

    return {
      status: "FOUND",
      btn: winner.btn,
      confidence: winner.score,
      candidates: scored
    };
  },

  /**
   * Phase 2: Verify button readiness.
   * Strictly verifies DOM attachment, visibility, and disabled state.
   */
  verifyReady(btn) {
    if (!btn) return { ready: false, reason: "Phần tử nút không tồn tại" };
    if (!btn.isConnected) return { ready: false, reason: "Nút đã bị tách khỏi DOM (detached)" };

    const r = btn.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return { ready: false, reason: "Kích thước nút bằng 0 (không hiển thị)" };

    // Check disabled state strictly without tampering
    const isDisabled = btn.disabled ||
                       btn.hasAttribute("disabled") ||
                       btn.getAttribute("aria-disabled") === "true";
    if (isDisabled) {
      return { ready: false, reason: "Nút Tạo ảnh đang ở trạng thái disabled (chờ kích hoạt)" };
    }

    const style = window.getComputedStyle(btn);
    if (style.visibility === "hidden" || style.display === "none" || style.opacity === "0") {
      return { ready: false, reason: "Nút bị ẩn trong CSS (visibility/display/opacity)" };
    }

    return { ready: true, reason: "OK", btn };
  },

  /**
   * Phase 4: Clean, robust click execution.
   * Resolves web component target, commits text WITHOUT blurring, and dispatches full click.
   */
  async click(btn, inputEl) {
    if (!btn || !btn.isConnected) return false;

    // Step 1: Commit text into framework state WITHOUT BLURRING
    if (inputEl && inputEl.isConnected) {
      console.log("[Flow Bridge][GenerateButtonController] Committing input text without blur...");
      inputEl.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      inputEl.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      await sleep(60);
    }

    // Step 2: Diagnostic highlight feedback (brief flash ~600ms so it doesn't stay green forever)
    const origOutline = btn.style.outline;
    const origShadow = btn.style.boxShadow;
    btn.style.outline = "4px solid #22c55e";
    btn.style.boxShadow = "0 0 20px 6px #22c55e";
    setTimeout(() => {
      btn.style.outline = origOutline;
      btn.style.boxShadow = origShadow;
    }, 600);

    // Step 2b: Click chuột thật (isTrusted) qua background/CDP — Flow bỏ qua click giả lập
    try {
      const br = btn.getBoundingClientRect();
      const res = await chrome.runtime.sendMessage({
        type: "TRUSTED_CLICK",
        payload: { x: Math.round(br.left + br.width / 2), y: Math.round(br.top + br.height / 2) }
      });
      if (res && res.success) {
        console.log("[Flow Bridge] Trusted click dispatched");
        GenerateButtonController.lastClickTrusted = true;
        return true;
      }
      console.warn("[Flow Bridge] Trusted click failed, fallback to synthetic:", res && res.error);
    } catch (e) {
      console.warn("[Flow Bridge] Trusted click error, fallback to synthetic:", e);
    }
    GenerateButtonController.lastClickTrusted = false;

    // Step 3: Resolve exact interactive target (inner button or host element)
    let target = btn;
    if (btn.shadowRoot) {
      const inner = btn.shadowRoot.querySelector("button, [role='button']");
      if (inner) target = inner;
    } else {
      const innerBtn = btn.querySelector("button, [role='button']");
      if (innerBtn) target = innerBtn;
    }

    const r = target.getBoundingClientRect();
    const cx = Math.round(r.left + r.width / 2);
    const cy = Math.round(r.top + r.height / 2);

    console.log("[Flow Bridge][GenerateButtonController] Submitting action to:", {
      btnTag: btn.tagName,
      targetTag: target.tagName,
      cx, cy
    });

    try {
      const common = {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        clientX: cx,
        clientY: cy,
        screenX: cx,
        screenY: cy,
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true
      };

      // 1. Dispatch full pointer & mouse sequence directly on target AND btn (NOT just on inner svg path!)
      target.focus?.();
      target.dispatchEvent(new PointerEvent("pointerdown", { ...common, button: 0, buttons: 1 }));
      target.dispatchEvent(new MouseEvent("mousedown", { ...common, button: 0, buttons: 1 }));
      target.dispatchEvent(new PointerEvent("pointerup", { ...common, button: 0, buttons: 0 }));
      target.dispatchEvent(new MouseEvent("mouseup", { ...common, button: 0, buttons: 0 }));
      target.dispatchEvent(new MouseEvent("click", { ...common, button: 0 }));

      if (typeof target.click === "function") {
        target.click();
      }

      if (btn !== target) {
        btn.dispatchEvent(new MouseEvent("click", { ...common, button: 0 }));
        if (typeof btn.click === "function") {
          btn.click();
        }
      }

      // 2. Also dispatch at coordinate element if it is a ripple or overlay layer
      const topEl = document.elementFromPoint(cx, cy);
      if (topEl && topEl !== target && topEl !== btn && (target.contains(topEl) || btn.contains(topEl))) {
        topEl.dispatchEvent(new MouseEvent("click", { ...common, button: 0 }));
      }

      // 3. UNIVERSAL COMPOSER SUBMIT: Keyboard Enter on inputEl
      // In Google Flow (and web chat composers), Enter triggers prompt submission!
      if (inputEl && inputEl.isConnected) {
        await sleep(100);
        const currentText = (inputEl.textContent || inputEl.innerText || "").trim();
        if (currentText.length > 0) {
          console.log("[Flow Bridge] Dispatching Enter submission on inputEl...");
          inputEl.focus?.();
          const enterOpts = {
            key: "Enter",
            code: "Enter",
            keyCode: 13,
            which: 13,
            charCode: 13,
            bubbles: true,
            cancelable: true,
            composed: true,
            view: window
          };
          inputEl.dispatchEvent(new KeyboardEvent("keydown", enterOpts));
          inputEl.dispatchEvent(new KeyboardEvent("keypress", enterOpts));
          inputEl.dispatchEvent(new KeyboardEvent("keyup", enterOpts));
        }
      }

      return true;
    } catch (err) {
      console.error("[Flow Bridge] Click dispatch error:", err);
      return false;
    }
  }
};

// ════════════════════════════════════════════════════════════
// Phase 5: Verify generation actually started in Google Flow
// Records baseline BEFORE click to avoid false positives from
// pre-existing loading indicators on the page.
// ════════════════════════════════════════════════════════════
function snapshotGenerationBaseline(composerBox) {
  const inputEl = composerBox ? Flow.findInput(composerBox) : null;
  const inputText = inputEl ? (inputEl.value || inputEl.innerText || inputEl.textContent || "").trim() : "";
  const loadingCount = document.querySelectorAll(
    "[class*='loading'], [class*='spinner'], [class*='generating'], [class*='progress']"
  ).length;
  const cardCount = document.querySelectorAll(
    "[class*='card'], [class*='result'], [class*='image-item']"
  ).length;
  const imgCount = document.querySelectorAll("img[src]").length;
  return { inputEl, inputText, loadingCount, cardCount, imgCount };
}

async function verifyGenerationStarted(baseline, timeoutMs = 7000) {
  const startTime = Date.now();
  const { inputEl, inputText, loadingCount: baseLoading, cardCount: baseCards, imgCount: baseImgs } = baseline;

  while (Date.now() - startTime < timeoutMs) {
    await sleep(250);

    // Signal 1: Input was cleared (prompt consumed by Google Flow)
    if (inputEl) {
      const currentText = (inputEl.value || inputEl.innerText || inputEl.textContent || "").trim();
      if (currentText === "" && inputText.length > 0) {
        console.log("[Flow Bridge] GENERATION CONFIRMED: Input cleared");
        return { confirmed: true, signal: "input_cleared" };
      }
    }

    // Signal 2: NEW loading indicators appeared (count increased from baseline)
    const nowLoading = document.querySelectorAll(
      "[class*='loading'], [class*='spinner'], [class*='generating'], [class*='progress']"
    ).length;
    if (nowLoading > baseLoading) {
      console.log(`[Flow Bridge] GENERATION CONFIRMED: Loading count ${baseLoading} → ${nowLoading}`);
      return { confirmed: true, signal: "loading_indicator" };
    }

    // Signal 3: NEW image cards appeared
    const nowCards = document.querySelectorAll(
      "[class*='card'], [class*='result'], [class*='image-item']"
    ).length;
    if (nowCards > baseCards) {
      console.log(`[Flow Bridge] GENERATION CONFIRMED: Cards ${baseCards} → ${nowCards}`);
      return { confirmed: true, signal: "new_card" };
    }

    // Signal 4: New images loaded
    const nowImgs = document.querySelectorAll("img[src]").length;
    if (nowImgs > baseImgs) {
      console.log(`[Flow Bridge] GENERATION CONFIRMED: Images ${baseImgs} → ${nowImgs}`);
      return { confirmed: true, signal: "new_image" };
    }
  }

  return { confirmed: false, signal: "timeout" };
}

// ════════════════════════════════════════════════════════════
// Chờ ảnh kết quả: ảnh mới (không có trước khi submit), đã tải xong, kích thước đủ lớn,
// và src ổn định ≥ 1.5s (loại ảnh preview/placeholder đang đổi src).
// ════════════════════════════════════════════════════════════
const ERROR_TEXT_RE = /(không thể tạo|tạo không thành công|không thành công|đã xảy ra lỗi|something went wrong|failed to generate|unable to generate|vi phạm|violat)/i;

async function waitForNewImages(baselineEls, expectedCount, { timeoutMs = 240000, shouldStop = () => false } = {}) {
  const start = Date.now();
  const seen = new Map(); // img -> { src, since }
  const baselineHasError = ERROR_TEXT_RE.test(document.body.innerText || "");
  const STABLE_MS = 1500;
  let lastReadyCount = 0;
  let lastChange = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (shouldStop()) return { status: "stopped" };
    await sleep(500);

    const now = Date.now();
    const ready = [];
    const readyImgs = new Map(); // src -> img
    for (const img of document.querySelectorAll("img")) {
      if (baselineEls.has(img) || img.closest("[id^='flowbridge-']")) continue;
      const src = img.currentSrc || img.src || "";
      if (!src) continue;
      const rec = seen.get(img);
      if (!rec || rec.src !== src) seen.set(img, { src, since: now });
      const r = img.getBoundingClientRect();
      if (!img.complete || img.naturalWidth < 256 || r.width < 80 || r.height < 80) continue;
      if (now - seen.get(img).since < STABLE_MS) continue;
      ready.push(src);
      if (!readyImgs.has(src)) readyImgs.set(src, img);
    }

    const urls = [...new Set(ready)];
    if (urls.length !== lastReadyCount) {
      lastReadyCount = urls.length;
      lastChange = now;
    }
    const pack = (list) => ({ status: "done", urls: list, imgs: list.map((u) => readyImgs.get(u)) });
    if (urls.length >= expectedCount) return pack(urls.slice(0, Math.max(expectedCount, 1)));
    // Có ít nhất 1 ảnh và không thêm ảnh nào trong 8s -> chấp nhận (Flow có thể trả ít hơn yêu cầu)
    if (urls.length > 0 && now - lastChange > 8000) return pack(urls);

    if (!baselineHasError) {
      const m = (document.body.innerText || "").match(ERROR_TEXT_RE);
      if (m) return { status: "error", message: m[0] };
    }
  }
  return { status: "timeout" };
}

// ════════════════════════════════════════════════════════════
// Cloud (Supabase): lấy ảnh GỐC từ <img> rồi đưa vào hàng đợi upload ở background
// ════════════════════════════════════════════════════════════
const cloudMsg = (type, payload) => chrome.runtime.sendMessage({ type, payload });

// lh3.googleusercontent.com/...=s512 / =w512-h512 là thumbnail: "=s0" trả bản gốc
function originalUrlCandidates(src) {
  const out = [];
  if (/googleusercontent\.com/i.test(src) && /=(?:[swh]\d+[^/?#]*)$/i.test(src)) {
    out.push(src.replace(/=(?:[swh]\d+[^/?#]*)$/i, "=s0"));
  }
  out.push(src);
  return [...new Set(out)];
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(",")[1] || "");
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

async function fetchImageBlob(url) {
  try {
    const res = await fetch(url, { credentials: "include" });
    if (res.ok) return await res.blob();
  } catch (_) { /* CORS/blob: -> thử qua background */ }
  if (url.startsWith("blob:")) throw new Error("BLOB_INACCESSIBLE: không đọc được blob URL");
  const r = await cloudMsg("CLOUD_FETCH_IMAGE", { url });
  if (!r || !r.ok) throw new Error("FETCH_FAILED: " + ((r && r.error) || "không có phản hồi"));
  const bin = atob(r.base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: r.type || "" });
}

// Thử từng URL, chọn ảnh lớn nhất; từ chối nếu chỉ lấy được thumbnail.
async function extractOriginalImage(img) {
  const src = img.currentSrc || img.src;
  let best = null;
  let lastErr = null;
  for (const url of originalUrlCandidates(src)) {
    try {
      const blob = await fetchImageBlob(url);
      if (!blob.size) throw new Error("EMPTY: ảnh rỗng");
      const bmp = await createImageBitmap(blob); // vừa lấy kích thước vừa kiểm tra ảnh không hỏng
      const dim = { width: bmp.width, height: bmp.height };
      bmp.close?.();
      if (!best || dim.width * dim.height > best.width * best.height) best = { blob, url, ...dim };
      if (Math.max(dim.width, dim.height) >= 512) break;
    } catch (e) {
      lastErr = e;
    }
  }
  if (!best) throw new Error("IMAGE_NOT_READABLE: " + (lastErr ? lastErr.message : "không đọc được ảnh"));
  if (Math.max(best.width, best.height) < 512) {
    throw new Error(`THUMBNAIL: chỉ lấy được ảnh ${best.width}x${best.height}, không phải ảnh gốc`);
  }
  return { base64: await blobToBase64(best.blob), width: best.width, height: best.height, source: best.url };
}

// Đưa ảnh vào hàng đợi cloud; cập nhật trạng thái trên thẻ. KHÔNG tải về máy.
async function saveImagesToCloud(task, jobId, imgs, meta) {
  task.cloud = { total: imgs.length, queued: 0, done: 0, failed: 0, waitingAuth: false, errors: [] };
  monitor.renderTask(task);
  for (let i = 0; i < imgs.length; i++) {
    try {
      const ex = await extractOriginalImage(imgs[i]);
      const r = await cloudMsg("CLOUD_ENQUEUE", {
        jobId, meta: { ...meta, index: i }, base64: ex.base64, width: ex.width, height: ex.height, source: ex.source
      });
      if (!r || !r.ok) throw new Error(`${r && r.code}: ${r && r.error}`);
      task.cloud.queued++;
    } catch (e) {
      task.cloud.failed++;
      task.cloud.errors.push(e.message);
      console.error("[Flow Bridge][Cloud] Không thể đưa ảnh vào hàng đợi:", e);
    }
    monitor.renderTask(task);
  }
  const tail = await cloudMsg("CLOUD_FINISH_JOB", { jobId, expected: meta.expected }).catch(() => null);
  return tail;
}

// ════════════════════════════════════════════════════════════
// DOM Finders
// ════════════════════════════════════════════════════════════
const Flow = {
  findComposerBox() {
    // 1. Quét tìm card thanh công cụ ở nửa dưới màn hình (chiều cao top > 35% viewport)
    const allDivs = Array.from(document.querySelectorAll("div, section, footer, form, main"));
    const bottomCandidates = allDivs.filter((el) => {
      if (!el.isConnected) return false;
      if (el.id && el.id.startsWith("flowbridge-")) return false; // Không lấy UI extension
      const r = el.getBoundingClientRect();
      if (r.width < 240 || r.height < 35 || r.height > 450) return false;
      if (r.top < window.innerHeight * 0.35) return false; // Bắt buộc ở nửa dưới màn hình, không lấy thanh trên cùng!

      const txt = (el.textContent || "").toLowerCase();
      const hasKeywords = txt.includes("bạn muốn tạo") ||
                          txt.includes("tác nhân") ||
                          txt.includes("nano banana") ||
                          txt.includes("banana pro") ||
                          txt.includes("imagen") ||
                          txt.includes("what do you want to create");
      return hasKeywords;
    });

    if (bottomCandidates.length > 0) {
      // Sắp xếp lấy thẻ có diện tích nhỏ nhất (thẻ sát nhất với composer)
      bottomCandidates.sort((a, b) => {
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        return (ra.width * ra.height) - (rb.width * rb.height);
      });
      return bottomCandidates[0];
    }

    // 2. Dự phòng: Tìm phần tử có placeholder hoặc text "Bạn muốn tạo những gì"
    const candidates2 = Array.from(document.querySelectorAll("*")).filter((el) => {
      if (el.id && el.id.startsWith("flowbridge-")) return false;
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.35) return false;
      const ph = (el.getAttribute("placeholder") || el.getAttribute("aria-placeholder") || "").toLowerCase();
      const txt = (el.textContent || "").toLowerCase();
      return ph.includes("bạn muốn tạo") || txt.includes("bạn muốn tạo những gì");
    });

    if (candidates2.length > 0) {
      let p = candidates2[0].parentElement;
      while (p && p !== document.body) {
        const r = p.getBoundingClientRect();
        if (r.width >= 240 && r.height >= 40 && r.height <= 450) return p;
        p = p.parentElement;
      }
      return candidates2[0];
    }

    return null;
  },

  findInput(composerBox) {
    const root = composerBox || Flow.findComposerBox() || document;
    
    // Lọc phần tử hợp lệ ở nửa dưới màn hình
    const filterValid = (el) => {
      if (!el || !el.isConnected) return false;
      if (el.id && el.id.startsWith("flowbridge-")) return false;
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.35) return false; // Không lấy search bar ở trên cùng!
      return r.width > 30;
    };

    // 1. Selector trực tiếp: textarea, input, contenteditable, role="textbox"
    const selectors = [
      'textarea',
      '[contenteditable="true"]',
      '[contenteditable=""]',
      'input[type="text"]',
      'input:not([type])',
      '[role="textbox"]',
      '[placeholder*="tạo"]',
      '[placeholder*="create"]'
    ];

    for (const sel of selectors) {
      const els = Array.from(root.querySelectorAll(sel)).filter(filterValid);
      if (els.length > 0) return els[0];
    }

    // 2. Quét xuyên Shadow DOM nếu có
    const all = Array.from(root.querySelectorAll("*"));
    for (const el of all) {
      if (el.shadowRoot) {
        for (const sel of selectors) {
          const inner = el.shadowRoot.querySelector(sel);
          if (inner && filterValid(inner)) return inner;
        }
      }
    }

    // 3. Tìm phần tử có text "Bạn muốn tạo những gì" để click kích hoạt
    for (const el of all) {
      const txt = (el.textContent || "").trim().toLowerCase();
      if (txt.includes("bạn muốn tạo những gì") && filterValid(el)) {
        return el;
      }
    }

    return null;
  },

  findSettingsPill() {
    const all = Array.from(document.querySelectorAll("button, div[role='button'], div, span"));
    for (const el of all) {
      const txt = (el.textContent || "").toLowerCase();
      if ((txt.includes("nano banana") || txt.includes("imagen") || txt.includes("x1") || txt.includes("x2")) && el.getBoundingClientRect().top > window.innerHeight * 0.5) {
        return el.closest("button") || el.closest("[role='button']") || el;
      }
    }
    return null;
  },

  // Kept for backward compatibility with DEBUG_DOM
  findSendButton(composerBox) {
    return GenerateButtonController.find(composerBox);
  },

  findThreeDotMenu() {
    const buttons = Array.from(document.querySelectorAll("button, [role='button']")).filter((b) => {
      const txt = (b.textContent || "").trim();
      const aria = (b.getAttribute("aria-label") || "").toLowerCase();
      return txt === "more_vert" || txt === "⋮" || aria.includes("more") || aria.includes("thêm");
    });
    return buttons[0] || null;
  },

  // ── BƯỚC 2: TÌM VÀ BẤM NÚT "DỰ ÁN MỚI" TRÊN TRANG CHỦ ──
  findNewProjectButton() {
    const all = Array.from(document.querySelectorAll("button, div[role='button'], div, a, span"));
    for (const el of all) {
      const txt = (el.innerText || el.textContent || "").trim();
      if (txt === "+ Dự án mới" || txt === "Dự án mới" || txt === "+ New project" || txt === "New project") {
        return el.closest("button, [role='button']") || el;
      }
    }
    for (const el of all) {
      const aria = (el.getAttribute("aria-label") || el.getAttribute("title") || "").toLowerCase();
      if (aria.includes("dự án mới") || aria.includes("new project") || aria.includes("create project")) {
        return el.closest("button, [role='button']") || el;
      }
    }
    return null;
  },

  async waitForProjectReady(timeoutMs = 15000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      if (window.location.href.includes("/project/")) {
        const composer = Flow.findComposerBox();
        if (composer) return true;
      }
      await sleep(400);
    }
    return !!Flow.findComposerBox();
  },
};

// ════════════════════════════════════════════════════════════
// 4. MAIN GENERATION FLOW (5 Bước thực hiện chuẩn tài liệu)
// ════════════════════════════════════════════════════════════
let flowRunning = false;

async function runFlowGeneration(payload) {
  const { prompts = [], aspectRatio = "9:16", batchCount = 1, model = "", autoDownload = true } = payload;
  if (!prompts || prompts.length === 0) return;

  const prompt = prompts[0];
  console.log("[Flow Bridge] === BẮT ĐẦU QUY TRÌNH GEN ẢNH ===", { prompt, aspectRatio, batchCount });

  if (flowRunning) {
    console.warn("[Flow Bridge] Đang có tác vụ chạy, bỏ qua yêu cầu mới");
    return;
  }
  flowRunning = true;

  showTopNoticeBanner();
  monitor.show();
  monitor.startTimer();
  monitor.setCounts({ sent: monitor.counts.sent + 1, wait: monitor.counts.wait + 1 });
  monitor.currentTask = monitor.addTask(prompt, payload);
  const jobId = crypto.randomUUID();
  monitor.currentTask.jobId = jobId;
  monitor.onRetry = (p) => runFlowGeneration(p);

  try {
    // ── BƯỚC 2: Kiểm tra trang chủ & Tự động chọn "Dự án mới" (Docx Bước 2) ──
    const isProjectUrl = window.location.href.includes("/project/");
    if (!isProjectUrl) {
      monitor.setState(GEN_STATE.PREPARING_INPUT, "Trang chủ: Đang mở 'Dự án mới' (Bước 2)...");
      const newProjBtn = Flow.findNewProjectButton();
      if (newProjBtn) {
        console.log("[Flow Bridge][Bước 2] Đã tìm thấy nút 'Dự án mới', tiến hành click...");
        newProjBtn.click();
        const navOk = await Flow.waitForProjectReady(15000);
        if (!navOk) {
          throw new Error("Không thể khởi tạo hoặc vào 'Dự án mới' từ trang chủ.");
        }
        await sleep(1000);
      } else {
        console.warn("[Flow Bridge] Đang ở URL không phải /project/ nhưng không thấy nút 'Dự án mới'");
      }
    }

    // ── BƯỚC 3: Tìm khung soạn thảo và nhập Prompt (Docx Bước 3) ──
    monitor.setState(GEN_STATE.PREPARING_INPUT, "Đang tìm khung soạn thảo (Bước 3)...");
    let composerBox = Flow.findComposerBox();
    for (let r = 0; r < 15; r++) {
      if (composerBox) break;
      await sleep(250);
      composerBox = Flow.findComposerBox();
    }
    if (!composerBox) throw new Error("Không tìm thấy khung soạn thảo ở thanh công cụ dưới cùng");

    // ── BƯỚC 4: Cấu hình ảnh (Mode, Tỷ lệ, Model, Số lượng) TRƯỚC khi nhập prompt ──
    // Thất bại -> dừng hẳn, không nhập prompt và không bấm Generate.
    monitor.setState(GEN_STATE.PREPARING_INPUT, "Cấu hình thông số tạo ảnh (Bước 4)...");
    try {
      const cfgResult = await FlowConfig.applyFlowConfiguration(
        { mode: "image", aspectRatio, model, outputCount: batchCount },
        { shouldAbort: () => monitor.isStopped }
      );
      console.log("[Flow Bridge][Bước 4] Cấu hình đã xác minh:", cfgResult);
    } catch (cfgErr) {
      if (cfgErr && cfgErr.code) {
        console.error("[Flow Bridge][Bước 4]", cfgErr.code, cfgErr.details);
        throw new Error(`Cấu hình Flow thất bại — ${cfgErr.message}`);
      }
      throw cfgErr;
    }
    if (monitor.isStopped) throw new Error("USER_CANCELLED: Tác vụ đã bị người dùng hủy bỏ");
    composerBox = Flow.findComposerBox() || composerBox;

    // Click kích hoạt composer
    const cRect0 = composerBox.getBoundingClientRect();
    let inputEl = Flow.findInput(composerBox);
    const clickPoint = inputEl || document.elementFromPoint(Math.round(cRect0.left + 80), Math.round(cRect0.top + 20)) || composerBox;
    clickPoint.click?.();
    clickPoint.focus?.();
    await sleep(200);

    inputEl = Flow.findInput(composerBox) || inputEl;
    if (!inputEl) throw new Error("Không tìm thấy ô nhập prompt 'Bạn muốn tạo những gì?'");

    console.log("[Flow Bridge][Bước 3] Tìm thấy ô prompt:", inputEl.tagName, inputEl.className);
    inputEl.focus?.();

    // Điền prompt đa chiến lược (hỗ trợ cả textarea, input và contenteditable)
    const promptNorm = normalizeText(prompt);
    let inserted = false;

    if (inputEl.tagName === "TEXTAREA" || inputEl.tagName === "INPUT") {
      const proto = inputEl.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      if (setter) {
        setter.call(inputEl, prompt);
      } else {
        inputEl.value = prompt;
      }
      inputEl.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      inputEl.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      inputEl.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: prompt }));
      inserted = true;
    } else {
      // ContentEditable hoặc div
      try {
        const sel = window.getSelection();
        if (sel) {
          const range = document.createRange();
          range.selectNodeContents(inputEl);
          sel.removeAllRanges();
          sel.addRange(range);
        }
        document.execCommand("selectAll", false, null);
        document.execCommand("delete", false, null);
      } catch (_) {}

      const execOk = document.execCommand("insertText", false, prompt);
      const valNow = normalizeText(inputEl.innerText || inputEl.textContent || "");
      if (!execOk || !valNow.includes(promptNorm)) {
        inputEl.innerText = prompt;
        inputEl.textContent = prompt;
      }
      inputEl.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, cancelable: true, composed: true, inputType: "insertText", data: prompt }));
      inputEl.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: prompt }));
      inputEl.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      inputEl.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      inserted = true;
    }

    // Kích hoạt phím End để đảm bảo con trỏ ở cuối và framework nhận dữ liệu
    inputEl.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "End", code: "End" }));
    inputEl.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "End", code: "End" }));
    await sleep(250);

    const readText = normalizeText(inputEl.value || inputEl.innerText || inputEl.textContent || "");
    console.log("[Flow Bridge][Bước 3] Kết quả nhập prompt:", { expected: promptNorm, actual: readText });
    const squash = (t) => t.replace(/\s+/g, "");
    if (!squash(readText).includes(squash(promptNorm))) {
      throw new Error("Prompt chưa được điền vào ô nhập của Flow (xác minh thất bại), đã dừng trước khi Generate");
    }

    // ── BƯỚC 5: Cuối cùng chọn nút gen ảnh (Mũi tên sang phải màu trắng) ──
    monitor.setState(GEN_STATE.AWAITING_BUTTON, "Tìm nút tạo ảnh (Bước 5)...");
    if (monitor.isStopped) throw new Error("USER_CANCELLED: Tác vụ đã bị người dùng hủy bỏ");

    // Wait for the Generate button to become enabled and ready (polling up to 4000ms)
    // Google Flow's reactive framework needs a moment after prompt injection to validate and enable the button
    let sendBtn = null;
    let btnCheck = { ready: false, reason: "Đang dò tìm nút..." };
    let findResult = null;
    const waitButtonStart = Date.now();

    while (Date.now() - waitButtonStart < 4000) {
      if (monitor.isStopped) throw new Error("USER_CANCELLED: Tác vụ đã bị người dùng hủy bỏ");
      
      composerBox = Flow.findComposerBox() || composerBox;
      if (composerBox && composerBox.isConnected) {
        findResult = GenerateButtonController.find(composerBox);
        if (findResult.status === "FOUND" && findResult.btn) {
          sendBtn = findResult.btn;
          btnCheck = GenerateButtonController.verifyReady(sendBtn);
          if (btnCheck.ready) {
            console.log("[Flow Bridge] Generate button ready!", { confidence: findResult.confidence, btnTag: sendBtn.tagName });
            break;
          }
        }
      }
      await sleep(150);
    }

    if (findResult && findResult.status === "AMBIGUOUS") {
      throw new Error("DỪNG LẠI (AMBIGUOUS): " + findResult.reason);
    }
    // ── PHASE 5: Submit via button click & Enter key ────────────────────
    monitor.setState(GEN_STATE.SUBMITTING, "Đang bấm nút tạo & gửi lệnh...");
    if (monitor.isStopped) throw new Error("USER_CANCELLED: Tác vụ đã bị người dùng hủy bỏ");

    // Snapshot DOM baseline BEFORE click — prevents false positives
    const genBaseline = snapshotGenerationBaseline(composerBox);
    const baselineImgEls = new Set(document.querySelectorAll("img"));
    console.log("[Flow Bridge] Baseline snapshot:", { loading: genBaseline.loadingCount, cards: genBaseline.cardCount, imgs: genBaseline.imgCount, text: genBaseline.inputText.substring(0, 20) });

    if (sendBtn) {
      await GenerateButtonController.click(sendBtn, inputEl);
    } else {
      console.warn("[Flow Bridge] Chưa định vị được nút [➔], tiến hành gửi qua phím Enter");
    }

    // Nếu click thật không dùng được thì dispatch thêm phím Enter trên ô input
    if (!GenerateButtonController.lastClickTrusted && inputEl && inputEl.isConnected) {
      await sleep(80);
      inputEl.focus?.();
      const enterOpts = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true, composed: true, view: window };
      inputEl.dispatchEvent(new KeyboardEvent("keydown", enterOpts));
      inputEl.dispatchEvent(new KeyboardEvent("keypress", enterOpts));
      inputEl.dispatchEvent(new KeyboardEvent("keyup", enterOpts));
    }

    await sleep(400);

    // ── PHASE 6: Verify generation actually started ──────────
    monitor.setState(GEN_STATE.SUBMITTING, "Đang xác nhận Google Flow đã nhận...");
    
    let genResult = await verifyGenerationStarted(genBaseline, 4000);

    // Thử lại 1 lần: tìm lại nút và bấm lần nữa nếu chưa thấy Flow bắt đầu tạo
    if (!genResult.confirmed) {
      console.warn("[Flow Bridge] Chưa xác nhận, thử bấm lại nút tạo...");
      composerBox = Flow.findComposerBox() || composerBox;
      const retry = composerBox ? GenerateButtonController.find(composerBox) : null;
      if (retry && retry.btn && GenerateButtonController.verifyReady(retry.btn).ready) {
        await GenerateButtonController.click(retry.btn, inputEl);
        await sleep(400);
        genResult = await verifyGenerationStarted(genBaseline, 6000);
      }
    }

    if (!genResult.confirmed) {
      // Generation may have started but we couldn't detect it
      // Do NOT mark as completed, report as unconfirmed
      console.warn("[Flow Bridge] " + GEN_STATE.UNCONFIRMED, genResult);
      monitor.setState(GEN_STATE.UNCONFIRMED, "Chưa xác nhận bắt đầu tạo");
      monitor.finishTask(monitor.currentTask, "failed", { note: "chưa xác nhận bắt đầu" });
      showTopNoticeBanner("⚠ Flow Bridge: Chưa xác nhận Google Flow bắt đầu tạo. Vui lòng kiểm tra trang Flow.");
      return;
    }

    console.log("[Flow Bridge] Generation confirmed via signal:", genResult.signal);
    monitor.setState(GEN_STATE.GENERATION_CONFIRMED, "✓ Google Flow đã bắt đầu tạo!");

    // ── PHASE 7: Chờ kết quả (phát hiện ảnh mới thật sự, không đoán) ──
    monitor.setState(GEN_STATE.PROCESSING, "Flow đang tạo ảnh...");
    const waitResult = await waitForNewImages(baselineImgEls, batchCount, {
      timeoutMs: 240000,
      shouldStop: () => monitor.isStopped
    });

    hideTopNoticeBanner();

    if (waitResult.status === "stopped") {
      return; // monitor.stop() đã cập nhật thẻ
    }

    if (waitResult.status === "done") {
      monitor.setState(GEN_STATE.COMPLETED, `Hoàn tất · ${waitResult.urls.length} ảnh`);
      monitor.finishTask(monitor.currentTask, "done", { results: waitResult.urls });
      const cloudState = await cloudMsg("CLOUD_STATUS").catch(() => null);
      if (cloudState && cloudState.ok && cloudState.enabled) {
        // Auto Save Cloud bật: chỉ lưu lên Supabase, không tự tải về máy
        await saveImagesToCloud(monitor.currentTask, jobId, waitResult.imgs, {
          prompt, model, aspectRatio, expected: batchCount
        });
      } else if (autoDownload) {
        waitResult.urls.forEach((u, i) => downloadResult(u, `Flow_${Date.now()}_${i + 1}.png`));
      }
    } else if (waitResult.status === "error") {
      monitor.setState(GEN_STATE.FAILED, "Flow báo lỗi");
      monitor.finishTask(monitor.currentTask, "failed", { note: waitResult.message });
    } else {
      // Hết thời gian: KHÔNG tuyên bố hoàn tất
      monitor.setState(GEN_STATE.UNCONFIRMED, "Quá thời gian chờ");
      monitor.finishTask(monitor.currentTask, "timeout");
    }

  } catch (err) {
    console.error("[Flow Bridge] Generation error:", err);
    const cancelled = String(err.message).startsWith("USER_CANCELLED");
    monitor.setState(GEN_STATE.FAILED, "Lỗi: " + err.message);
    monitor.finishTask(monitor.currentTask, cancelled ? "stopped" : "failed", { note: String(err.message).slice(0, 60) });
    hideTopNoticeBanner();
    if (!cancelled) alert("Flow Bridge: " + err.message);
  } finally {
    flowRunning = false;
    monitor.stopTimer();
  }
}

// ════════════════════════════════════════════════════════════
// 5. MESSAGE LISTENERS
// ════════════════════════════════════════════════════════════
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "RUN_AUTOMATION") {
    runFlowGeneration(message.payload);
    sendResponse({ success: true });
    return true;
  }

  if (message.type === "CLOUD_UPDATE" && message.item) {
    const it = message.item;
    const task = monitor.tasks.find((t) => t.jobId === it.jobId);
    if (task && task.cloud) {
      // Tính lại từ trạng thái từng item của job này (nguồn: hàng đợi ở background)
      task.cloud.items = { ...(task.cloud.items || {}), [it.id]: it.status };
      const st = Object.values(task.cloud.items);
      task.cloud.done = st.filter((x) => x === "done").length;
      task.cloud.failedUpload = st.filter((x) => x === "failed").length;
      task.cloud.waitingAuth = st.includes("waiting_auth");
      task.cloud.error = it.status === "failed" ? it.error : (task.cloud.error && st.includes("failed") ? task.cloud.error : "");
      monitor.renderTask(task);
    }
    return;
  }

  if (message.type === "GET_FLOW_STATUS") {
    sendResponse({
      connected: true,
      url: window.location.href,
      isProject: window.location.href.includes("/project/")
    });
    return true;
  }

  if (message.type === "STOP_AUTOMATION" || message.type === "STOP_ALL_TASKS") {
    console.log("[Flow Bridge] Received stop request — aborting workflow");
    monitor.stop();
    sendResponse({ success: true, stopped: true });
    return true;
  }

  if (message.type === "DEBUG_DOM") {
    const composer = Flow.findComposerBox();
    const input = Flow.findInput(composer);
    const pill = Flow.findSettingsPill();
    const findResult = composer ? GenerateButtonController.find(composer) : { status: "NO_COMPOSER", reason: "Khung soạn thảo chưa sẵn sàng" };
    const btn = findResult.btn;
    const btnCheck = btn ? GenerateButtonController.verifyReady(btn) : { ready: false, reason: findResult.reason || "Chưa phát hiện nút" };

    // Diagnostic highlights (strictly non-destructive, zero click)
    if (composer) {
      const origOutline = composer.style.outline;
      composer.style.outline = "2px dashed #3b82f6";
      setTimeout(() => { composer.style.outline = origOutline; }, 3000);
    }
    if (btn) {
      const origBtnOutline = btn.style.outline;
      const origBtnShadow = btn.style.boxShadow;
      btn.style.outline = "4px solid #22c55e";
      btn.style.boxShadow = "0 0 20px 6px #22c55e";
      setTimeout(() => {
        btn.style.outline = origBtnOutline;
        btn.style.boxShadow = origBtnShadow;
      }, 3000);
    }

    const btnRect = btn ? btn.getBoundingClientRect() : null;
    const composerRect = composer ? composer.getBoundingClientRect() : null;

    sendResponse({
      composerFound: !!composer,
      composerBox: composer ? {
        tag: composer.tagName,
        rect: { width: Math.round(composerRect.width), height: Math.round(composerRect.height) },
        inDOM: composer.isConnected
      } : null,
      inputFound: !!input,
      inputTag: input ? `${input.tagName} [${normalizeText(input.textContent || input.innerText).substring(0, 25)}...]` : "Không có",
      buttonStatus: findResult.status,
      btnFound: !!btn,
      btnTag: btn
        ? `${btn.tagName} | Conf:${findResult.confidence || 0}% | Ready:${btnCheck.ready} | X:${btnRect ? Math.round(btnRect.left + btnRect.width/2) : "?"}, Y:${btnRect ? Math.round(btnRect.top + btnRect.height/2) : "?"}`
        : "Chưa thấy - " + btnCheck.reason,
      btnReady: btnCheck.ready,
      btnReason: btnCheck.reason,
      btnDisabled: btn ? (btn.disabled || btn.hasAttribute("disabled") || btn.getAttribute("aria-disabled") === "true") : null,
      btnConnected: btn ? btn.isConnected : false,
      ambiguity: findResult.status === "AMBIGUOUS",
      candidatesCount: findResult.candidates ? findResult.candidates.length : 0,
      candidates: (findResult.candidates || []).map(c => ({
        tag: c.tag,
        score: c.score,
        rect: { width: Math.round(c.rect.width), height: Math.round(c.rect.height) }
      })),
      settingsPillFound: !!pill,
      settingsPillText: pill ? (pill.textContent || "").trim().substring(0, 30) : "Chưa thấy",
      url: window.location.href
    });
    return true;
  }

  if (message.type === "DEBUG_FLOW_CONFIG") {
    (async () => {
      const out = {};
      try { out.state = await FlowConfig.readFlowConfiguration(); } catch (e) { out.readError = `${e.code || ""} ${e.message}`; }
      try { out.dump = await FlowConfig.dumpConfigurationDom(); } catch (e) { out.dumpError = `${e.code || ""} ${e.message}`; }
      sendResponse(out);
    })();
    return true;
  }

  if (message.type === "TEST_CLICK_GENERATE") {
    const composer = Flow.findComposerBox();
    const input = Flow.findInput(composer);
    const findResult = composer ? GenerateButtonController.find(composer) : { btn: null };
    const btn = findResult.btn;
    if (btn) {
      GenerateButtonController.click(btn, input).then((ok) => {
        sendResponse({ success: ok, clicked: true });
      });
      return true;
    } else {
      sendResponse({ success: false, reason: findResult.reason || "Không tìm thấy nút" });
      return true;
    }
  }
});
