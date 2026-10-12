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
  const refPreviewCard = document.getElementById("refPreviewCard");
  const refThumbImg = document.getElementById("refThumbImg");
  const removeThumbBtn = document.getElementById("removeThumbBtn");
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
  let referenceImageData = null;
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
    charCounter.textContent = `${text.length}/4000`;
  }
  promptInput.addEventListener("input", updateCharCount);

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

  refFileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      handleImageFile(e.target.files[0]);
    }
  });

  function handleImageFile(file) {
    const reader = new FileReader();
    reader.onload = (evt) => {
      referenceImageData = evt.target.result;
      refThumbImg.src = referenceImageData;
      refPreviewCard.style.display = "flex";
    };
    reader.readAsDataURL(file);
  }

  removeThumbBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    referenceImageData = null;
    refFileInput.value = "";
    refThumbImg.src = "";
    refPreviewCard.style.display = "none";
  });

  // Platforms Switcher
  const platformChips = document.querySelectorAll(".platform-chip");
  platformChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      platformChips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
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

  // Check Google Flow connection status
  function checkFlowStatus() {
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
    chrome.tabs.create({ url: "https://flow.google.com/" });
  });

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
      referenceImage: referenceImageData,
      autoDownload: autoDownloadToggle ? autoDownloadToggle.checked : true,
    };

    closeConfirmModal();

    generateMainBtn.style.opacity = "0.7";
    generateMainBtn.disabled = true;

    chrome.runtime.sendMessage({ type: "DISPATCH_GENERATE", payload }, (resp) => {
      generateMainBtn.disabled = false;
      generateMainBtn.style.opacity = "1";
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
    const url = $("libUrl").value.trim();
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
