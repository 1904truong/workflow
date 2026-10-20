import React from 'react';
import {
  Bold, Italic, Underline, Strikethrough, Baseline, AlignLeft, AlignCenter, AlignRight,
  ListFilter, RemoveFormatting, Plus, ClipboardPaste, FilePlus2, ListPlus, SquarePen,
  QrCode, Headphones, ListOrdered, FilePlus, Ellipsis, SlidersHorizontal, Copy, Trash2, ALargeSmall,
} from 'lucide-react';
import type { TextStyle } from '../../services/matching-pictures/matchingPicturesCore';
import type { ListeningMatchingData, LmStyleKey } from '../../services/listening-matching/listeningMatchingCore';
import { LM_LAYOUTS, LM_STYLE_LABELS } from '../../services/listening-matching/listeningMatchingCore';
import { EditorToolbar, type ToolbarGroup } from '../shared/toolbar/EditorToolbar';

export type LmMoreKey = 'typography' | 'advanced';
const MORE_SETTINGS: { key: LmMoreKey; label: string }[] = [
  { key: 'typography', label: 'Typography Defaults' },
  { key: 'advanced', label: 'Advanced Worksheet Settings' },
];

const FONTS = ['Arial', 'Times New Roman', 'Quicksand', 'Roboto', 'Inter'];
const LINE_HEIGHTS = [1.2, 1.3, 1.4, 1.5, 1.6, 1.75, 2];
const ROW_GAPS = [3, 4, 4.5, 5, 6, 8];

interface Props {
  data: ListeningMatchingData;
  selKey: LmStyleKey;
  onSelKey: (k: LmStyleKey) => void;
  curStyle?: TextStyle;
  defaults: { bold: boolean; italic: boolean; size: number };
  onFlag: (flag: 'bold' | 'italic' | 'underline' | 'strike') => void;
  onSizeDelta: (delta: number) => void;
  onPatchStyle: (patch: Partial<TextStyle>) => void;
  onClearStyle: () => void;
  onSettings: (patch: Partial<ListeningMatchingData['settings']>) => void;
  onAddProblem: () => void;
  onSmartPaste: () => void;
  onInsertExercise: () => void;
  onAddOption: () => void;
  onDuplicate: () => void;
  onDelete?: () => void;
  renderMoreSection: (key: LmMoreKey) => React.ReactNode;
  locked?: boolean;
}

/** Thanh công cụ Listening True / False: cùng bộ nhóm với các bài khác, khai báo bằng EditorToolbar dùng chung. */
export const ListeningMatchingToolbar: React.FC<Props> = ({
  data, selKey, onSelKey, curStyle, defaults, onFlag, onSizeDelta, onPatchStyle, onClearStyle, onSettings,
  onAddProblem, onAddOption, onSmartPaste, onInsertExercise,
  onDuplicate, onDelete, renderMoreSection, locked = false,
}) => {
  const { settings } = data;
  const bold = curStyle?.bold ?? defaults.bold;
  const italic = curStyle?.italic ?? defaults.italic;
  const size = curStyle?.sizePt ?? defaults.size;
  const color = curStyle?.color ?? '#111111';
  const hasStyle = !!curStyle && Object.keys(curStyle).length > 0;
  const el = LM_STYLE_LABELS[selKey];
  const toggleAlign = (a: 'left' | 'center' | 'right') => onPatchStyle({ align: curStyle?.align === a ? undefined : a });

  const groups: ToolbarGroup[] = [
    {
      id: 'text', label: 'Text',
      items: [
        { type: 'select', id: 'el', label: 'Chọn thành phần cần định dạng', value: selKey, options: (Object.keys(LM_STYLE_LABELS) as LmStyleKey[]).map((k) => ({ value: k, label: LM_STYLE_LABELS[k] })), onChange: (v) => onSelKey(v as LmStyleKey), widthClass: 'w-40' },
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
            { title: 'Khoảng cách giữa các dòng (mm)', value: settings.rowGapMm, options: ROW_GAPS.map((g) => ({ value: g, label: `${g} mm` })), onChange: (v) => onSettings({ rowGapMm: v as number }) },
          ],
        },
        { type: 'button', id: 'clear', icon: RemoveFormatting, label: `Clear formatting – xóa định dạng ${el}`, disabled: !hasStyle, disabledReason: `${el} chưa có định dạng riêng`, onClick: onClearStyle },
      ],
    },
    {
      id: 'exercise', label: 'Exercise Tools',
      items: [
        { type: 'button', id: 'add', icon: Plus, label: 'Add question – thêm một câu hỏi', onClick: onAddProblem },
        { type: 'button', id: 'addopt', icon: ListPlus, label: 'Add option – thêm một lựa chọn a, b, c…', onClick: onAddOption },
        { type: 'button', id: 'paste', icon: ClipboardPaste, label: 'Smart Paste – dán đề: câu hỏi 1., 2. và lựa chọn a., b.', onClick: onSmartPaste },
        { type: 'button', id: 'exercise', icon: FilePlus2, label: 'Insert exercise – lưu bài này và chọn dạng bài mới trong thư mục', onClick: onInsertExercise },
      ],
    },
    {
      id: 'insert', label: 'Insert',
      items: [
        { type: 'button', id: 'qr', icon: QrCode, label: settings.showQrCode ? 'QR Code – đang hiện, bấm để ẩn' : 'QR Code – hiện mã QR audio trên worksheet', active: settings.showQrCode, onClick: () => onSettings({ showQrCode: !settings.showQrCode }) },
        { type: 'button', id: 'audioicon', icon: Headphones, label: settings.showAudioIcon ? 'Audio icon – đang hiện tai nghe cạnh tiêu đề, bấm để ẩn' : 'Audio icon – hiện biểu tượng tai nghe cạnh tiêu đề', active: settings.showAudioIcon, onClick: () => onSettings({ showAudioIcon: !settings.showAudioIcon }) },
        { type: 'button', id: 'numbering', icon: ListOrdered, label: settings.showNumbering ? 'Numbering – đang hiện số câu, bấm để ẩn' : 'Numbering – hiện số thứ tự câu', active: settings.showNumbering, onClick: () => onSettings({ showNumbering: !settings.showNumbering }) },
        { type: 'button', id: 'line', icon: SquarePen, label: settings.showAnswerBox ? 'Answer box – đang hiện hộp đáp án, bấm để ẩn' : 'Answer box – hiện hộp đáp án bên phải', active: settings.showAnswerBox, onClick: () => onSettings({ showAnswerBox: !settings.showAnswerBox }) },
      ],
    },
    {
      id: 'layout', label: 'Page & Layout',
      items: [
        {
          type: 'layout', id: 'layout', value: settings.layout, onChange: (id) => onSettings({ layout: id as ListeningMatchingData['settings']['layout'] }),
          options: LM_LAYOUTS.map((l) => ({
            id: l.id, label: l.label, desc: l.desc,
            thumb: (
              <div className="w-full h-14 p-1.5 bg-slate-50 border border-slate-300 rounded flex gap-1.5">
                <div className="flex-1 space-y-1"><span className="block h-0.5 bg-slate-500 rounded" /><span className="block h-0.5 bg-slate-500 rounded" /><span className="block h-0.5 bg-slate-500 rounded" /><span className="block h-0.5 bg-slate-300 rounded w-2/3" /><span className="block h-0.5 bg-slate-300 rounded w-2/3" /></div>
                <div className="flex flex-col items-end gap-1"><span className="w-3 h-3 bg-slate-300 rounded-xs" /><span className="w-6 flex-1 border border-blue-400 rounded-xs" /></div>
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

  return <EditorToolbar groups={groups} dense locked={locked} />;
};
