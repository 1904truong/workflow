// Flow Bridge Sidepanel Logic
document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const promptInput = document.getElementById("promptInput");
  const charCounter = document.getElementById("charCounter");
  const modelSelect = document.getElementById("modelSelect");
  const ratioSelect = document.getElementById("ratioSelect");
  const batchCountVal = document.getElementById("batchCountVal");
  const stepDec = document.getElementById("stepDec");
  const stepInc = document.getElementById("stepInc");
  const maxSpeedToggle = document.getElementById("maxSpeedToggle");
  const autoDownloadToggle = document.getElementById("autoDownloadToggle");
  const generateMainBtn = document.getElementById("generateMainBtn");
  const addToQueueBtn = document.getElementById("addToQueueBtn");
  const stopTaskBtn = document.getElementById("stopTaskBtn");
  const openFlowTabBtn = document.getElementById("openFlowTabBtn");
  const flowLiveStatus = document.getElementById("flowLiveStatus");
  const flowStatusTitle = document.getElementById("flowStatusTitle");
  const flowStatusSub = document.getElementById("flowStatusSub");
  const refDropzone = document.getElementById("refDropzone");
  const refFileInput = document.getElementById("refFileInput");
  const refAddMoreCard = document.getElementById("refAddMoreCard");
  const popoutBtn = document.getElementById("popoutBtn");

  // Account / Login Elements (Bước 1)
  const userAccountBtn = document.getElementById("userAccountBtn");
  const userEmailDisplay = document.getElementById("userEmailDisplay");
  const accountBadge = document.getElementById("accountBadge");
  const loginModal = document.getElementById("loginModal");
  const loginModalCloseBtn = document.getElementById("loginModalCloseBtn");
  const submitLoginBtn = document.getElementById("submitLoginBtn");
  const quickLoginBtn = document.getElementById("quickLoginBtn");
  const loginEmailInput = document.getElementById("loginEmailInput");
  const loginTokenInput = document.getElementById("loginTokenInput");

  let currentUser = null;

  // ── BƯỚC 1: Quản lý trạng thái đăng nhập trên extension ──
  function loadAccountState() {
    chrome.storage.local.get(["userAccount"], (res) => {
      if (res && res.userAccount && res.userAccount.loggedIn) {
        currentUser = res.userAccount;
        const shortName = currentUser.email ? currentUser.email.split("@")[0] : "User";
        if (userEmailDisplay) userEmailDisplay.textContent = shortName;
        const dot = userAccountBtn?.querySelector(".acc-dot");
        if (dot) dot.classList.add("online");
        if (accountBadge) accountBadge.textContent = "PRO";
      } else {
        currentUser = null;
        if (userEmailDisplay) userEmailDisplay.textContent = "Đăng nhập";
        const dot = userAccountBtn?.querySelector(".acc-dot");
        if (dot) dot.classList.remove("online");
        if (accountBadge) accountBadge.textContent = "FREE";
      }
    });
  }
  loadAccountState();

  function openLoginModal() {
    if (loginModal) loginModal.style.display = "flex";
  }

  function closeLoginModal() {
    if (loginModal) loginModal.style.display = "none";
  }

  if (userAccountBtn) {
    userAccountBtn.addEventListener("click", () => {
      if (currentUser) {
        if (confirm(`Bạn đang đăng nhập: ${currentUser.email}\nBạn có muốn đăng xuất không?`)) {
          chrome.storage.local.remove(["userAccount"], () => {
            loadAccountState();
          });
        }
      } else {
        openLoginModal();
      }
    });
  }

  if (loginModalCloseBtn) loginModalCloseBtn.addEventListener("click", closeLoginModal);

  function performLogin(email) {
    const acc = {
      email: email || (loginEmailInput?.value.trim()) || "truonghoang1904@gmail.com",
      loggedIn: true,
      loginTime: Date.now()
    };
    chrome.storage.local.set({ userAccount: acc }, () => {
      loadAccountState();
      closeLoginModal();
    });
  }

  if (submitLoginBtn) {
    submitLoginBtn.addEventListener("click", () => {
      performLogin(loginEmailInput?.value.trim());
    });
  }

  if (quickLoginBtn) {
    quickLoginBtn.addEventListener("click", () => {
      performLogin("truonghoang1904@gmail.com");
    });
  }

  // Modal elements
  const runConfirmModal = document.getElementById("runConfirmModal");
  const modalCloseBtn = document.getElementById("modalCloseBtn");
  const modalCancelBtn = document.getElementById("modalCancelBtn");
  const modalRunBtn = document.getElementById("modalRunBtn");
  const modalSinglePromptBtn = document.getElementById("modalSinglePromptBtn");
  const modalMultiPromptBtn = document.getElementById("modalMultiPromptBtn");
  const modalPromptCount = document.getElementById("modalPromptCount");
  const modalRatioSelect = document.getElementById("modalRatioSelect");
  const modalModelSelect = document.getElementById("modalModelSelect");
  const modalResolutionSelect = document.getElementById("modalResolutionSelect");
  const modalStepDec = document.getElementById("modalStepDec");
  const modalStepInc = document.getElementById("modalStepInc");
  const modalBatchVal = document.getElementById("modalBatchVal");
  const autoSubmitBtn = document.getElementById("autoSubmitBtn");
  const manualSubmitBtn = document.getElementById("manualSubmitBtn");
  const submitModeHint = document.getElementById("submitModeHint");

  let batchCount = 1;
  let submitMode = "auto"; // 'auto' or 'manual'
  let isMultiPrompt = false;

  // Lưu / khôi phục cấu hình ảnh (model, tỷ lệ, số lượng)
  function saveImageSettings() {
    chrome.storage.local.set({
      imageSettings: { model: modelSelect.value, aspectRatio: ratioSelect.value, batchCount }
    });
  }
  chrome.storage.local.get(["imageSettings"], (res) => {
    const s = res && res.imageSettings;
    if (!s) return;
    if (s.model && [...modelSelect.options].some((o) => o.value === s.model)) modelSelect.value = s.model;
    if (s.aspectRatio) ratioSelect.value = s.aspectRatio;
    if (s.batchCount >= 1 && s.batchCount <= 4) {
      batchCount = s.batchCount;
      batchCountVal.textContent = batchCount;
      modalBatchVal.textContent = batchCount;
    }
  });
  modelSelect.addEventListener("change", saveImageSettings);
  ratioSelect.addEventListener("change", saveImageSettings);
  [stepDec, stepInc, modalStepDec, modalStepInc].forEach((b) => b.addEventListener("click", saveImageSettings));

  // Character Counter
  function updateCharCount() {
    const text = promptInput.value;
    charCounter.textContent = `${text.length} characters`;
    const multiOn = document.getElementById("multiPromptToggle")?.checked;
    const n = multiOn ? Math.max(1, text.split("\n").filter((l) => l.trim()).length) : 1;
    const badge = document.getElementById("promptCountBadge");
    const hint = document.getElementById("promptCountHint");
    if (badge) badge.textContent = n;
    if (hint) hint.textContent = n > 1 ? `${n} prompt → ${n} kết quả (chạy lần lượt)` : "prompt → 1 kết quả";
  }
  promptInput.addEventListener("input", updateCharCount);
  updateCharCount();
  document.getElementById("multiPromptToggle")?.addEventListener("change", updateCharCount);

  // ── Thanh công cụ dưới ô prompt ──
  const flashBtn = (btn, msg) => {
    if (!btn) return;
    const old = btn.title;
    btn.title = msg;
    btn.classList.add("flash");
    setTimeout(() => { btn.classList.remove("flash"); btn.title = old; }, 1400);
  };
  const setPrompt = (text) => {
    promptInput.value = text;
    promptInput.dispatchEvent(new Event("input", { bubbles: true }));
  };

  // Import .txt: mỗi dòng là một prompt; nhiều dòng thì tự bật Multi-Prompt
  const importTxtBtn = document.getElementById("importTxtBtn");
  const importTxtInput = document.getElementById("importTxtInput");
  importTxtBtn.addEventListener("click", () => importTxtInput.click());
  importTxtInput.addEventListener("change", () => {
    const f = importTxtInput.files && importTxtInput.files[0];
    importTxtInput.value = "";
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
      if (!text) return flashBtn(importTxtBtn, "File trống");
      setPrompt(text.slice(0, 4000));
      const multi = document.getElementById("multiPromptToggle");
      const lines = text.split("\n").filter((l) => l.trim()).length;
      if (multi && multi.checked !== lines > 1) { multi.checked = lines > 1; multi.dispatchEvent(new Event("change", { bubbles: true })); }
      flashBtn(importTxtBtn, `Đã nhập ${lines} dòng`);
    };
    reader.readAsText(f, "utf-8");
  });

  // Prompt Assistant (theo quy tắc, không dùng AI bên ngoài): chuẩn hoá khoảng trắng, viết hoa đầu câu,
  // thêm gợi ý giữ nhân vật/phong cách nếu có ảnh tham chiếu, và gợi ý chất lượng.
  document.getElementById("promptAiBtn").addEventListener("click", function () {
    const raw = promptInput.value.trim();
    if (!raw) { promptInput.focus(); return flashBtn(this, "Hãy nhập prompt trước"); }
    const lines = raw.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
    const hasRefs = typeof refImages !== "undefined" && refImages.length > 0;
    const improved = lines.map((l) => {
      let t = l.charAt(0).toUpperCase() + l.slice(1);
      t = t.replace(/[.\s]+$/, "");
      if (hasRefs && !/giữ nguyên|không thay đổi|consistent/i.test(t)) t += ", giữ nguyên nhân vật và phong cách như ảnh tham chiếu";
      if (!/chất lượng|chi tiết|sắc nét|high quality|detailed/i.test(t)) t += ", chi tiết, sắc nét, chất lượng cao";
      return t + ".";
    });
    setPrompt(improved.join("\n").slice(0, 4000));
    flashBtn(this, "Đã cải thiện prompt");
  });

  // Nút quét ảnh bên trái: thêm ảnh tham chiếu
  document.getElementById("promptImageBtn").addEventListener("click", () => refFileInput.click());

  // Lưu prompt (bookmark): giữ tối đa 50 prompt, không trùng
  document.getElementById("savePromptBtn").addEventListener("click", function () {
    const text = promptInput.value.trim();
    if (!text) return flashBtn(this, "Chưa có prompt để lưu");
    chrome.storage.local.get(["savedPrompts"], (res) => {
      const list = (res.savedPrompts || []).filter((p) => p.text !== text);
      list.unshift({ text, at: Date.now() });
      chrome.storage.local.set({ savedPrompts: list.slice(0, 50) }, () => flashBtn(this, "Đã lưu prompt"));
    });
  });

  // Stepper Main
  stepDec.addEventListener("click", () => {
    if (batchCount > 1) {
      batchCount--;
      batchCountVal.textContent = batchCount;
      modalBatchVal.textContent = batchCount;
    }
  });

  stepInc.addEventListener("click", () => {
    if (batchCount < 4) {
      batchCount++;
      batchCountVal.textContent = batchCount;
      modalBatchVal.textContent = batchCount;
    }
  });

  // Modal Stepper
  modalStepDec.addEventListener("click", () => {
    if (batchCount > 1) {
      batchCount--;
      batchCountVal.textContent = batchCount;
      modalBatchVal.textContent = batchCount;
    }
  });

  modalStepInc.addEventListener("click", () => {
    if (batchCount < 4) {
      batchCount++;
      batchCountVal.textContent = batchCount;
      modalBatchVal.textContent = batchCount;
    }
  });

  // Reference Image Upload
  refDropzone.addEventListener("click", () => refFileInput.click());
  refAddMoreCard.addEventListener("click", () => refFileInput.click());

  const MAX_REF = 3;
  const refThumbs = document.getElementById("refThumbs");
  const refImages = []; // data URLs, tối đa MAX_REF
  const refReason = [];
  const refStatus = []; // "pending" | "uploading" | "done" | "failed" (song song refImages)

  refFileInput.addEventListener("change", (e) => {
    addRefFiles(e.target.files);
    refFileInput.value = "";
  });
  refDropzone.addEventListener("dragover", (e) => e.preventDefault());
  refDropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    addRefFiles(e.dataTransfer.files);
  });

  function addRefFiles(files) {
    const room = MAX_REF - refImages.length;
    Array.from(files || [])
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, room)
      .forEach((file) => {
        const reader = new FileReader();
        reader.onload = (evt) => {
          if (refImages.length >= MAX_REF) return;
          refImages.push(evt.target.result);
          refStatus.push("pending");
          renderRefs();
        };
        reader.readAsDataURL(file);
      });
  }

  function renderRefs() {
    refThumbs.textContent = "";
    refImages.forEach((src, i) => {
      const card = document.createElement("div");
      card.className = "ref-card preview-card";
      card.style.display = "flex";
      const img = document.createElement("img");
      img.className = "ref-thumb-img";
      img.src = src;
      const btn = document.createElement("button");
      btn.className = "thumb-close-btn";
      btn.title = "Xóa ảnh";
      btn.textContent = "✕";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        refImages.splice(i, 1);
        refStatus.splice(i, 1);
        renderRefs();
      });
      const badge = document.createElement("div");
      badge.className = "ref-badge " + (refStatus[i] || "pending");
      badge.title = refReason[i] || "";
      badge.textContent = { done: "✓ Đã upload", uploading: "Đang upload…", failed: "Lỗi upload" }[refStatus[i]] || "Chờ upload";
      const num = document.createElement("span");
      num.className = "ref-num";
      num.textContent = i + 1;
      card.append(img, btn, num, badge);
      refThumbs.appendChild(card);
    });
    refAddMoreCard.style.display = refImages.length >= MAX_REF ? "none" : "";
    refDropzone.style.display = refImages.length ? "none" : "";
    if (refImages.length) refAddMoreCard.title = `Thêm ảnh (${refImages.length}/${MAX_REF})`;
  }
  renderRefs();

  // Lệnh từ web Studio: điền prompt + ảnh tham chiếu vào side panel (chuyển về Flow) để người dùng thấy
  function applyWebFill(fill) {
    if (!fill) return;
    document.querySelector('.platform-chip[data-platform="flow"]')?.click();
    if (fill.prompt) setPrompt(String(fill.prompt).slice(0, 4000));
    refImages.length = 0; refStatus.length = 0;
    (fill.referenceImages || []).slice(0, MAX_REF).forEach((src) => { refImages.push(src); refStatus.push("pending"); });
    renderRefs();
  }
  chrome.storage.local.get(["lastWebRequest"], (res) => {
    const f = res && res.lastWebRequest;
    if (f && Date.now() - (f.at || 0) < 10 * 60 * 1000) applyWebFill(f); // side panel mở sau khi web gửi lệnh
    if (f) chrome.storage.local.remove("lastWebRequest"); // chỉ áp dụng một lần
  });
  chrome.runtime.onMessage.addListener((m) => { if (m && m.type === "WEB_FILL") applyWebFill(m.payload); });

  chrome.runtime.onMessage.addListener((m) => {
    if (m && m.type === "REF_STATUS" && refStatus[m.index] !== undefined) {
      refStatus[m.index] = m.status;
      refReason[m.index] = m.reason || "";
      renderRefs();
    }
  });

  // Platforms Switcher
  const platformChips = document.querySelectorAll(".platform-chip");
  platformChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      platformChips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      currentPlatform = chip.dataset.platform || "flow";
      applyPlatformUI();
      if (currentPlatform === "flow") checkFlowStatus(); else openPlatformTab();
    });
  });

  // Navigation Tabs Switcher
  const navTabs = document.querySelectorAll(".nav-tab");
  navTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      navTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const target = tab.dataset.tab;
      document.getElementById("panel-create").style.display = target === "create" ? "flex" : "none";
      const tasksPanel = document.getElementById("panel-tasks");
      if (tasksPanel) {
        tasksPanel.style.display = target === "tasks" ? "flex" : "none";
      }
      const libPanel = document.getElementById("panel-library");
      if (libPanel) {
        libPanel.style.display = target === "library" ? "flex" : "none";
      }
    });
  });

  // ── Cấu hình tìm ảnh Magnific (cùng bộ lọc với web); nhớ lại ở storage.stockFilters.magnific để background dùng làm mặc định ──
  const mg = {
    ai: document.getElementById("mgAi"), fileType: document.getElementById("mgFileType"),
    color: document.getElementById("mgColor"), detail: document.getElementById("mgDetail"), scenery: document.getElementById("mgScenery"),
    range: document.getElementById("mgPeopleRange"), gender: document.getElementById("mgPeopleGender"),
    age: document.getElementById("mgPeopleAge"), ethnicity: document.getElementById("mgPeopleEthnicity"),
    toggle: document.getElementById("mgPeopleToggle"), collapse: document.getElementById("mgPeopleCollapse"),
    panel: document.getElementById("mgPeoplePanel"), mode: document.getElementById("mgPeopleMode"),
    sub: document.getElementById("mgPeopleSub"), summary: document.getElementById("mgPeopleSummary"),
  };
  let mgPeopleMode = "";
  const pxSize = document.getElementById("pxSize"), pxColor = document.getElementById("pxColor");
  function pexelsFilters() {
    const f = { orientation: "auto" };
    if (pxSize.value) f.size = pxSize.value;
    if (pxColor.value) f.pexelsColor = pxColor.value;
    return f;
  }
  [pxSize, pxColor].forEach((el) => el.addEventListener("change", () => {
    chrome.storage.local.get("stockFilters").then((r) => {
      const all = (r && r.stockFilters) || {};
      all.pexels = pexelsFilters();
      chrome.storage.local.set({ stockFilters: all });
    }).catch(() => {});
  }));
  chrome.storage.local.get("stockFilters").then((r) => {
    const m = (r && r.stockFilters && r.stockFilters.pexels) || {};
    pxSize.value = m.size || ""; pxColor.value = m.pexelsColor || "";
  }).catch(() => {});
  function magnificFilters() {
    const f = { orientation: "auto", fileType: mg.fileType.value || "" };
    if (mg.ai.value) f.ai = mg.ai.value;
    if (mg.color.value) f.color = mg.color.value;
    if (mg.scenery.value) f.scenery = mg.scenery.value;
    f.detail = mg.detail.value || "high";
    if (mgPeopleMode) f.people = mgPeopleMode;
    if (mgPeopleMode === "include") {
      if (mg.range.value) f.peopleRange = mg.range.value;
      if (mg.gender.value) f.peopleGender = mg.gender.value;
      if (mg.age.value) f.peopleAge = mg.age.value;
      if (mg.ethnicity.value) f.peopleEthnicity = mg.ethnicity.value;
    }
    return f;
  }
  function renderPeople() {
    mg.mode.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.v === mgPeopleMode));
    mg.sub.style.display = mgPeopleMode === "include" ? "grid" : "none";
    const f = magnificFilters();
    const parts = mgPeopleMode === "exclude" ? ["No people"] : mgPeopleMode === "include"
      ? ["With people", f.peopleRange && `${f.peopleRange === "4" ? "4+" : f.peopleRange} person(s)`, f.peopleGender, f.peopleAge, f.peopleEthnicity].filter(Boolean) : ["All"];
    mg.summary.textContent = parts.join(" · ");
  }
  function saveMagnific() {
    renderPeople();
    chrome.storage.local.get("stockFilters").then((r) => {
      const all = (r && r.stockFilters) || {};
      all.magnific = { ...magnificFilters(), mode: mgPeopleMode };
      chrome.storage.local.set({ stockFilters: all });
    }).catch(() => {});
  }
  [mg.ai, mg.fileType, mg.color, mg.detail, mg.scenery, mg.range, mg.gender, mg.age, mg.ethnicity].forEach((el) => el.addEventListener("change", saveMagnific));
  mg.mode.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    mgPeopleMode = b.dataset.v;
    if (mgPeopleMode !== "include") { mg.range.value = ""; mg.gender.value = ""; mg.age.value = ""; mg.ethnicity.value = ""; }
    saveMagnific();
  });
  const setPeopleOpen = (open) => {
    document.getElementById("mgPeople").classList.toggle("open", open);
    mg.panel.style.display = open ? "flex" : "none";
    mg.toggle.style.display = open ? "none" : "flex";
    mg.collapse.style.display = open ? "" : "none";
  };
  mg.toggle.addEventListener("click", () => setPeopleOpen(true));
  mg.collapse.addEventListener("click", () => setPeopleOpen(false));
  chrome.storage.local.get("stockFilters").then((r) => {
    const m = (r && r.stockFilters && r.stockFilters.magnific) || {};
    mg.ai.value = m.ai || "";
    mg.fileType.value = m.fileType || "";
    mg.color.value = m.color || "";
    mg.detail.value = m.detail || "high";
    mg.scenery.value = m.scenery || "";
    mgPeopleMode = m.mode || m.people || "";
    mg.range.value = m.peopleRange || "";
    mg.gender.value = m.peopleGender || "";
    mg.age.value = m.peopleAge || "";
    mg.ethnicity.value = m.peopleEthnicity || "";
    renderPeople();
    syncColorBtn(m.color || "");
  }).catch(() => {});

  // ── Color swatch picker ──
  const COLOR_META = {
    "": { label: "Auto", cls: "mg-swatch-auto", bg: "" },
    black:  { label: "Black",  cls: "", bg: "#111827" },
    white:  { label: "White",  cls: "", bg: "#f1f5f9" },
    green:  { label: "Green",  cls: "", bg: "#14b8a6" },
    cyan:   { label: "Cyan",   cls: "", bg: "#22d3ee" },
    blue:   { label: "Blue",   cls: "", bg: "#3b82f6" },
    purple: { label: "Purple", cls: "", bg: "#8b5cf6" },
    pink:   { label: "Pink",   cls: "", bg: "#ec4899" },
    red:    { label: "Red",    cls: "", bg: "#ef4444" },
    orange: { label: "Orange", cls: "", bg: "#f97316" },
    yellow: { label: "Yellow", cls: "", bg: "#eab308" },
    gray:   { label: "Gray",   cls: "", bg: "#64748b" },
    "white-black": { label: "White & Black", cls: "", bg: "linear-gradient(135deg, white 50%, rgb(13, 13, 13) 50%)" },
    "gray-black": { label: "Gray & Black", cls: "", bg: "linear-gradient(135deg, rgb(200, 200, 200) 50%, rgb(13, 13, 13) 50%)" },
    "blue-green": { label: "Blue & Green", cls: "", bg: "linear-gradient(135deg, rgb(51, 106, 234) 50%, rgb(23, 209, 198) 50%)" },
    "red-blue": { label: "Red & Blue", cls: "", bg: "linear-gradient(135deg, rgb(235, 100, 76) 50%, rgb(31, 64, 140) 50%)" },
    "yellow-blue": { label: "Yellow & Blue", cls: "", bg: "linear-gradient(135deg, rgb(254, 182, 2) 50%, rgb(51, 106, 234) 50%)" },
    "green-yellow": { label: "Green & Yellow", cls: "", bg: "linear-gradient(135deg, rgb(23, 209, 198) 50%, rgb(254, 182, 2) 50%)" },
    "orange-red": { label: "Orange & Red", cls: "", bg: "linear-gradient(135deg, rgb(234, 126, 17) 50%, rgb(211, 72, 43) 50%)" },
    "yellow-red": { label: "Yellow & Red", cls: "", bg: "linear-gradient(135deg, rgb(254, 182, 2) 50%, rgb(211, 72, 43) 50%)" },
    "pink-blue": { label: "Pink & Blue", cls: "", bg: "linear-gradient(135deg, rgb(255, 216, 210) 50%, rgb(100, 142, 239) 50%)" },
    "pink-yellow": { label: "Pink & Yellow", cls: "", bg: "linear-gradient(135deg, rgb(255, 216, 210) 50%, rgb(254, 182, 2) 50%)" },
    "purple-blue": { label: "Purple & Blue", cls: "", bg: "linear-gradient(135deg, rgb(76, 80, 174) 50%, rgb(184, 203, 248) 50%)" },
    "gray-blue": { label: "Gray & Blue", cls: "", bg: "linear-gradient(135deg, rgb(200, 200, 200) 50%, rgb(100, 142, 239) 50%)" },
  };
  const colorPopup = document.getElementById("mgColorPopup");
  const colorBtn   = document.getElementById("mgColorBtn");
  const colorSwatch = document.getElementById("mgColorSwatch");
  const colorLabel  = document.getElementById("mgColorLabel");

  function syncColorBtn(val) {
    const meta = COLOR_META[val] || COLOR_META[""];
    colorLabel.textContent = meta.label;
    colorSwatch.className = "mg-color-swatch" + (meta.cls ? " " + meta.cls : "");
    colorSwatch.style.background = meta.bg || "";
    // highlight active swatch in popup
    colorPopup.querySelectorAll(".mg-cp-swatch").forEach((s) =>
      s.classList.toggle("active", s.dataset.color === val));
  }

  function positionColorPopup() {
    const field = document.getElementById("mgColorField");
    if (!field) return;
    const fr = field.getBoundingClientRect();
    const pr = colorPopup.parentElement.getBoundingClientRect();
    colorPopup.style.left = (fr.left - pr.left) + "px";
    colorPopup.style.top  = (fr.bottom - pr.top + 4) + "px";
  }

  colorBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = colorPopup.style.display !== "none";
    colorPopup.style.display = isOpen ? "none" : "block";
    if (!isOpen) positionColorPopup();
  });

  colorPopup.addEventListener("click", (e) => {
    const s = e.target.closest(".mg-cp-swatch");
    if (!s) return;
    const val = s.dataset.color;
    mg.color.value = val;
    syncColorBtn(val);
    colorPopup.style.display = "none";
    saveMagnific();
  });

  document.addEventListener("click", (e) => {
    if (!colorPopup.contains(e.target) && e.target !== colorBtn) {
      colorPopup.style.display = "none";
    }
  });

  // Nền tảng đang chọn (flow | chatgpt | grok | gemini | magnific | pexels)
  let currentPlatform = "flow";
  const PLATFORM_NAMES = { flow: "Google Flow", chatgpt: "ChatGPT", grok: "Grok", gemini: "Gemini", magnific: "Magnific", pexels: "Pexels" };

  // Đổi giao diện theo nền tảng: ẩn mục chỉ của Flow (model, số lượng, video, Max Speed...), đổi chữ nút Tạo
  function applyPlatformUI() {
    document.body.dataset.platform = currentPlatform;
    const label = currentPlatform === "flow" ? "Tạo" : `Tạo bằng ${PLATFORM_NAMES[currentPlatform]}`;
    const btnLabel = generateMainBtn.querySelector(".btn-label");
    if (btnLabel) btnLabel.textContent = label;
    const eng = document.getElementById("modalEngineName");
    if (eng) eng.textContent = currentPlatform === "flow" ? "Flow" : PLATFORM_NAMES[currentPlatform];
  }
  applyPlatformUI();

  function renderPlatformStatus(st) {
    const name = PLATFORM_NAMES[currentPlatform];
    openFlowTabBtn.querySelector("span").textContent = "Mở " + name;
    if (!st || !st.hasTab) {
      flowLiveStatus.classList.add("offline");
      flowStatusTitle.textContent = `Chưa mở ${name}`;
      flowStatusSub.textContent = `Bấm 'Mở ${name}' để chuyển sang tab và đăng nhập`;
    } else if (!st.loggedIn) {
      flowLiveStatus.classList.add("offline");
      flowStatusTitle.textContent = `Chưa đăng nhập ${name}`;
      flowStatusSub.textContent = (st.reason || "Hãy đăng nhập ở tab vừa mở") + " — đăng nhập xong sẽ tự nhận";
    } else {
      flowLiveStatus.classList.remove("offline");
      flowStatusTitle.textContent = "Sẵn sàng";
      flowStatusSub.textContent = `Đã đăng nhập ${name}`;
    }
  }

  // Check Google Flow connection status
  function checkFlowStatus() {
    if (currentPlatform !== "flow") {
      const asked = currentPlatform;
      chrome.runtime.sendMessage({ type: "CHECK_PLATFORM", payload: { platform: asked } }, (st) => {
        if (asked === currentPlatform) renderPlatformStatus(chrome.runtime.lastError ? null : st);
      });
      return;
    }
    openFlowTabBtn.querySelector("span").textContent = "Mở Google Flow";
    chrome.runtime.sendMessage({ type: "GET_FLOW_STATUS" }, (response) => {
      if (chrome.runtime.lastError || !response || !response.connected) {
        flowLiveStatus.classList.add("offline");
        flowStatusTitle.textContent = "Chưa mở Flow";
        flowStatusSub.textContent = "Bấm 'Mở Google Flow'";
      } else if (!response.isProject) {
        flowLiveStatus.classList.remove("offline");
        flowStatusTitle.textContent = "Trang chủ Flow";
        flowStatusSub.textContent = "Tự động chọn 'Dự án mới' (Bước 2)";
      } else {
        flowLiveStatus.classList.remove("offline");
        flowStatusTitle.textContent = "Sẵn sàng";
        flowStatusSub.textContent = "Đã kết nối với dự án Flow";
      }
    });
  }
  checkFlowStatus();
  setInterval(checkFlowStatus, 3000);

  // Open Google Flow Button
  openFlowTabBtn.addEventListener("click", () => {
    if (currentPlatform === "flow") { chrome.tabs.create({ url: "https://flow.google.com/" }); return; }
    openPlatformTab();
  });

  // Cửa sổ nhắc đăng nhập nền tảng: mở trang đăng nhập, rồi kiểm tra lại khi bạn đăng nhập xong
  const platformLoginModal = document.getElementById("platformLoginModal");
  const platformLoginText = document.getElementById("platformLoginText");
  const platformLoginTitle = document.getElementById("platformLoginTitle");
  let platformLoginFor = null;
  function showPlatformLogin(platform, reason) {
    if (!platformLoginModal || !PLATFORM_NAMES[platform]) return;
    platformLoginFor = platform;
    const name = PLATFORM_NAMES[platform];
    platformLoginTitle.textContent = `Chưa đăng nhập ${name}`;
    platformLoginText.textContent = `${reason ? reason + ". " : ""}Hãy đăng nhập ${name} ở tab vừa mở, rồi bấm "Tôi đã đăng nhập" để tiếp tục.`;
    platformLoginModal.style.display = "flex";
  }
  function hidePlatformLogin() { if (platformLoginModal) platformLoginModal.style.display = "none"; platformLoginFor = null; }
  document.getElementById("platformLoginCloseBtn")?.addEventListener("click", hidePlatformLogin);
  document.getElementById("platformLoginOpenBtn")?.addEventListener("click", () => {
    if (!platformLoginFor) return;
    chrome.runtime.sendMessage({ type: "OPEN_LOGIN", payload: { platform: platformLoginFor } }, () => {});
  });
  document.getElementById("platformLoginRecheckBtn")?.addEventListener("click", () => {
    const asked = platformLoginFor;
    if (!asked) return;
    chrome.runtime.sendMessage({ type: "CHECK_PLATFORM", payload: { platform: asked } }, (st) => {
      if (chrome.runtime.lastError || !st || !st.loggedIn) { showPlatformLogin(asked, (st && st.reason) || "Vẫn chưa thấy đăng nhập"); return; }
      hidePlatformLogin();
      if (asked === currentPlatform) renderPlatformStatus(st);
    });
  });

  // Chuyển sang (hoặc mở) tab của nền tảng đang chọn; chưa đăng nhập thì hiện yêu cầu đăng nhập
  function openPlatformTab() {
    const asked = currentPlatform;
    if (asked === "flow") return;
    flowStatusTitle.textContent = `Đang mở ${PLATFORM_NAMES[asked]}...`;
    chrome.runtime.sendMessage({ type: "OPEN_PLATFORM", payload: { platform: asked } }, (st) => {
      if (asked !== currentPlatform) return;
      const stOk = chrome.runtime.lastError ? null : st;
      renderPlatformStatus(stOk);
      if (stOk && stOk.hasTab && !stOk.loggedIn) showPlatformLogin(asked, stOk.reason);
    });
  }

  // Popout / Independent window
  popoutBtn.addEventListener("click", () => {
    chrome.windows.create({
      url: chrome.runtime.getURL("sidepanel.html"),
      type: "popup",
      width: 440,
      height: 720
    });
  });

  // ══════════════════════════════════════
  // MODAL CONFIRMATION LOGIC
  // ══════════════════════════════════════
  function openConfirmModal() {
    // ── BƯỚC 1: Bắt đăng nhập tài khoản trên extension (nếu chưa đăng nhập) ──
    if (!currentUser) {
      alert("Bước 1: Vui lòng đăng nhập tài khoản trên tiện ích mở rộng trước khi thực hiện tạo ảnh!");
      openLoginModal();
      return;
    }

    const rawText = promptInput.value.trim();
    if (!rawText) {
      alert("Vui lòng nhập câu lệnh prompt trước khi tạo!");
      promptInput.focus();
      return;
    }

    // Sync ratio + model từ cấu hình chính
    modalRatioSelect.value = ratioSelect.value;
    modalModelSelect.value = modelSelect.value;
    modalBatchVal.textContent = batchCount;

    // Sync submit mode UI
    if (submitMode === "auto") {
      autoSubmitBtn.classList.add("active");
      manualSubmitBtn.classList.remove("active");
      submitModeHint.textContent = "Flow Bridge tự động submit sau khi điền prompt";
    } else {
      manualSubmitBtn.classList.add("active");
      autoSubmitBtn.classList.remove("active");
      submitModeHint.textContent = "Flow Bridge chỉ điền prompt, bạn tự bấm Tạo trên Google Flow";
    }

    // Check lines for multi-prompt
    const lines = rawText.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length > 1) {
      isMultiPrompt = true;
      modalSinglePromptBtn.classList.remove("active");
      modalMultiPromptBtn.classList.add("active");
      modalPromptCount.textContent = lines.length;
    } else {
      isMultiPrompt = false;
      modalSinglePromptBtn.classList.add("active");
      modalMultiPromptBtn.classList.remove("active");
      modalPromptCount.textContent = "1";
    }

    runConfirmModal.style.display = "flex";
  }

  function closeConfirmModal() {
    runConfirmModal.style.display = "none";
  }

  function triggerGeneration() {
    // ── BƯỚC 1: Bắt đăng nhập tài khoản trên extension (nếu chưa đăng nhập) ──
    if (!currentUser) {
      alert("Bước 1: Vui lòng đăng nhập tài khoản trên tiện ích mở rộng trước khi thực hiện tạo ảnh!");
      openLoginModal();
      return;
    }

    const rawText = promptInput.value.trim();
    if (!rawText) {
      alert("Vui lòng nhập câu lệnh prompt trước khi tạo!");
      promptInput.focus();
      return;
    }

    let prompts = [];
    if (isMultiPrompt) {
      prompts = rawText.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    } else {
      prompts = [rawText];
    }

    const payload = {
      prompts,
      aspectRatio: ratioSelect.value,
      batchCount,
      model: modelSelect.value,
      resolution: modalResolutionSelect?.value || "1K",
      autoSubmit: submitMode === "auto",
      referenceImages: refImages.slice(),
      platform: document.querySelector(".platform-chip.active")?.dataset.platform || "flow",
      filters: document.body.dataset.platform === "pexels" ? pexelsFilters() : magnificFilters(),
      chatgptEffort: Number(document.getElementById("chatgptEffort")?.value || 1),
      autoDownload: autoDownloadToggle ? autoDownloadToggle.checked : true,
    };

    refStatus.fill("pending");
    renderRefs();
    closeConfirmModal();

    generateMainBtn.style.opacity = "0.7";
    generateMainBtn.disabled = true;

    chrome.runtime.sendMessage({ type: "DISPATCH_GENERATE", payload }, (resp) => {
      generateMainBtn.disabled = false;
      generateMainBtn.style.opacity = "1";
      if (resp && resp.error === "NOT_LOGGED_IN") {
        flowStatusTitle.textContent = `Chưa đăng nhập ${resp.platformName || ""}`;
        flowStatusSub.textContent = "Hãy đăng nhập ở tab vừa mở rồi bấm Tạo lại";
        flowLiveStatus.classList.add("offline");
        showPlatformLogin(payload.platform, resp.reason);
      } else if (resp && resp.success === false && resp.error) {
        alert(resp.error);
      }
    });
  }

  // "Tạo ngay": mở bảng xác nhận để kiểm tra cấu hình, bấm "Chạy" mới thực hiện
  generateMainBtn.addEventListener("click", openConfirmModal);

  // Đổi trong bảng xác nhận thì cập nhật luôn cấu hình chính (nguồn duy nhất cho payload)
  modalRatioSelect.addEventListener("change", () => {
    ratioSelect.value = modalRatioSelect.value;
    ratioSelect.dispatchEvent(new Event("change"));
  });
  modalModelSelect.addEventListener("change", () => {
    modelSelect.value = modalModelSelect.value;
    modelSelect.dispatchEvent(new Event("change"));
  });

  modalCloseBtn.addEventListener("click", closeConfirmModal);
  modalCancelBtn.addEventListener("click", closeConfirmModal);

  // Toggle Single / Multi Prompt in Modal
  modalSinglePromptBtn.addEventListener("click", () => {
    isMultiPrompt = false;
    modalSinglePromptBtn.classList.add("active");
    modalMultiPromptBtn.classList.remove("active");
    modalPromptCount.textContent = "1";
  });

  modalMultiPromptBtn.addEventListener("click", () => {
    isMultiPrompt = true;
    modalMultiPromptBtn.classList.add("active");
    modalSinglePromptBtn.classList.remove("active");
    const lines = promptInput.value.trim().split("\n").filter(l => l.trim().length > 0);
    modalPromptCount.textContent = Math.max(1, lines.length);
  });

  // Toggle Submit Mode
  autoSubmitBtn.addEventListener("click", () => {
    submitMode = "auto";
    autoSubmitBtn.classList.add("active");
    manualSubmitBtn.classList.remove("active");
    submitModeHint.textContent = "TobyFlow tự động submit sau khi điền prompt + ref";
  });

  manualSubmitBtn.addEventListener("click", () => {
    submitMode = "manual";
    manualSubmitBtn.classList.add("active");
    autoSubmitBtn.classList.remove("active");
    submitModeHint.textContent = "TobyFlow chỉ điền prompt, bạn tự bấm Tạo trên Google Flow";
  });

  // RUN ACTION: Bấm ▶ Chạy trên Modal
  modalRunBtn.addEventListener("click", () => {
    triggerGeneration();
  });

  // Hotkey Ctrl + Enter: Chạy ngay lập tức
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (runConfirmModal.style.display === "flex") triggerGeneration();
      else openConfirmModal();
    }
  });

  // Add to Queue
  addToQueueBtn.addEventListener("click", () => {
    const text = promptInput.value.trim();
    if (!text) return;
    chrome.runtime.sendMessage({
      type: "ADD_TO_QUEUE",
      payload: {
        prompt: text,
        aspectRatio: ratioSelect.value,
        model: modelSelect.value,
        batchCount: batchCount,
      }
    });
  });

  // Stop Task
  stopTaskBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "STOP_ALL_TASKS" });
  });

  // Test Google Flow DOM Button
  const testFlowDomBtn = document.getElementById("testFlowDomBtn");
  if (testFlowDomBtn) {
    testFlowDomBtn.addEventListener("click", () => {
      chrome.tabs.query({}, (tabs) => {
        const flowTab = tabs.find(t => t.url && t.url.includes("flow.google.com"));
        if (!flowTab) {
          alert("Chưa tìm thấy tab Google Flow nào! Vui lòng mở Google Flow trước.");
          return;
        }

        chrome.tabs.sendMessage(flowTab.id, { type: "DEBUG_DOM" }, (resp) => {
          if (chrome.runtime.lastError || !resp) {
            alert(
              "Chưa nhận được phản hồi từ Google Flow tab (" + flowTab.id + ").\n" +
              "Vui lòng nhấn F5 (Tải lại) trang Google Flow để nạp mã tự động mới nhất!"
            );
          } else {
            const doClick = confirm(
              `=== CHẾ ĐỘ CHẨN ĐOÁN GOOGLE FLOW ===\n\n` +
              `• Khung Composer: ${resp.composerFound ? `✓ TÌM THẤY (${resp.composerBox?.rect?.width}x${resp.composerBox?.rect?.height}px)` : "✕ Chưa thấy"}\n` +
              `• Ô Prompt Input: ${resp.inputFound ? "✓ TÌM THẤY (" + resp.inputTag + ")" : "✕ Chưa thấy"}\n` +
              `• Nút Tạo ảnh [➔]: ${resp.btnFound ? "✓ TÌM THẤY (" + resp.btnTag + ")" : "✕ " + (resp.btnReason || "Chưa thấy")}\n` +
              `• Sẵn sàng Click: ${resp.btnReady ? "✓ SẴN SÀNG" : "✕ CHƯA SẴN SÀNG (" + resp.btnReason + ")"}\n\n` +
              `Nút tạo đã chớp viền XANH LÁ trên trang Flow.\n\n` +
              `BẤM 'OK' ĐỂ THỰC HIỆN BẤM THỬ (CLICK) NÚT NÀY NGAY LẬP TỨC!\n(Bấm Cancel nếu chỉ muốn xem thông tin)`
            );
            if (doClick) {
              chrome.tabs.sendMessage(flowTab.id, { type: "TEST_CLICK_GENERATE" }, (clickResp) => {
                if (clickResp && clickResp.success) {
                  alert("✓ Đã gửi lệnh click và Enter thành công sang Google Flow!");
                } else {
                  alert("✕ Thất bại: " + (clickResp?.reason || "Không thể click"));
                }
              });
            }
          }
        });
      });
    });
  }
});

// Chẩn đoán cấu hình Flow: đọc cấu hình thật + dump DOM bảng cấu hình, copy JSON vào clipboard
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("debugFlowConfigBtn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    chrome.tabs.query({}, (tabs) => {
      const flowTab = tabs.find((t) => t.url && t.url.includes("flow.google.com/project/")) ||
                      tabs.find((t) => t.url && t.url.includes("flow.google.com"));
      if (!flowTab) { alert("Chưa mở Google Flow."); return; }
      chrome.tabs.sendMessage(flowTab.id, { type: "DEBUG_FLOW_CONFIG" }, async (resp) => {
        if (chrome.runtime.lastError || !resp) { alert("Chưa nhận phản hồi từ tab Flow. Hãy F5 trang Flow rồi thử lại."); return; }
        const json = JSON.stringify(resp, null, 1);
        try { await navigator.clipboard.writeText(json); } catch (_) {}
        const s = resp.state;
        alert(
          "Cấu hình Flow đọc được:\n" +
          (s ? "• Mode: " + s.mode + "\n• Tỷ lệ: " + s.aspectRatio + "\n• Model: " + s.model + "\n• Số lượng: x" + s.outputCount + "\n"
             : "• Lỗi: " + resp.readError + "\n") +
          "\nĐã copy JSON chẩn đoán vào clipboard (dán cho dev nếu đọc sai)."
        );
      });
    });
  });
});

// Đồng bộ chip tỷ lệ / số lượng với ratioSelect & stepper
document.addEventListener("DOMContentLoaded", () => {
  const ratioSelect = document.getElementById("ratioSelect");
  const batchVal = document.getElementById("batchCountVal");
  const ratioChips = document.querySelectorAll("#ratioChips .chip");
  const countChips = document.querySelectorAll("#countChips .chip");

  const refresh = () => {
    ratioChips.forEach((c) => c.classList.toggle("active", c.dataset.value === ratioSelect.value));
    countChips.forEach((c) => c.classList.toggle("active", c.dataset.value === batchVal.textContent.trim()));
  };

  ratioChips.forEach((c) => c.addEventListener("click", () => {
    ratioSelect.value = c.dataset.value;
    ratioSelect.dispatchEvent(new Event("change"));
    refresh();
  }));
  countChips.forEach((c) => c.addEventListener("click", () => {
    const target = parseInt(c.dataset.value, 10);
    const inc = document.getElementById("stepInc");
    const dec = document.getElementById("stepDec");
    let cur = parseInt(batchVal.textContent, 10) || 1;
    while (cur < target) { inc.click(); cur++; }
    while (cur > target) { dec.click(); cur--; }
    refresh();
  }));

  // Giá trị lưu được khôi phục bất đồng bộ nên theo dõi thay đổi
  new MutationObserver(refresh).observe(batchVal, { childList: true, characterData: true, subtree: true });
  chrome.storage.local.get(["imageSettings"], () => setTimeout(refresh, 0));
  refresh();
});

// ══════════════════════════════════════
// THƯ VIỆN ẢNH + CẤU HÌNH SUPABASE
// ══════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);
  const grid = $("libGrid");
  if (!grid) return;

  const send = (type, payload) =>
    new Promise((resolve) => chrome.runtime.sendMessage({ type, payload }, (r) => resolve(r || { ok: false, error: chrome.runtime.lastError?.message || "Không có phản hồi" })));

  let rows = [];
  let urls = {};

  function setMsg(text, kind = "") {
    const el = $("libMsg");
    el.textContent = text || "";
    el.className = "lib-msg" + (kind ? " " + kind : "");
  }

  // ── Cấu hình / trạng thái kết nối ──
  async function refreshStatus() {
    const st = await send("CLOUD_STATUS");
    const pill = $("libConnPill");
    if (!st.ok) { pill.textContent = "Lỗi"; pill.className = "lib-pill warn"; return st; }
    if (!st.configured) { pill.textContent = "Chưa cấu hình"; pill.className = "lib-pill warn"; }
    else if (!st.signedIn) { pill.textContent = "Chưa đăng nhập"; pill.className = "lib-pill warn"; }
    else { pill.textContent = st.email || "Đã kết nối"; pill.className = "lib-pill ok"; }
    $("libAutoSave").checked = st.autoSave;
    return st;
  }

  async function loadSettings() {
    const r = await send("CLOUD_GET_SETTINGS");
    if (r.ok) {
      $("libUrl").value = r.settings.url || "";
      $("libAnonKey").value = r.settings.anonKey || "";
      if (!r.settings.url || !r.settings.anonKey) $("libConfigDetails").open = true;
    }
  }

  $("libSaveConfig").addEventListener("click", async () => {
    let url = $("libUrl").value.trim();
    // Dán URL có đuôi (vd .../rest/v1/ hay .../auth/v1/) vẫn dùng được: chỉ giữ phần gốc https://xxxx.supabase.co
    try { const u = new URL(url); if (/\.supabase\.(co|in)$/i.test(u.hostname)) url = u.origin; } catch (_) {}
    $("libUrl").value = url;
    const anonKey = $("libAnonKey").value.trim();
    if (!/^https:\/\/[^/]+\.supabase\.(co|in)\/?$/i.test(url) && !/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(url)) {
      setMsg("URL không hợp lệ (dạng https://xxxx.supabase.co)", "err"); return;
    }
    if (anonKey.length < 20) { setMsg("Anon key không hợp lệ", "err"); return; }
    let role = "";
    try { role = JSON.parse(atob((anonKey.split(".")[1] || "").replace(/-/g, "+").replace(/_/g, "/"))).role || ""; } catch (_) { /* key dạng khác (sb_publishable_...) */ }
    if (role === "service_role" || /^sb_secret_/i.test(anonKey)) {
      setMsg("Đây là service_role key! Tuyệt đối không dùng trong extension. Hãy dùng anon public key.", "err"); return;
    }
    const r = await send("CLOUD_SET_SETTINGS", { url, anonKey });
    setMsg(r.ok ? "Đã lưu cấu hình" : r.error, r.ok ? "ok" : "err");
    refreshStatus();
  });

  $("libSignIn").addEventListener("click", async () => {
    setMsg("Đang đăng nhập...");
    const r = await send("CLOUD_SIGN_IN", { email: $("libEmail").value.trim(), password: $("libPassword").value });
    $("libPassword").value = "";
    setMsg(r.ok ? "Đăng nhập thành công" : `Đăng nhập thất bại: ${r.error}`, r.ok ? "ok" : "err");
    await refreshStatus();
    if (r.ok) { loadImages(); loadQueue(); }
  });

  $("libSignOut").addEventListener("click", async () => {
    await send("CLOUD_SIGN_OUT");
    rows = []; urls = {}; renderGrid();
    setMsg("Đã đăng xuất", "ok");
    refreshStatus();
  });

  $("libAutoSave").addEventListener("change", async (e) => {
    await send("CLOUD_SET_SETTINGS", { autoSave: e.target.checked });
    setMsg(e.target.checked ? "Đã bật tự động lưu lên cloud" : "Đã tắt tự động lưu lên cloud", "ok");
  });

  // ── Hàng đợi ──
  async function loadQueue() {
    const r = await send("CLOUD_QUEUE");
    const list = (r.ok ? r.queue : []).filter((x) => x.status !== "done").sort((a, b) => b.createdAt - a.createdAt);
    const card = $("libQueueCard");
    card.style.display = list.length ? "block" : "none";
    const wrap = $("libQueueList");
    wrap.textContent = "";
    const label = { queued: "Chờ", uploading: "Đang tải", verifying: "Đang xác minh", retry: "Thử lại", waiting_auth: "Cần đăng nhập", failed: "Lỗi", done: "Xong" };
    for (const it of list) {
      const row = document.createElement("div");
      row.className = "lib-q-item";
      row.title = it.error || "";
      const title = document.createElement("span");
      title.className = "q-title";
      title.textContent = it.meta.prompt || it.id;
      const state = document.createElement("span");
      state.className = "q-state st-" + it.status;
      state.textContent = label[it.status] || it.status;
      row.append(title, state);
      if (it.status === "failed" || it.status === "retry" || it.status === "waiting_auth") {
        const b = document.createElement("button");
        b.className = "lib-btn small";
        b.textContent = "Thử lại";
        b.addEventListener("click", async () => { await send("CLOUD_RETRY", { id: it.id }); loadQueue(); });
        row.append(b);
      }
      wrap.append(row);
    }
  }
  $("libClearDone").addEventListener("click", async () => { await send("CLOUD_CLEAR_DONE"); loadQueue(); });

  // ── Lưới ảnh ──
  function populateModelFilter() {
    const sel = $("libFilterModel");
    const cur = sel.value;
    const models = [...new Set(rows.map((r) => r.model).filter(Boolean))];
    sel.textContent = "";
    sel.append(new Option("Mọi model", ""));
    models.forEach((m) => sel.append(new Option(m, m)));
    sel.value = models.includes(cur) ? cur : "";
  }

  function visibleRows() {
    const m = $("libFilterModel").value;
    const ratio = $("libFilterRatio").value;
    return rows.filter((r) => (!m || r.model === m) && (!ratio || r.aspect_ratio === ratio));
  }

  const fmtDate = (iso) => new Date(iso).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
  const fmtSize = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.round(n / 1024) + " KB");

  function openLightbox(row) {
    const url = urls[row.storage_path];
    if (!url) return;
    const box = document.createElement("div");
    box.className = "lib-lightbox";
    const img = document.createElement("img");
    img.src = url;
    const p = document.createElement("p");
    p.textContent = `${row.prompt} — ${row.model || ""} ${row.aspect_ratio || ""} ${row.width}x${row.height}`;
    box.append(img, p);
    box.addEventListener("click", () => box.remove());
    document.body.append(box);
  }

  function downloadRow(row) {
    const url = urls[row.storage_path];
    if (!url) return;
    const ext = (row.storage_path.split(".").pop() || "png");
    // Chỉ tải khi người dùng bấm nút Tải
    chrome.downloads.download({ url, filename: `Flow_${row.id}.${ext}`, saveAs: false });
  }

  function renderGrid() {
    const list = visibleRows();
    grid.textContent = "";
    const empty = $("libEmpty");
    empty.style.display = list.length ? "none" : "block";
    if (!list.length) empty.textContent = rows.length ? "Không có ảnh khớp bộ lọc." : "Chưa có ảnh nào trên cloud.";
    for (const row of list) {
      const card = document.createElement("div");
      card.className = "lib-item";

      const thumb = document.createElement("div");
      thumb.className = "lib-thumb";
      const url = urls[row.storage_path];
      if (url) {
        const img = document.createElement("img");
        img.loading = "lazy";
        img.src = url;
        img.alt = row.prompt;
        thumb.append(img);
      } else {
        const ph = document.createElement("span");
        ph.className = "ph";
        ph.textContent = "Không tải được ảnh";
        thumb.append(ph);
      }
      thumb.addEventListener("click", () => openLightbox(row));

      const meta = document.createElement("div");
      meta.className = "lib-meta";
      const prompt = document.createElement("div");
      prompt.className = "lib-prompt";
      prompt.textContent = row.prompt;
      prompt.title = row.prompt;
      const tags = document.createElement("div");
      tags.className = "lib-tags";
      [row.model, row.aspect_ratio, row.width && `${row.width}×${row.height}`, fmtSize(row.size_bytes), "☁ Đã lưu"]
        .filter(Boolean).forEach((t) => { const s = document.createElement("span"); s.className = "lib-tag"; s.textContent = t; tags.append(s); });
      const date = document.createElement("div");
      date.className = "lib-date";
      date.textContent = fmtDate(row.created_at);
      meta.append(prompt, tags, date);

      const actions = document.createElement("div");
      actions.className = "lib-actions";
      const mk = (text, cls, fn) => { const b = document.createElement("button"); b.textContent = text; if (cls) b.className = cls; b.addEventListener("click", fn); return b; };
      actions.append(
        mk("Copy prompt", "", async () => { await navigator.clipboard.writeText(row.prompt); setMsg("Đã copy prompt", "ok"); }),
        mk("Tải", "", () => downloadRow(row)),
        mk("Xóa", "danger", async () => {
          if (!confirm("Xóa ảnh này khỏi cloud? Không thể hoàn tác.")) return;
          const r = await send("CLOUD_DELETE", { id: row.id, storage_path: row.storage_path });
          if (!r.ok) { setMsg("Xóa thất bại: " + r.error, "err"); return; }
          rows = rows.filter((x) => x.id !== row.id);
          renderGrid();
        })
      );
      card.append(thumb, meta, actions);
      grid.append(card);
    }
  }

  async function loadImages() {
    const st = await refreshStatus();
    if (!st.ok || !st.configured || !st.signedIn) {
      rows = []; renderGrid();
      $("libEmpty").style.display = "block";
      $("libEmpty").textContent = !st.configured ? "Nhập URL và anon key Supabase ở trên để bắt đầu." : "Đăng nhập Supabase để xem ảnh đã lưu.";
      return;
    }
    const r = await send("CLOUD_LIST", { search: $("libSearch").value.trim(), limit: 60 });
    if (!r.ok) { setMsg("Không tải được thư viện: " + r.error, "err"); return; }
    rows = r.rows;
    const s = await send("CLOUD_SIGN_URLS", { paths: rows.map((x) => x.storage_path) });
    urls = s.ok ? s.urls : {};
    populateModelFilter();
    renderGrid();
  }

  let searchTimer = null;
  $("libSearch").addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadImages, 350); });
  $("libFilterModel").addEventListener("change", renderGrid);
  $("libFilterRatio").addEventListener("change", renderGrid);
  $("libRefresh").addEventListener("click", () => { loadImages(); loadQueue(); });

  // Cập nhật realtime khi background upload xong
  chrome.runtime.onMessage.addListener((m) => {
    if (m.type !== "CLOUD_UPDATE") return;
    loadQueue();
    if (m.item.status === "done") loadImages();
  });

  // Khi mở tab Thư viện
  document.querySelector('.nav-tab[data-tab="library"]')?.addEventListener("click", () => {
    loadSettings(); loadImages(); loadQueue();
  });

  loadSettings();
  refreshStatus();
});
