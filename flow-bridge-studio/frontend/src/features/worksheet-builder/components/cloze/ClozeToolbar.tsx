import React from 'react';
import {
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered, ListFilter, RemoveFormatting,
  Plus, SquareDashed, ClipboardPaste, Shuffle, FilePlus2, Image as ImageIcon, ImageOff, ImagePlus, Hash, Columns3, FilePlus,
  Ellipsis, SlidersHorizontal, Copy, Trash2, ALargeSmall, Minimize2,
} from 'lucide-react';
import type { ClozeData, ClozeLayoutId } from '../../services/cloze/clozeCore';
import { CLOZE_LAYOUTS } from '../../services/cloze/clozeCore';
import { EditorToolbar, type ToolbarGroup } from '../shared/toolbar/EditorToolbar';

export type ClozeMoreKey = 'typography' | 'image' | 'advanced';
const MORE_SETTINGS: { key: ClozeMoreKey; label: string }[] = [
  { key: 'typography', label: 'Typography Defaults' },
  { key: 'image', label: 'Image Settings' },
  { key: 'advanced', label: 'Advanced Worksheet Settings' },
];

const FONTS = ['Arial', 'Times New Roman', 'Quicksand', 'Roboto', 'Inter'];
const LINE_HEIGHTS = [1.2, 1.3, 1.4, 1.5, 1.6, 1.75, 2];
const SPACINGS: { value: ClozeData['settings']['paragraphSpacing']; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'normal', label: 'Normal' },
  { value: 'spacious', label: 'Spacious' },
];
const POSITIONS: { value: ClozeData['settings']['imagePosition']; label: string }[] = [
  { value: 'right', label: 'Bên phải' },
  { value: 'left', label: 'Bên trái' },
  { value: 'top', label: 'Phía trên' },
  { value: 'none', label: 'Không có ảnh' },
];
const IMAGE_WIDTHS = [15, 20, 25, 30, 35, 40, 45, 50];
const COLUMNS = [1, 2, 3, 4].map((n) => ({ value: n, label: `${n} cột` }));
const LABELS: { value: ClozeData['settings']['optionLabelStyle']; label: string }[] = [
  { value: 'lowercase', label: 'a. b. c.' },
  { value: 'uppercase', label: 'A. B. C.' },
  { value: 'numeric', label: '1. 2. 3.' },
];

interface Props {
  data: ClozeData;
  onSettings: (patch: Partial<ClozeData['settings']>) => void;
  onWrap: (marker: '**' | '*' | '++') => void;
  onList: (kind: 'bullet' | 'numbered') => void;
  onPassageSize: (delta: number) => void;
  onInsertBlank: () => void;
  onAddQuestion: () => void;
  onSmartPaste: () => void;
  onShuffle: () => void;
  onAutoFit: () => void;
  fitting: boolean;
  onImageFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
  onGenerateImage: () => void;
  generatingImage?: boolean;
  onResetFormatting: () => void;
  onInsertExercise: () => void;
  onDuplicate: () => void;
  onDelete?: () => void;
  layoutThumb: (id: ClozeLayoutId) => React.ReactNode;
  renderMoreSection: (key: ClozeMoreKey) => React.ReactNode;
  locked?: boolean;
}

/** Thanh công cụ Multiple Choice Cloze: gom các cài đặt của cột Layout & Formatting cũ vào cùng bộ nhóm với các dạng bài khác. */
export const ClozeToolbar: React.FC<Props> = ({
  data, onSettings, onWrap, onList, onPassageSize, onInsertBlank, onAddQuestion, onSmartPaste, onShuffle, onAutoFit, fitting,
  onImageFile, onRemoveImage, onGenerateImage, generatingImage, onResetFormatting, onInsertExercise, onDuplicate, onDelete, layoutThumb, renderMoreSection, locked = false,
}) => {
  const s = data.settings;
  const hasImage = !!s.imageUrl && s.imagePosition !== 'none';

  const groups: ToolbarGroup[] = [
    {
      id: 'text', label: 'Text',
      items: [
        { type: 'select', id: 'font', label: 'Phông chữ cả bài', value: s.fontFamily, options: FONTS.map((f) => ({ value: f, label: f })), onChange: (v) => onSettings({ fontFamily: v }), widthClass: 'w-28' },
        { type: 'button', id: 'smaller', icon: ALargeSmall, text: '−', label: 'Giảm cỡ chữ đoạn văn', onClick: () => onPassageSize(-0.5) },
        { type: 'text', id: 'size', text: String(s.passageFontSizePt), title: 'Cỡ chữ đoạn văn (pt)' },
        { type: 'button', id: 'bigger', icon: ALargeSmall, text: '+', label: 'Tăng cỡ chữ đoạn văn', onClick: () => onPassageSize(0.5) },
        { type: 'divider' },
        { type: 'button', id: 'bold', icon: Bold, label: 'Bold – in đậm chữ đang chọn trong đoạn văn (**chữ**)', onClick: () => onWrap('**') },
        { type: 'button', id: 'italic', icon: Italic, label: 'Italic – in nghiêng chữ đang chọn (*chữ*)', onClick: () => onWrap('*') },
        { type: 'button', id: 'underline', icon: Underline, label: 'Underline – gạch chân chữ đang chọn (++chữ++)', onClick: () => onWrap('++') },
      ],
    },
    {
      id: 'paragraph', label: 'Paragraph',
      items: [
        { type: 'button', id: 'al', icon: AlignLeft, label: 'Align left – căn trái đoạn văn', active: s.passageAlign === 'left', onClick: () => onSettings({ passageAlign: 'left' }) },
        { type: 'button', id: 'ac', icon: AlignCenter, label: 'Align center – căn giữa', active: s.passageAlign === 'center', onClick: () => onSettings({ passageAlign: 'center' }) },
        { type: 'button', id: 'ar', icon: AlignRight, label: 'Align right – căn phải', active: s.passageAlign === 'right', onClick: () => onSettings({ passageAlign: 'right' }) },
        { type: 'button', id: 'aj', icon: AlignJustify, label: 'Justify – căn đều hai bên', active: s.passageAlign === 'justify', onClick: () => onSettings({ passageAlign: 'justify' }) },
        { type: 'divider' },
        { type: 'button', id: 'bullet', icon: List, label: 'Bulleted list – gạch đầu dòng cho dòng đang chọn', onClick: () => onList('bullet') },
        { type: 'button', id: 'number', icon: ListOrdered, label: 'Numbered list – đánh số dòng đang chọn', onClick: () => onList('numbered') },
        { type: 'divider' },
        {
          type: 'options', id: 'spacing', icon: ListFilter, label: 'Line spacing – giãn dòng và khoảng cách đoạn', closeOnSelect: false, widthClass: 'w-44',
          sections: [
            { title: 'Giãn dòng', value: s.lineHeight, options: [...new Set([...LINE_HEIGHTS, s.lineHeight])].sort((a, b) => a - b).map((h) => ({ value: h, label: String(h) })), onChange: (v) => onSettings({ lineHeight: v as number }) },
            { title: 'Khoảng cách giữa các đoạn', value: s.paragraphSpacing, options: SPACINGS, onChange: (v) => onSettings({ paragraphSpacing: v as ClozeData['settings']['paragraphSpacing'] }) },
          ],
        },
        { type: 'button', id: 'clear', icon: RemoveFormatting, label: 'Reset formatting – đưa phông, cỡ chữ, giãn dòng về mặc định', onClick: onResetFormatting },
      ],
    },
    {
      id: 'exercise', label: 'Exercise Tools',
      items: [
        { type: 'button', id: 'blank', icon: SquareDashed, label: 'Insert blank – chèn chỗ trống tại con trỏ trong đoạn văn (tự đánh số lại)', onClick: onInsertBlank },
        { type: 'button', id: 'addq', icon: Plus, label: 'Add question – thêm câu hỏi và chỗ trống mới', onClick: onAddQuestion },
        { type: 'button', id: 'paste', icon: ClipboardPaste, label: 'Smart Paste – dán cả bài: tiêu đề, đoạn văn và các lựa chọn', onClick: onSmartPaste },
        { type: 'button', id: 'shuffle', icon: Shuffle, label: 'Shuffle options – trộn thứ tự lựa chọn (làm một lần, có thể Hoàn tác)', disabled: data.questions.length === 0, disabledReason: 'Chưa có câu hỏi', onClick: onShuffle },
        { type: 'button', id: 'fit', icon: Minimize2, label: fitting ? 'Đang thu nhỏ…' : 'Auto fit to A4 – tự thu nhỏ chữ cho vừa một trang', disabled: fitting || data.questions.length === 0, disabledReason: fitting ? 'Đang thu nhỏ…' : 'Chưa có câu hỏi', onClick: onAutoFit },
        { type: 'button', id: 'exercise', icon: FilePlus2, label: 'Insert exercise – lưu bài này và chọn dạng bài mới trong thư mục', onClick: onInsertExercise },
      ],
    },
    {
      id: 'insert', label: 'Insert',
      items: [
        { type: 'file', id: 'image', icon: ImageIcon, label: hasImage ? 'Replace image – thay ảnh minh họa' : 'Insert image – tải ảnh minh họa cho đoạn văn', accept: 'image/*', onFile: onImageFile },
        { type: 'button', id: 'genimage', icon: ImagePlus, label: 'AI image – tạo ảnh minh họa bằng extension từ nội dung đoạn văn', disabled: !!generatingImage, disabledReason: 'Đang tạo ảnh…', onClick: onGenerateImage },
        { type: 'button', id: 'imgtoggle', icon: s.imagePosition === 'none' ? ImageOff : ImageIcon, label: s.imagePosition === 'none' ? 'Show image – đang ẩn khung ảnh, bấm để hiện' : 'Hide image – đang hiện khung ảnh, bấm để ẩn (ảnh đã tải vẫn được giữ)', active: s.imagePosition !== 'none', onClick: () => onSettings({ imagePosition: s.imagePosition === 'none' ? 'right' : 'none' }) },
        { type: 'button', id: 'noimage', icon: ImageOff, label: 'Remove image – xóa ảnh khỏi bài', disabled: !s.imageUrl, disabledReason: 'Bài chưa có ảnh', onClick: onRemoveImage },
        {
          type: 'options', id: 'imgpos', icon: ImageIcon, label: 'Image position & width – vị trí và độ rộng ảnh', closeOnSelect: false, widthClass: 'w-44',
          sections: [
            { title: 'Vị trí ảnh', value: s.imagePosition, options: POSITIONS, onChange: (v) => onSettings({ imagePosition: v as ClozeData['settings']['imagePosition'] }) },
            { title: 'Độ rộng ảnh', value: s.imageWidthPercent, options: IMAGE_WIDTHS.map((n) => ({ value: n, label: `${n}%` })), onChange: (v) => onSettings({ imageWidthPercent: v as number }) },
          ],
        },
        { type: 'button', id: 'qnum', icon: Hash, label: s.autoNumberQuestions ? 'Question numbers – đang hiện số câu, bấm để ẩn' : 'Question numbers – hiện số câu', active: s.autoNumberQuestions, onClick: () => onSettings({ autoNumberQuestions: !s.autoNumberQuestions }) },
      ],
    },
    {
      id: 'layout', label: 'Page & Layout',
      items: [
        {
          type: 'layout', id: 'layout', value: s.layout, onChange: (id) => onSettings({ layout: id as ClozeLayoutId }),
          options: CLOZE_LAYOUTS.map((l, i) => ({ id: l.id, label: `${i + 1}. ${l.label.replace(/^Kiểu \d+: /, '')}`, desc: l.desc, thumb: layoutThumb(l.id) })),
        },
        {
          type: 'options', id: 'answer', icon: Columns3, label: 'Answer layout – số cột và kiểu nhãn lựa chọn', closeOnSelect: false, widthClass: 'w-44',
          sections: [
            { title: 'Số cột lựa chọn', value: s.answerColumns, options: COLUMNS, onChange: (v) => onSettings({ answerColumns: v as 1 | 2 | 3 | 4 }) },
            { title: 'Kiểu nhãn', value: s.optionLabelStyle, options: LABELS, onChange: (v) => onSettings({ optionLabelStyle: v as ClozeData['settings']['optionLabelStyle'] }) },
          ],
        },
        { type: 'button', id: 'pagebreak', icon: FilePlus, label: s.pageBreakBefore ? 'Page break – bài này đang bắt đầu ở trang mới, bấm để bỏ' : 'Page break – bắt đầu bài này ở một trang mới', active: s.pageBreakBefore, onClick: () => onSettings({ pageBreakBefore: !s.pageBreakBefore }) },
      ],
    },
    {
      id: 'more', label: 'More',
      items: [
        {
          type: 'more', id: 'more', icon: Ellipsis, label: 'More options – cài đặt khác',
          entries: [
            { kind: 'title', label: 'Cài đặt worksheet' },
            ...MORE_SETTINGS.map((m) => ({ kind: 'panel' as const, id: m.key, icon: SlidersHorizontal, label: m.label, render: () => renderMoreSection(m.key) })),
            { kind: 'divider' },
            { kind: 'action', icon: Copy, label: 'Duplicate – lưu thành bản sao mới', onClick: onDuplicate },
            ...(onDelete ? [{ kind: 'action' as const, icon: Trash2, label: 'Xóa bài tập này', danger: true, onClick: onDelete }] : []),
          ],
        },
      ],
    },
  ];

  return <EditorToolbar groups={groups} dense locked={locked} />;
};
