// Bộ thành phần cho thanh công cụ hai hàng kiểu Word / Casual Docs (hàng menu + hàng công cụ).
//
// Hành vi học từ Casual Docs:
//  - Mọi nút/menu chặn `mousedown` mặc định → bấm vào thanh KHÔNG cướp focus và vùng chọn của ô soạn.
//  - Panel thả xuống dùng `position: fixed` (đưa ra document.body) nên không bị cắt bởi vùng cuộn, tự lật lên/dịch vào khi sát mép màn hình.
//  - Khi một menu đang mở, rê chuột sang menu khác thì chuyển luôn (hover-to-switch); bấm ra ngoài hoặc Esc thì đóng.
// Chỉ chứa phần giao diện chung; dạng bài nào dùng thì tự khai báo menu/nút thật của mình.

import React, { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ToolbarTip } from './ToolbarIconButton';

interface RibbonState { openId: string | null; setOpenId: (id: string | null) => void; kbOpen: React.MutableRefObject<boolean> }
const RibbonContext = createContext<RibbonState>({ openId: null, setOpenId: () => {}, kbOpen: { current: false } });

const noFocusSteal = (e: React.MouseEvent) => e.preventDefault();

export const RibbonRoot: React.FC<{ locked?: boolean; lockedHint?: string; children: React.ReactNode }> = ({ locked = false, lockedHint, children }) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const kbOpen = useRef(false); // menu vừa được mở bằng bàn phím → focus vào mục đầu tiên

  const focusTrigger = (id: string | null) => {
    if (id) document.querySelector<HTMLElement>(`[data-ribbon-trigger="${id}"]`)?.focus();
  };
  const menuTriggers = () => [...document.querySelectorAll<HTMLElement>('[data-ribbon-trigger^="menu-"]')];

  /** Điều khiển bằng bàn phím: ↓/Enter/Space mở menu, ↑↓ Home End di chuyển mục, ←→ đổi menu, Esc/Tab đóng và trả focus */
  const onKeyDown = (e: React.KeyboardEvent) => {
    const t = e.target as HTMLElement;
    const panelEl = t.closest<HTMLElement>('[data-ribbon-panel]');
    if (panelEl && t.tagName !== 'INPUT') {
      const items = [...panelEl.querySelectorAll<HTMLElement>('[role=menuitem]:not(:disabled)')];
      const i = items.indexOf(t.closest<HTMLElement>('[role=menuitem]') as HTMLElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
      else if (e.key === 'Home') { e.preventDefault(); items[0]?.focus(); }
      else if (e.key === 'End') { e.preventDefault(); items[items.length - 1]?.focus(); }
      else if (e.key === 'Escape' || e.key === 'Tab') { if (e.key === 'Escape') e.preventDefault(); const id = openId; setOpenId(null); focusTrigger(id); }
      else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && openId?.startsWith('menu-')) {
        e.preventDefault();
        const list = menuTriggers();
        const cur = list.findIndex((el) => el.dataset.ribbonTrigger === openId);
        const next = list[(cur + (e.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length];
        kbOpen.current = true;
        setOpenId(next.dataset.ribbonTrigger ?? null);
      }
      return;
    }
    const trig = t.closest<HTMLElement>('[data-ribbon-trigger]');
    if (!trig) return;
    const id = trig.dataset.ribbonTrigger ?? '';
    if (id.startsWith('menu-') && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      const list = menuTriggers();
      const cur = list.indexOf(trig);
      const next = list[(cur + (e.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length];
      next.focus();
      if (openId) { kbOpen.current = true; setOpenId(next.dataset.ribbonTrigger ?? null); }
    } else if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      kbOpen.current = true;
      if (e.key === 'ArrowDown') { e.preventDefault(); setOpenId(id); }
    }
  };

  useEffect(() => {
    if (!openId) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest('[data-ribbon-panel],[data-ribbon-trigger]')) return;
      setOpenId(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenId(null); };
    const onScroll = (e: Event) => { if (!(e.target as HTMLElement | null)?.closest?.('[data-ribbon-panel]')) setOpenId(null); };
    const onResize = () => setOpenId(null);
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [openId]);

  useEffect(() => { if (locked) setOpenId(null); }, [locked]);

  return (
    <RibbonContext.Provider value={{ openId, setOpenId, kbOpen }}>
      <div
        className={`bg-white border-b border-slate-200 sticky top-0 z-30 shrink-0 transition-opacity ${locked ? 'opacity-50 select-none' : ''}`}
        aria-disabled={locked || undefined}
        title={locked ? lockedHint : undefined}
        // Đang xem trước: khóa toàn bộ công cụ chỉnh sửa
        {...(locked ? { inert: true } : {})}
        onKeyDown={onKeyDown}
        onMouseDown={(e) => { if (!(e.target as HTMLElement).closest('input,textarea,select,label')) e.preventDefault(); }}
      >
        {children}
      </div>
    </RibbonContext.Provider>
  );
};

// ───────────── Popover (panel thả xuống neo vào nút) ─────────────

export interface PopoverTriggerProps {
  open: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  'data-ribbon-trigger': string;
}

export const Popover: React.FC<{
  id: string;
  trigger: (p: PopoverTriggerProps) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  /** Rê chuột sang đây khi menu khác đang mở thì chuyển sang menu này (dùng cho hàng menu) */
  hoverSwitch?: boolean;
  panelClass?: string;
}> = ({ id, trigger, children, hoverSwitch = false, panelClass = '' }) => {
  const { openId, setOpenId, kbOpen } = useContext(RibbonContext);
  const open = openId === id;
  const anchorRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    const a = anchorRef.current?.getBoundingClientRect();
    const p = panelRef.current?.getBoundingClientRect();
    if (!a || !p) return;
    const m = 8;
    const left = Math.max(m, Math.min(a.left, window.innerWidth - p.width - m));
    let top = a.bottom + 4;
    if (top + p.height > window.innerHeight - m && a.top - p.height - 4 > m) top = a.top - p.height - 4;
    setPos({ left, top });
  }, [open]);

  // Mở bằng bàn phím: focus mục đầu tiên (chỉ focus được sau khi panel đã hiện, tức đã có vị trí)
  useEffect(() => {
    if (open && pos && kbOpen.current) {
      kbOpen.current = false;
      // Menu mà mọi mục đều đang tắt: focus chính panel để phím ←→ Esc vẫn hoạt động
      (panelRef.current?.querySelector<HTMLElement>('[role=menuitem]:not(:disabled),button:not(:disabled)') ?? panelRef.current)?.focus();
    }
  }, [open, pos, kbOpen]);

  return (
    <span ref={anchorRef} className="inline-flex">
      {trigger({
        open,
        onClick: () => setOpenId(open ? null : id),
        onMouseEnter: () => { if (hoverSwitch && openId && openId !== id) setOpenId(id); },
        onMouseDown: (e) => { kbOpen.current = false; noFocusSteal(e); },
        'data-ribbon-trigger': id,
      })}
      {open && createPortal(
        <div
          ref={panelRef}
          data-ribbon-panel
          role="menu"
          tabIndex={-1}
          onMouseDown={(e) => { if (!(e.target as HTMLElement).closest('input,textarea,select,label')) e.preventDefault(); }}
          style={{ position: 'fixed', left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden' }}
          className={`z-[80] max-h-[70vh] overflow-y-auto rounded-lg border focus:outline-none border-slate-200 bg-white shadow-lg ${panelClass}`}
        >
          {children(() => setOpenId(null))}
        </div>,
        document.body,
      )}
    </span>
  );
};

// ───────────── Nút ─────────────

export const TbButton: React.FC<{
  icon: LucideIcon;
  label: string;
  /** Chỉ truyền phím tắt đang thực sự hoạt động */
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onClick?: () => void;
  indicator?: string;
  /** Chữ nhỏ cạnh icon */
  text?: string;
  className?: string;
}> = ({ icon: Icon, label, shortcut, active = false, disabled = false, disabledReason, onClick, indicator, text, className = '' }) => (
  <ToolbarTip label={disabled && disabledReason ? disabledReason : `${label}${shortcut ? ` (${shortcut})` : ''}`}>
    <button
      type="button"
      aria-label={label}
      aria-pressed={active || undefined}
      disabled={disabled}
      onMouseDown={noFocusSteal}
      onClick={onClick}
      className={`inline-flex h-8 ${text ? 'min-w-8 px-1.5 gap-1' : 'w-8'} ${text ? 'flex-row' : 'flex-col'} items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
        active ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-transparent text-slate-700 hover:bg-slate-100'
      } ${disabled ? 'cursor-not-allowed opacity-35 hover:bg-transparent' : 'cursor-pointer'} ${className}`}
    >
      <Icon size={16} strokeWidth={1.9} />
      {text && <span className="text-xs font-semibold">{text}</span>}
      {indicator && <span className="-mt-0.5 h-[3px] w-4 rounded-sm" style={{ background: indicator }} />}
    </button>
  </ToolbarTip>
);

export const TbSep: React.FC = () => <span className="mx-1 h-5 w-px shrink-0 bg-slate-200" aria-hidden />;

/** Nút mở dropdown ở hàng công cụ: nội dung + mũi tên (vd. "Arial ▾", "100% ▾") */
export const DropdownTrigger: React.FC<PopoverTriggerProps & { label: string; width?: string; disabled?: boolean; children: React.ReactNode; tip?: string }> = ({
  open, onClick, onMouseEnter, onMouseDown, label, width = '', disabled, children, tip, ...rest
}) => (
  <ToolbarTip label={tip ?? label}>
    <button
      type="button"
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={open}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseDown={onMouseDown}
      data-ribbon-trigger={rest['data-ribbon-trigger']}
      className={`inline-flex h-8 items-center justify-between gap-1 rounded-md border px-2 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
        open ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-transparent text-slate-700 hover:bg-slate-100'
      } ${disabled ? 'cursor-not-allowed opacity-35' : 'cursor-pointer'} ${width}`}
    >
      <span className="flex min-w-0 items-center gap-1 truncate">{children}</span>
      <ChevronDown size={13} className="shrink-0 text-slate-400" />
    </button>
  </ToolbarTip>
);

/** Chữ menu ở hàng 1 (File, Edit, ...) */
export const MenuTrigger: React.FC<PopoverTriggerProps & { label: string }> = ({ open, onClick, onMouseEnter, onMouseDown, label, ...rest }) => (
  <button
    type="button"
    aria-haspopup="menu"
    aria-expanded={open}
    onClick={onClick}
    onMouseEnter={onMouseEnter}
    onMouseDown={onMouseDown}
    data-ribbon-trigger={rest['data-ribbon-trigger']}
    className={`inline-flex h-7 items-center rounded-md px-2.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
      open ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-100'
    }`}
  >
    {label}
  </button>
);

// ───────────── Danh sách mục trong menu ─────────────

export type RibbonEntry =
  | { kind: 'item'; label: string; icon?: LucideIcon; shortcut?: string; onClick: () => void; disabled?: boolean; checked?: boolean; keepOpen?: boolean }
  | { kind: 'sep' }
  | { kind: 'title'; label: string };

export const MenuList: React.FC<{ entries: RibbonEntry[]; close: () => void; minWidth?: string }> = ({ entries, close, minWidth = 'min-w-[14rem]' }) => (
  <div className={`py-1 ${minWidth}`}>
    {entries.map((en, i) => {
      if (en.kind === 'sep') return <div key={i} className="my-1 h-px bg-slate-200" />;
      if (en.kind === 'title') return <div key={i} className="px-3 pb-0.5 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{en.label}</div>;
      const Icon = en.icon;
      return (
        <button
          key={i}
          type="button"
          role="menuitem"
          disabled={en.disabled}
          onClick={() => { en.onClick(); if (!en.keepOpen) close(); }}
          className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] ${en.disabled ? 'cursor-not-allowed text-slate-300' : 'text-slate-700 hover:bg-slate-100'}`}
        >
          <span className="flex h-4 w-4 shrink-0 items-center justify-center text-slate-500">
            {en.checked ? <Check size={14} className="text-blue-600" /> : Icon ? <Icon size={15} strokeWidth={1.8} /> : null}
          </span>
          <span className="flex-1 whitespace-nowrap">{en.label}</span>
          {en.shortcut && <span className="ml-6 text-xs text-slate-400">{en.shortcut}</span>}
        </button>
      );
    })}
  </div>
);

// ───────────── Bảng màu ─────────────

const PALETTE = [
  ['#000000', '#434343', '#666666', '#999999', '#cccccc', '#ffffff'],
  ['#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb'],
  ['#9333ea', '#db2777', '#7f1d1d', '#7c2d12', '#14532d', '#1e3a8a'],
];
const HIGHLIGHTS = ['#fde047', '#bef264', '#67e8f9', '#f9a8d4', '#fdba74', '#d8b4fe'];

export const ColorPalette: React.FC<{
  value?: string;
  onPick: (color: string | undefined) => void;
  close: () => void;
  highlight?: boolean;
  /** Có chữ này thì hiện nút "bỏ màu"; bỏ trống = không có */
  noneLabel?: string;
}> = ({ value, onPick, close, highlight = false, noneLabel }) => {
  const rows = highlight ? [HIGHLIGHTS] : PALETTE;
  const pick = (c: string | undefined) => { onPick(c); close(); };
  return (
    <div className="w-[11.5rem] p-2">
      {noneLabel && <button type="button" onClick={() => pick(undefined)} className="mb-2 w-full rounded-md border border-slate-200 px-2 py-1 text-left text-xs text-slate-600 hover:bg-slate-50">{noneLabel}</button>}
      <div className="space-y-1">
        {rows.map((row, ri) => (
          <div key={ri} className="flex gap-1">
            {row.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => pick(c)}
                className={`h-6 w-6 rounded-md border ${value?.toLowerCase() === c ? 'border-blue-600 ring-1 ring-blue-500' : 'border-slate-200'}`}
                style={{ background: c }}
              />
            ))}
          </div>
        ))}
      </div>
      <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-xs text-slate-600 hover:bg-slate-50">
        <input type="color" value={value || '#111827'} onChange={(e) => onPick(e.target.value)} className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0" />
        Màu khác…
      </label>
    </div>
  );
};

/** Nút chọn file (ảnh, audio...) cùng kiểu với TbButton; bấm mở hộp chọn file */
export const TbFileButton: React.FC<{
  icon: LucideIcon;
  label: string;
  accept?: string;
  multiple?: boolean;
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  disabledReason?: string;
}> = ({ icon: Icon, label, accept, multiple, onFile, disabled = false, disabledReason }) => (
  <ToolbarTip label={disabled && disabledReason ? disabledReason : label}>
    <label
      aria-label={label}
      tabIndex={disabled ? -1 : 0}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-slate-700 transition-colors ${disabled ? 'cursor-not-allowed opacity-35' : 'cursor-pointer hover:bg-slate-100'}`}
    >
      <Icon size={16} strokeWidth={1.9} />
      <input type="file" hidden accept={accept} multiple={multiple} disabled={disabled} onChange={onFile} />
    </label>
  </ToolbarTip>
);
