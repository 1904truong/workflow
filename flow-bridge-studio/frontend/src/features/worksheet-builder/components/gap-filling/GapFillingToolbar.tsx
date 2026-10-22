import React from 'react';
import {
  Bold, Italic, Underline, Strikethrough, Baseline, AlignLeft, AlignCenter, AlignRight,
  ListFilter, RemoveFormatting, Plus, ClipboardPaste, FileUp, SquareDashed, FilePlus2, QrCode, Box,
  FilePlus, Ellipsis, SlidersHorizontal, Copy, Trash2, ALargeSmall,
} from 'lucide-react';
import type { TextStyle } from '../../services/matching-pictures/matchingPicturesCore';
import type { GapFillingData, GapStyleKey } from '../../services/gap-filling/gapFillingCore';
import { GAP_LAYOUTS, GAP_STYLE_LABELS } from '../../services/gap-filling/gapFillingCore';
import { type ToolbarGroup } from '../shared/toolbar/EditorToolbar';
import { RibbonToolbar, type RibbonShell } from '../shared/toolbar/RibbonToolbar';

export type GapMoreKey = 'typography' | 'advanced';
const MORE_SETTINGS: { key: GapMoreKey; label: string }[] = [
  { key: 'typography', label: 'Typography Defaults' },
  { key: 'advanced', label: 'Advanced Worksheet Settings' },
];

const FONTS = ['Arial', 'Times New Roman', 'Quicksand', 'Roboto', 'Inter'];
const LINE_HEIGHTS = [1.5, 1.75, 2, 2.1, 2.3, 2.5];

interface Props {
  data: GapFillingData;
  selKey: GapStyleKey;
  onSelKey: (k: GapStyleKey) => void;
  curStyle?: TextStyle;
  defaults: { bold: boolean; italic: boolean; size: number };
  onFlag: (flag: 'bold' | 'italic' | 'underline' | 'strike') => void;
  onSizeDelta: (delta: number) => void;
  onPatchStyle: (patch: Partial<TextStyle>) => void;
  onClearStyle: () => void;
  onSettings: (patch: Partial<GapFillingData['settings']>) => void;
  onAddWord: () => void;
  onImportWords: () => void;
  onAddBlank: () => void;
  onSmartPaste: () => void;
  onInsertExercise: () => void;
  onDuplicate: () => void;
  onDelete?: () => void;
  renderMoreSection: (key: GapMoreKey) => React.ReactNode;
  /** Lưu / xuất Word / in / zoom / undo của editor, dùng cho các menu File, Edit, View của thanh công cụ */
  shell?: RibbonShell;
  locked?: boolean;
}

/** Thanh công cụ Gap Filling / Word Formation: cùng bộ nhóm với các dạng bài khác, nút Exercise Tools theo khung từ / chỗ trống. */
export const GapFillingToolbar: React.FC<Props> = ({
  data, selKey, onSelKey, curStyle, defaults, onFlag, onSizeDelta, onPatchStyle, onClearStyle, onSettings,
  onAddWord, onImportWords, onAddBlank, onSmartPaste, onInsertExercise, onDuplicate, onDelete, renderMoreSection, locked = false, shell,
}) => {
  const { settings } = data;
  const bold = curStyle?.bold ?? defaults.bold;
  const italic = curStyle?.italic ?? defaults.italic;
  const size = curStyle?.sizePt ?? defaults.size;
  const color = curStyle?.color ?? '#111111';
  const hasStyle = !!curStyle && Object.keys(curStyle).length > 0;
  const el = GAP_STYLE_LABELS[selKey];
  const toggleAlign = (a: 'left' | 'center' | 'right') => onPatchStyle({ align: curStyle?.align === a ? undefined : a });

  const groups: ToolbarGroup[] = [
    {
      id: 'text', label: 'Text',
      items: [
        { type: 'select', id: 'el', label: 'Chọn thành phần cần định dạng', value: selKey, options: (Object.keys(GAP_STYLE_LABELS) as GapStyleKey[]).map((k) => ({ value: k, label: GAP_STYLE_LABELS[k] })), onChange: (v) => onSelKey(v as GapStyleKey), widthClass: 'w-40' },
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
          type: 'options', id: 'spacing', icon: ListFilter, label: 'Line spacing – giãn dòng đoạn văn', closeOnSelect: true, widthClass: 'w-40',
          sections: [{ title: 'Giãn dòng', value: settings.lineHeight, options: LINE_HEIGHTS.map((h) => ({ value: h, label: String(h) })), onChange: (v) => onSettings({ lineHeight: v as number }) }],
        },
        { type: 'button', id: 'clear', icon: RemoveFormatting, label: `Clear formatting – xóa định dạng ${el}`, disabled: !hasStyle, disabledReason: `${el} chưa có định dạng riêng`, onClick: onClearStyle },
      ],
    },
    {
      id: 'exercise', label: 'Exercise Tools',
      items: [
        { type: 'button', id: 'addw', icon: Plus, text: 'W', label: 'Add word – thêm một từ vào khung từ', onClick: onAddWord },
        { type: 'button', id: 'importw', icon: FileUp, label: 'Import words – nhập nhanh danh sách từ', onClick: onImportWords },
        { type: 'button', id: 'blank', icon: SquareDashed, label: 'Add blank – chèn chỗ trống (a) ______ vào vị trí con trỏ trong đoạn văn', onClick: onAddBlank },
        { type: 'button', id: 'paste', icon: ClipboardPaste, label: 'Smart Paste – dán cả bài: tiêu đề, khung từ và đoạn văn có (a) ______', onClick: onSmartPaste },
        { type: 'button', id: 'exercise', icon: FilePlus2, label: 'Insert exercise – lưu bài này và chọn dạng bài mới trong thư mục', onClick: onInsertExercise },
      ],
    },
    {
      id: 'insert', label: 'Insert',
      items: [
        { type: 'button', id: 'wordbank', icon: Box, label: settings.showWordBank ? 'Word bank – đang hiện khung từ, bấm để ẩn' : 'Word bank – hiện khung từ trên phiếu', active: settings.showWordBank, onClick: () => onSettings({ showWordBank: !settings.showWordBank }) },
        { type: 'button', id: 'qr', icon: QrCode, label: settings.showQrCode ? 'QR Code – đang hiện, bấm để ẩn' : 'QR Code – hiện mã QR audio trên worksheet', active: settings.showQrCode, onClick: () => onSettings({ showQrCode: !settings.showQrCode }) },
      ],
    },
    {
      id: 'layout', label: 'Page & Layout',
      items: [
        {
          type: 'layout', id: 'layout', value: settings.layout, onChange: (id) => onSettings({ layout: id as GapFillingData['settings']['layout'] }),
          options: GAP_LAYOUTS.map((l) => ({
            id: l.id, label: l.label, desc: l.desc,
            thumb: (
              <div className="w-full h-14 p-1.5 bg-slate-50 border border-slate-300 rounded flex flex-col gap-1">
                <div className="flex gap-1"><span className="h-0.5 flex-1 bg-slate-500 rounded mt-0.5" /><span className="w-3 h-3 bg-slate-700 rounded-xs" /></div>
                <span className="mx-auto w-3/4 h-2.5 border border-slate-600 rounded-md" />
                {l.id === 'two_columns'
                  ? [0, 1, 2].map((i) => <div key={i} className="flex items-center gap-1.5"><span className="h-0.5 w-1/2 bg-slate-400 rounded" /><span className="h-0.5 w-1/2 bg-slate-400 rounded" /></div>)
                  : l.id === 'numbered_list'
                  ? [0, 1, 2].map((i) => <div key={i} className="flex items-center gap-1"><span className="w-1 h-0.5 bg-slate-700 rounded" /><span className="h-0.5 w-4/5 bg-slate-400 rounded" /></div>)
                  : [0, 1, 2].map((i) => <span key={i} className="block h-0.5 bg-slate-400 rounded" />)}
              </div>
            ),
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
