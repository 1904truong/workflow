import React from 'react';
import {
  Bold, Italic, Underline, Baseline, Highlighter,
  AlignLeft, AlignCenter, AlignRight, List, ListOrdered, Outdent, Indent, ListFilter,
  SquareDashed, FilePlus2, Sparkles,
  Image as ImageIcon, Headphones, Table2, QrCode, ImageUp, ImagePlus,
  Columns2, FilePlus, Ellipsis,
  Type, Minus, Square, ArrowUp, ArrowDown, Copy, RemoveFormatting,
  AlignHorizontalJustifyCenter, SlidersHorizontal,
} from 'lucide-react';
import type {
  ListeningExtra,
  ListeningExtraType,
  ListeningGapFillData,
  ListeningGapFillSettings,
  ListeningParagraphFormat,
} from '../../services/listening/listeningGapFillCore';
import { LISTENING_LAYOUTS, DIALOGUE_PRESET, PASSAGE_QR_PRESET, PASSAGE_IMAGE_PRESET, OUTLINE_PRESET, SENTENCE_LIST_PRESET } from '../../services/listening/listeningGapFillCore';
import { ListeningLayoutThumbnail } from './ListeningLayoutThumbnail';
import { EditorToolbar, type ToolbarGroup } from '../shared/toolbar/EditorToolbar';

export type MoreSectionKey = 'blank' | 'image' | 'answer' | 'typography' | 'advanced';

const MORE_SETTINGS: { key: MoreSectionKey; label: string }[] = [
  { key: 'blank', label: 'Blank Settings' },
  { key: 'image', label: 'Image Settings' },
  { key: 'answer', label: 'Answer Table Settings' },
  { key: 'typography', label: 'Typography Defaults' },
  { key: 'advanced', label: 'Advanced Worksheet Settings' },
];

const FONTS = ['Arial', 'Times New Roman', 'Roboto', 'Inter'];
const SIZES = [10, 10.5, 11, 12, 13, 14];
const LINE_HEIGHTS = [1.3, 1.4, 1.5, 1.7, 2];

interface Props {
  data: ListeningGapFillData;
  activeParagraphIndex: number;
  selectedExtra: ListeningExtra | null;
  onSettings: (patch: Partial<ListeningGapFillSettings>) => void;
  onParaFormat: (patch: ListeningParagraphFormat) => void;
  onClearFormat: () => void;
  onImageFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  imageSupported: boolean;
  onAudioFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBodyImageFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGenerateBodyImage: () => void;
  generatingBodyImage: boolean;
  onInsertBlank: () => void;
  nextBlankLabel: string;
  onInsertExercise: () => void;
  onSmartPaste: () => void;
  onAddExtra: (type: ListeningExtraType) => void;
  onMoveExtra: (dir: 'up' | 'down') => void;
  onAlignExtra: (align: 'left' | 'center' | 'right') => void;
  onDuplicateExtra: () => void;
  renderMoreSection: (key: MoreSectionKey) => React.ReactNode;
  /** Chế độ Preview: chỉ xem, mọi công cụ chỉnh sửa bị khóa */
  locked?: boolean;
}

/** Thanh công cụ Listening Gap Fill: chỉ khai báo nhóm/nút, phần giao diện do EditorToolbar (dùng chung) lo. */
export const ListeningToolbar: React.FC<Props> = ({
  data, activeParagraphIndex, selectedExtra, onSettings, onParaFormat, onClearFormat, onImageFile, imageSupported,
  onAudioFile, onBodyImageFile, onGenerateBodyImage, generatingBodyImage, onInsertBlank, nextBlankLabel, onInsertExercise, onSmartPaste, onAddExtra, onMoveExtra, onAlignExtra,
  onDuplicateExtra, renderMoreSection, locked = false,
}) => {
  const { settings } = data;
  const para = data.paragraphs[activeParagraphIndex];
  const fmt: ListeningParagraphFormat = para?.format || {};
  const extraSelected = !!selectedExtra;
  const noPara = !para || extraSelected;
  const needPara = 'Chọn một đoạn văn để dùng chức năng này';
  const currentAlign = extraSelected ? selectedExtra!.align : fmt.align || 'left';
  const list = fmt.list ?? 'number';
  const hasFormat = !!(fmt.bold || fmt.italic || fmt.underline || fmt.color || fmt.highlight || fmt.align || fmt.list || fmt.indentMm);
  const setAlign = (a: 'left' | 'center' | 'right') => (extraSelected ? onAlignExtra(a) : onParaFormat({ align: a }));
  const textDisabled = { disabled: noPara, disabledReason: needPara };

  const groups: ToolbarGroup[] = [
    {
      id: 'text', label: 'Text',
      items: [
        { type: 'select', id: 'font', label: 'Phông chữ', value: settings.fontFamily, options: FONTS.map((f) => ({ value: f, label: f })), onChange: (v) => onSettings({ fontFamily: v }), widthClass: 'w-28' },
        { type: 'select', id: 'size', label: 'Cỡ chữ', value: String(settings.passageFontSizePt), options: SIZES.map((s) => ({ value: String(s), label: String(s) })), onChange: (v) => onSettings({ passageFontSizePt: Number(v) }), widthClass: 'w-16' },
        { type: 'divider' },
        { type: 'button', id: 'bold', icon: Bold, label: 'Bold – in đậm đoạn đang chọn', active: !!fmt.bold, ...textDisabled, onClick: () => onParaFormat({ bold: !fmt.bold }) },
        { type: 'button', id: 'italic', icon: Italic, label: 'Italic – in nghiêng đoạn đang chọn', active: !!fmt.italic, ...textDisabled, onClick: () => onParaFormat({ italic: !fmt.italic }) },
        { type: 'button', id: 'underline', icon: Underline, label: 'Underline – gạch chân đoạn đang chọn', active: !!fmt.underline, ...textDisabled, onClick: () => onParaFormat({ underline: !fmt.underline }) },
        { type: 'color', id: 'color', icon: Baseline, label: 'Text color – màu chữ', value: fmt.color, indicator: fmt.color || '#111827', ...textDisabled, onColor: (v) => onParaFormat({ color: v }) },
        { type: 'color', id: 'highlight', icon: Highlighter, label: 'Highlight – tô nền chữ', value: fmt.highlight || '#fde047', indicator: fmt.highlight || '#fde047', ...textDisabled, onColor: (v) => onParaFormat({ highlight: v }) },
      ],
    },
    {
      id: 'paragraph', label: 'Paragraph',
      items: [
        { type: 'button', id: 'al', icon: AlignLeft, label: 'Align left – căn trái', active: currentAlign === 'left', disabled: !para && !extraSelected, onClick: () => setAlign('left') },
        { type: 'button', id: 'ac', icon: AlignCenter, label: 'Align center – căn giữa', active: currentAlign === 'center', disabled: !para && !extraSelected, onClick: () => setAlign('center') },
        { type: 'button', id: 'ar', icon: AlignRight, label: 'Align right – căn phải', active: currentAlign === 'right', disabled: !para && !extraSelected, onClick: () => setAlign('right') },
        { type: 'divider' },
        { type: 'button', id: 'bullet', icon: List, label: 'Bulleted list – gạch đầu dòng', active: list === 'bullet', ...textDisabled, onClick: () => onParaFormat({ list: list === 'bullet' ? 'none' : 'bullet' }) },
        { type: 'button', id: 'number', icon: ListOrdered, label: 'Numbered list – đánh số', active: list === 'number', ...textDisabled, onClick: () => onParaFormat({ list: list === 'number' ? 'none' : 'number' }) },
        { type: 'divider' },
        { type: 'button', id: 'outdent', icon: Outdent, label: 'Decrease indent – giảm thụt lề', disabled: noPara || !fmt.indentMm, disabledReason: noPara ? needPara : 'Đoạn này chưa thụt lề', onClick: () => onParaFormat({ indentMm: Math.max(0, (fmt.indentMm || 0) - 5) }) },
        { type: 'button', id: 'indent', icon: Indent, label: 'Increase indent – tăng thụt lề', disabled: noPara || (fmt.indentMm || 0) >= 30, disabledReason: noPara ? needPara : 'Đã thụt lề tối đa', onClick: () => onParaFormat({ indentMm: (fmt.indentMm || 0) + 5 }) },
        { type: 'divider' },
        {
          type: 'options', id: 'spacing', icon: ListFilter, label: 'Line spacing – giãn dòng',
          sections: [{ value: settings.lineHeight, options: LINE_HEIGHTS.map((h) => ({ value: h, label: h.toFixed(1) })), onChange: (v) => onSettings({ lineHeight: v as number }) }],
        },
      ],
    },
    {
      id: 'exercise', label: 'Exercise Tools',
      items: [
        { type: 'button', id: 'blank', icon: SquareDashed, label: `Insert blank – chèn chỗ trống (${nextBlankLabel}) vào đoạn đang chọn`, ...textDisabled, onClick: onInsertBlank },
        { type: 'button', id: 'exercise', icon: FilePlus2, label: 'Insert exercise – lưu bài này và chọn dạng bài mới trong thư mục', onClick: onInsertExercise },
        { type: 'button', id: 'ai', icon: Sparkles, label: 'AI Assist – Smart Paste: dán văn bản, tự tách đoạn và chỗ trống', onClick: onSmartPaste },
      ],
    },
    {
      id: 'insert', label: 'Insert',
      items: [
        { type: 'file', id: 'image', icon: ImageIcon, label: 'Insert image – chèn ảnh vào đoạn đang chọn', accept: 'image/*', onFile: onImageFile, disabled: noPara || !imageSupported, disabledReason: !imageSupported ? 'Layout này không có ảnh – chọn Original, Hai cột hoặc Kết hợp hình ảnh' : needPara },
        { type: 'file', id: 'bodyimg', icon: ImageUp, label: 'Body image – tải ảnh lớn cạnh bài đọc (layout 9)', accept: 'image/*', onFile: onBodyImageFile },
        { type: 'button', id: 'genbody', icon: ImagePlus, label: 'AI image – tạo ảnh lớn cạnh bài đọc bằng extension từ nội dung bài', disabled: generatingBodyImage, disabledReason: 'Đang tạo ảnh…', onClick: onGenerateBodyImage },
        { type: 'file', id: 'audio', icon: Headphones, label: 'Insert audio – tải lên / thay file audio', accept: 'audio/*', onFile: onAudioFile },
        { type: 'button', id: 'table', icon: Table2, label: 'Insert table – chèn bảng', onClick: () => onAddExtra('table') },
        { type: 'button', id: 'qr', icon: QrCode, label: settings.showQrCode ? 'QR Code – đang hiện, bấm để ẩn' : 'QR Code – bấm để hiện trên worksheet', active: settings.showQrCode, onClick: () => onSettings({ showQrCode: !settings.showQrCode }) },
      ],
    },
    {
      id: 'layout', label: 'Page & Layout',
      items: [
        {
          type: 'layout', id: 'layout', value: settings.layout, onChange: (id) => onSettings(id === 'form_completion' ? { ...PASSAGE_IMAGE_PRESET, layout: 'form_completion' as const } : id === 'dialogue' ? DIALOGUE_PRESET : id === 'passage_qr' ? PASSAGE_QR_PRESET : id === 'passage_image' ? PASSAGE_IMAGE_PRESET : id === 'outline' ? OUTLINE_PRESET : id === 'sentence_list' ? SENTENCE_LIST_PRESET : { layout: id as ListeningGapFillSettings['layout'] }),
          options: LISTENING_LAYOUTS.map((l) => ({ id: l.id, label: l.label, desc: l.desc, thumb: <ListeningLayoutThumbnail layout={l.id} className="w-full h-14" /> })),
        },
        { type: 'button', id: 'columns', icon: Columns2, label: settings.layout === 'two_columns' ? 'Columns – đang chia 2 cột, bấm để về 1 cột' : 'Columns – chia worksheet thành 2 cột', active: settings.layout === 'two_columns', onClick: () => onSettings({ layout: settings.layout === 'two_columns' ? 'original' : 'two_columns' }) },
        { type: 'button', id: 'pagebreak', icon: FilePlus, label: settings.pageBreakBefore ? 'Page break – bài này đang bắt đầu ở trang mới, bấm để bỏ' : 'Page break – bắt đầu bài này ở một trang mới', active: settings.pageBreakBefore, onClick: () => onSettings({ pageBreakBefore: !settings.pageBreakBefore }) },
      ],
    },
    {
      id: 'more', label: 'More',
      items: [
        {
          type: 'more', id: 'more', icon: Ellipsis,
          entries: [
            { kind: 'title', label: 'Chèn đối tượng' },
            { kind: 'action', icon: Type, label: 'Text Box', onClick: () => onAddExtra('text') },
            { kind: 'action', icon: Minus, label: 'Line', onClick: () => onAddExtra('line') },
            { kind: 'action', icon: Square, label: 'Shape', onClick: () => onAddExtra('shape') },
            { kind: 'divider' },
            { kind: 'title', label: extraSelected ? 'Đối tượng đang chọn' : 'Đối tượng đang chọn (chọn trong preview)' },
            ...(['left', 'center', 'right'] as const).map((a) => ({
              kind: 'action' as const, icon: AlignHorizontalJustifyCenter,
              label: `Align objects – ${a === 'left' ? 'căn trái' : a === 'center' ? 'căn giữa' : 'căn phải'}`,
              disabled: !extraSelected, checked: selectedExtra?.align === a, onClick: () => onAlignExtra(a),
            })),
            { kind: 'action', icon: ArrowUp, label: 'Bring forward – đưa lên trên', disabled: !extraSelected, onClick: () => onMoveExtra('up') },
            { kind: 'action', icon: ArrowDown, label: 'Send backward – đưa xuống dưới', disabled: !extraSelected, onClick: () => onMoveExtra('down') },
            { kind: 'action', icon: Copy, label: 'Duplicate block', disabled: !extraSelected, onClick: onDuplicateExtra },
            { kind: 'divider' },
            { kind: 'action', icon: RemoveFormatting, label: 'Clear formatting – xóa định dạng đoạn', disabled: noPara || !hasFormat, onClick: onClearFormat },
            { kind: 'divider' },
            { kind: 'title', label: 'Cài đặt worksheet' },
            ...MORE_SETTINGS.map((s) => ({ kind: 'panel' as const, id: s.key, icon: SlidersHorizontal, label: s.label, render: () => renderMoreSection(s.key) })),
          ],
        },
      ],
    },
  ];

  return <EditorToolbar groups={groups} dense locked={locked} />;
};
