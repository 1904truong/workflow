import React from 'react';
import {
  Bold, Italic, Underline, Strikethrough, Baseline, AlignLeft, AlignCenter, AlignRight, ListFilter, RemoveFormatting,
  Plus, Sparkles, ClipboardPaste, FilePlus2, Image as ImageIcon, ImagePlus, QrCode, Headphones, ListOrdered, Minus,
  FilePlus, Ellipsis, SlidersHorizontal, Copy, Trash2, ALargeSmall, Rows3, Columns3, Table2,
} from 'lucide-react';
import type { TextStyle } from '../../services/matching-pictures/matchingPicturesCore';
import type { ListeningTableData, TableStyleKey } from '../../services/listening-table/listeningTableCore';
import { TABLE_LAYOUTS, TABLE_STYLE_LABELS } from '../../services/listening-table/listeningTableCore';
import { type ToolbarGroup } from '../shared/toolbar/EditorToolbar';
import { RibbonToolbar, type RibbonShell } from '../shared/toolbar/RibbonToolbar';

export type TableMoreKey = 'typography' | 'advanced';
const MORE_SETTINGS: { key: TableMoreKey; label: string }[] = [
  { key: 'typography', label: 'Typography Defaults' },
  { key: 'advanced', label: 'Advanced Worksheet Settings' },
];

const FONTS = ['Arial', 'Times New Roman', 'Quicksand', 'Roboto', 'Inter'];
const LINE_HEIGHTS = [1.2, 1.3, 1.4, 1.45, 1.5, 1.6, 1.75, 2];
const GAPS = [2, 3, 4, 5, 6, 8];

interface Props {
  data: ListeningTableData;
  selKey: TableStyleKey;
  onSelKey: (k: TableStyleKey) => void;
  curStyle?: TextStyle;
  defaults: { bold: boolean; italic: boolean; size: number };
  onFlag: (flag: 'bold' | 'italic' | 'underline' | 'strike') => void;
  onSizeDelta: (delta: number) => void;
  onPatchStyle: (patch: Partial<TextStyle>) => void;
  onClearStyle: () => void;
  onSettings: (patch: Partial<ListeningTableData['settings']>) => void;
  canDeleteRow: boolean;
  canDeleteColumn: boolean;
  onInsertRow: () => void;
  onInsertColumn: () => void;
  onDeleteRow: () => void;
  onDeleteColumn: () => void;
  onAddQuestion: () => void;
  onSmartAI: () => void;
  onSmartPaste: () => void;
  onInsertExercise: () => void;
  onImageFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGenerateImage: () => void;
  generating: boolean;
  onDuplicate: () => void;
  onDelete?: () => void;
  renderMoreSection: (key: TableMoreKey) => React.ReactNode;
  /** Lưu / xuất Word / in / zoom / undo của editor, dùng cho các menu File, Edit, View của thanh công cụ */
  shell?: RibbonShell;
  locked?: boolean;
}

/** Thanh công cụ Listening Table Completion: cùng bộ nhóm với các bài khác, khai báo bằng EditorToolbar dùng chung. */
export const ListeningTableToolbar: React.FC<Props> = ({
  data, selKey, onSelKey, curStyle, defaults, onFlag, onSizeDelta, onPatchStyle, onClearStyle, onSettings,
  canDeleteRow, canDeleteColumn, onInsertRow, onInsertColumn, onDeleteRow, onDeleteColumn, onAddQuestion, onSmartAI,
  onSmartPaste, onInsertExercise, onImageFile, onGenerateImage, generating, onDuplicate, onDelete, renderMoreSection, locked = false, shell,
}) => {
  const { settings } = data;
  const bold = curStyle?.bold ?? defaults.bold;
  const italic = curStyle?.italic ?? defaults.italic;
  const size = curStyle?.sizePt ?? defaults.size;
  const color = curStyle?.color ?? '#111111';
  const hasStyle = !!curStyle && Object.keys(curStyle).length > 0;
  const el = TABLE_STYLE_LABELS[selKey];
  const toggleAlign = (a: 'left' | 'center' | 'right') => onPatchStyle({ align: curStyle?.align === a ? undefined : a });

  const groups: ToolbarGroup[] = [
    {
      id: 'text', label: 'Text',
      items: [
        { type: 'select', id: 'el', label: 'Chọn thành phần cần định dạng', value: selKey, options: (Object.keys(TABLE_STYLE_LABELS) as TableStyleKey[]).map((k) => ({ value: k, label: TABLE_STYLE_LABELS[k] })), onChange: (v) => onSelKey(v as TableStyleKey), widthClass: 'w-36' },
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
            { title: 'Khoảng cách giữa các câu hỏi (mm)', value: settings.questionGapMm, options: GAPS.map((g) => ({ value: g, label: `${g} mm` })), onChange: (v) => onSettings({ questionGapMm: v as number }) },
          ],
        },
        { type: 'button', id: 'clear', icon: RemoveFormatting, label: `Clear formatting – xóa định dạng ${el}`, disabled: !hasStyle, disabledReason: `${el} chưa có định dạng riêng`, onClick: onClearStyle },
      ],
    },
    {
      id: 'exercise', label: 'Exercise Tools',
      items: [
        { type: 'button', id: 'insrow', icon: Rows3, text: '+', label: 'Insert row – chèn hàng bên dưới ô đang chọn', onClick: onInsertRow },
        { type: 'button', id: 'inscol', icon: Columns3, text: '+', label: 'Insert column – chèn cột bên phải ô đang chọn', onClick: onInsertColumn },
        { type: 'button', id: 'delrow', icon: Rows3, text: '−', label: 'Delete row – xóa hàng của ô đang chọn', disabled: !canDeleteRow, disabledReason: 'Bảng cần ít nhất một hàng', onClick: onDeleteRow },
        { type: 'button', id: 'delcol', icon: Columns3, text: '−', label: 'Delete column – xóa cột của ô đang chọn', disabled: !canDeleteColumn, disabledReason: 'Bảng cần ít nhất hai cột', onClick: onDeleteColumn },
        { type: 'divider' },
        { type: 'button', id: 'addq', icon: Plus, label: 'Add question – thêm một câu hỏi trả lời ngắn', onClick: onAddQuestion },
        { type: 'button', id: 'ai', icon: Sparkles, label: 'Smart AI – dán đề, tự tách bảng và câu hỏi, nhờ AI gợi ý ảnh', onClick: onSmartAI },
        { type: 'button', id: 'paste', icon: ClipboardPaste, label: 'Smart Paste – dán bảng (Tab hoặc |) và câu hỏi', onClick: onSmartPaste },
        { type: 'button', id: 'exercise', icon: FilePlus2, label: 'Insert exercise – lưu bài này và chọn dạng bài mới trong thư mục', onClick: onInsertExercise },
      ],
    },
    {
      id: 'insert', label: 'Insert',
      items: [
        { type: 'file', id: 'image', icon: ImageIcon, label: 'Insert image – tải ảnh / bản đồ từ máy', accept: 'image/*', onFile: onImageFile },
        { type: 'button', id: 'genimg', icon: ImagePlus, label: 'AI image – tạo ảnh / bản đồ bằng extension từ nội dung bài', disabled: generating, disabledReason: 'Đang tạo ảnh…', onClick: onGenerateImage },
        { type: 'button', id: 'qr', icon: QrCode, label: settings.showQrCode ? 'QR Code – đang hiện, bấm để ẩn' : 'QR Code – hiện mã QR audio trên worksheet', active: settings.showQrCode, onClick: () => onSettings({ showQrCode: !settings.showQrCode }) },
        { type: 'button', id: 'audioicon', icon: Headphones, label: settings.showAudioIcon ? 'Audio icon – đang hiện tai nghe cạnh tiêu đề, bấm để ẩn' : 'Audio icon – hiện biểu tượng tai nghe cạnh tiêu đề', active: settings.showAudioIcon, onClick: () => onSettings({ showAudioIcon: !settings.showAudioIcon }) },
        { type: 'button', id: 'numbers', icon: ListOrdered, label: settings.showQuestionNumbers ? 'Numbering – đang hiện số câu hỏi, bấm để ẩn' : 'Numbering – hiện số thứ tự câu hỏi', active: settings.showQuestionNumbers, onClick: () => onSettings({ showQuestionNumbers: !settings.showQuestionNumbers }) },
        { type: 'button', id: 'lines', icon: Minus, label: settings.showAnswerLines ? 'Answer line – đang hiện dòng kẻ trả lời, bấm để ẩn' : 'Answer line – hiện dòng kẻ để học sinh viết câu trả lời', active: settings.showAnswerLines, onClick: () => onSettings({ showAnswerLines: !settings.showAnswerLines }) },
      ],
    },
    {
      id: 'layout', label: 'Page & Layout',
      items: [
        {
          type: 'layout', id: 'layout', value: settings.layout, onChange: (id) => onSettings({ layout: id as ListeningTableData['settings']['layout'] }),
          options: TABLE_LAYOUTS.map((l) => ({
            id: l.id, label: l.label, desc: l.desc,
            thumb: (
              <div className="w-full h-14 p-1.5 bg-slate-50 border border-slate-300 rounded flex flex-col gap-1">
                <div className="h-4 rounded-xs bg-emerald-200" />
                <div className="flex-1 border border-blue-400 rounded-xs grid grid-cols-3 gap-px bg-blue-300"><span className="bg-white" /><span className="bg-white" /><span className="bg-white" /><span className="bg-white" /><span className="bg-white" /><span className="bg-white" /></div>
                <div className="h-0.5 bg-slate-400 rounded" />
              </div>
            ),
          })),
        },
        { type: 'button', id: 'showimg', icon: Table2, label: settings.showImage ? 'Image frame – đang hiện khung ảnh phía trên bảng, bấm để ẩn' : 'Image frame – hiện khung ảnh phía trên bảng', active: settings.showImage, onClick: () => onSettings({ showImage: !settings.showImage }) },
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
