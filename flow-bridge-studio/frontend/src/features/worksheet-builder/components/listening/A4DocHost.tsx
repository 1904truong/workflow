// Vùng soạn LIỀN MẠCH cho trang A4 (Edit Mode) của Listening Gap Fill: giống Word, cả phần bài đọc là MỘT vùng chọn.
// Ctrl+A chọn mọi đoạn, kéo chuột chọn xuyên đoạn, định dạng/xóa/gõ đè/dán qua nhiều đoạn, Enter tách đoạn, Backspace đầu đoạn gộp đoạn.
//
// Cách hoạt động:
//  - Một phần tử contentEditable bao toàn bộ layout. Mỗi đoạn văn là một "bề mặt" `[data-para-id]` chỉ để vẽ chữ + marks;
//    mọi thứ khác (số thứ tự, ảnh, QR, bảng...) tự động thành "đảo" contenteditable=false nên không sửa nhầm được.
//  - Vùng chọn được đổi từ DOM sang vị trí tài liệu (đoạn, ký tự); mọi thao tác (gõ, xóa, dán, định dạng) tính trên dữ liệu
//    (docEdit.ts) rồi trả về cha lưu vào cùng nguồn dữ liệu với cột trái; các bề mặt vẽ lại từ dữ liệu.
//  - Gõ IME (Telex) để trình duyệt tự sửa DOM, kết thúc thì đọc lại và đồng bộ.

import React, { useEffect, useLayoutEffect, useRef } from 'react';
import type { ListeningParagraph } from '../../services/listening/listeningGapFillCore';
import {
  applyFormatDoc, attrsInDocRange, clearFormatDoc, cmpPoint, docSlice, replaceRange,
  type DocPiece, type DocPoint, type DocRange,
} from '../../services/listening/docEdit';
import { attrsInRange, attrsToStyle, diffEdit, marksAfterEdit, segmentText, type TextMark, type TextMarkAttrs } from '../../services/listening/textMarks';
import { paintInto, readTextOf, textOffsetOf, textPointAt } from './richDom';
import { mapOffsetAfterResequence, type RichParagraphHandle, type RichSelectionInfo } from './RichParagraphInput';

export interface A4DocEditing {
  /** Lưu danh sách đoạn mới vào dữ liệu chung; trả về danh sách cuối cùng (đã đánh lại nhãn chỗ trống nếu cần) */
  onDocEdit: (next: ListeningParagraph[]) => ListeningParagraph[];
  /** Báo vùng chọn: `index`/`offset` = đoạn chứa đầu vùng chọn và độ dài tiền tố không sửa được của đoạn đó */
  onSelection: (index: number, offset: number, info: RichSelectionInfo | null, handle: RichParagraphHandle) => void;
}

let paintVersion = 0; // tăng mỗi khi một bề mặt vẽ lại; host dựa vào đây để đặt lại vùng chọn sau khi vẽ

/** Bề mặt vẽ chữ của một đoạn. `offset` = số ký tự đầu đoạn không hiển thị (tiền tố "JULIE:", "+ "...). */
export const A4ParagraphSurface: React.FC<{ paraId: string; offset: number; text: string; marks?: TextMark[] }> = ({ paraId, offset, text, marks }) => {
  const ref = useRef<HTMLDivElement>(null);
  const shown = useRef('\u0000');
  useLayoutEffect(() => {
    const key = `${text}\u0001${JSON.stringify(marks ?? null)}`;
    if (!ref.current || key === shown.current) return;
    paintInto(ref.current, text, marks, 'page');
    shown.current = key;
    paintVersion++;
  });
  return (
    <div
      ref={ref}
      data-para-id={paraId}
      data-offset={offset}
      style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
      className="cursor-text rounded-[2px]"
    />
  );
};

const stripFalsy = (a: TextMarkAttrs): TextMarkAttrs => {
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(a)) if (v) o[k] = v;
  return o as TextMarkAttrs;
};
const kebab = (k: string) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

/** Mọi phần tử không chứa đoạn văn thành "đảo" không sửa được; ô sửa riêng (tiêu đề, input) giữ nguyên. */
function markIslands(el: Element): void {
  for (const child of Array.from(el.children)) {
    if (child.hasAttribute('data-para-id')) continue;
    const hasSurface = !!child.querySelector('[data-para-id]');
    if (hasSurface) {
      if (child.hasAttribute('data-island')) { child.removeAttribute('contenteditable'); child.removeAttribute('data-island'); }
      markIslands(child);
    } else if (!child.hasAttribute('contenteditable')) {
      child.setAttribute('contenteditable', 'false');
      child.setAttribute('data-island', '1');
    }
  }
}

const isSpace = (c: string | undefined) => !!c && /\s/.test(c);

export const A4DocHost: React.FC<{ paragraphs: ListeningParagraph[]; editing: A4DocEditing; children: React.ReactNode }> = ({ paragraphs, editing, children }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const parasRef = useRef(paragraphs);
  parasRef.current = paragraphs;
  const editingRef = useRef(editing);
  editingRef.current = editing;
  const selRef = useRef<DocRange | null>(null);
  const pendingFmt = useRef<{ attrs: TextMarkAttrs; at: DocPoint } | null>(null);
  const pendingSel = useRef<DocRange | null>(null);
  const composing = useRef(false);
  const lastInfo = useRef('');
  const seenPaint = useRef(0);
  const api = useRef({} as RichParagraphHandle);

  // ── DOM ⇄ vị trí tài liệu ──
  const surfaces = () => Array.from(hostRef.current?.querySelectorAll<HTMLElement>('[data-para-id]') ?? []);
  const idxOfId = (id: string) => parasRef.current.findIndex((p) => p.id === id);
  const surfaceOf = (i: number): HTMLElement | null => {
    const id = parasRef.current[i]?.id;
    if (!id) return null;
    return surfaces().find((s) => s.dataset.paraId === id) ?? null;
  };
  const baseOffset = (i: number) => Number(surfaceOf(i)?.dataset.offset ?? 0);

  const clampRange = (r: DocRange): DocRange => {
    const paras = parasRef.current;
    const fix = (p: DocPoint): DocPoint => {
      const para = Math.max(0, Math.min(p.para, paras.length - 1));
      return { para, off: Math.max(0, Math.min(p.off, paras[para]?.text.length ?? 0)) };
    };
    return { from: fix(r.from), to: fix(r.to) };
  };

  const pointFromDom = (node: Node, off: number, side: 'start' | 'end'): DocPoint | null => {
    const host = hostRef.current;
    if (!host) return null;
    const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    const surf = el?.closest<HTMLElement>('[data-para-id]');
    if (surf && host.contains(surf)) {
      const i = idxOfId(surf.dataset.paraId ?? '');
      if (i < 0) return null;
      return { para: i, off: textOffsetOf(surf, node, off) + Number(surf.dataset.offset ?? 0) };
    }
    // Điểm nằm ngoài các đoạn (đảo, khoảng trống, hoặc Ctrl+A): gán vào mép đoạn gần nhất theo phía của vùng chọn
    const list = surfaces();
    if (!list.length) return null;
    const rg = document.createRange();
    rg.setStart(node, off);
    rg.collapse(true);
    let next = -1;
    for (let k = 0; k < list.length; k++) {
      const sr = document.createRange();
      sr.selectNodeContents(list[k]);
      if (rg.compareBoundaryPoints(Range.START_TO_START, sr) <= 0) { next = k; break; }
    }
    const at = (k: number, end: boolean): DocPoint | null => {
      const s = list[k];
      const i = idxOfId(s.dataset.paraId ?? '');
      if (i < 0) return null;
      return { para: i, off: end ? parasRef.current[i].text.length : Number(s.dataset.offset ?? 0) };
    };
    if (side === 'start') return next >= 0 ? at(next, false) : at(list.length - 1, true);
    return next > 0 ? at(next - 1, true) : next === 0 ? at(0, false) : at(list.length - 1, true);
  };

  const inNestedEditor = (n: Node | null): boolean => {
    const host = hostRef.current;
    if (!n || !host) return false;
    const el = n.nodeType === Node.ELEMENT_NODE ? (n as Element) : n.parentElement;
    const e = el?.closest('[contenteditable="true"],[contenteditable=""],input,textarea');
    return !!e && e !== host;
  };
  const selectionInNestedEditor = () => {
    const s = window.getSelection();
    return !!s && s.rangeCount > 0 && (inNestedEditor(s.getRangeAt(0).startContainer) || inNestedEditor(s.getRangeAt(0).endContainer));
  };

  const readDocSelection = (): DocRange | null => {
    const host = hostRef.current;
    const s = window.getSelection();
    if (!host || !s || s.rangeCount === 0) return null;
    const r = s.getRangeAt(0);
    if (!host.contains(r.startContainer) || !host.contains(r.endContainer)) return null;
    if (inNestedEditor(r.startContainer) || inNestedEditor(r.endContainer)) return null;
    const a = pointFromDom(r.startContainer, r.startOffset, 'start');
    if (!a) return null;
    if (s.isCollapsed) return { from: a, to: a };
    const b = pointFromDom(r.endContainer, r.endOffset, 'end');
    if (!b) return null;
    return cmpPoint(a, b) <= 0 ? { from: a, to: b } : { from: a, to: a };
  };

  const current = (): DocRange | null => {
    const live = readDocSelection();
    if (live) selRef.current = live;
    return selRef.current ? clampRange(selRef.current) : null;
  };

  const domPoint = (p: DocPoint) => {
    const s = surfaceOf(p.para);
    if (!s) return null;
    return textPointAt(s, Math.max(0, p.off - Number(s.dataset.offset ?? 0)));
  };
  const setDomSelection = (range: DocRange) => {
    const host = hostRef.current;
    if (!host) return;
    const p1 = domPoint(range.from);
    const p2 = cmpPoint(range.from, range.to) === 0 ? p1 : domPoint(range.to);
    if (!p1 || !p2) return;
    if (document.activeElement !== host) host.focus({ preventScroll: true });
    const s = window.getSelection();
    if (!s) return;
    const r = document.createRange();
    r.setStart(p1.node, p1.off);
    r.setEnd(p2.node, p2.off);
    s.removeAllRanges();
    s.addRange(r);
  };

  // ── Báo trạng thái cho thanh công cụ ──
  const report = (user = true) => {
    const r = selRef.current ? clampRange(selRef.current) : null;
    let info: RichSelectionInfo | null = null;
    if (r) {
      let attrs = attrsInDocRange(parasRef.current, r);
      const collapsed = cmpPoint(r.from, r.to) === 0;
      if (collapsed && pendingFmt.current) attrs = { ...attrs, ...pendingFmt.current.attrs };
      info = { collapsed, attrs: stripFalsy(attrs) };
    }
    const key = JSON.stringify(info);
    if (user || key !== lastInfo.current) {
      lastInfo.current = key;
      editingRef.current.onSelection(r ? r.from.para : 0, r ? baseOffset(r.from.para) : 0, info ? { ...info, user } : null, api.current);
    }
  };

  const applyPendingSel = () => {
    const r = pendingSel.current;
    if (!r) return;
    pendingSel.current = null;
    const c = clampRange(r);
    selRef.current = c;
    setDomSelection(c);
    report(true);
  };

  /** Lưu danh sách đoạn mới; vùng chọn mới được đặt lại sau khi React vẽ xong (các bề mặt vẽ lại từ dữ liệu). */
  const commitDoc = (next: ListeningParagraph[], sel: DocRange) => {
    const finalParas = editingRef.current.onDocEdit(next);
    parasRef.current = finalParas;
    const map = (pt: DocPoint): DocPoint => {
      const o = next[pt.para]?.text;
      const n = finalParas[pt.para]?.text;
      return o !== undefined && n !== undefined && o !== n ? { para: pt.para, off: mapOffsetAfterResequence(o, n, pt.off) } : pt;
    };
    const mapped = { from: map(sel.from), to: map(sel.to) };
    selRef.current = mapped;
    pendingSel.current = mapped;
    window.setTimeout(() => { if (pendingSel.current) applyPendingSel(); }, 80);
  };

  const doReplace = (range: DocRange, pieces: DocPiece[]) => {
    const paras = parasRef.current;
    const f = range.from;
    const hp = paras[f.para];
    if (!hp) return;
    const base = cmpPoint(range.from, range.to) === 0 ? attrsInRange(hp.marks, hp.text.length, f.off, f.off) : attrsInRange(hp.marks, hp.text.length, f.off, f.off + 1);
    const inherit = { ...base, ...(pendingFmt.current?.attrs ?? {}) };
    const res = replaceRange(paras, range, pieces, { inherit });
    if (pieces.some((p) => p.text)) pendingFmt.current = null;
    commitDoc(res.paragraphs, { from: res.caret, to: res.caret });
  };

  const applyFormat = (patch: TextMarkAttrs) => {
    const r = current();
    if (!r) return;
    if (cmpPoint(r.from, r.to) === 0) {
      pendingFmt.current = { attrs: { ...(pendingFmt.current?.attrs ?? {}), ...patch }, at: r.from };
      setDomSelection(r);
      report(true);
      return;
    }
    commitDoc(applyFormatDoc(parasRef.current, r, patch), r);
  };

  const clearFormat = () => {
    const r = current();
    if (!r) return;
    pendingFmt.current = null;
    commitDoc(clearFormatDoc(parasRef.current, r), r);
  };

  Object.assign(api.current, {
    hasSelection: () => !!current(),
    getSelection: () => {
      const r = current();
      if (!r) return null;
      const off0 = baseOffset(r.from.para);
      const start = Math.max(0, r.from.off - off0);
      // Vùng chọn trải nhiều đoạn: các thao tác theo đoạn (vd. Insert Blank) chỉ dùng vị trí đầu vùng chọn
      const end = r.to.para === r.from.para ? Math.max(0, r.to.off - off0) : start;
      return { start, end };
    },
    applyFormat,
    clearFormat,
    focusAt: (start, end) => {
      const r = current();
      const para = r ? r.from.para : 0;
      const off0 = baseOffset(para);
      const range = clampRange({ from: { para, off: start + off0 }, to: { para, off: (end ?? start) + off0 } });
      selRef.current = range;
      setDomSelection(range);
      report(true);
    },
    selectAll: () => {
      const paras = parasRef.current;
      if (!paras.length) return;
      const range = { from: { para: 0, off: 0 }, to: { para: paras.length - 1, off: paras[paras.length - 1].text.length } };
      selRef.current = range;
      setDomSelection(range);
      report(true);
    },
    execClipboard: (kind) => {
      const r = current();
      if (!r || cmpPoint(r.from, r.to) === 0) return;
      setDomSelection(r);
      document.execCommand(kind);
    },
  } satisfies RichParagraphHandle);

  // Sau mỗi lần vẽ: đánh dấu các "đảo" không sửa được, đặt lại vùng chọn nếu các đoạn vừa được vẽ lại
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    markIslands(host);
    const repainted = paintVersion !== seenPaint.current;
    seenPaint.current = paintVersion;
    if (pendingSel.current) applyPendingSel();
    else if (repainted && selRef.current && document.activeElement === host) {
      setDomSelection(clampRange(selRef.current));
      report(false);
    }
  });

  useEffect(() => () => { lastInfo.current = ''; editingRef.current.onSelection(0, 0, null, api.current); }, []);

  // ── Sự kiện ──
  useEffect(() => {
    const host = hostRef.current!;

    const onSelectionChange = () => {
      const r = readDocSelection();
      if (!r) return;
      selRef.current = r;
      const pf = pendingFmt.current;
      if (pf && (cmpPoint(r.from, r.to) !== 0 || cmpPoint(r.from, pf.at) !== 0)) pendingFmt.current = null;
      report(true);
    };

    const deleteRange = (type: string, range: DocRange): DocRange | null => {
      if (cmpPoint(range.from, range.to) !== 0) return range;
      const paras = parasRef.current;
      const c = range.from;
      const p = paras[c.para];
      const start = baseOffset(c.para); // đầu phần chữ hiển thị của đoạn
      const backMerge = (): DocRange | null => (c.para > 0 ? { from: { para: c.para - 1, off: paras[c.para - 1].text.length }, to: c } : null);
      const fwdMerge = (): DocRange | null => (c.para < paras.length - 1 ? { from: c, to: { para: c.para + 1, off: baseOffset(c.para + 1) } } : null);
      const word = type.includes('Word');
      if (type.includes('Backward')) {
        if (c.off <= start) return backMerge(); // đầu đoạn: gộp với đoạn trước
        let o = c.off - 1;
        if (word) {
          o = c.off;
          while (o > start && isSpace(p.text[o - 1])) o--;
          while (o > start && !isSpace(p.text[o - 1])) o--;
        }
        return { from: { para: c.para, off: o }, to: c };
      }
      if (c.off >= p.text.length) return fwdMerge(); // cuối đoạn: gộp với đoạn sau
      let o = c.off + 1;
      if (word) {
        o = c.off;
        while (o < p.text.length && isSpace(p.text[o])) o++;
        while (o < p.text.length && !isSpace(p.text[o])) o++;
      }
      return { from: c, to: { para: c.para, off: o } };
    };

    const onBeforeInput = (e: InputEvent) => {
      if (composing.current || e.isComposing || e.inputType.startsWith('insertComposition')) return;
      if (selectionInNestedEditor()) return; // ô sửa riêng (tiêu đề...) tự xử lý
      const range = readDocSelection();
      if (!range) { e.preventDefault(); return; }
      selRef.current = range;
      const t = e.inputType;
      if (t === 'insertText') { e.preventDefault(); if (e.data) doReplace(range, [{ text: e.data }]); return; }
      if (t === 'insertParagraph') { e.preventDefault(); doReplace(range, [{ text: '' }, { text: '' }]); return; }
      if (t === 'insertLineBreak') { e.preventDefault(); doReplace(range, [{ text: '\n' }]); return; }
      if (t === 'insertReplacementText') {
        e.preventDefault();
        const rep = e.dataTransfer?.getData('text/plain') ?? e.data ?? '';
        if (rep) doReplace(range, [{ text: rep }]);
        return;
      }
      if (t.startsWith('delete')) {
        e.preventDefault();
        const r = deleteRange(t, range);
        if (r && cmpPoint(r.from, r.to) !== 0) doReplace(r, [{ text: '' }]);
        return;
      }
      if (t === 'historyUndo' || t === 'historyRedo' || t.startsWith('format') || t === 'insertFromDrop' || t === 'insertFromPaste' || t === 'insertFromYank') e.preventDefault();
    };

    /** Trình duyệt tự sửa chữ trong một đoạn (gõ IME): đọc lại DOM và đồng bộ vào dữ liệu. */
    const syncFromDom = () => {
      const paras = parasRef.current;
      let changed = -1;
      let visible = '';
      for (const s of surfaces()) {
        const i = idxOfId(s.dataset.paraId ?? '');
        if (i < 0) continue;
        const off0 = Number(s.dataset.offset ?? 0);
        const text = readTextOf(s);
        if (text !== paras[i].text.slice(off0)) { changed = i; visible = text; break; }
      }
      if (changed < 0) return;
      const p = paras[changed];
      const full = p.text.slice(0, baseOffset(changed)) + visible;
      const ed = diffEdit(p.text, full);
      const base = attrsInRange(p.marks, p.text.length, ed.at, ed.at);
      const marks = marksAfterEdit(p.marks, full.length, ed, { ...base, ...(pendingFmt.current?.attrs ?? {}) });
      pendingFmt.current = null;
      const sel = readDocSelection() ?? { from: { para: changed, off: ed.at + ed.newLen }, to: { para: changed, off: ed.at + ed.newLen } };
      commitDoc(paras.map((q, i) => (i === changed ? { ...q, text: full, marks } : q)), sel);
    };

    const onInput = () => { if (!composing.current && !selectionInNestedEditor()) syncFromDom(); };
    const onCompStart = () => { composing.current = true; };
    const onCompEnd = () => { composing.current = false; syncFromDom(); };

    const onCopy = (e: ClipboardEvent, cut: boolean) => {
      if (selectionInNestedEditor()) return;
      const r = readDocSelection() ?? selRef.current;
      if (!r || cmpPoint(r.from, r.to) === 0 || !e.clipboardData) return;
      e.preventDefault();
      const pieces = docSlice(parasRef.current, clampRange(r));
      e.clipboardData.setData('text/plain', pieces.map((p) => p.text).join('\n'));
      e.clipboardData.setData('application/x-fbs-runs', JSON.stringify({ pieces }));
      e.clipboardData.setData('text/html', pieces.map((pc) => `<p>${segmentText(pc.marks, 0, pc.text.length).map((seg) => {
        const style = Object.entries(attrsToStyle(seg.attrs)).filter(([, v]) => v !== undefined).map(([k, v]) => `${kebab(k)}:${v}`).join(';');
        return `<span style="${style}">${escHtml(pc.text.slice(seg.start, seg.end))}</span>`;
      }).join('')}</p>`).join(''));
      if (cut) doReplace(clampRange(r), [{ text: '' }]);
    };

    const onPaste = (e: ClipboardEvent) => {
      if (selectionInNestedEditor()) return;
      e.preventDefault();
      const cd = e.clipboardData;
      const r = readDocSelection() ?? selRef.current;
      if (!cd || !r) return;
      let plain = cd.getData('text/plain').replace(/\r\n?/g, '\n');
      if (!plain) return;
      let pieces: DocPiece[] | null = null;
      try {
        const raw = cd.getData('application/x-fbs-runs');
        if (raw) {
          const j = JSON.parse(raw) as { pieces?: DocPiece[]; text?: string; marks?: TextMark[] };
          if (j.pieces && j.pieces.map((p) => p.text).join('\n') === plain) pieces = j.pieces;
          else if (j.text === plain) pieces = [{ text: j.text, marks: j.marks }];
        }
      } catch { /* dán chữ thường */ }
      if (!pieces) {
        if (plain.endsWith('\n')) plain = plain.slice(0, -1);
        pieces = plain.split('\n').map((text) => ({ text }));
      }
      doReplace(clampRange(r), pieces);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || selectionInNestedEditor()) return;
      const k = e.key.toLowerCase();
      // Ctrl+A: trình duyệt chọn sai khi có phần tử nổi/hàng flex xen giữa các đoạn → tự chọn từ đầu đoạn đầu đến cuối đoạn cuối
      if (k === 'a' && !e.shiftKey) { e.preventDefault(); api.current.selectAll(); return; }
      const key = k === 'b' ? 'bold' : k === 'i' ? 'italic' : k === 'u' ? 'underline' : null;
      if (!key) return;
      e.preventDefault();
      const r = current();
      if (!r) return;
      let attrs = attrsInDocRange(parasRef.current, r);
      if (cmpPoint(r.from, r.to) === 0 && pendingFmt.current) attrs = { ...attrs, ...pendingFmt.current.attrs };
      applyFormat({ [key]: !attrs[key] } as TextMarkAttrs);
    };

    const cut = (e: ClipboardEvent) => onCopy(e, true);
    const copy = (e: ClipboardEvent) => onCopy(e, false);
    const noDrop = (e: DragEvent) => { if (!inNestedEditor(e.target as Node)) e.preventDefault(); };

    document.addEventListener('selectionchange', onSelectionChange);
    host.addEventListener('beforeinput', onBeforeInput);
    host.addEventListener('input', onInput);
    host.addEventListener('compositionstart', onCompStart);
    host.addEventListener('compositionend', onCompEnd);
    host.addEventListener('copy', copy);
    host.addEventListener('cut', cut);
    host.addEventListener('paste', onPaste);
    host.addEventListener('keydown', onKeyDown);
    host.addEventListener('drop', noDrop);
    host.addEventListener('dragover', noDrop);
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      host.removeEventListener('beforeinput', onBeforeInput);
      host.removeEventListener('input', onInput);
      host.removeEventListener('compositionstart', onCompStart);
      host.removeEventListener('compositionend', onCompEnd);
      host.removeEventListener('copy', copy);
      host.removeEventListener('cut', cut);
      host.removeEventListener('paste', onPaste);
      host.removeEventListener('keydown', onKeyDown);
      host.removeEventListener('drop', noDrop);
      host.removeEventListener('dragover', noDrop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={hostRef}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      data-a4-host
      className="caret-blue-600 outline-none"
    >
      {children}
    </div>
  );
};
