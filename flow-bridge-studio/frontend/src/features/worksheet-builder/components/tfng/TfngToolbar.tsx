import React from 'react';
import {
  Bold, Italic, Underline, Strikethrough, Baseline, AlignLeft, AlignCenter, AlignRight,
  ListFilter, RemoveFormatting, Plus, ClipboardPaste, Sparkles, FilePlus2, Image as ImageIcon, ImagePlus,
  ListOrdered, FilePlus, Ellipsis, SlidersHorizontal, Copy, Trash2, ALargeSmall,
} from 'lucide-react';
import type { TextStyle } from '../../services/matching-pictures/matchingPicturesCore';
import type { TfngData, TfngStyleKey } from '../../services/tfng/tfngCore';
import { TFNG_LAYOUTS, TFNG_STYLE_LABELS } from '../../services/tfng/tfngCore';
import { type ToolbarGroup } from '../shared/toolbar/EditorToolbar';
import { RibbonToolbar, type RibbonShell } from '../shared/toolbar/RibbonToolbar';

const Dots = ({ kind }: { kind: 'round' | 'box' | 'line' | 'text' }) => (
  <span className="flex gap-0.5 items-center">
    {[0, 1, 2].map((i) =>
      kind === 'round' ? <i key={i} className="w-1.5 h-1.5 rounded-full border border-slate-600" />
        : kind === 'box' ? <i key={i} className="w-1.5 h-1.5 border border-slate-600" />
          : kind === 'line' ? <i key={i} className="w-2 h-1.5 border-b border-slate-600" />
            : <i key={i} className="w-1 h-0.5 bg-slate-700" />)}
  </span>
);

/** Hình thu nhỏ của từng layout True / False / Not Given trong menu chọn layout */
const TfngLayoutThumb: React.FC<{ id: string }> = ({ id }) => {
  const head = (
    <div className="flex gap-1"><div className="flex-1 space-y-0.5"><span className="block h-0.5 bg-slate-500 rounded" /><span className="block h-0.5 bg-slate-400 rounded w-2/3" /></div><span className="w-4 h-4 bg-blue-300 rounded-xs" /></div>
  );
  const frame = 'w-full h-14 p-1.5 bg-slate-50 border border-slate-300 rounded flex flex-col gap-1';
  if (id === 'two_columns') {
    return (
      <div className={frame}>
        {head}
        <div className="flex gap-1.5 flex-1">
          {[0, 1].map((c) => <div key={c} className="flex-1 space-y-1">{[0, 1].map((i) => <div key={i}><span className="block h-0.5 bg-slate-400 rounded" /><Dots kind="text" /></div>)}</div>)}
        </div>
      </div>
    );
  }
  if (id === 'answer_grid') {
    return (
      <div className={frame}>
        {head}
        <div className="border border-slate-400 flex-1 grid grid-rows-3 divide-y divide-slate-300">
          {[0, 1, 2].map((i) => <div key={i} className="flex items-center gap-1 px-0.5"><span className="h-0.5 flex-1 bg-slate-400 rounded" /><Dots kind="box" /></div>)}
        </div>
      </div>
    );
  }
  const kind = id === 'checkbox' ? 'box' : id === 'circle' ? 'round' : id === 'underline' ? 'line' : 'text';
  return (
    <div className={frame}>
      {head}
      {[0, 1, 2].map((i) => <div key={i} className="flex items-center gap-1"><span className="h-0.5 flex-1 bg-slate-400 rounded" /><Dots kind={kind} /></div>)}
    </div>
  );
};

export type TfngMoreKey = 'typography' | 'advanced';
const MORE_SETTINGS: { key: TfngMoreKey; label: string }[] = [
  { key: 'typography', label: 'Typography Defaults' },
  { key: 'advanced', label: 'Advanced Worksheet Settings' },
];

const FONTS = ['Arial', 'Times New Roman', 'Quicksand', 'Roboto', 'Inter'];
const LINE_HEIGHTS = [1.2, 1.3, 1.4, 1.5, 1.6, 1.75, 2];
const ROW_GAPS = [3, 4, 4.5, 5, 6, 8];

interface Props {
  data: TfngData;
  selKey: TfngStyleKey;
  onSelKey: (k: TfngStyleKey) => void;
  curStyle?: TextStyle;
  defaults: { bold: boolean; italic: boolean; size: number };
  onFlag: (flag: 'bold' | 'italic' | 'underline' | 'strike') => void;
  onSizeDelta: (delta: number) => void;
  onPatchStyle: (patch: Partial<TextStyle>) => void;
  onClearStyle: () => void;
  onSettings: (patch: Partial<TfngData['settings']>) => void;
  onAddStatement: () => void;
  onSmartAI: () => void;
  onSmartPaste: () => void;
  onInsertExercise: () => void;
  onImageFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGenerateImage: () => void;
  generating: boolean;
  onDuplicate: () => void;
  onDelete?: () => void;
  renderMoreSection: (key: TfngMoreKey) => React.ReactNode;
  /** Lưu / xuất Word / in / zoom / undo của editor, dùng cho các menu File, Edit, View của thanh công cụ */
  shell?: RibbonShell;
  locked?: boolean;
}

/** Thanh công cụ True / False / Not Given: cùng bộ nhóm với các bài khác, khai báo bằng EditorToolbar dùng chung. */
export const TfngToolbar: React.FC<Props> = ({
  data, selKey, onSelKey, curStyle, defaults, onFlag, onSizeDelta, onPatchStyle, onClearStyle, onSettings,
  onAddStatement, onSmartAI, onSmartPaste, onInsertExercise, onImageFile, onGenerateImage, generating,
  onDuplicate, onDelete, renderMoreSection, locked = false, shell,
}) => {
  const { settings } = data;
  const bold = curStyle?.bold ?? defaults.bold;
  const italic = curStyle?.italic ?? defaults.italic;
  const size = curStyle?.sizePt ?? defaults.size;
  const color = curStyle?.color ?? '#111111';
  const hasStyle = !!curStyle && Object.keys(curStyle).length > 0;
  const el = TFNG_STYLE_LABELS[selKey];
  const toggleAlign = (a: 'left' | 'center' | 'right') => onPatchStyle({ align: curStyle?.align === a ? undefined : a });

  const groups: ToolbarGroup[] = [
    {
      id: 'text', label: 'Text',
      items: [
        { type: 'select', id: 'el', label: 'Chọn thành phần cần định dạng', value: selKey, options: (Object.keys(TFNG_STYLE_LABELS) as TfngStyleKey[]).map((k) => ({ value: k, label: TFNG_STYLE_LABELS[k] })), onChange: (v) => onSelKey(v as TfngStyleKey), widthClass: 'w-40' },
        { type: 'select', id: 'font', label: 'Phông chữ cả bài', value: settings.fontFamily, options: FONTS.map((f) => ({ value: f, label: f })), onChange: (v) => onSettings({ fontFamily: v }), widthClass: 'w-28' },
        { type: 'button', id: 'smaller', icon: ALargeSmall, text: '−', label: `Giảm cỡ chữ – ${el}`, onClick: () => onSizeDelta(-0.5) },
        { type: 'text', id: 'size', text: String(size), title: `Cỡ chữ hiện tại của ${el}` },
        { type: 'button', id: 'bigger', icon: ALargeSmall, text: '+', label: `Tăng cỡ chữ – ${el}`, onClick: () => onSizeDelta(0.5) },
        { type: 'divider' },
        { type: 'button', id: 'bold', icon: Bold, label: `Bold – in đậm ${el}`, active: bold, onClick: () => onFlag('bold') },
        { type: 'button', id: 'italic', icon: Italic, label: `Italic – in nghiêng ${el}`, active: italic, onClick: () => onFlag('italic') },
        { type: 'button', id: 'underline', icon: Underline, label: `Underline – gạch chân ${el}`, active: !!curStyle?.underline, onClick: () => onFlag('underline') },
        { type: 'button', id: 'strike', icon: Strikethrough, label: `Strikethrough – gạch ngang ${el}`, active: !!curStyle?.strike, onClick: () => onFlag('strike') },
        { type: 'color', id: 'color', icon: Baseline, label: `Text color – màu chữ ${el}`, value: color, indicator: color, onColor: (v) => onPatchStyle({ color: v === '#111111' ? undefined : v }) },
      ],
    },
    {
      id: 'paragraph', label: 'Paragraph',
      items: [
        { type: 'button', id: 'al', icon: AlignLeft, label: `Align left – căn trái ${el}`, active: curStyle?.align === 'left', onClick: () => toggleAlign('left') },
        { type: 'button', id: 'ac', icon: AlignCenter, label: `Align center – căn giữa ${el}`, active: curStyle?.align === 'center', onClick: () => toggleAlign('center') },
        { type: 'button', id: 'ar', icon: AlignRight, label: `Align right – căn phải ${el}`, active: curStyle?.align === 'right', onClick: () => toggleAlign('right') },
        { type: 'divider' },
        {
          type: 'options', id: 'spacing', icon: ListFilter, label: 'Line spacing – giãn dòng cả bài', closeOnSelect: false, widthClass: 'w-48',
          sections: [
            { title: 'Giãn dòng', value: settings.lineHeight, options: LINE_HEIGHTS.map((h) => ({ value: h, label: String(h) })), onChange: (v) => onSettings({ lineHeight: v as number }) },
            { title: 'Khoảng cách giữa các câu (mm)', value: settings.rowGapMm, options: ROW_GAPS.map((g) => ({ value: g, label: `${g} mm` })), onChange: (v) => onSettings({ rowGapMm: v as number }) },
          ],
        },
        { type: 'button', id: 'clear', icon: RemoveFormatting, label: `Clear formatting – xóa định dạng ${el}`, disabled: !hasStyle, disabledReason: `${el} chưa có định dạng riêng`, onClick: onClearStyle },
      ],
    },
    {
      id: 'exercise', label: 'Exercise Tools',
      items: [
        { type: 'button', id: 'add', icon: Plus, label: 'Add statement – thêm một câu', onClick: onAddStatement },
        { type: 'button', id: 'ai', icon: Sparkles, label: 'Smart AI – dán văn bản, tự tách tiêu đề và các câu, nhờ AI gợi ý ảnh', onClick: onSmartAI },
        { type: 'button', id: 'paste', icon: ClipboardPaste, label: 'Smart Paste – dán văn bản có đánh số 1., 2.', onClick: onSmartPaste },
        { type: 'button', id: 'exercise', icon: FilePlus2, label: 'Insert exercise – lưu bài này và chọn dạng bài mới trong thư mục', onClick: onInsertExercise },
      ],
    },
    {
      id: 'insert', label: 'Insert',
      items: [
        { type: 'file', id: 'image', icon: ImageIcon, label: 'Insert image – tải ảnh minh họa từ máy', accept: 'image/*', onFile: onImageFile },
        { type: 'button', id: 'genimg', icon: ImagePlus, label: 'AI image – tạo ảnh minh họa bằng extension từ nội dung bài', disabled: generating, disabledReason: 'Đang tạo ảnh…', onClick: onGenerateImage },
        { type: 'button', id: 'numbering', icon: ListOrdered, label: settings.showNumbering ? 'Numbering – đang hiện số câu, bấm để ẩn' : 'Numbering – hiện số thứ tự câu', active: settings.showNumbering, onClick: () => onSettings({ showNumbering: !settings.showNumbering }) },
        { type: 'button', id: 'mascot', icon: ImageIcon, label: settings.showImage ? 'Mascot – đang hiện ảnh cạnh tiêu đề, bấm để ẩn' : 'Mascot – hiện ảnh cạnh tiêu đề', active: settings.showImage, onClick: () => onSettings({ showImage: !settings.showImage }) },
      ],
    },
    {
      id: 'layout', label: 'Page & Layout',
      items: [
        {
          type: 'layout', id: 'layout', value: settings.layout, onChange: (id) => onSettings({ layout: id as TfngData['settings']['layout'] }),
          options: TFNG_LAYOUTS.map((l) => ({
            id: l.id, label: l.label, desc: l.desc,
            thumb: <TfngLayoutThumb id={l.id} />,
          })),
        },
        { type: 'button', id: 'pagebreak', icon: FilePlus, label: settings.pageBreakBefore ? 'Page break – bài này đang bắt đầu ở trang mới, bấm để bỏ' : 'Page break – bắt đầu bài này ở một trang mới', active: settings.pageBreakBefore, onClick: () => onSettings({ pageBreakBefore: !settings.pageBreakBefore }) },
      ],
    },
    {
      id: 'more', label: 'More',
      items: [
        {
          type: 'more', id: 'more', icon: Ellipsis, label: 'More options – cài đặt khác',
          entries: [
            { kind: 'title', label: 'Cài đặt worksheet' },
            ...MORE_SETTINGS.map((s) => ({ kind: 'panel' as const, id: s.key, icon: SlidersHorizontal, label: s.label, render: () => renderMoreSection(s.key) })),
            { kind: 'divider' },
            { kind: 'action', icon: Copy, label: 'Duplicate – lưu và nhân bản bài', onClick: onDuplicate },
            ...(onDelete ? [{ kind: 'action' as const, icon: Trash2, label: 'Xóa bài tập này', danger: true, onClick: onDelete }] : []),
          ],
        },
      ],
    },
  ];

  return <RibbonToolbar groups={groups} locked={locked} shell={shell} />;
};
