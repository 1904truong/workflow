import React from 'react';
import {
  ListFilter,
  Plus, ClipboardPaste, FilePlus2, FilePlus, Ellipsis, SlidersHorizontal, Copy, Trash2, ALargeSmall, Hash, Contrast, SquareDashed, Scissors, BookText,
} from 'lucide-react';
import type { MatchingData, MatchingLayoutId } from '../../services/matching/matchingCore';
import { type ToolbarGroup } from '../shared/toolbar/EditorToolbar';
import { RibbonToolbar, type RibbonShell } from '../shared/toolbar/RibbonToolbar';

export type MiMoreKey = 'typography' | 'advanced';
const MORE_SETTINGS: { key: MiMoreKey; label: string }[] = [
  { key: 'typography', label: 'Typography Defaults' },
  { key: 'advanced', label: 'Advanced Worksheet Settings' },
];

export interface MiLayoutMeta {
  id: MatchingLayoutId;
  label: string;
  desc: string;
}

const SPACINGS: { value: MatchingData['settings']['lineSpacing']; label: string }[] = [
  { value: 'compact', label: 'Gọn' },
  { value: 'normal', label: 'Vừa' },
  { value: 'spacious', label: 'Rộng' },
];
const COLUMN_GAPS = [8, 10, 14, 20, 28, 34];

/** Hình thu nhỏ trong menu chọn layout */
const Thumb: React.FC<{ id: MatchingLayoutId }> = ({ id }) => {
  const frame = 'w-full h-14 p-1.5 bg-slate-50 border border-slate-300 rounded flex items-stretch gap-1.5';
  const col = (cls = '') => (
    <div className={`flex-1 flex flex-col justify-between py-0.5 ${cls}`}>
      {[0, 1, 2].map((i) => <span key={i} className="block h-0.5 bg-slate-400 rounded" />)}
    </div>
  );
  if (id === 'facing_tables') {
    return <div className={frame}><div className="flex-1 flex flex-col">{[0, 1, 2].map((i) => <span key={i} className="flex-1 border border-orange-400 -mt-px" />)}</div><span className="w-2" /><div className="flex-1 flex flex-col">{[0, 1, 2].map((i) => <span key={i} className="flex-1 border border-orange-400 -mt-px" />)}</div></div>;
  }
  if (id === 'reading_images') {
    return <div className={`${frame} flex-col`}><div className="flex gap-1 flex-1"><div className="flex-1 space-y-1 pt-0.5">{[0, 1, 2].map((i) => <span key={i} className="block h-0.5 bg-slate-400 rounded" />)}</div><span className="w-6 bg-slate-300 rounded-sm" /></div><div className="flex gap-1.5 flex-1">{col()}{col()}</div></div>;
  }
  if (id === 'answer_table') {
    return <div className={`${frame} flex-col gap-0.5`}><div className="flex gap-0.5">{[0, 1, 2, 3].map((i) => <span key={i} className="flex-1 h-2.5 border border-slate-400" />)}</div><div className="flex gap-0.5">{[0, 1, 2, 3].map((i) => <span key={i} className="flex-1 h-2.5 border border-slate-400" />)}</div></div>;
  }
  if (id === 'image_matching') {
    return <div className={frame}><div className="flex-1 flex flex-col justify-between">{[0, 1, 2].map((i) => <span key={i} className="h-2.5 w-4 bg-slate-300 rounded-sm" />)}</div><div className="flex-1 flex flex-col justify-between">{[0, 1, 2].map((i) => <span key={i} className="block h-0.5 bg-slate-400 rounded" />)}</div></div>;
  }
  const dots = id === 'connect_lines';
  return (
    <div className={frame}>
      {col()}
      {dots && <div className="w-3 flex flex-col justify-between py-0.5">{[0, 1, 2].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-slate-700" />)}</div>}
      {col()}
    </div>
  );
};

interface Props {
  data: MatchingData;
  layouts: MiLayoutMeta[];
  onSettings: (patch: Partial<MatchingData['settings']>) => void;
  onLayout: (id: MatchingLayoutId) => void;
  pageBreakBefore: boolean;
  onPageBreak: () => void;
  onAddProblem: () => void;
  onAddSolution: () => void;
  onAddReading: () => void;
  onSmartPaste: () => void;
  onInsertExercise: () => void;
  onDuplicate: () => void;
  onDelete?: () => void;
  renderMoreSection: (key: MiMoreKey) => React.ReactNode;
  shell?: RibbonShell;
  locked?: boolean;
}

/** Thanh công cụ Matching Information / Draw Lines and Match: cùng bộ nhóm với các dạng bài khác. */
export const MatchingInfoToolbar: React.FC<Props> = ({
  data, layouts, onSettings, onLayout,
  pageBreakBefore, onPageBreak, onAddProblem, onAddSolution, onAddReading, onSmartPaste, onInsertExercise, onDuplicate, onDelete, renderMoreSection, locked = false, shell,
}) => {
  const { settings } = data;
  const groups: ToolbarGroup[] = [
    {
      id: 'text', label: 'Text',
      items: [
        { type: 'button', id: 'smaller', icon: ALargeSmall, text: '−', label: 'Giảm cỡ chữ của các mục', onClick: () => onSettings({ fontSizePt: Math.max(8, settings.fontSizePt - 0.5) }) },
        { type: 'text', id: 'size', text: String(settings.fontSizePt), title: 'Cỡ chữ hiện tại của các mục (pt)' },
        { type: 'button', id: 'bigger', icon: ALargeSmall, text: '+', label: 'Tăng cỡ chữ của các mục', onClick: () => onSettings({ fontSizePt: Math.min(16, settings.fontSizePt + 0.5) }) },
      ],
    },
    {
      id: 'paragraph', label: 'Paragraph',
      items: [
        {
          type: 'options', id: 'spacing', icon: ListFilter, label: 'Line spacing – giãn dòng và khoảng cách giữa hai cột', closeOnSelect: false, widthClass: 'w-44',
          sections: [
            { title: 'Giãn dòng', value: settings.lineSpacing, options: SPACINGS, onChange: (v) => onSettings({ lineSpacing: v as MatchingData['settings']['lineSpacing'] }) },
            { title: 'Khoảng cách hai cột (mm)', value: settings.columnGapMm, options: COLUMN_GAPS.map((g) => ({ value: g, label: `${g} mm` })), onChange: (v) => onSettings({ columnGapMm: v as number }) },
          ],
        },
      ],
    },
    {
      id: 'exercise', label: 'Exercise Tools',
      items: [
        { type: 'button', id: 'addp', icon: Plus, text: 'P', label: 'Add problem – thêm một mục cột trái (1, 2, 3…)', onClick: onAddProblem },
        { type: 'button', id: 'adds', icon: Plus, text: 'S', label: 'Add solution – thêm một mục cột phải (a, b, c…)', onClick: onAddSolution },
        ...(data.layout === 'reading_images' ? [{ type: 'button' as const, id: 'addr', icon: BookText, label: 'Add reading block – thêm một đoạn đọc có ảnh', onClick: onAddReading }] : []),
        { type: 'button', id: 'paste', icon: ClipboardPaste, label: 'Smart Paste – dán cả bài, chọn layout, đọc từ ảnh hoặc để AI viết lại đúng định dạng', onClick: onSmartPaste },
        { type: 'button', id: 'exercise', icon: FilePlus2, label: 'Insert exercise – lưu bài này và chọn dạng bài mới trong thư mục', onClick: onInsertExercise },
      ],
    },
    {
      id: 'insert', label: 'Insert',
      items: [
        { type: 'button', id: 'numbering', icon: Hash, label: settings.showNumbering ? 'Numbering – đang hiện số / chữ cái, bấm để ẩn' : 'Numbering – hiện số / chữ cái', active: settings.showNumbering, onClick: () => onSettings({ showNumbering: !settings.showNumbering }) },
        { type: 'button', id: 'boxes', icon: SquareDashed, label: settings.showAnswerBoxes ? 'Answer boxes – đang hiện ô trả lời, bấm để ẩn' : 'Answer boxes – hiện ô trả lời', active: settings.showAnswerBoxes, onClick: () => onSettings({ showAnswerBoxes: !settings.showAnswerBoxes }) },
        { type: 'button', id: 'gray', icon: Contrast, label: settings.grayscale ? 'Grayscale – đang in đen trắng, bấm để về màu' : 'Grayscale – in đen trắng (viền và ảnh)', active: settings.grayscale, onClick: () => onSettings({ grayscale: !settings.grayscale }) },
        ...(data.layout === 'cut_paste' ? [{ type: 'button' as const, id: 'cut', icon: Scissors, label: settings.cutMode === 'cut' ? 'Cut & Paste – đang cắt dán thẻ, bấm để chuyển sang viết chữ cái' : 'Cut & Paste – đang viết chữ cái, bấm để chuyển sang cắt dán thẻ', active: settings.cutMode === 'cut', onClick: () => onSettings({ cutMode: settings.cutMode === 'cut' ? 'write' : 'cut' }) }] : []),
      ],
    },
    {
      id: 'layout', label: 'Page & Layout',
      items: [
        {
          type: 'layout', id: 'layout', value: data.layout, onChange: (id) => onLayout(id as MatchingLayoutId),
          options: layouts.map((l) => ({ id: l.id, label: l.label, desc: l.desc, thumb: <Thumb id={l.id} /> })),
        },
        { type: 'button', id: 'pagebreak', icon: FilePlus, label: pageBreakBefore ? 'Page break – bài này đang bắt đầu ở trang mới, bấm để bỏ' : 'Page break – bắt đầu bài này ở một trang mới', active: pageBreakBefore, onClick: onPageBreak },
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
