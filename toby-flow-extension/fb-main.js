// Chạy trong MAIN world: chặn hộp thoại chọn file của Flow, để extension tự đưa file vào input.
(() => {
  if (window.__fbFilePatched) return;
  window.__fbFilePatched = true;
  const mark = (inp) => {
    inp.setAttribute("data-fb-file", "1");
    if (!inp.isConnected) { inp.style.display = "none"; (document.body || document.documentElement).appendChild(inp); }
  };
  const origClick = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function () {
    if (this.type === "file" && window.__fbIntercept) { mark(this); return; }
    return origClick.apply(this, arguments);
  };
  if (HTMLInputElement.prototype.showPicker) {
    const origShow = HTMLInputElement.prototype.showPicker;
    HTMLInputElement.prototype.showPicker = function () {
      if (this.type === "file" && window.__fbIntercept) { mark(this); return; }
      return origShow.apply(this, arguments);
    };
  }
  // content script (isolated) bật/tắt chặn qua sự kiện trên document
  document.addEventListener("fb-intercept", (e) => { window.__fbIntercept = !!(e.detail ?? e.target?.dataset?.fbIntercept); });
  document.addEventListener("fb-intercept-on", () => { window.__fbIntercept = true; });
  document.addEventListener("fb-intercept-off", () => { window.__fbIntercept = false; });
})();
