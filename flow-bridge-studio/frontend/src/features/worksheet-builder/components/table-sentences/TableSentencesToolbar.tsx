import React from 'react';
import {
  Bold, Italic, Underline, Strikethrough, Baseline, AlignLeft, AlignCenter, AlignRight,
  ListFilter, RemoveFormatting, Plus, FilePlus2, FilePlus, Ellipsis, SlidersHorizontal, Copy, Trash2, ALargeSmall,
  Rows3, Columns3, Image as ImageIcon,
} from 'lucide-react';
import type { TextStyle } from '../../services/matching-pictures/matchingPicturesCore';
import type { TableSentencesData, TsStyleKey } from '../../services/table-sentences/tableSentencesCore';
import { TABLE_SENTENCES_LAYOUTS, TS_STYLE_LABELS } from '../../services/table-sentences/tableSentencesCore';
import { type ToolbarGroup } from '../shared/toolbar/EditorToolbar';
import { RibbonToolbar, type RibbonShell } from '../shared/toolbar/RibbonToolbar';

export type TsMoreKey = 'typography' | 'advanced';
const MORE_SETTINGS: { key: TsMoreKey; label: string }[] = [
  { key: 'typography', label: 'Typography Defaults' },
  { key: 'advanced', label: 'Advanced Worksheet Settings' },
];

const FONTS = ['Arial', 'Times New Roman', 'Quicksand', 'Roboto', 'Inter'];
const LINE_HEIGHTS = [1.3, 1.4, 1.5, 1.6, 1.75, 2];
const LINE_GAPS = [6, 7, 8, 9, 10, 12];

const Thumb: React.FC = () => (
  <div className="w-full h-14 p-1.5 bg-slate-50 border border-slate-300 rounded flex gap-1.5">
    <div className="w-3/5 grid grid-cols-3 gap-px">
      {Array.from({ length: 9 }, (_, i) => <span key={i} className="border border-orange-400 rounded-[1px]" />)}
    </div>
    <div className="flex-1 flex flex-col justify-between py-0.5">
      {[0, 1, 2, 3].map((i) => <span key={i} className="block h-0.5 bg-slate-400 rounded" />)}
    </div>
  </div>
);

interface Props {
  data: TableSentencesData;
  selKey: TsStyleKey;
  onSelKey: (k: TsStyleKey) => void;
  curStyle?: TextStyle;
  defaults: { bold: boolean; italic: boolean; size: number };
  onFlag: (flag: 'bold' | 'italic' | 'underline' | 'strike') => void;
  onSizeDelta: (delta: number) => void;
  onPatchStyle: (patch: Partial<TextStyle>) => void;
  onClearStyle: () => void;
  onSettings: (patch: Partial<TableSentencesData['settings']>) => void;
  onAddRow: () => void;
  onAddColumn: () => void;
  onImagesFiles: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onInsertExercise: () => void;
  onDuplicate: () => void;
  onDelete?: () => void;
  renderMoreSection: (key: TsMoreKey) => React.ReactNode;
  shell?: RibbonShell;
  locked?: boolean;
}

/** Thanh công cụ Table → Write Sentences: cùng bộ nhóm với các dạng bài khác. */
export const TableSentencesToolbar: React.FC<Props> = ({
  data, selKey, onSelKey, curStyle, defaults, onFlag, onSizeDelta, onPatchStyle, onClearStyle, onSettings,
  onAddRow, onAddColumn, onImagesFiles, onInsertExercise, onDuplicate, onDelete, renderMoreSection, locked = false, shell,
}) => {
  const { settings } = data;
  const bold = curStyle?.bold ?? defaults.bold;
  const italic = curStyle?.italic ?? defaults.italic;
  const size = curStyle?.sizePt ?? defaults.size;
  const color = curStyle?.color ?? '#111111';
  const hasStyle = !!curStyle && Object.keys(curStyle).length > 0;
  const el = TS_STYLE_LABELS[selKey];
  const toggleAlign = (a: 'left' | 'center' | 'right') => onPatchStyle({ align: curStyle?.align === a ? undefined : a });

  const groups: ToolbarGroup[] = [
    {
      id: 'text', label: 'Text',
      items: [
        { type: 'select', id: 'el', label: 'Chọn thành phần cần định dạng', value: selKey, options: (Object.keys(TS_STYLE_LABELS) as TsStyleKey[]).map((k) => ({ value: k, label: TS_STYLE_LABELS[k] })), onChange: (v) => onSelKey(v as TsStyleKey), widthClass: 'w-36' },
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
          type: 'options', id: 'spacing', icon: ListFilter, label: 'Line spacing – giãn dòng và khoảng cách giữa các dòng kẻ', closeOnSelect: false, widthClass: 'w-44',
          sections: [
            { title: 'Giãn dòng', value: settings.lineHeight, options: LINE_HEIGHTS.map((h) => ({ value: h, label: String(h) })), onChange: (v) => onSettings({ lineHeight: v as number }) },
            { title: 'Khoảng cách dòng kẻ (mm)', value: settings.lineGapMm, options: LINE_GAPS.map((g) => ({ value: g, label: `${g} mm` })), onChange: (v) => onSettings({ lineGapMm: v as number }) },
          ],
        },
        { type: 'button', id: 'clear', icon: RemoveFormatting, label: `Clear formatting – xóa định dạng ${el}`, disabled: !hasStyle, disabledReason: `${el} chưa có định dạng riêng`, onClick: onClearStyle },
      ],
    },
    {
      id: 'exercise', label: 'Exercise Tools',
      items: [
        { type: 'button', id: 'addrow', icon: Rows3, text: '+', label: 'Add row – thêm một hàng (I, Mom & Dad…)', onClick: onAddRow },
        { type: 'button', id: 'addcol', icon: Columns3, text: '+', label: 'Add column – thêm một cột ảnh', onClick: onAddColumn },
        { type: 'file', id: 'images', icon: ImageIcon, label: 'Upload images – chọn nhiều ảnh, điền lần lượt vào các cột chưa có ảnh', accept: 'image/*', multiple: true, onFile: onImagesFiles },
        { type: 'button', id: 'exercise', icon: FilePlus2, label: 'Insert exercise – lưu bài này và chọn dạng bài mới trong thư mục', onClick: onInsertExercise },
      ],
    },
    {
      id: 'insert', label: 'Insert',
      items: [
        { type: 'button', id: 'morelines', icon: Plus, text: 'L', label: `Thêm dòng kẻ (đang có ${settings.lineCount})`, onClick: () => onSettings({ lineCount: Math.min(20, settings.lineCount + 1) }) },
        { type: 'button', id: 'fewerlines', icon: Plus, text: '−L', label: `Bớt dòng kẻ (đang có ${settings.lineCount})`, disabled: settings.lineCount <= 1, onClick: () => onSettings({ lineCount: Math.max(1, settings.lineCount - 1) }) },
      ],
    },
    {
      id: 'layout', label: 'Page & Layout',
      items: [
        {
          type: 'layout', id: 'layout', value: settings.layout, onChange: (id) => onSettings({ layout: id as TableSentencesData['settings']['layout'] }),
          options: TABLE_SENTENCES_LAYOUTS.map((l) => ({ id: l.id, label: l.label, desc: l.desc, thumb: <Thumb /> })),
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
