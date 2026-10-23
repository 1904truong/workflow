import React from 'react';
import {
  Bold, Italic, Underline, Strikethrough, Baseline, AlignLeft, AlignCenter, AlignRight,
  ListFilter, RemoveFormatting, Plus, ClipboardPaste, FileUp, Shuffle, FilePlus2, ImageUp, ImageOff, ImagePlus, Heading,
  FilePlus, Ellipsis, SlidersHorizontal, Copy, Trash2, ALargeSmall,
} from 'lucide-react';
import type { TextStyle } from '../../services/matching-pictures/matchingPicturesCore';
import type { MatchingHeadingsData, HeadingStyleKey } from '../../services/matching-headings/matchingHeadingsCore';
import { HEADINGS_LAYOUTS, HEADING_STYLE_LABELS } from '../../services/matching-headings/matchingHeadingsCore';
import { type ToolbarGroup } from '../shared/toolbar/EditorToolbar';
import { RibbonToolbar, type RibbonShell } from '../shared/toolbar/RibbonToolbar';

export type HeadingsMoreKey = 'typography' | 'advanced';
const MORE_SETTINGS: { key: HeadingsMoreKey; label: string }[] = [
  { key: 'typography', label: 'Typography Defaults' },
  { key: 'advanced', label: 'Advanced Worksheet Settings' },
];

const FONTS = ['Arial', 'Times New Roman', 'Quicksand', 'Roboto', 'Inter'];
const LINE_HEIGHTS = [1.2, 1.3, 1.4, 1.5, 1.6, 1.75, 2];
const PARA_GAPS = [1, 2, 2.5, 3, 4, 5];

interface Props {
  data: MatchingHeadingsData;
  selKey: HeadingStyleKey;
  onSelKey: (k: HeadingStyleKey) => void;
  curStyle?: TextStyle;
  defaults: { bold: boolean; italic: boolean; size: number };
  onFlag: (flag: 'bold' | 'italic' | 'underline' | 'strike') => void;
  onSizeDelta: (delta: number) => void;
  onPatchStyle: (patch: Partial<TextStyle>) => void;
  onClearStyle: () => void;
  onSettings: (patch: Partial<MatchingHeadingsData['settings']>) => void;
  onAddParagraph: () => void;
  onAddIdea: () => void;
  onImportIdeas: () => void;
  onSmartPaste: () => void;
  onShuffleIdeas: () => void;
  onImageFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearImage: () => void;
  onGenerateImage: () => void;
  generatingImage?: boolean;
  onInsertExercise: () => void;
  onDuplicate: () => void;
  onDelete?: () => void;
  renderMoreSection: (key: HeadingsMoreKey) => React.ReactNode;
  /** Lưu / xuất Word / in / zoom / undo của editor, dùng cho các menu File, Edit, View của thanh công cụ */
  shell?: RibbonShell;
  locked?: boolean;
}

/** Thanh công cụ Matching Headings: cùng bộ nhóm với các dạng bài khác, nút Exercise Tools theo đoạn văn / ý chính / ảnh. */
export const MatchingHeadingsToolbar: React.FC<Props> = ({
  data, selKey, onSelKey, curStyle, defaults, onFlag, onSizeDelta, onPatchStyle, onClearStyle, onSettings,
  onAddParagraph, onAddIdea, onImportIdeas, onSmartPaste, onShuffleIdeas, onImageFile, onClearImage, onGenerateImage, generatingImage, onInsertExercise, onDuplicate, onDelete,
  renderMoreSection, locked = false, shell,
}) => {
  const { settings } = data;
  const bold = curStyle?.bold ?? defaults.bold;
  const italic = curStyle?.italic ?? defaults.italic;
  const size = curStyle?.sizePt ?? defaults.size;
  const color = curStyle?.color ?? '#111111';
  const hasStyle = !!curStyle && Object.keys(curStyle).length > 0;
  const el = HEADING_STYLE_LABELS[selKey];
  const toggleAlign = (a: 'left' | 'center' | 'right') => onPatchStyle({ align: curStyle?.align === a ? undefined : a });

  const groups: ToolbarGroup[] = [
    {
      id: 'text', label: 'Text',
      items: [
        { type: 'select', id: 'el', label: 'Chọn thành phần cần định dạng', value: selKey, options: (Object.keys(HEADING_STYLE_LABELS) as HeadingStyleKey[]).map((k) => ({ value: k, label: HEADING_STYLE_LABELS[k] })), onChange: (v) => onSelKey(v as HeadingStyleKey), widthClass: 'w-36' },
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
          type: 'options', id: 'spacing', icon: ListFilter, label: 'Line spacing – giãn dòng cả bài', closeOnSelect: false, widthClass: 'w-44',
          sections: [
            { title: 'Giãn dòng', value: settings.lineHeight, options: LINE_HEIGHTS.map((h) => ({ value: h, label: String(h) })), onChange: (v) => onSettings({ lineHeight: v as number }) },
            { title: 'Khoảng cách giữa các đoạn (mm)', value: settings.paragraphGapMm, options: PARA_GAPS.map((g) => ({ value: g, label: `${g} mm` })), onChange: (v) => onSettings({ paragraphGapMm: v as number }) },
          ],
        },
        { type: 'button', id: 'clear', icon: RemoveFormatting, label: `Clear formatting – xóa định dạng ${el}`, disabled: !hasStyle, disabledReason: `${el} chưa có định dạng riêng`, onClick: onClearStyle },
      ],
    },
    {
      id: 'exercise', label: 'Exercise Tools',
      items: [
        { type: 'button', id: 'addp', icon: Plus, text: 'P', label: 'Add paragraph – thêm một đoạn văn vào bài đọc', onClick: onAddParagraph },
        { type: 'button', id: 'addi', icon: Plus, text: 'I', label: 'Add idea – thêm một ý chính (a, b, c…)', onClick: onAddIdea },
        { type: 'button', id: 'import', icon: FileUp, label: 'Import – nhập nhanh danh sách ý chính, mỗi dòng một ý', onClick: onImportIdeas },
        { type: 'button', id: 'paste', icon: ClipboardPaste, label: 'Smart Paste – dán cả bài: tiêu đề, các đoạn văn và danh sách a., b., c.', onClick: onSmartPaste },
        { type: 'button', id: 'shuffle', icon: Shuffle, label: 'Shuffle ideas – xáo trộn thứ tự các ý chính', disabled: data.ideas.length < 2, disabledReason: 'Cần ít nhất 2 ý chính', onClick: onShuffleIdeas },
        { type: 'button', id: 'exercise', icon: FilePlus2, label: 'Insert exercise – lưu bài này và chọn dạng bài mới trong thư mục', onClick: onInsertExercise },
      ],
    },
    {
      id: 'insert', label: 'Insert',
      items: [
        { type: 'file', id: 'image', icon: ImageUp, label: 'Insert image – tải ảnh minh họa đặt bên phải bài đọc', accept: 'image/*', onFile: onImageFile },
        { type: 'button', id: 'genimage', icon: ImagePlus, label: 'AI image – tạo ảnh bên phải bài đọc bằng extension từ nội dung bài', disabled: !!generatingImage, disabledReason: 'Đang tạo ảnh…', onClick: onGenerateImage },
        { type: 'button', id: 'noimage', icon: ImageOff, label: 'Remove image – xóa ảnh khỏi bài', disabled: !data.image?.url, disabledReason: 'Bài chưa có ảnh', onClick: onClearImage },
        { type: 'button', id: 'ptitle', icon: Heading, label: settings.showPassageTitle ? 'Passage title – đang hiện tiêu đề bài đọc, bấm để ẩn' : 'Passage title – hiện tiêu đề bài đọc', active: settings.showPassageTitle, onClick: () => onSettings({ showPassageTitle: !settings.showPassageTitle }) },
      ],
    },
    {
      id: 'layout', label: 'Page & Layout',
      items: [
        {
          type: 'layout', id: 'layout', value: settings.layout, onChange: (id) => onSettings({ layout: id as MatchingHeadingsData['settings']['layout'] }),
          options: HEADINGS_LAYOUTS.map((l) => ({
            id: l.id, label: l.label, desc: l.desc,
            thumb: (
              <div className="w-full h-14 p-1.5 bg-slate-50 border border-slate-300 rounded flex flex-col gap-1">
                <div className="flex gap-1 items-start">
                  <div className="flex-1 space-y-0.5">{[0, 1, 2].map((i) => <span key={i} className="block h-0.5 bg-slate-400 rounded" />)}</div>
                  <span className="w-5 h-4 bg-sky-400 rounded-xs shrink-0" />
                </div>
                <div className="flex gap-1.5 flex-1">
                  <div className="flex-1 space-y-0.5">{[0, 1, 2].map((i) => <span key={i} className="block h-0.5 bg-slate-500 rounded w-3/4" />)}</div>
                  {l.id === 'list_divider' && <span className="w-px bg-slate-400" />}
                  <div className="flex-1 space-y-0.5">{[0, 1, 2].map((i) => <span key={i} className="block h-0.5 bg-slate-400 rounded" />)}</div>
                </div>
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
