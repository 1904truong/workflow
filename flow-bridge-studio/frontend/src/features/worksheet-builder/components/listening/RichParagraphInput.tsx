// Ô nhập một đoạn văn có định dạng từng từ (kiểu Word) cho Listening Gap Fill.
//
// Dữ liệu vẫn là `text` (chứa marker chỗ trống "(a) ____") + `marks` (định dạng theo vị trí, xem textMarks.ts).
// Mọi thao tác gõ/xóa/dán/cắt được chặn ở `beforeinput` và tính trên dữ liệu rồi vẽ lại DOM, nên:
//  - chỗ trống luôn được xóa/giữ nguyên cả khối (không bao giờ bị cắt nửa chừng),
//  - chữ mới gõ thừa hưởng định dạng như Word (hoặc định dạng đang chờ khi bấm Bold lúc chưa chọn gì),
//  - vùng chọn và con trỏ do mình đặt lại sau mỗi lần vẽ, bấm nút trên thanh công cụ không làm mất vùng chọn.
// Gõ tiếng Việt/IME (composition) được để trình duyệt tự xử lý rồi đồng bộ lại khi kết thúc.

import React, { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import {
  applyMarkPatch, attrsInRange, attrsToStyle, clearMarks, diffEdit, marksAfterEdit, segmentText, sliceMarks,
  type TextMark, type TextMarkAttrs,
} from '../../services/listening/textMarks';

export interface RichEdit { text: string; marks?: TextMark[]; caret: number; caretEnd: number }
/** `user` = do người dùng thao tác ở ô này (chọn/gõ/bấm nút) → ô này trở thành ô đang hoạt động; false = chỉ là làm mới sau khi dữ liệu đổi từ nơi khác */
export interface RichSelectionInfo { collapsed: boolean; attrs: TextMarkAttrs; user?: boolean }
export interface RichParagraphHandle {
  hasSelection: () => boolean;
  /** Vùng chọn gần nhất trong ô (vẫn nhớ khi focus đang ở nút trên thanh công cụ) */
  getSelection: () => { start: number; end: number } | null;
  /** Áp định dạng lên vùng chọn; chưa chọn gì thì áp cho chữ gõ tiếp theo. Giá trị false/undefined = bỏ thuộc tính. */
  applyFormat: (patch: TextMarkAttrs) => void;
  clearFormat: () => void;
  focusAt: (start: number, end?: number) => void;
  selectAll: () => void;
  /** Cắt/chép vùng chọn bằng menu (đi qua cùng xử lý với Ctrl+X / Ctrl+C) */
  execClipboard: (kind: 'cut' | 'copy') => void;
}

interface Props {
  text: string;
  marks?: TextMark[];
  /** Đặt con trỏ khi ô vừa được mở (bỏ trống = không tự focus) */
  initialCaret?: number;
  /** Nhận thay đổi, trả về nội dung cuối cùng (cha có thể đánh lại nhãn chỗ trống) kèm vị trí con trỏ đã dịch */
  onEdit: (next: RichEdit) => RichEdit;
  /** Nhận trạng thái định dạng tại con trỏ; `handle` để cha biết ô nào đang hoạt động khi có nhiều ô (cột trái + từng đoạn trên A4) */
  onSelectionInfo: (info: RichSelectionInfo | null, handle: RichParagraphHandle) => void;
  /** 'editor' = chỗ trống màu xanh (cột soạn); 'page' = giống chữ in trên trang A4 */
  gapStyle?: 'editor' | 'page';
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}

const GAP_RE = /\(([A-Za-z0-9_]+)\)\s*_{2,}/g;
export const gapRanges = (text: string): { start: number; end: number }[] => {
  const out: { start: number; end: number }[] = [];
  GAP_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = GAP_RE.exec(text)) !== null) out.push({ start: m.index, end: m.index + m[0].length });
  return out;
};

/** Vị trí con trỏ sau khi các nhãn chỗ trống đổi độ dài (vd. (9)→(10)): cộng chênh lệch của các chỗ trống đứng trước con trỏ. */
export const mapOffsetAfterResequence = (oldText: string, newText: string, pos: number): number => {
  const og = gapRanges(oldText);
  const ng = gapRanges(newText);
  let delta = 0;
  for (let i = 0; i < Math.min(og.length, ng.length); i++) {
    if (og[i].end <= pos) delta += (ng[i].end - ng[i].start) - (og[i].end - og[i].start);
  }
  return Math.max(0, Math.min(newText.length, pos + delta));
};

const stripFalsy = (a: TextMarkAttrs): TextMarkAttrs => {
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(a)) if (v) o[k] = v;
  return o as TextMarkAttrs;
};
const kebab = (k: string) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

export const RichParagraphInput = forwardRef<RichParagraphHandle, Props>(function RichParagraphInput(props, ref) {
  const rootRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const cur = useRef<{ text: string; marks?: TextMark[] }>({ text: props.text, marks: props.marks });
  const shown = useRef({ text: '\u0000', marksKey: '' });
  const sel = useRef<{ start: number; end: number } | null>(null);
  const pending = useRef<{ attrs: TextMarkAttrs; pos: number } | null>(null);
  const composing = useRef(false);
  const lastInfo = useRef('');
  const api = useRef({} as RichParagraphHandle);

  // ── DOM ⇄ vị trí ký tự ──
  const readSelection = (): { start: number; end: number } | null => {
    const root = rootRef.current;
    const s = window.getSelection();
    if (!root || !s || s.rangeCount === 0) return null;
    const r = s.getRangeAt(0);
    if (!root.contains(r.startContainer) || !root.contains(r.endContainer)) return null;
    const off = (node: Node, o: number) => {
      const rg = document.createRange();
      rg.selectNodeContents(root);
      rg.setEnd(node, o);
      return rg.toString().length;
    };
    const a = off(r.startContainer, r.startOffset);
    const b = off(r.endContainer, r.endOffset);
    return { start: Math.min(a, b), end: Math.max(a, b) };
  };

  /** Vùng chọn mới nhất: đọc thẳng từ DOM (không chờ sự kiện selectionchange), không còn trong ô thì dùng vùng đã nhớ */
  const currentSel = () => {
    const live = readSelection();
    if (live) sel.current = live;
    return sel.current;
  };

  const pointAt = (offset: number): { node: Node; off: number } => {
    const root = rootRef.current!;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let acc = 0;
    let last: Text | null = null;
    let n: Node | null;
    while ((n = w.nextNode())) {
      const len = (n as Text).data.length;
      if (offset <= acc + len) return { node: n, off: offset - acc };
      acc += len;
      last = n as Text;
    }
    return last ? { node: last, off: last.data.length } : { node: root, off: 0 };
  };

  const setSel = (start: number, end = start) => {
    const root = rootRef.current;
    if (!root) return;
    const len = cur.current.text.length;
    const a = Math.max(0, Math.min(start, len));
    const b = Math.max(a, Math.min(end, len));
    if (document.activeElement !== root) root.focus({ preventScroll: true });
    const s = window.getSelection();
    if (!s) return;
    const p1 = pointAt(a);
    const p2 = a === b ? p1 : pointAt(b);
    const r = document.createRange();
    r.setStart(p1.node, p1.off);
    r.setEnd(p2.node, p2.off);
    s.removeAllRanges();
    s.addRange(r);
    sel.current = { start: a, end: b };
  };

  const readText = (): string => {
    const root = rootRef.current;
    if (!root) return '';
    let out = '';
    const walk = (n: Node) => {
      if (n.nodeType === Node.TEXT_NODE) out += (n as Text).data;
      else if (n instanceof HTMLElement) {
        if (n.dataset.pad) return;
        if (n.tagName === 'BR') { out += '\n'; return; }
        n.childNodes.forEach(walk);
      }
    };
    root.childNodes.forEach(walk);
    return out;
  };

  // ── Vẽ lại từ dữ liệu ──
  const paint = (text: string, marks?: TextMark[]) => {
    const root = rootRef.current;
    if (!root) return;
    const frag = document.createDocumentFragment();
    const addText = (from: number, to: number) => {
      for (const seg of segmentText(marks, from, to)) {
        const t = text.slice(seg.start, seg.end);
        const style = attrsToStyle(seg.attrs);
        if (Object.values(style).some((v) => v !== undefined)) {
          const sp = document.createElement('span');
          for (const [k, v] of Object.entries(style)) if (v !== undefined) (sp.style as unknown as Record<string, string>)[k] = String(v);
          sp.textContent = t;
          frag.appendChild(sp);
        } else frag.appendChild(document.createTextNode(t));
      }
    };
    let last = 0;
    for (const g of gapRanges(text)) {
      addText(last, g.start);
      const sp = document.createElement('span');
      sp.dataset.gap = '1';
      const marker = text.slice(g.start, g.end);
      if (propsRef.current.gapStyle === 'page') {
        // Giống chữ in: nhãn (a) in đậm, phần gạch dưới bình thường
        const m = /^(\([^)]*\))([\s\S]*)$/.exec(marker);
        const label = document.createElement('strong');
        label.style.fontWeight = '700';
        label.style.color = '#0f172a';
        label.textContent = m ? m[1] : marker;
        sp.appendChild(label);
        if (m && m[2]) sp.appendChild(document.createTextNode(m[2]));
      } else {
        sp.style.color = '#2563eb';
        sp.style.fontWeight = '700';
        sp.textContent = marker;
      }
      frag.appendChild(sp);
      last = g.end;
    }
    addText(last, text.length);
    if (text.endsWith('\n')) {
      const br = document.createElement('br');
      br.dataset.pad = '1';
      frag.appendChild(br);
    }
    root.replaceChildren(frag);
    shown.current = { text, marksKey: JSON.stringify(marks ?? null) };
  };

  // ── Báo trạng thái định dạng tại con trỏ cho thanh công cụ ──
  const report = (user = true) => {
    const s = sel.current;
    let info: RichSelectionInfo | null = null;
    if (s) {
      const { text, marks } = cur.current;
      let attrs = attrsInRange(marks, text.length, s.start, s.end);
      const collapsed = s.start === s.end;
      if (collapsed && pending.current) attrs = { ...attrs, ...pending.current.attrs };
      info = { collapsed, attrs: stripFalsy(attrs) };
    }
    const key = JSON.stringify(info);
    // Thao tác của người dùng luôn báo (để ô này thành ô đang hoạt động dù trạng thái không đổi); làm mới tự động thì chỉ báo khi khác
    if (user || key !== lastInfo.current) {
      lastInfo.current = key;
      propsRef.current.onSelectionInfo(info ? { ...info, user } : null, api.current);
    }
  };

  const commit = (text: string, marks: TextMark[] | undefined, start: number, end = start) => {
    const res = propsRef.current.onEdit({ text, marks, caret: start, caretEnd: end });
    cur.current = { text: res.text, marks: res.marks };
    paint(res.text, res.marks);
    setSel(res.caret, res.caretEnd);
    report();
  };

  /** Thay [a, b) bằng `ins`. Chỗ trống là khối nguyên: xóa chạm vào là xóa cả khối, không gõ chèn vào giữa khối. */
  const doEdit = (a0: number, b0: number, ins: string, insMarks?: TextMark[]) => {
    const { text, marks } = cur.current;
    let a = Math.max(0, Math.min(a0, text.length));
    let b = Math.max(a, Math.min(b0, text.length));
    for (const g of gapRanges(text)) {
      if (a === b) { if (a > g.start && a < g.end) { a = g.end; b = g.end; } }
      else if (a < g.end && b > g.start) { a = Math.min(a, g.start); b = Math.max(b, g.end); }
    }
    const base = a === b ? attrsInRange(marks, text.length, a, a) : attrsInRange(marks, text.length, a, a + 1);
    const inherit = { ...base, ...(pending.current?.attrs ?? {}) };
    const newText = text.slice(0, a) + ins + text.slice(b);
    let nm = marksAfterEdit(marks, newText.length, { at: a, oldLen: b - a, newLen: ins.length }, ins ? inherit : undefined);
    if (insMarks) for (const m of insMarks) nm = applyMarkPatch(nm, newText.length, a + m.start, a + m.end, m);
    if (ins) pending.current = null;
    commit(newText, nm, a + ins.length);
  };

  const applyFormat = (patch: TextMarkAttrs) => {
    const s = currentSel();
    if (!s) return;
    if (s.start === s.end) {
      pending.current = { attrs: { ...(pending.current?.attrs ?? {}), ...patch }, pos: s.start };
      setSel(s.start);
      report();
      return;
    }
    const { text, marks } = cur.current;
    commit(text, applyMarkPatch(marks, text.length, s.start, s.end, patch), s.start, s.end);
  };

  const clearFormat = () => {
    const s = currentSel();
    const { text, marks } = cur.current;
    pending.current = null;
    if (s && s.start !== s.end) commit(text, clearMarks(marks, text.length, s.start, s.end), s.start, s.end);
    else commit(text, undefined, s?.start ?? text.length);
  };

  // Đối tượng điều khiển có định danh cố định (cha so sánh để biết ô nào đang hoạt động); hàm bên trong luôn mới nhất
  Object.assign(api.current, {
    hasSelection: () => !!currentSel(),
    getSelection: () => currentSel(),
    applyFormat,
    clearFormat,
    focusAt: (start, end) => { setSel(start, end ?? start); report(); },
    selectAll: () => { setSel(0, cur.current.text.length); report(); },
    execClipboard: (kind) => {
      const s = currentSel();
      if (!s || s.start === s.end) return;
      setSel(s.start, s.end);
      document.execCommand(kind);
    },
  } satisfies RichParagraphHandle);
  useImperativeHandle(ref, () => api.current, []);

  // ── Đồng bộ từ props (undo/redo, đánh lại nhãn chỗ trống, thay đổi từ nơi khác) ──
  useLayoutEffect(() => {
    const key = JSON.stringify(props.marks ?? null);
    if (props.text === shown.current.text && key === shown.current.marksKey) return;
    cur.current = { text: props.text, marks: props.marks };
    const keep = sel.current;
    paint(props.text, props.marks);
    if (keep && document.activeElement === rootRef.current) setSel(keep.start, keep.end);
    else if (keep) sel.current = { start: Math.min(keep.start, props.text.length), end: Math.min(keep.end, props.text.length) };
    report(false);
  });

  useLayoutEffect(() => {
    if (props.initialCaret !== undefined) {
      setSel(props.initialCaret);
      report();
    }
    return () => { lastInfo.current = ''; propsRef.current.onSelectionInfo(null, api.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sự kiện ──
  useEffect(() => {
    const root = rootRef.current!;

    const onSelectionChange = () => {
      const s = readSelection();
      if (!s) return;
      sel.current = s;
      if (pending.current && (s.start !== s.end || s.start !== pending.current.pos)) pending.current = null;
      report();
    };

    const rangeOf = (e: InputEvent): { start: number; end: number } | null => {
      const t = e.getTargetRanges?.()[0];
      if (!t) return null;
      const off = (node: Node, o: number) => {
        const rg = document.createRange();
        rg.selectNodeContents(root);
        rg.setEnd(node, o);
        return rg.toString().length;
      };
      return { start: off(t.startContainer, t.startOffset), end: off(t.endContainer, t.endOffset) };
    };

    const onBeforeInput = (e: InputEvent) => {
      if (composing.current || e.isComposing || e.inputType.startsWith('insertComposition')) return;
      const t = e.inputType;
      const s = readSelection() ?? sel.current ?? { start: cur.current.text.length, end: cur.current.text.length };
      if (t === 'insertText') { e.preventDefault(); if (e.data) doEdit(s.start, s.end, e.data); return; }
      if (t === 'insertParagraph' || t === 'insertLineBreak') { e.preventDefault(); doEdit(s.start, s.end, '\n'); return; }
      if (t === 'insertReplacementText') {
        e.preventDefault();
        const r = rangeOf(e) ?? s;
        const rep = e.dataTransfer?.getData('text/plain') ?? e.data ?? '';
        if (rep) doEdit(r.start, r.end, rep);
        return;
      }
      if (t.startsWith('delete')) {
        e.preventDefault();
        let r = s.start !== s.end ? s : rangeOf(e);
        if (!r) r = t.includes('Forward') ? { start: s.start, end: s.start + 1 } : { start: s.start - 1, end: s.start };
        if (r.start !== r.end) doEdit(r.start, r.end, '');
        return;
      }
      if (t === 'historyUndo' || t === 'historyRedo' || t.startsWith('format') || t === 'insertFromDrop' || t === 'insertFromPaste' || t === 'insertFromYank') {
        e.preventDefault();
      }
    };

    /** Nội dung DOM bị đổi ngoài ý muốn (spellcheck, kéo thả, kết thúc IME): đọc lại và đồng bộ. */
    const syncFromDom = () => {
      const t = readText();
      const { text, marks } = cur.current;
      if (t === text) return;
      const ed = diffEdit(text, t);
      const s = readSelection();
      const base = attrsInRange(marks, text.length, ed.at, ed.at);
      const nm = marksAfterEdit(marks, t.length, ed, { ...base, ...(pending.current?.attrs ?? {}) });
      pending.current = null;
      commit(t, nm, s ? s.start : ed.at + ed.newLen);
    };

    const onInput = () => { if (!composing.current) syncFromDom(); };
    const onCompStart = () => { composing.current = true; };
    const onCompEnd = () => { composing.current = false; syncFromDom(); };

    const onCopy = (e: ClipboardEvent, cut: boolean) => {
      const s = readSelection() ?? sel.current;
      if (!s || s.start === s.end || !e.clipboardData) return;
      e.preventDefault();
      const { text, marks } = cur.current;
      const plain = text.slice(s.start, s.end);
      const sub = sliceMarks(marks, s.start, s.end);
      e.clipboardData.setData('text/plain', plain);
      e.clipboardData.setData('application/x-fbs-runs', JSON.stringify({ text: plain, marks: sub }));
      e.clipboardData.setData('text/html', segmentText(sub, 0, plain.length).map((seg) => {
        const css = Object.entries(attrsToStyle(seg.attrs)).filter(([, v]) => v !== undefined).map(([k, v]) => `${kebab(k)}:${v}`).join(';');
        return `<span style="${css}">${esc(plain.slice(seg.start, seg.end))}</span>`;
      }).join(''));
      if (cut) doEdit(s.start, s.end, '');
    };

    const onPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      const cd = e.clipboardData;
      if (!cd) return;
      const plain = cd.getData('text/plain').replace(/\r\n?/g, '\n');
      if (!plain) return;
      let runs: TextMark[] | undefined;
      try {
        const raw = cd.getData('application/x-fbs-runs');
        if (raw) { const j = JSON.parse(raw) as { text: string; marks?: TextMark[] }; if (j.text === plain) runs = j.marks; }
      } catch { /* bỏ qua, dán chữ thường */ }
      const s = readSelection() ?? sel.current ?? { start: cur.current.text.length, end: cur.current.text.length };
      doEdit(s.start, s.end, plain, runs);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      const key = k === 'b' ? 'bold' : k === 'i' ? 'italic' : k === 'u' ? 'underline' : null;
      if (!key) return;
      e.preventDefault();
      const s = currentSel();
      if (!s) return;
      const { text, marks } = cur.current;
      let attrs = attrsInRange(marks, text.length, s.start, s.end);
      if (s.start === s.end && pending.current) attrs = { ...attrs, ...pending.current.attrs };
      applyFormat({ [key]: !attrs[key] } as TextMarkAttrs);
    };

    const cut = (e: ClipboardEvent) => onCopy(e, true);
    const copy = (e: ClipboardEvent) => onCopy(e, false);
    const noDrop = (e: DragEvent) => e.preventDefault();

    document.addEventListener('selectionchange', onSelectionChange);
    root.addEventListener('beforeinput', onBeforeInput);
    root.addEventListener('input', onInput);
    root.addEventListener('compositionstart', onCompStart);
    root.addEventListener('compositionend', onCompEnd);
    root.addEventListener('copy', copy);
    root.addEventListener('cut', cut);
    root.addEventListener('paste', onPaste);
    root.addEventListener('keydown', onKeyDown);
    root.addEventListener('drop', noDrop);
    root.addEventListener('dragover', noDrop);
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      root.removeEventListener('beforeinput', onBeforeInput);
      root.removeEventListener('input', onInput);
      root.removeEventListener('compositionstart', onCompStart);
      root.removeEventListener('compositionend', onCompEnd);
      root.removeEventListener('copy', copy);
      root.removeEventListener('cut', cut);
      root.removeEventListener('paste', onPaste);
      root.removeEventListener('keydown', onKeyDown);
      root.removeEventListener('drop', noDrop);
      root.removeEventListener('dragover', noDrop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={rootRef}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      role="textbox"
      aria-multiline="true"
      data-placeholder={props.placeholder}
      className={props.className}
      style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', ...props.style }}
    />
  );
});
