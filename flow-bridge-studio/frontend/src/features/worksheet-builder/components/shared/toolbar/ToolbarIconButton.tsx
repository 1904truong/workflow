import React, { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';

/** true = nút nhỏ gọn (icon 16px, nút 32px) – dùng cho thanh công cụ Matching Pictures */
export const ToolbarDensityContext = createContext<boolean>(false);
import type { LucideIcon } from 'lucide-react';

const TOOLTIP_DELAY_MS = 300;

/** Tooltip nhỏ hiện bên dưới sau ~300ms khi hover hoặc focus bàn phím; hoạt động cả với nút bị disabled */
export const ToolbarTip: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const show = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(true), TOOLTIP_DELAY_MS);
  };
  const hide = () => {
    if (timer.current) window.clearTimeout(timer.current);
    setOpen(false);
  };
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  return (
    <span className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide} onMouseDown={hide}>
      {children}
      {open && (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-1/2 top-full z-[70] mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-md"
        >
          {label}
        </span>
      )}
    </span>
  );
};

interface ToolbarIconButtonProps {
  icon: LucideIcon;
  label: string;
  /** Chỉ truyền phím tắt đang thực sự hoạt động */
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  /** Giải thích khi nút bị tắt (thay cho label) */
  disabledReason?: string;
  onClick?: () => void;
  /** 'file': mở hộp chọn file; 'color': mở bảng chọn màu */
  kind?: 'button' | 'file' | 'color';
  accept?: string;
  multiple?: boolean;
  onFile?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  colorValue?: string;
  onColor?: (value: string) => void;
  /** Vạch màu bên dưới icon (màu chữ / tô nền) */
  indicator?: string;
  /** Chữ nhỏ cạnh icon (ví dụ tên dropdown) */
  text?: string;
  expanded?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const toolbarBtnClass = (active: boolean, disabled: boolean, extra = '', dense = false) =>
  `${dense ? 'h-8 min-w-8 px-1.5' : 'h-9 min-w-9 px-2'} inline-flex flex-col items-center justify-center gap-0 rounded-lg border text-slate-800 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
    active
      ? 'border-blue-200 bg-blue-50 text-blue-700'
      : 'border-transparent hover:bg-slate-100'
  } ${disabled ? 'opacity-40 cursor-not-allowed hover:bg-transparent' : 'cursor-pointer'} ${extra}`;

export const ToolbarIconButton: React.FC<ToolbarIconButtonProps> = ({
  icon: Icon,
  label,
  shortcut,
  active = false,
  disabled = false,
  disabledReason,
  onClick,
  kind = 'button',
  accept,
  multiple,
  onFile,
  colorValue,
  onColor,
  indicator,
  text,
  expanded,
  className = '',
  children,
}) => {
  const dense = useContext(ToolbarDensityContext);
  const tip = disabled && disabledReason ? disabledReason : `${label}${shortcut ? ` (${shortcut})` : ''}`;
  const cls = toolbarBtnClass(active, disabled, className, dense);
  const icon = (
    <>
      <span className="flex items-center gap-1">
        <Icon size={dense ? 16 : 18} strokeWidth={1.75} />
        {text && <span className="text-xs font-semibold">{text}</span>}
        {children}
      </span>
      {indicator && <span className="h-[3px] w-4 rounded-sm -mt-0.5" style={{ background: indicator }} />}
    </>
  );

  return (
    <ToolbarTip label={tip}>
      {kind === 'button' ? (
        <button
          type="button"
          aria-label={label}
          aria-pressed={active || undefined}
          aria-expanded={expanded}
          disabled={disabled}
          onClick={onClick}
          className={cls}
        >
          {icon}
        </button>
      ) : (
        <label aria-label={label} className={cls} tabIndex={disabled ? -1 : 0}>
          {icon}
          {kind === 'file' ? (
            <input type="file" accept={accept} multiple={multiple} hidden disabled={disabled} onChange={onFile} />
          ) : (
            <input
              type="color"
              className="sr-only"
              disabled={disabled}
              value={colorValue || '#111827'}
              onChange={(e) => onColor?.(e.target.value)}
            />
          )}
        </label>
      )}
    </ToolbarTip>
  );
};

/** Giữ các popover của thanh công cụ nằm gọn trong màn hình: tràn phải/trái thì tự dịch vào */
export const useClampPopovers = (rootRef: React.RefObject<HTMLElement | null>, deps: unknown[]) => {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>('.absolute.z-50.top-full').forEach((el) => {
      el.style.transform = '';
      const r = el.getBoundingClientRect();
      const margin = 8;
      let dx = 0;
      if (r.right > window.innerWidth - margin) dx = window.innerWidth - margin - r.right;
      if (r.left + dx < margin) dx = margin - r.left;
      if (dx) el.style.transform = `translateX(${Math.round(dx)}px)`;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};
