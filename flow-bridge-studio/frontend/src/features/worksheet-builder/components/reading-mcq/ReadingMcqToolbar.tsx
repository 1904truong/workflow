import React from 'react';
import {
  Bold, Italic, Underline, Strikethrough, Baseline, AlignLeft, AlignCenter, AlignRight, ListFilter, RemoveFormatting,
  Plus, ListPlus, FileUp, ClipboardPaste, Shuffle, FilePlus2, ListOrdered, Square, CaseUpper, Columns3, FilePlus,
  Ellipsis, SlidersHorizontal, Copy, Trash2, ALargeSmall, ImageIcon, AlignJustify, Palette,
} from 'lucide-react';
import type { TextStyle } from '../../services/matching-pictures/matchingPicturesCore';
import type { McqLayoutId } from '../../services/grammar-mcq/grammarMcqCore';
import type { ReadingMcqData } from '../../services/reading-mcq/readingMcqCore';
import { READING_MCQ_LAYOUTS, READING_STYLE_LABELS as MCQ_STYLE_LABELS, type ReadingStyleKey as McqStyleKey } from '../../services/reading-mcq/readingMcqCore';
import { type ToolbarGroup } from '../shared/toolbar/EditorToolbar';
import { RibbonToolbar, type RibbonShell } from '../shared/toolbar/RibbonToolbar';

export type McqMoreKey = 'typography' | 'advanced';
const MORE_SETTINGS: { key: McqMoreKey; label: string }[] = [
  { key: 'typography', label: 'Typography Defaults' },
  { key: 'advanced', label: 'Advanced Worksheet Settings' },
];

const FONTS = ['Arial', 'Times New Roman', 'Quicksand', 'Roboto', 'Inter'];
const LINE_HEIGHTS = [1.2, 1.3, 1.4, 1.5, 1.6, 1.75, 2];
const GAPS = [1.5, 2.5, 3.5, 5, 6, 8];
const COLUMNS: { value: ReadingMcqData['settings']['optionColumns']; label: string }[] = [
  { value: 'auto', label: 'Tự động' },
  { value: 1, label: '1 cột' },
  { value: 2, label: '2 cột' },
  { value: 4, label: '4 cột (1 hàng)' },
];

/** Hình thu nhỏ mô tả từng layout trong bảng chọn */
const Thumb: React.FC<{ id: McqLayoutId }> = ({ id }) => {
  const line = <span className="block h-0.5 bg-slate-400 rounded" />;
  const opt = <div className="grid grid-cols-2 gap-x-1 gap-y-px pl-1">{[0, 1, 2, 3].map((i) => <span key={i} className="block h-px bg-slate-300" />)}</div>;
  const box = 'w-full h-14 p-1.5 bg-slate-50 border border-slate-300 rounded';
  switch (id) {
    case 'pictures':
      return <div className={`${box} space-y-1`}>{[0, 1].map((r) => <div key={r}>{line}<div className="grid grid-cols-3 gap-1 mt-0.5">{[0, 1, 2].map((j) => <span key={j} className="block h-2.5 bg-sky-300 rounded-xs" />)}</div></div>)}</div>;
    case 'two_columns':
      return <div className={`${box} flex gap-1.5`}>{[0, 1].map((c) => <div key={c} className="flex-1 space-y-1">{line}{opt}{line}{opt}</div>)}</div>;
    case 'compact':
      return <div className={`${box} space-y-0.5`}>{[0, 1, 2, 3].map((i) => <div key={i}>{line}<div className="flex gap-1 pl-1 mt-px">{[0, 1, 2, 3].map((j) => <span key={j} className="block h-px flex-1 bg-slate-300" />)}</div></div>)}</div>;
    case 'answer_grid':
      return <div className={`${box} grid grid-cols-5 gap-px bg-slate-300 p-px`}>{Array.from({ length: 15 }).map((_, i) => <span key={i} className="bg-white" />)}</div>;
    case 'question_blocks':
      return <div className={`${box} space-y-1`}>{[0, 1].map((i) => <div key={i} className="border border-slate-300 rounded-sm bg-white p-0.5">{line}{opt}</div>)}</div>;
    case 'exam_style':
      return <div className={`${box} space-y-1`}>{[0, 1, 2].map((i) => <div key={i}><div className="flex items-center gap-0.5"><span className="w-2 h-1.5 border border-slate-500 rounded-xs" />{line}</div><div className="flex gap-1 pl-3 mt-px">{[0, 1, 2, 3].map((j) => <span key={j} className="block h-px flex-1 bg-slate-300" />)}</div></div>)}</div>;
    case 'comic_story':
      return (
        <div className={`${box} flex gap-1 p-1`}>
          <div className="w-1/2 h-full bg-amber-100 border border-amber-300 rounded-xs flex items-center justify-center text-[7px] text-amber-800 font-bold">
            Comic
          </div>
          <div className="w-1/2 flex flex-col justify-between py-0.5 space-y-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-0.5">
                <span className="block h-0.5 w-3/4 bg-slate-500 rounded" />
                <span className="block h-px w-full border-b border-dashed border-slate-400" />
              </div>
            ))}
          </div>
        </div>
      );
    case 'original':
    default:
      return <div className={`${box} space-y-1`}>{[0, 1].map((i) => <div key={i}>{line}{opt}</div>)}</div>;
  }
};

interface Props {
  data: ReadingMcqData;
  selKey: McqStyleKey;
  onSelKey: (k: McqStyleKey) => void;
  curStyle?: TextStyle;
  defaults: { bold: boolean; italic: boolean; size: number };
  onFlag: (flag: 'bold' | 'italic' | 'underline' | 'strike') => void;
  onSizeDelta: (delta: number) => void;
  onPatchStyle: (patch: Partial<TextStyle>) => void;
  onClearStyle: () => void;
  onSettings: (patch: Partial<ReadingMcqData['settings']>) => void;
  hasSelectedQuestion: boolean;
  onAddQuestion: () => void;
  onAddOption: () => void;
  onImport: () => void;
  onSmartPaste: () => void;
  onShuffleOptions: () => void;
  onInsertExercise: () => void;
  onDuplicate: () => void;
  onDelete?: () => void;
  renderMoreSection: (key: McqMoreKey) => React.ReactNode;
  /** Lưu / xuất Word / in / zoom / undo của editor, dùng cho các menu File, Edit, View của thanh công cụ */
  shell?: RibbonShell;
  locked?: boolean;
}

/** Thanh công cụ Reading Multiple Choice: cùng bộ nhóm với các bài khác, khai báo bằng EditorToolbar dùng chung. */
export const ReadingMcqToolbar: React.FC<Props> = ({
  data, selKey, onSelKey, curStyle, defaults, onFlag, onSizeDelta, onPatchStyle, onClearStyle, onSettings,
  hasSelectedQuestion, onAddQuestion, onAddOption, onImport, onSmartPaste, onShuffleOptions, onInsertExercise,
  onDuplicate, onDelete, renderMoreSection, locked = false, shell,
}) => {
  const { settings } = data;
  const bold = curStyle?.bold ?? defaults.bold;
  const italic = curStyle?.italic ?? defaults.italic;
  const size = curStyle?.sizePt ?? defaults.size;
  const color = curStyle?.color ?? '#111111';
  const hasStyle = !!curStyle && Object.keys(curStyle).length > 0;
  const el = MCQ_STYLE_LABELS[selKey];
  const toggleAlign = (a: 'left' | 'center' | 'right') => onPatchStyle({ align: curStyle?.align === a ? undefined : a });

  const groups: ToolbarGroup[] = [
    {
      id: 'text', label: 'Text',
      items: [
        { type: 'select', id: 'el', label: 'Chọn thành phần cần định dạng', value: selKey, options: (Object.keys(MCQ_STYLE_LABELS) as McqStyleKey[]).map((k) => ({ value: k, label: MCQ_STYLE_LABELS[k] })), onChange: (v) => onSelKey(v as McqStyleKey), widthClass: 'w-36' },
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
            { title: 'Khoảng cách giữa các câu (mm)', value: settings.questionGapMm, options: GAPS.map((g) => ({ value: g, label: `${g} mm` })), onChange: (v) => onSettings({ questionGapMm: v as number }) },
          ],
        },
        { type: 'button', id: 'clear', icon: RemoveFormatting, label: `Clear formatting – xóa định dạng ${el}`, disabled: !hasStyle, disabledReason: `${el} chưa có định dạng riêng`, onClick: onClearStyle },
      ],
    },
    {
      id: 'exercise', label: 'Exercise Tools',
      items: [
        { type: 'button', id: 'addq', icon: Plus, label: 'Add question – thêm một câu hỏi', onClick: onAddQuestion },
        { type: 'button', id: 'addo', icon: ListPlus, label: 'Add option – thêm một lựa chọn cho câu đang chọn', disabled: !hasSelectedQuestion, disabledReason: 'Chọn một câu ở danh sách bên trái', onClick: onAddOption },
        { type: 'button', id: 'import', icon: FileUp, label: 'Import – nhập nhanh danh sách câu (mỗi dòng một câu)', onClick: onImport },
        { type: 'button', id: 'paste', icon: ClipboardPaste, label: 'Smart Paste – dán câu hỏi kèm lựa chọn a, b, c, d', onClick: onSmartPaste },
        { type: 'button', id: 'shuffle', icon: Shuffle, label: 'Shuffle options – xáo trộn thứ tự lựa chọn của câu đang chọn', disabled: !hasSelectedQuestion, disabledReason: 'Chọn một câu ở danh sách bên trái', onClick: onShuffleOptions },
        { type: 'button', id: 'exercise', icon: FilePlus2, label: 'Insert exercise – lưu bài này và chọn dạng bài mới trong thư mục', onClick: onInsertExercise },
      ],
    },
    {
      id: 'insert', label: 'Insert',
      items: [
        { type: 'button', id: 'img', icon: ImageIcon, label: settings.showPassageImage ? 'Article image – đang hiện ảnh bài báo, bấm để ẩn' : 'Article image – hiện ảnh bài báo ở góc phải bài đọc', active: settings.showPassageImage, onClick: () => onSettings({ showPassageImage: !settings.showPassageImage }) },
        { type: 'button', id: 'justify', icon: AlignJustify, label: settings.justifyPassage ? 'Justify – đang căn đều hai bên đoạn văn, bấm để căn trái' : 'Justify – căn đều hai bên đoạn văn', active: settings.justifyPassage, onClick: () => onSettings({ justifyPassage: !settings.justifyPassage }) },
        { type: 'button', id: 'numbering', icon: ListOrdered, label: settings.showNumbering ? 'Numbering – đang hiện số câu, bấm để ẩn' : 'Numbering – hiện số thứ tự câu', active: settings.showNumbering, onClick: () => onSettings({ showNumbering: !settings.showNumbering }) },
        { type: 'button', id: 'boxes', icon: Square, label: settings.showAnswerBoxes ? 'Answer boxes – đang hiện ô trả lời, bấm để ẩn' : 'Answer boxes – hiện ô trả lời cạnh mỗi câu', active: settings.showAnswerBoxes, onClick: () => onSettings({ showAnswerBoxes: !settings.showAnswerBoxes }) },
        { type: 'button', id: 'case', icon: CaseUpper, label: settings.optionLabelStyle === 'uppercase' ? 'Option labels – đang dùng A. B. C. D., bấm để đổi sang a. b. c. d.' : 'Option labels – đang dùng a. b. c. d., bấm để đổi sang A. B. C. D.', active: settings.optionLabelStyle === 'uppercase', onClick: () => onSettings({ optionLabelStyle: settings.optionLabelStyle === 'uppercase' ? 'lowercase' : 'uppercase' }) },
      ],
    },
    {
      id: 'layout', label: 'Page & Layout',
      items: [
        {
          type: 'layout', id: 'layout', value: settings.layout, onChange: (id) => onSettings({ layout: id as McqLayoutId }),
          options: READING_MCQ_LAYOUTS.map((l) => ({ id: l.id, label: l.label, desc: l.desc, thumb: <Thumb id={l.id} /> })),
        },
        {
          type: 'options', id: 'columns', icon: Columns3, label: 'Option columns – số cột lựa chọn',
          sections: [{ value: settings.optionColumns, options: COLUMNS, onChange: (v) => onSettings({ optionColumns: v as ReadingMcqData['settings']['optionColumns'] }) }],
        },
        { type: 'button', id: 'pagebreak', icon: FilePlus, label: settings.pageBreakBefore ? 'Page break – bài này đang bắt đầu ở trang mới, bấm để bỏ' : 'Page break – bắt đầu bài này ở một trang mới', active: settings.pageBreakBefore, onClick: () => onSettings({ pageBreakBefore: !settings.pageBreakBefore }) },
        ...(settings.layout === 'comic_story' ? [
          {
            type: 'button' as const,
            id: 'themeColor',
            icon: Palette,
            label: settings.themeColor === 'orange' ? 'Màu chủ đề: Cam (Orange) – bấm để đổi sang Navy' : 'Màu chủ đề: Xanh Navy – bấm để đổi sang Cam',
            active: settings.themeColor === 'orange',
            onClick: () => onSettings({ themeColor: settings.themeColor === 'orange' ? 'navy' : 'orange' }),
          },
          {
            type: 'button' as const,
            id: 'linesCount',
            icon: Square,
            label: `Dòng kẻ trả lời: ${settings.answerLineCount || 1} dòng – bấm để đổi 1/2 dòng`,
            active: (settings.answerLineCount || 1) > 1,
            onClick: () => onSettings({ answerLineCount: (settings.answerLineCount || 1) === 1 ? 2 : 1 }),
          },
        ] : []),
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
