// E2E: Edit Mode dùng chung (RichEditable + RibbonToolbar) trên MỌI dạng bài có ô chữ sửa trực tiếp trên trang A4.
//
// Chạy: (1) `npx vite --port 5179` trong frontend; (2) cài playwright-core ở một thư mục bất kỳ
//        (`npm i playwright-core`, không cần tải trình duyệt – dùng Chrome có sẵn);
//        (3) `PW_CORE=<thư mục>/node_modules/playwright-core/index.mjs node e2e/rich-edit.e2e.mjs`
// Biến môi trường: BASE_URL (mặc định http://localhost:5179), CHROME (đường dẫn chrome.exe), ONLY (một mã dạng bài).

const { chromium } = await import(process.env.PW_CORE ? new URL(`file:///${process.env.PW_CORE.replace(/\\/g, '/')}`).href : 'playwright-core');
const BASE = process.env.BASE_URL || 'http://localhost:5179';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const TYPES = [
  'gap_filling_word_formation', 'grammar_vocab_multiple_choice', 'listening_matching', 'listening_multiple_choice',
  'listening_table_completion', 'listening_true_false', 'matching_headings', 'matching_pictures', 'matching_vocabulary',
  'reading_multiple_choice', 'sentence_completion', 'true_false_not_given',
].filter((t) => !process.env.ONLY || t === process.env.ONLY);

const FOLDERS_KEY = 'flow_bridge_folders_v2';
const SCREEN_KEY = 'fb_active_screen_v1';
const BOX = '[role="textbox"][aria-multiline="false"][contenteditable]';

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('dialog', (d) => d.accept());

const results = [];
const check = (row, name, ok, note = '') => { row[name] = ok ? 'PASS' : `FAIL${note ? ` (${note})` : ''}`; };

// Lần đầu mở: app tự tạo các thư mục mẫu → tạo một thư mục trống dành riêng cho test
await page.goto(BASE);
await page.waitForFunction((k) => !!localStorage.getItem(k), FOLDERS_KEY, { timeout: 20000 });
const folderId = await page.evaluate((k) => {
  const list = JSON.parse(localStorage.getItem(k));
  const f = { ...list[0], id: 'folder_e2e_rich', name: 'E2E Rich Edit', exercises: [] };
  localStorage.setItem(k, JSON.stringify([...list.filter((x) => x.id !== f.id), f]));
  return f.id;
}, FOLDERS_KEY);

const exercisesOfFolder = () => page.evaluate(([k, id]) => JSON.parse(localStorage.getItem(k)).find((f) => f.id === id).exercises, [FOLDERS_KEY, folderId]);

/** Chọn từ dài ≥3 chữ cái đầu tiên trong ô (bằng Selection API giống người dùng kéo chuột) */
const selectFirstWord = (box) => box.evaluate((el) => {
  const text = el.textContent;
  const m = /[A-Za-z]{3,}/.exec(text);
  if (!m) return null;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const pts = [];
  let acc = 0; let n;
  while ((n = walker.nextNode())) { pts.push([n, acc]); acc += n.data.length; }
  const at = (off) => { for (let i = pts.length - 1; i >= 0; i--) if (off >= pts[i][1]) return [pts[i][0], off - pts[i][1]]; return [el, 0]; };
  el.focus();
  const r = document.createRange();
  const [a, ao] = at(m.index); const [b, bo] = at(m.index + m[0].length);
  r.setStart(a, ao); r.setEnd(b, bo);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  return { word: m[0], text };
});

for (const type of TYPES) {
  const row = { type };
  results.push(row);
  try {
    await page.evaluate(([sk, fid, t]) => localStorage.setItem(sk, JSON.stringify({ type: 'add_exercise', folderId: fid, initialType: t })), [SCREEN_KEY, folderId, type]);
    await page.reload();
    await page.locator(BOX).first().waitFor({ timeout: 15000 });
    // Ô đầu tiên có chữ (bài mới của vài dạng có tiêu đề trống); không ô nào có chữ thì gõ vào ô đầu
    const idx = await page.locator(BOX).evaluateAll((els) => els.findIndex((el) => /[A-Za-z]{3,}/.test(el.textContent)));
    const box = page.locator(BOX).nth(Math.max(0, idx));
    await box.click();
    if (idx < 0) { await page.keyboard.type('Hello pupils'); }
    row.field = (await box.textContent()).slice(0, 18);

    // 1) Chọn một từ → Bold + màu: chỉ từ đó đổi
    const sel = await selectFirstWord(box);
    if (!sel) { check(row, 'format-word', false, 'ô đầu tiên không có từ'); continue; }
    await page.waitForTimeout(80);
    await page.locator('button[aria-label^="Bold"]').first().click();
    await page.locator('button[aria-label^="Superscript"]').count().then((c) => { row.supSub = c ? 'có' : 'không'; });
    const fmt = await box.evaluate((el, word) => {
      const bold = [...el.querySelectorAll('span')].filter((s) => getComputedStyle(s).fontWeight === '700' && !s.closest('[data-gap]'));
      return { boldText: bold.map((s) => s.textContent).join('|'), word };
    }, sel.word);
    check(row, 'format-word', fmt.boldText === sel.word, `in đậm "${fmt.boldText}" thay vì "${sel.word}"`);

    // 2) Đặt con trỏ cuối ô và gõ chữ
    await box.evaluate((el) => { el.focus(); const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
    await page.keyboard.type(' QZ');
    const typed = (await box.textContent()).endsWith(' QZ');
    check(row, 'type-at-caret', typed);
    await page.keyboard.press('Enter'); // rời ô → lưu chữ + định dạng vào dữ liệu bài

    // 3) Ctrl+S lưu thật, badge báo "Đã lưu"
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(1200); // App ghi localStorage sau debounce 600ms (persistFolder)
    const exs = await exercisesOfFolder();
    const ex = exs.find((e) => e.type === type || JSON.stringify(e).includes(' QZ'));
    const dataKey = ex && Object.keys(ex).find((k) => ex[k] && typeof ex[k] === 'object' && !Array.isArray(ex[k]) && 'settings' in ex[k]);
    const rich = dataKey ? ex[dataKey].richMarks : undefined;
    const savedKey = rich && Object.keys(rich).find((k) => k.endsWith(' QZ'));
    check(row, 'save', !!savedKey && rich[savedKey].some((m) => m.bold), savedKey ? 'không có mark bold' : 'không thấy richMarks đã lưu');
    check(row, 'badge', (await page.getByText('Đã lưu', { exact: true }).count()) > 0);

    // 4) Undo bỏ thao tác cuối, Redo trả lại
    const undoBtn = page.locator('button[aria-label="Hoàn tác"]').first();
    if (await undoBtn.isEnabled()) {
      await undoBtn.click();
      const afterUndo = await box.textContent();
      await page.locator('button[aria-label="Làm lại"]').first().click();
      const afterRedo = await box.textContent();
      check(row, 'undo-redo', !afterUndo.endsWith(' QZ') && afterRedo.endsWith(' QZ'), `undo="${afterUndo.slice(-12)}" redo="${afterRedo.slice(-12)}"`);
    } else check(row, 'undo-redo', false, 'nút Hoàn tác bị khóa');

    // 5) Reload → mở trang Preview & Export (WorksheetRenderer / ExerciseBlock): từ vẫn đậm, không còn ô sửa
    await page.evaluate(([sk, fid]) => localStorage.setItem(sk, JSON.stringify({ type: 'export', folderId: fid })), [SCREEN_KEY, folderId]);
    await page.reload();
    await page.waitForTimeout(1500);
    const preview = await page.evaluate((word) => {
      const spans = [...document.querySelectorAll('span')].filter((s) => s.textContent === word && getComputedStyle(s).fontWeight === '700');
      return { bold: spans.length > 0, qz: document.body.innerText.includes(' QZ'), editable: document.querySelectorAll('[role="textbox"][aria-multiline="false"]').length };
    }, sel.word);
    check(row, 'reload+preview', preview.bold && preview.qz, `bold=${preview.bold} qz=${preview.qz}`);

    // dọn bài vừa tạo để lần sau bắt đầu sạch
    await page.evaluate(([k, id]) => { const l = JSON.parse(localStorage.getItem(k)); const f = l.find((x) => x.id === id); f.exercises = []; localStorage.setItem(k, JSON.stringify(l)); }, [FOLDERS_KEY, folderId]);
  } catch (e) {
    row.error = String(e.message || e).split('\n')[0].slice(0, 160);
  }
}

await browser.close();
console.table(results);
if (errors.length) console.log('Lỗi JS trên trang:', [...new Set(errors)].slice(0, 10));
const failed = results.filter((r) => r.error || Object.values(r).some((v) => String(v).startsWith('FAIL')));
console.log(`\n${results.length - failed.length}/${results.length} dạng bài qua toàn bộ bước.`);
process.exit(failed.length ? 1 : 0);
