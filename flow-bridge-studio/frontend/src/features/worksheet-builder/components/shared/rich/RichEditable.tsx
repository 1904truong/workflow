// Ô chữ sửa trực tiếp trên trang A4 dùng chung cho mọi dạng bài (thay các EditableText riêng của từng renderer).
//
//  - Edit Mode: dùng engine RichParagraphInput (con trỏ đúng vị trí, chọn từng từ, định dạng chờ tại con trỏ, Ctrl+B/I/U,
//    gõ tiếng Việt, dán giữ định dạng). Chữ + định dạng được lưu khi rời ô (Enter / Esc / bấm ra ngoài) như trước.
//  - Preview / in: vẽ chữ kèm định dạng từng từ; ô chưa định dạng riêng thì giữ nguyên cách hiển thị cũ của renderer (`fallback`).
//  - Thanh công cụ chung (RibbonToolbar) đọc ô đang chọn qua `useRichSelection` để Bold/Italic/màu/cỡ chữ... áp đúng phần chữ đang chọn.

import React, { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { RichParagraphInput, type RichEdit, type RichParagraphHandle, type RichSelectionInfo } from '../../listening/RichParagraphInput';
import { attrsToStyle, segmentText, type TextMark } from '../../../services/listening/textMarks';
import { richMarksFor, setRichMarks, tidyRichEdit, type RichMarks } from '../../../services/richFields';

// ───────────── Nơi lưu định dạng của bài ─────────────

interface RichMarksCtx {
  marks?: RichMarks;
  /** Có = đang ở trình soạn, lưu được định dạng mới */
  onChange?: (update: (prev: RichMarks | undefined) => RichMarks | undefined) => void;
}
const Ctx = createContext<RichMarksCtx>({});

export const RichMarksProvider: React.FC<RichMarksCtx & { children: React.ReactNode }> = ({ marks, onChange, children }) => (
  <Ctx.Provider value={{ marks, onChange }}>{children}</Ctx.Provider>
);

// ───────────── Ô đang chọn (cho thanh công cụ) ─────────────

export interface RichActive {
  handle: RichParagraphHandle;
  info: RichSelectionInfo;
  el: HTMLElement | null;
}
let active: RichActive | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const setActive = (a: RichActive | null) => { active = a; emit(); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** Ô chữ đang có con trỏ / vùng chọn (null = không có) */
export const useRichSelection = (): RichActive | null => useSyncExternalStore(subscribe, () => active, () => null);

// Con trỏ chuyển sang ô nhập khác (cột trái, hộp thoại...) thì thanh công cụ trở về định dạng theo thành phần
if (typeof document !== 'undefined') {
  document.addEventListener('focusin', (e) => {
    const t = e.target as HTMLElement | null;
    if (!active || !t || active.el?.contains(t)) return;
    if (t.matches('input, textarea, select, [contenteditable="true"], [contenteditable=""]')) setActive(null);
  });
}

/** Cỡ chữ hiện tại (pt) của ô đang chọn: theo định dạng riêng, không có thì đo trên trang */
export const activeFontSizePt = (a: RichActive): number => {
  if (a.info.attrs.fontSizePt) return a.info.attrs.fontSizePt;
  const px = a.el ? parseFloat(getComputedStyle(a.el).fontSize) : NaN;
  return Number.isFinite(px) ? Math.round(px * 0.75 * 2) / 2 : 11;
};

// ───────────── Chữ có định dạng (chỉ xem) ─────────────

export const MarkedText: React.FC<{ text: string; marks?: TextMark[] }> = ({ text, marks }) => (
  <>
    {segmentText(marks, 0, text.length).map((seg) => {
      const t = text.slice(seg.start, seg.end);
      const style = attrsToStyle(seg.attrs);
      return Object.values(style).some((v) => v !== undefined)
        ? <span key={seg.start} style={style as React.CSSProperties}>{t}</span>
        : <React.Fragment key={seg.start}>{t}</React.Fragment>;
    })}
  </>
);

/** Định dạng từng từ đã lưu cho đoạn chữ này (dùng trong renderer để biết có cần vẽ theo marks không) */
export const useRichMarks = (text: string): TextMark[] | undefined => richMarksFor(useContext(Ctx).marks, text);

// ───────────── Ô sửa ─────────────

interface Props {
  value: string;
  /** Có = sửa được (Edit Mode) */
  onCommit?: (v: string) => void;
  css?: React.CSSProperties;
  selected?: boolean;
  onSelect?: () => void;
  /** 'inline' cho câu dài xuống dòng tự nhiên trong đoạn; mặc định 'inline-block' */
  display?: 'inline' | 'inline-block';
  /** Cách hiển thị riêng của renderer khi ô chưa có định dạng từng từ (vd. [[TRUE]] tô đỏ) */
  fallback?: React.ReactNode;
}

export const RichEditable: React.FC<Props> = ({ value: rawValue, onCommit, css, selected, onSelect, display = 'inline-block', fallback }) => {
  // Dữ liệu cũ có thể thiếu trường (undefined): coi như ô trống, không để engine sập cả trang
  const value = typeof rawValue === 'string' ? rawValue : rawValue == null ? '' : String(rawValue);
  const ctx = useContext(Ctx);
  const saved = richMarksFor(ctx.marks, value);
  const [draft, setDraft] = useState<{ text: string; marks?: TextMark[] } | null>(null);
  const handleRef = useRef<RichParagraphHandle | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);

  // Rời Edit Mode / ô bị gỡ khỏi trang: không còn là ô đang chọn
  useEffect(() => () => { if (active && active.handle === handleRef.current) setActive(null); }, []);

  if (!onCommit) {
    return <span style={css}>{saved ? <MarkedText text={value} marks={saved} /> : (fallback ?? value)}</span>;
  }

  const shown = draft ?? { text: value, marks: saved };
  const commit = () => {
    if (!draft) return;
    const next = tidyRichEdit(draft.text, draft.marks);
    setDraft(null);
    const before = JSON.stringify(saved ?? null);
    if (next.text !== value) onCommit(next.text);
    if (ctx.onChange && (next.text !== value || JSON.stringify(next.marks ?? null) !== before)) {
      ctx.onChange((prev) => setRichMarks(prev, value, next.text, next.marks));
    }
  };

  return (
    <span ref={wrapRef} style={{ display, minWidth: '3ch' }}>
      <RichParagraphInput
        as="span"
        singleLine
        gapStyle="page"
        text={shown.text}
        marks={shown.marks}
        onEdit={(e: RichEdit) => { setDraft({ text: e.text, marks: e.marks }); return e; }}
        onSelectionInfo={(info, handle) => {
          handleRef.current = handle;
          if (info && (info.user || active?.handle === handle)) setActive({ handle, info, el: wrapRef.current });
          else if (!info && active?.handle === handle) setActive(null);
        }}
        onFocus={onSelect}
        onBlur={commit}
        className="rounded-[2px] cursor-text caret-blue-600 hover:bg-blue-50 focus:bg-blue-50/60 focus:outline focus:outline-1 focus:outline-blue-400 focus:outline-offset-2"
        style={{ ...css, display, minWidth: '3ch', whiteSpace: 'pre-wrap', outline: selected ? '1px solid #8b5cf6' : undefined, outlineOffset: '2px' }}
      />
    </span>
  );
};
