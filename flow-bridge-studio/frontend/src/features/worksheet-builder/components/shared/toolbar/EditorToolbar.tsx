// Thanh công cụ dùng chung cho mọi trình soạn bài (kiểu Word): chỉ cần khai báo các nhóm và nút bằng dữ liệu.
//
//   <EditorToolbar groups={[{ id: 'text', label: 'Text', items: [ ... ] }, ...]} dense locked={isPreview} />
//
// Mỗi dạng bài tự ghép nhóm của mình (xem ListeningToolbar.tsx, MatchingToolbar.tsx). Thanh lo phần chung:
// kích thước nút, tooltip, trạng thái bật/tắt, menu thả xuống (tự giữ trong màn hình), Layout picker,
// menu "More", khóa khi ở chế độ Preview.

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, Check, LayoutTemplate as LayoutIconFallback } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ToolbarIconButton, ToolbarDensityContext, useClampPopovers } from './ToolbarIconButton';

// ───────────── Kiểu cấu hình ─────────────

interface Disable { disabled?: boolean; disabledReason?: string }

export interface ToolbarButtonItem extends Disable {
  type: 'button';
  id: string;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
  /** Chữ nhỏ cạnh icon */
  text?: string;
}
export interface ToolbarFileItem extends Disable {
  type: 'file';
  id: string;
  icon: LucideIcon;
  label: string;
  accept?: string;
  multiple?: boolean;
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
}
export interface ToolbarColorItem extends Disable {
  type: 'color';
  id: string;
  icon: LucideIcon;
  label: string;
  value?: string;
  /** Màu của vạch dưới icon */
  indicator?: string;
  onColor: (value: string) => void;
}
export interface ToolbarSelectItem {
  type: 'select';
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  widthClass?: string;
}
export interface ToolbarTextItem { type: 'text'; id: string; text: string; title?: string }
export interface ToolbarDividerItem { type: 'divider' }

export interface ToolbarMenuApi { close: () => void }
export interface ToolbarMenuItem {
  type: 'menu';
  id: string;
  icon: LucideIcon;
  label: string;
  text?: string;
  /** Hiện mũi tên xuống cạnh nút (mặc định chỉ khi có `text`) */
  chevron?: boolean;
  render: (api: ToolbarMenuApi) => React.ReactNode;
  panelClass?: string;
  align?: 'left' | 'right';
}

export interface LayoutOption { id: string; label: string; desc?: string; thumb: React.ReactNode }
export interface ToolbarLayoutItem {
  type: 'layout';
  id: string;
  label?: string;
  value: string;
  options: LayoutOption[];
  onChange: (id: string) => void;
}

export interface OptionsSection {
  title?: string;
  value: unknown;
  options: { value: unknown; label: string }[];
  onChange: (value: unknown) => void;
}
/** Menu danh sách lựa chọn có dấu tích (giãn dòng, số cột...) */
export interface ToolbarOptionsItem {
  type: 'options';
  id: string;
  icon: LucideIcon;
  label: string;
  sections: OptionsSection[];
  /** Đóng menu sau khi chọn (mặc định: có) */
  closeOnSelect?: boolean;
  widthClass?: string;
}

export type MoreEntry =
  | { kind: 'title'; label: string }
  | { kind: 'divider' }
  | { kind: 'action'; icon: LucideIcon; label: string; onClick: () => void; disabled?: boolean; danger?: boolean; checked?: boolean }
  | { kind: 'panel'; id: string; icon: LucideIcon; label: string; render: () => React.ReactNode };

export interface ToolbarMoreItem {
  type: 'more';
  id: string;
  icon: LucideIcon;
  label?: string;
  entries: MoreEntry[];
}

export type ToolbarItem =
  | ToolbarButtonItem | ToolbarFileItem | ToolbarColorItem | ToolbarSelectItem | ToolbarTextItem
  | ToolbarDividerItem | ToolbarMenuItem | ToolbarLayoutItem | ToolbarOptionsItem | ToolbarMoreItem;

export interface ToolbarGroup {
  id: string;
  label: string;
  items: ToolbarItem[];
}

export interface EditorToolbarProps {
  groups: ToolbarGroup[];
  /** Nút nhỏ gọn (icon 16px / nút 32px). Mặc định: cỡ thường. */
  dense?: boolean;
  /** Chế độ chỉ xem: mờ đi và khóa toàn bộ */
  locked?: boolean;
  lockedHint?: string;
  className?: string;
}

// ───────────── Giao diện ─────────────

const popCls = 'absolute z-50 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg';
const menuItemCls =
  'w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-left';

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  groups,
  dense = false,
  locked = false,
  lockedHint = 'Đang ở chế độ Preview – chọn Edit Mode để chỉnh sửa',
  className = '',
}) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const [panelId, setPanelId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const closeAll = () => { setOpenId(null); setPanelId(null); };
  useClampPopovers(rootRef, [openId, panelId]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) closeAll(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeAll(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, []);

  useEffect(() => {
    if (rootRef.current) (rootRef.current as HTMLElement & { inert: boolean }).inert = locked;
    if (locked) closeAll();
  }, [locked]);

  const toggle = (id: string) => { setPanelId(null); setOpenId((cur) => (cur === id ? null : id)); };

  const selectCls = `${dense ? 'h-8 px-2' : 'h-9 px-2.5'} bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40`;

  const renderItem = (it: ToolbarItem, idx: number): React.ReactNode => {
    switch (it.type) {
      case 'divider':
        return <span key={`d${idx}`} className={`w-px ${dense ? 'h-4 mx-0.5' : 'h-5 mx-1'} bg-slate-200 shrink-0`} />;

      case 'text':
        return <span key={it.id} className="min-w-8 px-0.5 text-center text-xs font-semibold text-slate-700" title={it.title}>{it.text}</span>;

      case 'select':
        return (
          <select
            key={it.id}
            aria-label={it.label}
            title={it.label}
            value={it.value}
            onChange={(e) => it.onChange(e.target.value)}
            className={`${selectCls} ${it.widthClass || 'w-28'}`}
          >
            {it.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );

      case 'button':
        return (
          <ToolbarIconButton key={it.id} icon={it.icon} label={it.label} active={it.active} text={it.text}
            disabled={it.disabled} disabledReason={it.disabledReason} onClick={it.onClick} />
        );

      case 'file':
        return (
          <ToolbarIconButton key={it.id} kind="file" icon={it.icon} label={it.label} accept={it.accept} multiple={it.multiple}
            onFile={it.onFile} disabled={it.disabled} disabledReason={it.disabledReason} />
        );

      case 'color':
        return (
          <ToolbarIconButton key={it.id} kind="color" icon={it.icon} label={it.label} colorValue={it.value}
            indicator={it.indicator} onColor={it.onColor} disabled={it.disabled} disabledReason={it.disabledReason} />
        );

      case 'menu': {
        const open = openId === it.id;
        return (
          <div key={it.id} className="relative">
            <ToolbarIconButton icon={it.icon} label={it.label} text={it.text} expanded={open} active={open} onClick={() => toggle(it.id)}
              className={it.text ? '!flex-row !gap-1.5 px-2.5' : ''}>
              {(it.chevron ?? !!it.text) && <ChevronDown size={14} strokeWidth={1.75} />}
            </ToolbarIconButton>
            {open && (
              <div className={`${popCls} ${it.align === 'right' ? 'right-0' : 'left-0'} ${it.panelClass || 'w-56'} max-w-[92vw]`}>
                {it.render({ close: closeAll })}
              </div>
            )}
          </div>
        );
      }

      case 'layout': {
        const open = openId === it.id;
        return (
          <div key={it.id} className="relative">
            <ToolbarIconButton icon={LayoutIconFallback} text={it.label || 'Layout'} label="Layout – chọn bố cục worksheet" expanded={open} active={open}
              onClick={() => toggle(it.id)} className="!flex-row !gap-1.5 px-2.5">
              <ChevronDown size={14} strokeWidth={1.75} />
            </ToolbarIconButton>
            {open && (
              <div className={`${popCls} left-0 w-[420px] max-w-[92vw] p-2.5 grid grid-cols-3 gap-2`}>
                {it.options.map((o) => {
                  const on = it.value === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      title={o.desc}
                      onClick={() => { it.onChange(o.id); closeAll(); }}
                      className={`relative p-2 rounded-lg border text-left transition-colors ${on ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-500/20' : 'border-slate-200 hover:bg-slate-50 hover:border-slate-300'}`}
                    >
                      {on && (
                        <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center"><Check size={10} strokeWidth={3} /></span>
                      )}
                      <div className="mb-1.5">{o.thumb}</div>
                      <span className="text-[11px] font-semibold text-slate-800 leading-tight block">{o.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      }

      case 'options': {
        const open = openId === it.id;
        return (
          <div key={it.id} className="relative">
            <ToolbarIconButton icon={it.icon} label={it.label} expanded={open} active={open} onClick={() => toggle(it.id)} />
            {open && (
              <div className={`${popCls} left-0 ${it.widthClass || 'w-44'} py-1`}>
                {it.sections.map((s, si) => (
                  <div key={si}>
                    {si > 0 && <div className="my-1 h-px bg-slate-100" />}
                    {s.title && <div className="px-3 pt-1 pb-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">{s.title}</div>}
                    {s.options.map((o) => (
                      <button
                        key={String(o.value)}
                        type="button"
                        onClick={() => { s.onChange(o.value); if (it.closeOnSelect !== false) closeAll(); }}
                        className="w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-slate-50"
                      >
                        <span>{o.label}</span>
                        {s.value === o.value && <Check size={14} className="text-blue-600" />}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }

      case 'more': {
        const open = openId === it.id;
        const panel = open ? it.entries.find((e): e is Extract<MoreEntry, { kind: 'panel' }> => e.kind === 'panel' && e.id === panelId) : undefined;
        return (
          <div key={it.id} className="relative">
            <ToolbarIconButton icon={it.icon} label={it.label || 'More options – công cụ và cài đặt khác'} expanded={open} active={open} onClick={() => toggle(it.id)} />
            {open && (
              <div className={`${popCls} right-0 ${panel ? 'w-96' : 'w-64'} max-w-[92vw] max-h-[75vh] overflow-y-auto`}>
                {panel ? (
                  <div className="p-3 space-y-2">
                    <button type="button" onClick={() => setPanelId(null)} className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800">
                      <ChevronLeft size={14} /> {panel.label}
                    </button>
                    {panel.render()}
                  </div>
                ) : (
                  <div className="py-1">
                    {it.entries.map((en, i) => {
                      if (en.kind === 'divider') return <div key={i} className="my-1 h-px bg-slate-100" />;
                      if (en.kind === 'title') return <div key={i} className="px-3 pt-1.5 pb-1 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">{en.label}</div>;
                      const Icon = en.icon;
                      if (en.kind === 'panel') {
                        return <button key={en.id} type="button" className={menuItemCls} onClick={() => setPanelId(en.id)}><Icon size={16} strokeWidth={1.75} /> {en.label}</button>;
                      }
                      return (
                        <button
                          key={i}
                          type="button"
                          disabled={en.disabled}
                          className={`${menuItemCls} ${en.danger ? '!text-rose-600' : ''}`}
                          onClick={() => { en.onClick(); closeAll(); }}
                        >
                          <Icon size={16} strokeWidth={1.75} /> {en.label}
                          {en.checked && <Check size={14} className="ml-auto text-blue-600" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      }
    }
  };

  return (
    <div
      ref={rootRef}
      className={`bg-white border-b border-slate-200 ${dense ? 'px-4 py-1.5 gap-x-2.5 gap-y-1.5' : 'px-4 py-2 gap-x-3 gap-y-2'} flex flex-wrap items-start sticky top-0 z-30 shrink-0 transition-opacity ${locked ? 'opacity-50 select-none' : ''} ${className}`}
      aria-disabled={locked || undefined}
      title={locked ? lockedHint : undefined}
    >
      <ToolbarDensityContext.Provider value={dense}>
        {groups.map((g) => (
          <div key={g.id} className="flex flex-col items-center">
            <div className={`flex items-center ${dense ? 'gap-0.5 px-1.5 py-0.5' : 'gap-1 px-2 py-1'} border border-slate-200/80 rounded-lg bg-white`}>
              {g.items.map(renderItem)}
            </div>
            <span className="text-[10.5px] text-slate-400 mt-1 leading-none">{g.label}</span>
          </div>
        ))}
      </ToolbarDensityContext.Provider>
    </div>
  );
};
