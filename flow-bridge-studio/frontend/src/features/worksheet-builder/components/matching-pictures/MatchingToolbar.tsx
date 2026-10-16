import React from 'react';
import {
  Bold, Italic, Underline, Strikethrough, Baseline, AlignLeft, AlignCenter, AlignRight,
  ListFilter, RemoveFormatting, Rows3, Plus, ClipboardPaste, Minimize2, Shuffle, FilePlus2,
  Images, Image as ImageIcon, Tag, Captions, Columns3, FilePlus,
  Ellipsis, SlidersHorizontal, Copy, Trash2, ALargeSmall,
} from 'lucide-react';
import type {
  MatchingPicturesData,
  MatchingPicturesLayoutId,
  TextStyle,
  TextStyleKey,
} from '../../services/matching-pictures/matchingPicturesCore';
import { MATCHING_PICTURES_LAYOUTS, TEXT_STYLE_LABELS } from '../../services/matching-pictures/matchingPicturesCore';
import { MatchingLayoutThumbnail } from './MatchingLayoutThumbnail';
import { EditorToolbar, type ToolbarGroup } from '../shared/toolbar/EditorToolbar';

export type MatchingMoreKey = 'image' | 'answer' | 'typography' | 'advanced';

const MORE_SETTINGS: { key: MatchingMoreKey; label: string }[] = [
  { key: 'image', label: 'Image Settings' },
  { key: 'answer', label: 'Answer Area Settings' },
  { key: 'typography', label: 'Typography Defaults' },
  { key: 'advanced', label: 'Advanced Worksheet Settings' },
];

const FONTS = ['Arial', 'Times New Roman', 'Quicksand', 'Roboto', 'Inter'];
const LINE_HEIGHTS = [1.2, 1.3, 1.4, 1.5, 1.6, 1.75, 2];
const COLUMN_OPTIONS: { value: 1 | 2 | 3 | 'auto'; label: string }[] = [
  { value: 1, label: '1 cột ảnh' },
  { value: 2, label: '2 cột ảnh' },
  { value: 3, label: '3 cột ảnh' },
  { value: 'auto', label: 'Tự động' },
];

interface Props {
  data: MatchingPicturesData;
  selKey: TextStyleKey;
  onSelKey: (k: TextStyleKey) => void;
  curStyle?: TextStyle;
  defaults: { bold: boolean; italic: boolean; size: number };
  onFlag: (flag: 'bold' | 'italic' | 'underline' | 'strike') => void;
  onSizeDelta: (delta: number) => void;
  onPatchStyle: (patch: Partial<TextStyle>) => void;
  onClearStyle: () => void;
  onSettings: (patch: Partial<MatchingPicturesData['settings']>) => void;
  onAddParagraph: () => void;
  onSmartPaste: () => void;
  onAutoFit: () => void;
  fitting: boolean;
  onShuffle: () => void;
  onInsertExercise: () => void;
  onUploadImages: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGallery: () => void;
  onDuplicate: () => void;
  onDelete?: () => void;
  renderMoreSection: (key: MatchingMoreKey) => React.ReactNode;
  /** Chế độ Preview: chỉ xem, mọi công cụ chỉnh sửa bị khóa */
  locked?: boolean;
}

/** Thanh công cụ Matching Pictures: chỉ khai báo nhóm/nút, phần giao diện do EditorToolbar (dùng chung) lo. */
export const MatchingToolbar: React.FC<Props> = ({
  data, selKey, onSelKey, curStyle, defaults, onFlag, onSizeDelta, onPatchStyle, onClearStyle,
  onSettings, onAddParagraph, onSmartPaste, onAutoFit, fitting, onShuffle, onInsertExercise,
  onUploadImages, onGallery, onDuplicate, onDelete, renderMoreSection, locked = false,
}) => {
  const { settings } = data;
  const bold = curStyle?.bold ?? defaults.bold;
  const italic = curStyle?.italic ?? defaults.italic;
  const size = curStyle?.sizePt ?? defaults.size;
  const color = curStyle?.color ?? '#111111';
  const hasStyle = !!curStyle && Object.keys(curStyle).length > 0;
  const el = TEXT_STYLE_LABELS[selKey];
  const toggleAlign = (a: 'left' | 'center' | 'right') => onPatchStyle({ align: curStyle?.align === a ? undefined : a });

  const groups: ToolbarGroup[] = [
    {
      id: 'text', label: 'Text',
      items: [
        { type: 'select', id: 'el', label: 'Chọn thành phần cần định dạng', value: selKey, options: (Object.keys(TEXT_STYLE_LABELS) as TextStyleKey[]).map((k) => ({ value: k, label: TEXT_STYLE_LABELS[k] })), onChange: (v) => onSelKey(v as TextStyleKey), widthClass: 'w-36' },
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
            { title: 'Khoảng cách đoạn', value: settings.paragraphSpacing, options: [{ value: 'compact', label: 'Compact' }, { value: 'normal', label: 'Normal' }, { value: 'spacious', label: 'Spacious' }], onChange: (v) => onSettings({ paragraphSpacing: v as MatchingPicturesData['settings']['paragraphSpacing'] }) },
          ],
        },
        { type: 'button', id: 'clear', icon: RemoveFormatting, label: `Clear formatting – xóa định dạng ${el}`, disabled: !hasStyle, disabledReason: `${el} chưa có định dạng riêng`, onClick: onClearStyle },
      ],
    },
    {
      id: 'exercise', label: 'Exercise Tools',
      items: [
        { type: 'button', id: 'addp', icon: Plus, label: 'Add paragraph – thêm đoạn văn', onClick: onAddParagraph },
        { type: 'button', id: 'paste', icon: ClipboardPaste, label: 'Smart Paste – dán văn bản, tự tách thành các đoạn', onClick: onSmartPaste },
        { type: 'button', id: 'shuffle', icon: Shuffle, label: 'Shuffle images – xáo trộn thứ tự ảnh', disabled: data.images.length < 2, disabledReason: 'Cần ít nhất 2 ảnh', onClick: onShuffle },
        { type: 'button', id: 'fit', icon: Minimize2, label: 'Auto fit to A4 – thu nhỏ để vừa một trang', disabled: fitting, disabledReason: 'Đang thu nhỏ…', onClick: onAutoFit },
        { type: 'button', id: 'exercise', icon: FilePlus2, label: 'Insert exercise – lưu bài này và chọn dạng bài mới trong thư mục', onClick: onInsertExercise },
      ],
    },
    {
      id: 'insert', label: 'Insert',
      items: [
        { type: 'file', id: 'upload', icon: ImageIcon, label: 'Insert images – tải ảnh từ máy (có thể chọn nhiều ảnh)', accept: 'image/*', multiple: true, onFile: onUploadImages },
        { type: 'button', id: 'gallery', icon: Images, label: 'Gallery – chọn ảnh từ thư viện', onClick: onGallery },
        { type: 'button', id: 'labels', icon: Tag, label: settings.showImageLabels ? 'Image labels – đang hiện nhãn A, B, C…, bấm để ẩn' : 'Image labels – hiện nhãn A, B, C… trên ảnh', active: settings.showImageLabels, onClick: () => onSettings({ showImageLabels: !settings.showImageLabels }) },
        { type: 'button', id: 'captions', icon: Captions, label: settings.showImageCaptions ? 'Captions – đang hiện chú thích ảnh, bấm để ẩn' : 'Captions – hiện chú thích dưới ảnh', active: settings.showImageCaptions, onClick: () => onSettings({ showImageCaptions: !settings.showImageCaptions }) },
      ],
    },
    {
      id: 'layout', label: 'Page & Layout',
      items: [
        {
          type: 'layout', id: 'layout', value: settings.layout, onChange: (id) => onSettings({ layout: id as MatchingPicturesLayoutId }),
          options: MATCHING_PICTURES_LAYOUTS.map((l) => ({ id: l.id, label: l.label, desc: l.desc, thumb: <MatchingLayoutThumbnail layout={l.id} className="w-full h-14" /> })),
        },
        {
          type: 'options', id: 'columns', icon: Columns3, label: 'Image columns – số cột ảnh',
          sections: [{ value: settings.imageColumns, options: COLUMN_OPTIONS, onChange: (v) => onSettings({ imageColumns: v as 1 | 2 | 3 | 'auto' }) }],
        },
        { type: 'button', id: 'pagebreak', icon: FilePlus, label: settings.pageBreakBefore ? 'Page break – bài này đang bắt đầu ở trang mới, bấm để bỏ' : 'Page break – bắt đầu bài này ở một trang mới', active: settings.pageBreakBefore, onClick: () => onSettings({ pageBreakBefore: !settings.pageBreakBefore }) },
        { type: 'button', id: 'answer', icon: Rows3, label: settings.showAnswerArea ? 'Answer area – đang hiện ô trả lời, bấm để ẩn' : 'Answer area – hiện ô trả lời cho học sinh', active: settings.showAnswerArea, onClick: () => onSettings({ showAnswerArea: !settings.showAnswerArea }) },
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
