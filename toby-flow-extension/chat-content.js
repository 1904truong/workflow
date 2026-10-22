// Flow Bridge — bộ chạy cho ChatGPT / Grok / Gemini (chat tạo ảnh).
// Được background tiêm vào tab khi bấm "Tạo" với nền tảng tương ứng.
(() => {
  if (window.__fbChatLoaded) return;
  window.__fbChatLoaded = true;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const visible = (el) => !!el && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
  async function waitFor(fn, timeoutMs = 8000, step = 250) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      if (stopped) return null;
      const v = fn();
      if (v) return v;
      await sleep(step);
    }
    return null;
  }

  let stopped = false;
  let running = false;

  // ── Thông báo nhỏ góc trên ──
  let toast;
  function say(text, isError) {
    console.log("[Flow Bridge][Chat]", text);
    if (!toast) {
      toast = document.createElement("div");
      toast.style.cssText = "position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#101012;color:#e8ffb0;border:1px solid #c4f135;border-radius:10px;padding:8px 14px;font:600 13px system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.5);max-width:80vw";
      document.documentElement.appendChild(toast);
    }
    toast.style.color = isError ? "#ffb4b4" : "#e8ffb0";
    toast.style.borderColor = isError ? "#e5484d" : "#c4f135";
    toast.textContent = "Flow Bridge • " + text;
  }
  const hideToast = (ms = 4000) => setTimeout(() => { toast?.remove(); toast = null; }, ms);

  const platformOf = () => {
    const h = location.hostname;
    if (/chatgpt\.com|openai\.com/.test(h)) return "chatgpt";
    if (/grok\.com|x\.com|twitter\.com/.test(h)) return "grok";
    if (/gemini\.google\.com/.test(h)) return "gemini";
    return "unknown";
  };

  // ── Tìm ô nhập ──
  function findInput() {
    const sels = {
      chatgpt: ["#prompt-textarea", "div.ProseMirror[contenteditable='true']", "textarea[data-id='root']"],
      gemini: ["rich-textarea .ql-editor", "div.ql-editor[contenteditable='true']", "div[contenteditable='true'][role='textbox']"],
      grok: ["textarea[aria-label]", "div.tiptap[contenteditable='true']", "div.ProseMirror[contenteditable='true']", "textarea"],
    }[platformOf()] || [];
    for (const s of [...sels, "div[contenteditable='true'][role='textbox']", "textarea", "div[contenteditable='true']"]) {
      const el = [...document.querySelectorAll(s)].filter(visible).sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top)[0];
      if (el) return el;
    }
    return null;
  }

  function setPromptText(el, text, opts = {}) {
    el.focus();
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    // contenteditable: xóa nội dung cũ (chỉ khi có chữ) rồi chèn.
    // opts.noClear (ChatGPT): ô nhập đang chứa chip "Tạo ảnh" — chọn-tất-cả rồi xóa sẽ xóa luôn chip
    if (!opts.noClear && (el.innerText || "").trim()) {
      const sel = getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand("delete", false, null);
    } else {
      const sel = getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    document.execCommand("insertText", false, text);
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
  }

  const readText = (el) => ((el.value ?? el.innerText ?? el.textContent) || "").replace(/\s+/g, "");

  // ── Ảnh tham chiếu: dán file vào ô nhập ──
  function dataUrlToFile(dataUrl, name) {
    const [head, b64] = dataUrl.split(",");
    const mime = (head.match(/data:([^;]+)/) || [])[1] || "image/png";
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], name, { type: mime });
  }
  const countThumbs = () => document.querySelectorAll("img[src^='blob:'], img[src^='data:']").length;

  const reportRef = (index, status, reason) => { try { chrome.runtime.sendMessage({ type: "REF_STATUS", index, status, reason }).catch?.(() => {}); } catch (_) {} };

  async function attachImages(dataUrls, inputEl) {
    let ok = 0;
    dataUrls.forEach((_, k) => reportRef(k, "pending"));
    for (let i = 0; i < dataUrls.length; i++) {
      if (stopped) return ok;
      const ext = (dataUrls[i].match(/data:image\/(\w+)/) || [])[1] || "png";
      const file = dataUrlToFile(dataUrls[i], `flow_ref_${String(i + 1).padStart(2, "0")}.${ext}`);
      reportRef(i, "uploading");
      const before = countThumbs();
      const mk = () => { const dt = new DataTransfer(); dt.items.add(file); return dt; };
      inputEl.focus();
      inputEl.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: mk() }));
      let grew = await waitFor(() => countThumbs() > before, 8000);
      if (!grew) {
        const fi = [...document.querySelectorAll("input[type='file']")].filter((x) => !x.accept || /image/i.test(x.accept)).pop();
        if (fi) {
          fi.files = mk().files;
          fi.dispatchEvent(new Event("change", { bubbles: true }));
          grew = await waitFor(() => countThumbs() > before, 8000);
        }
      }
      if (!grew) {
        const dropTarget = inputEl.closest("form") || inputEl.parentElement || inputEl;
        const dt = mk();
        for (const t of ["dragenter", "dragover", "drop"]) dropTarget.dispatchEvent(new DragEvent(t, { bubbles: true, cancelable: true, dataTransfer: dt }));
        grew = await waitFor(() => countThumbs() > before, 8000);
      }
      if (grew) ok++;
      reportRef(i, grew ? "done" : "failed", grew ? "" : "Không đính được ảnh vào ô nhập");
      say(`Ảnh tham chiếu ${i + 1}/${dataUrls.length}: ${grew ? "đã đính" : "KHÔNG đính được"}`, !grew);
      await sleep(800);
    }
    return ok;
  }

  // ── Nút gửi ──
  function findSendButton(inputEl) {
    if (!inputEl || !inputEl.isConnected) inputEl = findInput() || inputEl;
    const sels = {
      chatgpt: ["button[data-testid='send-button']", "button[aria-label*='Send' i]", "button[aria-label*='Gửi' i]"],
      gemini: ["button.send-button", "button[aria-label*='Send' i]", "button[aria-label*='Gửi' i]"],
      grok: ["button[type='submit']", "button[aria-label*='Submit' i]", "button[aria-label*='Send' i]", "button[aria-label*='Gửi' i]"],
    }[platformOf()] || [];
    for (const s of sels) {
      const b = [...document.querySelectorAll(s)].filter(visible).find((x) => !x.disabled && x.getAttribute("aria-disabled") !== "true" && !/voice|giọng|dictat|speech/i.test((x.getAttribute("aria-label") || "") + " " + (x.getAttribute("data-testid") || "")));
      if (b) return b;
    }
    // dự phòng: nút tròn nhỏ có icon, gần mép phải/dưới của khung chứa ô nhập
    const cr = composerRect(inputEl);
    const box = { querySelectorAll: () => [...document.querySelectorAll("button")].filter((b) => { const q = b.getBoundingClientRect(); const cx = q.left + q.width / 2, cy = q.top + q.height / 2; return cx >= cr.left - 8 && cx <= cr.right + 8 && cy >= cr.top - 12 && cy <= cr.bottom + 12; }) };
    const isVoice = (b) => /voice|giọng|mic|dictat|speech|âm thanh|audio|ghi âm/i.test((b.getAttribute("aria-label") || "") + " " + (b.getAttribute("data-testid") || ""));
    return [...box.querySelectorAll("button")].filter(visible).filter((b) => !b.disabled && b.querySelector("svg") && !isVoice(b)).sort((a, b) => {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      return (rb.right + rb.bottom) - (ra.right + ra.bottom);
    })[0] || null;
  }

  async function trustedClick(el) {
    const r = el.getBoundingClientRect();
    try {
      const res = await FBGuard.send({ type: "TRUSTED_CLICK", payload: { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) } });
      if (res && res.success) return true;
    } catch (_) {}
    el.click();
    return false;
  }

  // ── Phát hiện đang tạo / có ảnh mới ──
  const isBusy = () => !![...document.querySelectorAll("button")].filter(visible).find((b) => /stop|dừng|ngừng/i.test((b.getAttribute("aria-label") || "") + " " + (b.getAttribute("data-testid") || "")));
  const bigImgs = () => new Set([...document.querySelectorAll("img")].filter((im) => {
    const r = im.getBoundingClientRect();
    return r.width >= 200 && r.height >= 200 && !im.src.startsWith("data:image/svg");
  }));


  // ════════ ChatGPT: chế độ "Tạo ảnh" + mức suy luận + câu tỉ lệ khung ════════
  const tClick = async (el) => {
    const r = el.getBoundingClientRect();
    try {
      const res = await FBGuard.send({ type: "TRUSTED_CLICK", payload: { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) } });
      if (res && res.success) return true;
    } catch (_) {}
    el.click();
    return false;
  };
  const tKeys = (keys) => FBGuard.send({ type: "TRUSTED_CLICK", payload: { pressKeys: keys } }).catch(() => {});
  const composerForm = (inputEl) => inputEl.closest("form") || inputEl.parentElement?.parentElement?.parentElement || document;

  const RATIO_TEXT = {
    "16:9": "16:9 (landscape)", "9:16": "9:16 (portrait)", "1:1": "1:1 (square)",
    "4:3": "4:3 (landscape)", "3:4": "3:4 (portrait)", "3:2": "3:2 (landscape)", "2:3": "2:3 (portrait)",
  };

  // Menu dấu "+" đang mở? (có dòng "Thêm ảnh & tệp")
  const menuOpen = () => [...document.querySelectorAll("div, span, button, li, [role='menuitem']")].filter(visible)
    .some((e) => e.children.length <= 3 && /^(thêm ảnh (&|và) tệp|add photos)/i.test((e.textContent || "").trim()));

  // Khung thanh nhập liệu (cả thanh bo tròn gồm +, chip, ô chữ, mức suy luận, mic, gửi):
  // leo từ ô nhập lên tổ tiên đầu tiên đủ rộng. Khi có chip "Tạo ảnh", chính ô nhập chỉ còn là đoạn hẹp.
  function composerRect(inputEl) {
    // ô nhập cũ có thể đã bị ChatGPT gỡ khỏi trang sau khi đổi chế độ -> lấy ô nhập hiện tại
    if (!inputEl || !inputEl.isConnected) inputEl = findInput() || inputEl;
    let el = inputEl;
    while (el && el !== document.body) {
      const r = el.getBoundingClientRect();
      if (r.width >= 450 && r.height >= 40) return r;
      el = el.parentElement;
    }
    return inputEl.getBoundingClientRect();
  }

  // Các nút nằm TRONG thanh nhập liệu
  function nearButtons(inputEl) {
    const c = composerRect(inputEl);
    return [...document.querySelectorAll("button, [role='button']")].filter(visible).filter((b) => {
      const q = b.getBoundingClientRect();
      const cx = q.left + q.width / 2, cy = q.top + q.height / 2;
      return cx >= c.left - 8 && cx <= c.right + 8 && cy >= c.top - 12 && cy <= c.bottom + 12;
    });
  }

  // Đã ở chế độ "Tạo ảnh"? = có chip "Tạo ảnh" trong thanh nhập VÀ menu "+" đã đóng
  function inImageMode(inputEl) {
    if (menuOpen()) return false;
    const c = composerRect(inputEl);
    return [...document.querySelectorAll("button, span, div")].filter(visible).some((e) => {
      if (e.children.length > 3 || !/^(tạo ảnh|create image)$/i.test((e.textContent || "").trim())) return false;
      const q = e.getBoundingClientRect();
      const cx = q.left + q.width / 2, cy = q.top + q.height / 2;
      return cx >= c.left - 8 && cx <= c.right + 8 && cy >= c.top - 12 && cy <= c.bottom + 12;
    });
  }

  // Mục "Tạo ảnh" trong danh sách đang mở: nằm ngay dưới dòng "Thêm ảnh & tệp" (không lấy chip "Tạo ảnh" của tin nhắn cũ)
  function findCreateImageMenuItem() {
    const all = [...document.querySelectorAll("span, div, li, button, [role='menuitem'], [role='option']")].filter(visible);
    const anchor = all.find((e) => e.children.length <= 3 && /^(thêm ảnh (&|và) tệp|add photos)/i.test((e.textContent || "").trim()));
    if (!anchor) return null;
    const ar = anchor.getBoundingClientRect();
    return all.filter((e) => {
      if (e.children.length > 2 || !/^(tạo ảnh|create image)$/i.test((e.textContent || "").trim())) return false;
      const q = e.getBoundingClientRect();
      return q.top > ar.top && q.top - ar.top < 500 && Math.abs(q.left - ar.left) < 400;
    }).sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0] || null;
  }

  // Cách chính: gõ "@" -> chờ ~2 giây cho danh sách hiện -> chọn "Tạo ảnh"
  async function chatgptEnableViaAt(inputEl) {
    inputEl = findInput() || inputEl;
    if (menuOpen()) { await tKeys(["Escape"]); await sleep(400); }
    await tClick(inputEl);
    await sleep(300);
    await FBGuard.send({ type: "TRUSTED_CLICK", payload: { pressText: "@" } }).catch(() => {});
    say("ChatGPT: đã gõ @ — chờ 2 giây để danh sách hiện...");
    await sleep(2000);
    const cleanup = async () => {
      if (menuOpen()) { await tKeys(["Escape"]); await sleep(300); }
      const cur = findInput() || inputEl;
      if (/^@$/.test((cur.innerText || cur.textContent || "").trim())) await tKeys(["Backspace"]);
    };
    if (!menuOpen()) { console.warn("[Flow Bridge][Chat] Gõ @ nhưng danh sách chưa hiện"); await cleanup(); return false; }
    const it = await waitFor(findCreateImageMenuItem, 3000);
    if (!it) { await cleanup(); return false; }
    await tClick(it);
    if (await waitFor(() => inImageMode(findInput() || inputEl), 3500)) { say("ChatGPT: đã bật chế độ Tạo ảnh (qua @)"); return true; }
    console.warn("[Flow Bridge][Chat] Chọn 'Tạo ảnh' qua @ chưa được");
    await cleanup();
    return false;
  }

  async function chatgptEnableImageMode(inputEl) {
    if (inImageMode(inputEl)) return true;
    for (let k = 1; k <= 2; k++) {
      try { if (await chatgptEnableViaAt(inputEl)) return true; } catch (e) { console.warn("[Flow Bridge][Chat] Cách @ lỗi:", e.message); }
    }
    console.warn("[Flow Bridge][Chat] Cách @ không được, thử cách bấm dấu '+'");
    return chatgptEnableViaPlus(inputEl);
  }

  async function chatgptEnableViaPlus(inputEl) {
    if (inImageMode(inputEl)) return true;
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (!menuOpen()) {
        const buttons = nearButtons(inputEl);
        const plus = buttons.find((b) => /thêm|add|attach|tệp|file|upload|plus|open/i.test((b.getAttribute("aria-label") || "") + " " + (b.getAttribute("data-testid") || ""))) ||
          buttons.sort((x, y) => x.getBoundingClientRect().left - y.getBoundingClientRect().left)[0];
        if (!plus) throw new Error("Không thấy dấu '+' cạnh ô nhập ChatGPT");
        await tClick(plus);
        if (!(await waitFor(menuOpen, 4000))) { console.warn("[Flow Bridge][Chat] Menu '+' chưa mở, thử lại", attempt); continue; }
      }
      const item = await waitFor(findCreateImageMenuItem, 4000);
      if (!item) throw new Error("Không thấy mục 'Tạo ảnh' trong menu dấu '+'");
      await tClick(item);
      if (await waitFor(() => inImageMode(inputEl), 2500)) { say("ChatGPT: đã bật chế độ Tạo ảnh"); return true; }
      // chưa được: thử bấm cả dòng chứa mục đó, rồi click thường
      const row = item.closest("[role='menuitem'], li, button, a") || item.parentElement;
      if (row && row !== item) await tClick(row);
      if (await waitFor(() => inImageMode(inputEl), 2500)) { say("ChatGPT: đã bật chế độ Tạo ảnh"); return true; }
      item.click(); row?.click?.();
      if (await waitFor(() => inImageMode(inputEl), 2500)) { say("ChatGPT: đã bật chế độ Tạo ảnh"); return true; }
      console.warn("[Flow Bridge][Chat] Bật chế độ Tạo ảnh chưa được, thử lại", attempt);
      if (menuOpen()) await tKeys(["Escape"]);
      await sleep(500);
    }
    // Dự phòng: gõ "@" vào ô nhập -> hiện danh sách -> chọn "Tạo ảnh"
    console.warn("[Flow Bridge][Chat] Thử cách gõ @ rồi chọn 'Tạo ảnh'");
    if (menuOpen()) { await tKeys(["Escape"]); await sleep(400); }
    inputEl = findInput() || inputEl;
    await tClick(inputEl);
    await sleep(300);
    document.execCommand("insertText", false, "@");
    inputEl.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: "@" }));
    if (await waitFor(menuOpen, 4000)) {
      const it = await waitFor(findCreateImageMenuItem, 3000);
      if (it) {
        await tClick(it);
        if (await waitFor(() => inImageMode(inputEl), 3000)) { say("ChatGPT: đã bật chế độ Tạo ảnh (qua @)"); return true; }
      }
    }
    // dọn ký tự "@" còn sót nếu không thành công
    if (menuOpen()) { await tKeys(["Escape"]); await sleep(300); }
    if (/^@$/.test((inputEl.innerText || inputEl.textContent || "").trim())) { await tKeys(["Backspace"]); }
    throw new Error("Đã bấm 'Tạo ảnh' nhưng ChatGPT chưa chuyển sang chế độ tạo ảnh");
  }

  // level 1..3 = vị trí trên thanh trượt (1 = Tức thì)
  async function chatgptSetEffort(inputEl, level) {
    if (!inputEl.isConnected) inputEl = findInput() || inputEl;
    if (menuOpen()) { await tKeys(["Escape"]); await sleep(400); }
    const LEVEL_LABEL = /^(tức thì|vừa|cao|instant|medium|high|standard|pro|thinking|extended|auto|nhanh|chuẩn)$/i;
    const near = nearButtons(inputEl);
    const labelOf = (b) => (b.textContent || "").trim();
    const crect = composerRect(inputEl);
    // log dạng chuỗi để đọc được ngay (không bị gập như Array(n))
    console.log("[Flow Bridge][Chat] Nút trong thanh nhập: " + JSON.stringify(near.map((b) => ({
      text: labelOf(b).slice(0, 20), aria: b.getAttribute("aria-label") || "", testid: b.getAttribute("data-testid") || "",
      x: Math.round(b.getBoundingClientRect().left), html: b.outerHTML.slice(0, 90),
    }))));
    // 1) theo chữ trên nút / nhãn
    let trigger = near.find((b) => LEVEL_LABEL.test(labelOf(b))) ||
      near.find((b) => /suy luận|reasoning|mức nỗ lực|effort|thinking|intelligence/i.test((b.getAttribute("aria-label") || "") + " " + (b.getAttribute("data-testid") || "")));
    // 2) chữ mức nằm ở phần tử bất kỳ trong thanh nhập -> bấm phần tử đó (hoặc nút/thẻ bao quanh)
    if (!trigger) {
      const el = [...document.querySelectorAll("span, div, button, [role='button']")].filter(visible).find((e) => {
        if (e.children.length > 2 || !LEVEL_LABEL.test((e.textContent || "").trim())) return false;
        const q = e.getBoundingClientRect(); const cx = q.left + q.width / 2, cy = q.top + q.height / 2;
        return cx >= crect.left - 8 && cx <= crect.right + 8 && cy >= crect.top - 12 && cy <= crect.bottom + 12;
      });
      if (el) trigger = el.closest("button, [role='button']") || el;
    }
    // 3) theo vị trí: mic = nút nằm ngay trước nút gửi (ngoài cùng bên phải); mức suy luận = nút ngay trước mic
    if (!trigger) {
      const sorted = [...near].sort((x, y) => x.getBoundingClientRect().left - y.getBoundingClientRect().left);
      if (sorted.length >= 4) trigger = sorted[sorted.length - 3];
    }
    const findSlider = () => [...document.querySelectorAll("[role='slider'], input[type='range']")].filter(visible)[0];
    const LEVEL_RE = [/tức thì|instant/i, /vừa|medium/i, /cao|high/i];
    const currentLabel = () => {
      const bs = nearButtons(inputEl);
      const b = bs.find((x) => LEVEL_LABEL.test(labelOf(x)));
      if (b) return labelOf(b);
      const el = [...document.querySelectorAll("span, div")].filter(visible).find((e) => e.children.length <= 2 && LEVEL_LABEL.test((e.textContent || "").trim()));
      return el ? (el.textContent || "").trim() : "";
    };
    // Mở bảng: bấm nút -> nếu chưa có thanh trượt thì dùng phím tắt Ctrl+Shift+M ("Mức nỗ lực suy luận")
    let slider = null;
    if (trigger) { await tClick(trigger); slider = await waitFor(findSlider, 2500); }
    if (!slider) {
      console.warn("[Flow Bridge][Chat] Chưa thấy thanh trượt, dùng phím tắt Ctrl+Shift+M");
      await tKeys(["Escape"]); await sleep(300);
      await FBGuard.send({ type: "TRUSTED_CLICK", payload: { pressCombo: { key: "M", code: "KeyM", vk: 77, modifiers: 10 } } }).catch(() => {});
      slider = await waitFor(findSlider, 3000);
    }
    if (!slider && !trigger) throw new Error("Không thấy nút chọn mức suy luận cạnh mic");
    if (slider && slider.tagName === "INPUT") {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(slider, String(Math.min(+slider.max || 2, level - 1)));
      slider.dispatchEvent(new Event("input", { bubbles: true }));
      slider.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      if (slider) await tClick(slider); // lấy focus (nếu không thấy thanh trượt, vẫn gửi phím vì bảng thường tự nhận focus)
      await tKeys(["Home", ...Array(Math.max(0, level - 1)).fill("ArrowRight")]);
    }
    await sleep(500);
    await tKeys(["Escape"]);
    await sleep(500);
    const now = currentLabel();
    console.log("[Flow Bridge][Chat] Mức suy luận sau khi chọn:", now, "| mong muốn mức", level);
    if (now && !LEVEL_RE[level - 1].test(now)) throw new Error(`Chọn mức suy luận chưa đúng (đang "${now}", cần mức ${level}/3)`);
    say(`ChatGPT: đã chọn mức ${level}/3`);
  }

  // ChatGPT: lưu ảnh mới tạo — chọn ảnh -> nút "Chia sẻ" dưới ảnh -> "Tải xuống" trong hộp thoại
  async function chatgptDownloadViaUI(before) {
    // ChatGPT có thể thay phần tử ảnh khi tạo xong -> lấy lại ảnh mới nhất (thấp nhất trên trang) không thuộc ảnh cũ
    const latest = () => [...bigImgs()].filter((im) => !before.has(im) && visible(im)).sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0];
    const img = await waitFor(latest, 8000);
    if (!img) throw new Error("Không thấy ảnh mới để tải xuống");
    img.scrollIntoView({ block: "center" });
    await sleep(700);
    const findShare = () => {
      const im = latest();
      if (!im) return null;
      const ir = im.getBoundingClientRect();
      return [...document.querySelectorAll("button, [role='button']")].filter(visible).filter((b) => {
        const q = b.getBoundingClientRect();
        const label = (b.getAttribute("aria-label") || "") + " " + (b.getAttribute("data-testid") || "");
        return /chia sẻ|share/i.test(label) && q.top >= ir.bottom - 4 && q.top <= ir.bottom + 200; // nút ở hàng dưới ảnh, không phải nút nhỏ trên ảnh
      }).sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0] || null;
    };
    const share = await waitFor(findShare, 8000);
    if (!share) throw new Error("Không thấy nút 'Chia sẻ' dưới ảnh");
    await tClick(share);
    // Nhãn "Tải xuống" nằm DƯỚI vòng tròn biểu tượng: nút thật là vòng tròn phía trên nhãn
    const label = await waitFor(() => [...document.querySelectorAll("button, [role='button'], div, span")].filter(visible)
      .find((e) => e.children.length <= 2 && /^(tải xuống|download)$/i.test((e.textContent || "").trim())), 6000);
    if (!label) { await tKeys(["Escape"]); throw new Error("Không thấy nút 'Tải xuống' trong hộp thoại chia sẻ"); }
    const lr = label.getBoundingClientRect();
    const byAria = [...document.querySelectorAll("button, [role='button'], a")].filter(visible)
      .find((b) => /tải xuống|download/i.test((b.getAttribute("aria-label") || "") + " " + (b.getAttribute("title") || "")));
    const above = [...document.querySelectorAll("button, [role='button'], a")].filter(visible).filter((b) => {
      const q = b.getBoundingClientRect();
      return q.bottom <= lr.top + 6 && lr.top - q.bottom < 80 && Math.abs((q.left + q.width / 2) - (lr.left + lr.width / 2)) < 50;
    }).sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0];
    const wrap = label.closest("button, [role='button'], a");
    const targets = [byAria, above, wrap, label].filter((x, i, arr) => x && arr.indexOf(x) === i);
    console.log("[Flow Bridge][Chat] Ứng viên nút Tải xuống:", targets.length);
    let started = false;
    for (const target of targets) {
      const waitP = chrome.runtime.sendMessage({ type: "WAIT_DOWNLOAD", payload: { timeoutMs: 7000 } }).catch(() => ({ started: false }));
      await tClick(target);
      const res = await waitP;
      if (res && res.started) { started = true; console.log("[Flow Bridge][Chat] Chrome bắt đầu tải:", res.filename || res.url); break; }
      console.warn("[Flow Bridge][Chat] Bấm nút này chưa thấy tải, thử ứng viên khác");
    }
    if (!started) { await tKeys(["Escape"]); throw new Error("Đã bấm 'Tải xuống' nhưng Chrome không bắt đầu tải file nào"); }
    say("Đã tải ảnh xuống");
    await sleep(2000);
    await tKeys(["Escape"]); // đóng hộp thoại chia sẻ
    await sleep(600);
  }

  // Dự phòng: tải thẳng file ảnh từ địa chỉ ảnh trên trang (không qua giao diện Chia sẻ)
  async function chatgptDownloadViaSrc(before, prompt) {
    const img = [...bigImgs()].filter((im) => !before.has(im) && visible(im)).sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0]
      || [...bigImgs()].filter(visible).sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0];
    if (!img) throw new Error("Không thấy ảnh để tải");
    const src = img.currentSrc || img.src;
    if (!src) throw new Error("Ảnh không có địa chỉ để tải");
    const filename = FBGuard.fileName(prompt, 0, 1);
    if (/^(blob:|data:)/.test(src)) {
      const waitP = chrome.runtime.sendMessage({ type: "WAIT_DOWNLOAD", payload: { timeoutMs: 8000 } }).catch(() => ({ started: false }));
      const a = document.createElement("a");
      a.href = src; a.download = filename; a.style.display = "none";
      document.body.appendChild(a); a.click(); a.remove();
      const r = await waitP;
      if (!r || !r.started) throw new Error("Đã gửi lệnh tải ảnh nhưng Chrome chưa bắt đầu tải");
      console.log("[Flow Bridge][Chat] Đã tải ảnh (blob):", r.filename || filename);
    } else {
      // Chrome trả về downloadId ngay khi lượt tải được tạo -> đủ để xác nhận đã bắt đầu tải
      const res = await chrome.runtime.sendMessage({ type: "DOWNLOAD_IMAGE", payload: { url: src, filename } }).catch(() => null);
      if (!res || !res.success) throw new Error("Chrome từ chối tải địa chỉ ảnh này");
      console.log("[Flow Bridge][Chat] Đã tải ảnh qua địa chỉ ảnh, downloadId =", res.downloadId, filename);
    }
  }

  async function chatgptDownloadLatest(before, prompt) {
    try {
      await chatgptDownloadViaSrc(before, prompt);
      say("Đã tải ảnh xuống");
      await sleep(1000);
      return;
    } catch (e) {
      console.warn("[Flow Bridge][Chat] Tải trực tiếp lỗi:", e.message, "→ thử nút Chia sẻ → Tải xuống");
      say("Tải trực tiếp lỗi (" + e.message + ") — thử qua nút Chia sẻ...", true);
    }
    await chatgptDownloadViaUI(before);
  }

  // ── Lưu ảnh lên Supabase (dùng lại hàng đợi cloud của extension, giống Flow) ──
  const blobToBase64 = (blob) => new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(",")[1] || "");
    fr.onerror = () => reject(fr.error || new Error("Không đọc được ảnh"));
    fr.readAsDataURL(blob);
  });
  const b64ToBlob = (b64, type) => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: type || "image/png" });
  };

  async function fetchImageBlobAny(src) {
    try {
      const r = await fetch(src, { credentials: "include" });
      if (r.ok) { const b = await r.blob(); if (b.size) return b; }
    } catch (_) {}
    // Content script không đọc được: nhờ background (có host permission + cookie) tải hộ
    const res = await chrome.runtime.sendMessage({ type: "CLOUD_FETCH_IMAGE", payload: { url: src } });
    if (!res || !res.ok || !res.base64) throw new Error("Không tải được dữ liệu ảnh để lưu lên Supabase");
    return b64ToBlob(res.base64, res.type);
  }

  async function chatgptSaveToCloud(before, prompt, opts) {
    const st = await chrome.runtime.sendMessage({ type: "CLOUD_STATUS" }).catch(() => null);
    if (!st || !st.ok || !st.enabled) { console.log("[Flow Bridge][Chat] Auto Save Cloud đang tắt, bỏ qua lưu Supabase"); return false; }
    if (!st.signedIn) say("Supabase: chưa đăng nhập — ảnh sẽ chờ trong hàng đợi, hãy đăng nhập trong Cài đặt cloud", true);
    const img = [...bigImgs()].filter((im) => !before.has(im) && visible(im)).sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0];
    if (!img) throw new Error("Không thấy ảnh mới để lưu lên Supabase");
    const src = img.currentSrc || img.src;
    const blob = await fetchImageBlobAny(src);
    const bmp = await createImageBitmap(blob);
    const dims = { width: bmp.width, height: bmp.height };
    bmp.close?.();
    const jobId = crypto.randomUUID();
    const r = await chrome.runtime.sendMessage({
      type: "CLOUD_ENQUEUE",
      payload: {
        jobId, base64: await blobToBase64(blob), width: dims.width, height: dims.height, source: src.startsWith("blob:") ? "chatgpt:blob" : src.slice(0, 200),
        meta: { platform: "ChatGPT", prompt, model: `ChatGPT (mức ${opts.effort || 1}/3)`, aspectRatio: opts.aspectRatio || null, expected: 1, index: 0 },
      },
    });
    if (!r || !r.ok) throw new Error(`${r && r.code}: ${r && r.error}`);
    await chrome.runtime.sendMessage({ type: "CLOUD_FINISH_JOB", payload: { jobId, expected: 1 } }).catch(() => null);
    say(`Đã đưa ảnh ${dims.width}x${dims.height} vào hàng đợi Supabase`);
    console.log("[Flow Bridge][Chat] Đã enqueue ảnh lên Supabase, jobId =", jobId);
    return true;
  }

  // Lệnh từ web: lưu ảnh lên Supabase, chờ upload xong, trả link có chữ ký (hiệu lực 7 ngày); null nếu chưa cấu hình Supabase
  async function chatgptWebViaSupabase(src, prompt, opts) {
    const st = await chrome.runtime.sendMessage({ type: "CLOUD_STATUS" }).catch(() => null);
    if (!st || !st.ok || !st.configured || !st.signedIn) return null;
    const blob = await fetchImageBlobAny(src);
    const bmp = await createImageBitmap(blob);
    const dims = { width: bmp.width, height: bmp.height };
    bmp.close?.();
    const jobId = crypto.randomUUID();
    const r = await chrome.runtime.sendMessage({ type: "CLOUD_ENQUEUE", payload: { jobId, base64: await blobToBase64(blob), width: dims.width, height: dims.height, source: src.startsWith("blob:") ? "chatgpt:blob" : src.slice(0, 200), meta: { platform: "ChatGPT", prompt, model: `ChatGPT (mức ${opts.effort || 1}/3)`, aspectRatio: opts.aspectRatio || null, expected: 1, index: 0 } } });
    if (!r || !r.ok) throw new Error(`${r && r.code}: ${r && r.error}`);
    await chrome.runtime.sendMessage({ type: "CLOUD_FINISH_JOB", payload: { jobId, expected: 1 } }).catch(() => null);
    let item = null;
    const t0 = Date.now();
    while (Date.now() - t0 < 150000) {
      const q = await chrome.runtime.sendMessage({ type: "CLOUD_QUEUE" }).catch(() => null);
      item = q && q.ok && (q.queue || []).find((x) => x.id === r.id);
      if (item && item.status === "done") break;
      if (item && item.status === "failed") throw new Error("Upload Supabase thất bại: " + (item.error || "không rõ"));
      await sleep(1500);
    }
    if (!item || item.status !== "done" || !item.storagePath) throw new Error("Quá thời gian chờ upload Supabase");
    const signed = await chrome.runtime.sendMessage({ type: "CLOUD_SIGN_URLS", payload: { paths: [item.storagePath], expiresIn: 604800 } }).catch(() => null);
    const url = signed && signed.ok && signed.urls && signed.urls[item.storagePath];
    if (!url) throw new Error("Không tạo được link ảnh Supabase");
    return { ok: true, imageUrl: url, imageUrls: [url], source: "supabase", storagePath: item.storagePath };
  }

  async function runOne(prompt, refs, opts) {
    let inputEl = await waitFor(findInput, 20000);
    if (!inputEl) throw new Error("Không tìm thấy ô nhập của " + platformOf());
    const before = bigImgs();
    const isGpt = platformOf() === "chatgpt";

    if (isGpt) {
      await chatgptEnableImageMode(inputEl);
      await sleep(800);
      inputEl = findInput() || inputEl;
      await chatgptSetEffort(inputEl, opts.effort || 1);
      inputEl = findInput() || inputEl;
    }

    if (refs.length) {
      say(`Đang đính ${refs.length} ảnh tham chiếu...`);
      const n = await attachImages(refs, inputEl);
      if (n < refs.length) throw new Error(`Chỉ đính được ${n}/${refs.length} ảnh tham chiếu — dừng để không tạo sai ảnh`);
    }

    // Sau khi đính ảnh / đổi chế độ, ChatGPT thường dựng lại ô nhập -> lấy lại ô mới và giữ chế độ "Tạo ảnh"
    await sleep(600);
    inputEl = findInput() || inputEl;
    if (isGpt && !inImageMode(inputEl)) { await chatgptEnableImageMode(inputEl); inputEl = findInput() || inputEl; }
    await tClick(inputEl); // lấy focus bằng chuột thật
    await sleep(300);
    // Có ảnh tham chiếu: đặt tên Ảnh 1, Ảnh 2... theo thứ tự đính và dặn ChatGPT dùng chúng làm style/tham chiếu
    const refNote = refs.length
      ? `I attached ${refs.length} reference image${refs.length > 1 ? "s" : ""} (${refs.map((_, i) => `Image ${i + 1}`).join(", ")}, in the order attached). Generate the new image in the style of, and based on, ${refs.length > 1 ? "these reference images" : "this reference image"}.

`
      : "";
    const text = isGpt ? `${refNote}${prompt}${opts.suffix}` : `${opts.prefix}${refNote}${prompt}${opts.suffix}`;
    setPromptText(inputEl, text, { noClear: isGpt });
    if (isGpt) {
      // Bảo hiểm: nếu chip "Tạo ảnh" vẫn bị mất thì bật lại (chữ đã điền được giữ nguyên) rồi kiểm tra lại
      await sleep(400);
      if (!inImageMode(inputEl)) {
        console.warn("[Flow Bridge][Chat] Chip 'Tạo ảnh' bị mất sau khi điền prompt, bật lại");
        await chatgptEnableImageMode(inputEl);
        inputEl = findInput() || inputEl;
        if (!inImageMode(inputEl)) throw new Error("Chế độ 'Tạo ảnh' bị mất và không bật lại được — dừng để không gửi sai kiểu");
      }
    }
    await sleep(500);
    if (!readText(inputEl).includes(text.replace(/\s+/g, "").slice(0, 30))) throw new Error("Prompt chưa được điền vào ô nhập (xác minh thất bại)");

    say("Đang gửi lệnh...");
    inputEl = findInput() || inputEl;
    const liveText = () => readText(findInput() || inputEl); // luôn đọc ô nhập hiện tại (ô cũ bị gỡ sẽ trả chuỗi rỗng -> báo "đã gửi" nhầm)
    if (!liveText()) throw new Error("Ô nhập đang trống trước khi gửi (prompt bị mất) — dừng lại");
    const describe = (b) => `${b.getAttribute("data-testid") || ""}|${b.getAttribute("aria-label") || ""}|disabled=${b.disabled}|x=${Math.round(b.getBoundingClientRect().left)},y=${Math.round(b.getBoundingClientRect().top)}`;
    let btn = await waitFor(() => findSendButton(inputEl), 15000);
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (btn) {
        console.log(`[Flow Bridge][Chat] Nút gửi (lần ${attempt}):`, describe(btn));
        await trustedClick(btn);
      } else {
        console.warn("[Flow Bridge][Chat] Không thấy nút gửi, dùng phím Enter");
        await FBGuard.send({ type: "TRUSTED_CLICK", payload: { pressEnter: true } });
      }
      // Xác nhận đã gửi: ô nhập (hiện tại) trống đi hoặc bắt đầu "đang tạo"
      if (await waitFor(() => !liveText() || isBusy(), 8000)) break;
      if (attempt === 3) throw new Error("Chưa xác nhận lệnh đã được gửi (bấm nút gửi và Enter đều không có phản hồi)");
      console.warn("[Flow Bridge][Chat] Chưa thấy gửi được, tìm lại nút và thử lại");
      inputEl = findInput() || inputEl;
      btn = findSendButton(inputEl);
    }

    say("Đang chờ ảnh được tạo...");
    // chờ có ảnh mới và hết trạng thái "đang tạo"
    const done = await waitFor(() => {
      const now = bigImgs();
      const fresh = [...now].filter((im) => !before.has(im));
      return fresh.length && !isBusy() ? fresh : null;
    }, opts.timeoutMs, 1500);
    if (!done) throw new Error("Quá thời gian chờ ảnh (hoặc nền tảng không trả ảnh)");
    await sleep(1500);
    if (opts.autoDownload && isGpt) {
      try { await chatgptDownloadLatest(before, prompt); }
      catch (e) { console.warn("[Flow Bridge][Chat] Tải ảnh thất bại:", e.message); say("Ảnh đã tạo nhưng chưa tải được: " + e.message, true); await sleep(2500); }
    }
    // Bước cuối: lưu ảnh lên Supabase (khi bật Auto Save Cloud)
    if (isGpt && !opts._webReq) {
      try { await chatgptSaveToCloud(before, prompt, opts); }
      catch (e) { console.warn("[Flow Bridge][Chat] Lưu Supabase thất bại:", e.message); say("Ảnh đã tạo nhưng chưa lưu được lên Supabase: " + e.message, true); await sleep(2500); }
    }
    // Nếu có yêu cầu từ web Studio: gửi URL ảnh về web
    if (opts._webReq) {
      try {
        const fresh = [...bigImgs()].filter((im) => !before.has(im) && visible(im)).sort((x, y) => y.getBoundingClientRect().bottom - x.getBoundingClientRect().bottom)[0] || done[done.length - 1];
        let src = fresh ? (fresh.currentSrc || fresh.src) : "";
        // Link ảnh ChatGPT cần đăng nhập/blob nên web không mở được: lưu lên Supabase rồi trả link; không có Supabase thì trả data URL
        let result = null;
        try { result = await chatgptWebViaSupabase(src, prompt, opts); } catch (e) { console.warn("[Flow Bridge][Chat] Supabase lỗi:", e.message); }
        if (result) { chrome.runtime.sendMessage({ type: "WEB_GEN_DONE", payload: { reqId: opts._webReq, ...result } }).catch(() => {}); return done.length; }
        try { if (src) src = "data:" + (await fetchImageBlobAny(src).then(async (b) => { const t = b.type || "image/png"; return t + ";base64," + await blobToBase64(b); })); } catch (e) { console.warn("[Flow Bridge][Chat] Không đổi được ảnh sang data URL:", e.message); }
        if (!src) throw new Error("Không lấy được ảnh để gửi về web");
        chrome.runtime.sendMessage({
          type: "WEB_GEN_DONE",
          payload: { reqId: opts._webReq, ok: true, imageUrl: src, source: "chatgpt" }
        }).catch(() => {});
      } catch (e) {
        console.warn("[Flow Bridge][Chat] Báo web kết quả thất bại:", e);
        chrome.runtime.sendMessage({ type: "WEB_GEN_DONE", payload: { reqId: opts._webReq, ok: false, code: "IMAGE_READ_FAILED", message: String(e && e.message || e) } }).catch(() => {});
      }
    }
    return done.length;
  }

  // Lệnh từ web Studio: mọi lỗi phải báo về web ngay (không thì web chờ "Generating…" tới khi tự hết hạn)
  const reportWebFail = (payload, code, message) => {
    if (!payload || !payload._webReq) return;
    chrome.runtime.sendMessage({ type: "WEB_GEN_DONE", payload: { reqId: payload._webReq, ok: false, code, message } }).catch(() => {});
  };

  async function runQueue(payload) {
    if (running) { say("Đang có tác vụ chạy, bỏ qua", true); hideToast(); reportWebFail(payload, "BUSY", "Extension đang chạy một tác vụ khác trên ChatGPT. Hãy đợi xong (hoặc bấm Dừng) rồi tạo lại."); return; }
    running = true; stopped = false;
    FBGuard.show();
    const prompts = (payload.prompts || []).filter((p) => p && p.trim());
    const refs = (payload.referenceImages || []).slice(0, 3);
    const isGptPlatform = platformOf() === "chatgpt";
    const ratioLabel = RATIO_TEXT[payload.aspectRatio] || payload.aspectRatio;
    const ratio = payload.aspectRatio
      ? (isGptPlatform ? ` Generate the image in ${ratioLabel} aspect ratio.` : `, tỉ lệ khung hình ${payload.aspectRatio}`)
      : "";
    const opts = { prefix: "Hãy tạo ảnh: ", suffix: ratio, timeoutMs: 240000, autoDownload: payload.autoDownload !== false, effort: Math.min(3, Math.max(1, +payload.chatgptEffort || 1)), aspectRatio: payload.aspectRatio, _webReq: payload._webReq };
    try {
      for (let i = 0; i < prompts.length; i++) {
        if (stopped) break;
        say(`Prompt ${i + 1}/${prompts.length}...`);
        const n = await runOne(prompts[i], refs, opts);
        say(`Xong prompt ${i + 1}/${prompts.length} (${n} ảnh)`);
        await sleep(2000);
      }
      if (stopped) { say("Đã dừng", true); reportWebFail(payload, "STOPPED", "Bạn đã dừng việc tạo ảnh trên extension"); } else say(`Hoàn tất ${prompts.length} prompt`);
    } catch (e) {
      console.error("[Flow Bridge][Chat]", e);
      say("Lỗi: " + e.message, true);
      reportWebFail(payload, /Quá thời gian/.test(e.message) ? "TIMEOUT" : "CHATGPT_FAILED", "ChatGPT không trả được ảnh: " + e.message);
    } finally {
      running = false;
      FBGuard.hide();
      hideToast(6000);
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "RUN_CHAT_AUTOMATION") { runQueue(message.payload); sendResponse({ success: true }); return true; }
    if (message.type === "STOP_AUTOMATION") { stopped = true; }
  });
})();
