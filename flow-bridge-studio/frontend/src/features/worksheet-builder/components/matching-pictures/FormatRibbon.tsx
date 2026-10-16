import React, { useEffect, useRef, useState } from 'react';
import { AlignLeft, AlignCenter, AlignRight, RemoveFormatting, ChevronDown } from 'lucide-react';
import type { TextStyle, TextStyleKey } from '../../services/matching-pictures/matchingPicturesCore';
import { TEXT_STYLE_LABELS } from '../../services/matching-pictures/matchingPicturesCore';

interface Props {
  selKey: TextStyleKey;
  onSelKey: (k: TextStyleKey) => void;
  style?: TextStyle;
  /** Giá trị mặc định đang hiển thị của thành phần (để nút B / I phản ánh đúng) */
  defaults: { bold: boolean; italic: boolean; size: number };
  onFlag: (flag: 'bold' | 'italic' | 'underline' | 'strike') => void;
  onSizeDelta: (delta: number) => void;
  onPatch: (patch: Partial<TextStyle>) => void;
  onClear: () => void;
}

const PALETTE = [
  ['#111111', 'Đen (mặc định)'], ['#475569', 'Xám'], ['#16295f', 'Xanh navy'], ['#1d4ed8', 'Xanh dương'], ['#0e7490', 'Xanh ngọc'],
  ['#15803d', 'Xanh lá'], ['#b45309', 'Cam đất'], ['#c81e1e', 'Đỏ'], ['#be185d', 'Hồng đậm'], ['#6d28d9', 'Tím'],
] as const;

const btn =
  'h-8 min-w-8 px-1.5 rounded-md border border-transparent flex items-center justify-center text-slate-700 hover:bg-slate-200/70 hover:border-slate-300 transition-colors';
const on = 'bg-blue-100 border-blue-300 text-blue-800 hover:bg-blue-100';

/** Group nhỏ có nhãn bên dưới, giống các nhóm trên thanh Ribbon của Word */
const Group: React.FC<{ label: string; children: React.ReactNode; last?: boolean }> = ({ label, children, last }) => (
  <div className={`flex flex-col items-center px-2 ${last ? '' : 'border-r border-slate-300/70'}`}>
    <div className="flex items-center gap-0.5 h-8">{children}</div>
    <span className="text-[9px] leading-none text-slate-500 mt-1 tracking-wide">{label}</span>
  </div>
);

export const FormatRibbon: React.FC<Props> = ({ selKey, onSelKey, style, defaults, onFlag, onSizeDelta, onPatch, onClear }) => {
  const [colorOpen, setColorOpen] = useState(false);
  const colorRef = useRef<HTMLDivElement>(null);
  const bold = style?.bold ?? defaults.bold;
  const italic = style?.italic ?? defaults.italic;
  const size = style?.sizePt ?? defaults.size;
  const color = style?.color ?? '#111111';

  useEffect(() => {
    if (!colorOpen) return;
    const onDown = (e: MouseEvent) => { if (!colorRef.current?.contains(e.target as Node)) setColorOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [colorOpen]);

  return (
    <div
      role="toolbar"
      aria-label="Định dạng chữ"
      className="flex flex-wrap items-start gap-y-2 rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 px-1.5 py-2 shadow-xs select-none"
      // Giữ nguyên vùng đang chọn trên trang A4 khi bấm nút (trừ ô chọn / nhập số)
      onMouseDown={(e) => {
        const tag = (e.target as HTMLElement).tagName;
        if (tag !== 'SELECT' && tag !== 'INPUT') e.preventDefault();
      }}
    >
      {/* Kiểu = thành phần đang chọn */}
      <Group label="Thành phần">
        <div className="relative">
          <select
            value={selKey}
            onChange={(e) => onSelKey(e.target.value as TextStyleKey)}
            className="h-8 w-[8.6rem] pl-2 pr-6 rounded-md border border-slate-300 bg-white text-[12px] font-medium text-slate-800 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            aria-label="Thành phần đang định dạng"
          >
            {(Object.keys(TEXT_STYLE_LABELS) as TextStyleKey[]).map((k) => <option key={k} value={k}>{TEXT_STYLE_LABELS[k]}</option>)}
          </select>
          <ChevronDown size={13} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        </div>
      </Group>

      {/* Cỡ chữ: A− [số] A+ */}
      <Group label="Cỡ chữ">
        <button type="button" title="Giảm cỡ chữ" aria-label="Giảm cỡ chữ" onClick={() => onSizeDelta(-0.5)} className={`${btn} text-[11px] font-bold`}>A<span className="text-[9px] -mt-1">−</span></button>
        <input
          type="number"
          min={7}
          max={30}
          step={0.5}
          value={size}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n) && n >= 7 && n <= 30) onPatch({ sizePt: n });
          }}
          aria-label="Cỡ chữ (pt)"
          className="h-8 w-12 rounded-md border border-slate-300 bg-white text-center text-[12px] font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
        <button type="button" title="Tăng cỡ chữ" aria-label="Tăng cỡ chữ" onClick={() => onSizeDelta(0.5)} className={`${btn} text-[13px] font-bold`}>A<span className="text-[9px] -mt-1">+</span></button>
      </Group>

      {/* B I U S */}
      <Group label="Kiểu chữ">
        <button type="button" title="In đậm" aria-label="In đậm" aria-pressed={bold} onClick={() => onFlag('bold')} className={`${btn} ${bold ? on : ''} text-[14px] font-extrabold`}>B</button>
        <button type="button" title="In nghiêng" aria-label="In nghiêng" aria-pressed={italic} onClick={() => onFlag('italic')} className={`${btn} ${italic ? on : ''} text-[14px] italic font-serif`}>I</button>
        <button type="button" title="Gạch chân" aria-label="Gạch chân" aria-pressed={!!style?.underline} onClick={() => onFlag('underline')} className={`${btn} ${style?.underline ? on : ''} text-[14px] underline`}>U</button>
        <button type="button" title="Gạch ngang" aria-label="Gạch ngang" aria-pressed={!!style?.strike} onClick={() => onFlag('strike')} className={`${btn} ${style?.strike ? on : ''} text-[14px] line-through`}>S</button>
      </Group>

      {/* Màu chữ: chữ A có vạch màu bên dưới + bảng màu */}
      <Group label="Màu chữ">
        <div className="relative" ref={colorRef}>
          <div className="flex items-center">
            <button type="button" title="Màu chữ" aria-label="Màu chữ" onClick={() => onPatch({ color: color === '#111111' ? undefined : color })} className={`${btn} !px-1 flex-col !gap-0 leading-none`}>
              <span className="text-[14px] font-extrabold">A</span>
              <span className="block w-4 h-[3px] rounded-sm" style={{ background: color }} />
            </button>
            <button type="button" title="Chọn màu" aria-label="Chọn màu" aria-expanded={colorOpen} onClick={() => setColorOpen((v) => !v)} className={`${btn} !px-0.5 -ml-1 w-4 min-w-4`}>
              <ChevronDown size={12} />
            </button>
          </div>
          {colorOpen && (
            <div className="absolute left-0 top-full mt-1.5 z-50 w-44 rounded-xl border border-slate-200 bg-white shadow-xl p-2.5 space-y-2">
              <div className="grid grid-cols-5 gap-1.5">
                {PALETTE.map(([c, name]) => (
                  <button
                    key={c}
                    type="button"
                    title={name}
                    aria-label={name}
                    onClick={() => { onPatch({ color: c === '#111111' ? undefined : c }); setColorOpen(false); }}
                    className={`w-6 h-6 rounded-md border ${color === c ? 'ring-2 ring-blue-500 ring-offset-1 border-white' : 'border-slate-300 hover:scale-110'} transition-transform`}
                    style={{ background: c }}
                  />
                ))}
              </div>
              <button type="button" onClick={() => { onPatch({ color: undefined }); setColorOpen(false); }} className="w-full text-[11px] text-slate-600 hover:text-slate-900 py-1 rounded-md hover:bg-slate-100">Tự động (mặc định)</button>
            </div>
          )}
        </div>
      </Group>

      {/* Căn lề */}
      <Group label="Căn lề">
        {([['left', AlignLeft, 'Căn trái'], ['center', AlignCenter, 'Căn giữa'], ['right', AlignRight, 'Căn phải']] as const).map(([id, Icon, label]) => (
          <button key={id} type="button" title={label} aria-label={label} aria-pressed={style?.align === id} onClick={() => onPatch({ align: style?.align === id ? undefined : id })} className={`${btn} ${style?.align === id ? on : ''}`}>
            <Icon size={16} />
          </button>
        ))}
      </Group>

      {/* Xóa định dạng */}
      <Group label="Xóa" last>
        <button type="button" title="Xóa định dạng của thành phần này" aria-label="Xóa định dạng" onClick={onClear} className={btn}><RemoveFormatting size={16} /></button>
      </Group>
    </div>
  );
};
