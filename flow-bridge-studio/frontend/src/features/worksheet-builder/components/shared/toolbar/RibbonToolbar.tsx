// Thanh công cụ hai hàng kiểu Casual Docs dùng chung cho các dạng bài (cùng giao diện với Listening Fill in the Gap).
//
// Nhận đúng cấu trúc `groups` mà mỗi dạng bài đã khai báo cho EditorToolbar (nhóm text / paragraph / exercise / insert / layout / more),
// nên mọi nút vẫn gọi handler thật của từng dạng bài – không có nút giả:
//  - Hàng 2: Undo/Redo + Zoom (nếu editor cung cấp `shell`), rồi các nút Text, Paragraph, Insert, Layout, Exercise Tools của dạng bài;
//    nút đầu tiên của Exercise Tools là nút xanh nổi bật ở góc phải hàng menu (giống Insert Blank).
//  - Hàng 1: File / Edit / Format / View / Insert / Tools được dựng từ chính các nút đó cộng với `shell`
//    (lưu, xuất Word, in, quay lại, zoom, chế độ xem). Menu không có mục nào thì không hiện.

import React, { useEffect, useRef, useState } from 'react';
import {
  Undo2, Redo2, Save, FilePlus2, FileDown, Printer, ArrowLeft, ZoomIn, ZoomOut, Maximize2, Eye, Pencil, LayoutTemplate, SlidersHorizontal, X,
} from 'lucide-react';
import type { MoreEntry, ToolbarGroup, ToolbarItem } from './EditorToolbar';
import {
  RibbonRoot, Popover, TbButton, TbFileButton, TbSep, DropdownTrigger, MenuTrigger, MenuList, ColorPalette, type RibbonEntry,
} from './ribbonKit';

export interface RibbonShell {
  onSave?: () => void;
  /** Lưu rồi quay lại / chọn dạng bài mới */
  onSaveAndReturn?: () => void;
  /** Lưu rồi mở bài mới cùng thư mục */
  onSaveAndAdd?: () => void;
  onExportDocx?: () => void;
  onPrint?: () => void;
  onBack?: () => void;
  zoom?: number;
  onZoom?: (value: number) => void;
  onFitPage?: () => void;
  previewMode?: boolean;
  onPreviewMode?: (preview: boolean) => void;
  undo?: { onUndo: () => void; onRedo: () => void; canUndo: boolean; canRedo: boolean };
}

const ZOOMS = [50, 75, 80, 90, 100, 110, 120, 125, 150];
const short = (label: string) => label.split(' – ')[0];

/** Bỏ dấu phân cách thừa (đầu, cuối, liên tiếp) */
const tidy = (entries: RibbonEntry[]): RibbonEntry[] => {
  const out: RibbonEntry[] = [];
  for (const e of entries) {
    if (e.kind === 'sep' && (!out.length || out[out.length - 1].kind === 'sep')) continue;
    out.push(e);
  }
  while (out.length && out[out.length - 1].kind === 'sep') out.pop();
  return out;
};

export const RibbonToolbar: React.FC<{ groups: ToolbarGroup[]; locked?: boolean; shell?: RibbonShell }> = ({ groups, locked = false, shell = {} }) => {
  const g = (id: string) => groups.find((x) => x.id === id);
  const textG = g('text');
  const paraG = g('paragraph');
  const exG = g('exercise');
  const insG = g('insert');
  const layG = g('layout');
  const moreG = g('more');

  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [panel, setPanel] = useState<{ label: string; render: () => React.ReactNode } | null>(null);
  useEffect(() => { if (locked) setPanel(null); }, [locked]);

  const item = (label: string, onClick: () => void, extra: Partial<Extract<RibbonEntry, { kind: 'item' }>> = {}): RibbonEntry => ({ kind: 'item', label, onClick, ...extra });
  const sep: RibbonEntry = { kind: 'sep' };

  // Mục của nhóm → mục trong menu
  const toEntries = (items: ToolbarItem[]): RibbonEntry[] => items.flatMap((it): RibbonEntry[] => {
    switch (it.type) {
      case 'button': return [item(short(it.label), it.onClick, { icon: it.icon, disabled: it.disabled, checked: it.active })];
      case 'file': return [item(`${short(it.label)}…`, () => fileRefs.current[it.id]?.click(), { icon: it.icon, disabled: it.disabled })];
      case 'select': return [{ kind: 'title', label: it.label }, ...it.options.map((o) => item(o.label, () => it.onChange(o.value), { checked: o.value === it.value }))];
      case 'options': return it.sections.flatMap((s): RibbonEntry[] => [
        { kind: 'title', label: s.title || short(it.label) },
        ...s.options.map((o) => item(o.label, () => s.onChange(o.value), { checked: s.value === o.value })),
      ]);
      case 'divider': return [sep];
      default: return [];
    }
  });

  const moreEntries = (moreG?.items ?? []).flatMap((it): RibbonEntry[] => it.type !== 'more' ? [] : it.entries.map((en: MoreEntry): RibbonEntry => {
    if (en.kind === 'title') return { kind: 'title', label: en.label };
    if (en.kind === 'divider') return sep;
    if (en.kind === 'panel') return item(en.label, () => setPanel({ label: en.label, render: en.render }), { icon: en.icon });
    return item(en.label, en.onClick, { icon: en.icon, disabled: en.disabled, checked: en.checked });
  }));

  const clearEntries = [...(textG?.items ?? []), ...(paraG?.items ?? [])].filter((it) => it.type === 'button' && /clear|xóa định dạng/i.test(it.label));
  const fileMenu = tidy([
    ...(shell.onSave ? [item('Lưu', shell.onSave, { icon: Save })] : []),
    ...(shell.onSaveAndAdd ? [item('Lưu và thêm bài tập khác', shell.onSaveAndAdd, { icon: FilePlus2 })] : []),
    ...(shell.onSaveAndReturn ? [item('Lưu và quay lại thư mục', shell.onSaveAndReturn, { icon: Save })] : []),
    ...((shell.onSave || shell.onSaveAndReturn || shell.onSaveAndAdd) && (shell.onExportDocx || shell.onPrint) ? [sep] : []),
    ...(shell.onExportDocx ? [item('Xuất Word (.docx)', shell.onExportDocx, { icon: FileDown })] : []),
    ...(shell.onPrint ? [item('In / Lưu PDF', shell.onPrint, { icon: Printer })] : []),
    ...(shell.onBack ? [sep, item('Quay lại bài học', shell.onBack, { icon: ArrowLeft })] : []),
  ]);
  const editMenu = tidy([
    ...(shell.undo ? [
      item('Hoàn tác', shell.undo.onUndo, { icon: Undo2, shortcut: 'Ctrl+Z', disabled: !shell.undo.canUndo }),
      item('Làm lại', shell.undo.onRedo, { icon: Redo2, shortcut: 'Ctrl+Y', disabled: !shell.undo.canRedo }),
    ] : []),
    ...(shell.undo && clearEntries.length ? [sep] : []),
    ...toEntries(clearEntries),
  ]);
  const formatMenu = tidy(toEntries([...(textG?.items ?? []), ...(paraG?.items ?? [])].filter((it) => !clearEntries.includes(it))));
  const viewMenu = tidy([
    ...(shell.onZoom && shell.zoom !== undefined ? [
      item('Phóng to', () => shell.onZoom!(Math.min(150, shell.zoom! + 10)), { icon: ZoomIn, disabled: shell.zoom >= 150, keepOpen: true }),
      item('Thu nhỏ', () => shell.onZoom!(Math.max(50, shell.zoom! - 10)), { icon: ZoomOut, disabled: shell.zoom <= 50, keepOpen: true }),
      item('Về 100%', () => shell.onZoom!(100), { disabled: shell.zoom === 100 }),
    ] : []),
    ...(shell.onFitPage ? [item('Phóng to trang đang soạn', shell.onFitPage, { icon: Maximize2 })] : []),
    ...(shell.onPreviewMode ? [sep, item('Chế độ soạn', () => shell.onPreviewMode!(false), { icon: Pencil, checked: !shell.previewMode }), item('Xem trước', () => shell.onPreviewMode!(true), { icon: Eye, checked: !!shell.previewMode })] : []),
  ]);
  const insertMenu = tidy(toEntries(insG?.items ?? []));
  const toolsMenu = tidy([...toEntries(exG?.items ?? []), ...(moreEntries.length && (exG?.items.length ?? 0) ? [sep] : []), ...moreEntries]);
  const menus: [string, RibbonEntry[]][] = ([['File', fileMenu], ['Edit', editMenu], ['Format', formatMenu], ['View', viewMenu], ['Insert', insertMenu], ['Tools', toolsMenu]] as [string, RibbonEntry[]][]).filter(([, e]) => e.length > 0);

  // ── Hàng 2 ──
  const primary = exG?.items.find((it) => it.type === 'button');
  const renderItem = (it: ToolbarItem, key: string): React.ReactNode => {
    switch (it.type) {
      case 'divider': return <TbSep key={key} />;
      case 'text': return <span key={key} className="min-w-8 px-0.5 text-center text-xs font-semibold text-slate-700" title={it.title}>{it.text}</span>;
      case 'button': return <TbButton key={key} icon={it.icon} label={it.label} active={it.active} disabled={it.disabled} disabledReason={it.disabledReason} text={it.text} onClick={it.onClick} />;
      case 'file': return <TbFileButton key={key} icon={it.icon} label={it.label} accept={it.accept} multiple={it.multiple} onFile={it.onFile} disabled={it.disabled} disabledReason={it.disabledReason} />;
      case 'select': {
        const cur = it.options.find((o) => o.value === it.value);
        return (
          <Popover key={key} id={`sel-${it.id}`} trigger={(p) => <DropdownTrigger {...p} label={it.label} width={it.widthClass || 'w-28'}>{cur?.label ?? it.value}</DropdownTrigger>}>
            {(close) => <MenuList minWidth="min-w-[8rem]" close={close} entries={it.options.map((o) => item(o.label, () => it.onChange(o.value), { checked: o.value === it.value }))} />}
          </Popover>
        );
      }
      case 'color': {
        const Icon = it.icon;
        return (
          <Popover key={key} id={`col-${it.id}`} trigger={(p) => (
            <DropdownTrigger {...p} label={it.label} tip={it.label} disabled={it.disabled} width="!px-1">
              <span className="flex flex-col items-center"><Icon size={16} strokeWidth={1.9} /><span className="-mt-0.5 h-[3px] w-4 rounded-sm" style={{ background: it.indicator || '#111827' }} /></span>
            </DropdownTrigger>
          )}>
            {(close) => <ColorPalette value={it.value} close={close} highlight={/highlight|tô nền/i.test(it.label)} onPick={(c) => { if (c) it.onColor(c); }} />}
          </Popover>
        );
      }
      case 'menu': {
        const Icon = it.icon;
        return (
          <Popover key={key} id={`menu-item-${it.id}`} trigger={(p) => <DropdownTrigger {...p} label={it.label} tip={it.label}><Icon size={16} strokeWidth={1.9} />{it.text}</DropdownTrigger>}>
            {(close) => <div className={`${it.panelClass || 'w-56'} max-w-[92vw]`}>{it.render({ close })}</div>}
          </Popover>
        );
      }
      case 'options': {
        const Icon = it.icon;
        return (
          <Popover key={key} id={`opt-${it.id}`} trigger={(p) => <DropdownTrigger {...p} label={it.label} tip={it.label} width="!px-1.5"><Icon size={16} strokeWidth={1.9} /></DropdownTrigger>}>
            {(close) => <MenuList minWidth="min-w-[8rem]" close={close} entries={toEntries([it])} />}
          </Popover>
        );
      }
      case 'layout':
        return (
          <Popover key={key} id={`layout-${it.id}`} trigger={(p) => <DropdownTrigger {...p} label="Layout – chọn bố cục worksheet" tip="Layout – chọn bố cục worksheet"><LayoutTemplate size={15} strokeWidth={1.9} />{it.label || 'Layout'}</DropdownTrigger>}>
            {(close) => (
              <div className="grid w-[26rem] max-w-[92vw] grid-cols-3 gap-2 p-2">
                {it.options.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    title={o.desc}
                    onClick={() => { it.onChange(o.id); close(); }}
                    className={`rounded-lg border p-1.5 text-left transition-colors ${it.value === o.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}
                  >
                    <div className="mb-1">{o.thumb}</div>
                    <div className="text-[11px] font-semibold leading-tight text-slate-800">{o.label}</div>
                  </button>
                ))}
              </div>
            )}
          </Popover>
        );
      case 'more': return null; // nằm trong menu Tools
    }
  };
  const renderGroup = (grp: ToolbarGroup | undefined, skip?: ToolbarItem) =>
    grp ? grp.items.filter((it) => it !== skip).map((it, i) => renderItem(it, `${grp.id}-${'id' in it ? it.id : i}-${i}`)) : [];
  const hasAny = (arr: React.ReactNode[]) => arr.some(Boolean);
  const textNodes = renderGroup(textG);
  const paraNodes = renderGroup(paraG);
  const insNodes = renderGroup(insG);
  const layNodes = renderGroup(layG);
  // Nút phụ của Exercise Tools nằm trong menu Tools (nút đầu tiên là nút xanh bên phải) để thanh luôn gọn hai hàng
  const clusters = [textNodes, paraNodes, insNodes, layNodes].filter(hasAny);

  // Mọi file ẩn cho menu Insert/Tools
  const fileItems = [...(insG?.items ?? []), ...(exG?.items ?? [])].filter((it): it is Extract<ToolbarItem, { type: 'file' }> => it.type === 'file');

  return (
    <RibbonRoot locked={locked} lockedHint="Đang ở chế độ Preview – chuyển sang Edit Mode để chỉnh sửa">
      <div className="flex items-center gap-0.5 px-3 pt-1">
        {menus.map(([name, entries]) => (
          <Popover key={name} id={`menu-${name}`} hoverSwitch trigger={(p) => <MenuTrigger {...p} label={name} />}>
            {(close) => <MenuList entries={entries} close={close} />}
          </Popover>
        ))}
        {primary && primary.type === 'button' && (
          <div className="ml-auto flex items-center pl-2">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={primary.onClick}
              disabled={primary.disabled}
              title={primary.disabled && primary.disabledReason ? primary.disabledReason : primary.label}
              className="inline-flex h-7 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-[13px] font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <primary.icon size={15} strokeWidth={2} /> {short(primary.label)}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-0.5 gap-y-0.5 px-3 pb-1.5 pt-0.5">
        {shell.undo && (
          <>
            <TbButton icon={Undo2} label="Hoàn tác" shortcut="Ctrl+Z" disabled={!shell.undo.canUndo} onClick={shell.undo.onUndo} />
            <TbButton icon={Redo2} label="Làm lại" shortcut="Ctrl+Y" disabled={!shell.undo.canRedo} onClick={shell.undo.onRedo} />
            <TbSep />
          </>
        )}
        {shell.onZoom && shell.zoom !== undefined && (
          <>
            <Popover id="zoom" trigger={(p) => <DropdownTrigger {...p} label="Zoom bản xem trước A4" width="w-[4.5rem]">{shell.zoom}%</DropdownTrigger>}>
              {(close) => <MenuList minWidth="min-w-[7rem]" close={close} entries={ZOOMS.map((z) => item(`${z}%`, () => shell.onZoom!(z), { checked: shell.zoom === z }))} />}
            </Popover>
            <TbSep />
          </>
        )}
        {clusters.map((nodes, i) => (
          <React.Fragment key={i}>
            {i > 0 && <TbSep />}
            {nodes}
          </React.Fragment>
        ))}

      </div>

      {fileItems.map((it) => (
        <input key={it.id} ref={(el) => { fileRefs.current[it.id] = el; }} type="file" hidden accept={it.accept} multiple={it.multiple} onChange={it.onFile} />
      ))}

      {panel && (
        <div className="absolute right-4 top-full z-40 mt-1 max-h-[70vh] w-[24rem] max-w-[92vw] overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900"><SlidersHorizontal size={14} /> {panel.label}</h3>
            <button type="button" onClick={() => setPanel(null)} aria-label="Đóng" className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={15} /></button>
          </div>
          {panel.render()}
        </div>
      )}
    </RibbonRoot>
  );
};
