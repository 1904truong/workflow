import React from 'react';
import {
  Bold, Italic, Underline, Strikethrough, Baseline, AlignLeft, AlignCenter, AlignRight,
  ListFilter, RemoveFormatting, Plus, ClipboardPaste, FileUp, Sparkles, Shuffle, FilePlus2, ListOrdered, Square,
  SeparatorVertical, FilePlus, Ellipsis, SlidersHorizontal, Copy, Trash2, ALargeSmall,
} from 'lucide-react';
import type { TextStyle } from '../../services/matching-pictures/matchingPicturesCore';
import type { MatchingVocabularyData, VocabStyleKey } from '../../services/matching-vocabulary/matchingVocabularyCore';
import { VOCAB_LAYOUTS, VOCAB_STYLE_LABELS } from '../../services/matching-vocabulary/matchingVocabularyCore';
import { EditorToolbar, type ToolbarGroup } from '../shared/toolbar/EditorToolbar';

export type VocabMoreKey = 'typography' | 'advanced';
const MORE_SETTINGS: { key: VocabMoreKey; label: string }[] = [
  { key: 'typography', label: 'Typography Defaults' },
  { key: 'advanced', label: 'Advanced Worksheet Settings' },
];

const FONTS = ['Arial', 'Times New Roman', 'Quicksand', 'Roboto', 'Inter'];
const LINE_HEIGHTS = [1.2, 1.3, 1.4, 1.5, 1.6, 1.75, 2];
const ROW_GAPS = [3, 4, 5, 6, 8, 10];

interface Props {
  data: MatchingVocabularyData;
  selKey: VocabStyleKey;
  onSelKey: (k: VocabStyleKey) => void;
  curStyle?: TextStyle;
  defaults: { bold: boolean; italic: boolean; size: number };
  onFlag: (flag: 'bold' | 'italic' | 'underline' | 'strike') => void;
  onSizeDelta: (delta: number) => void;
  onPatchStyle: (patch: Partial<TextStyle>) => void;
  onClearStyle: () => void;
  onSettings: (patch: Partial<MatchingVocabularyData['settings']>) => void;
  onAddWord: () => void;
  onAddDefinition: () => void;
  onImport: () => void;
  onSmartPaste: () => void;
  onSmartAI: () => void;
  onShuffleDefinitions: () => void;
  onInsertExercise: () => void;
  onDuplicate: () => void;
  onDelete?: () => void;
  renderMoreSection: (key: VocabMoreKey) => React.ReactNode;
  locked?: boolean;
}

/** Thanh công cụ Matching Vocabulary: cùng bộ nhóm với Matching Pictures, chỉ đổi nút theo hai cột Word / Definition. */
export const MatchingVocabularyToolbar: React.FC<Props> = ({
  data, selKey, onSelKey, curStyle, defaults, onFlag, onSizeDelta, onPatchStyle, onClearStyle, onSettings,
  onAddWord, onAddDefinition, onImport, onSmartPaste, onSmartAI, onShuffleDefinitions, onInsertExercise, onDuplicate, onDelete,
  renderMoreSection, locked = false,
}) => {
  const { settings } = data;
  const bold = curStyle?.bold ?? defaults.bold;
  const italic = curStyle?.italic ?? defaults.italic;
  const size = curStyle?.sizePt ?? defaults.size;
  const color = curStyle?.color ?? '#111111';
  const hasStyle = !!curStyle && Object.keys(curStyle).length > 0;
  const el = VOCAB_STYLE_LABELS[selKey];
  const toggleAlign = (a: 'left' | 'center' | 'right') => onPatchStyle({ align: curStyle?.align === a ? undefined : a });

  const groups: ToolbarGroup[] = [
    {
      id: 'text', label: 'Text',
      items: [
        { type: 'select', id: 'el', label: 'Chọn thành phần cần định dạng', value: selKey, options: (Object.keys(VOCAB_STYLE_LABELS) as VocabStyleKey[]).map((k) => ({ value: k, label: VOCAB_STYLE_LABELS[k] })), onChange: (v) => onSelKey(v as VocabStyleKey), widthClass: 'w-36' },
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
            { title: 'Khoảng cách giữa các hàng (mm)', value: settings.rowGapMm, options: ROW_GAPS.map((g) => ({ value: g, label: `${g} mm` })), onChange: (v) => onSettings({ rowGapMm: v as number }) },
          ],
        },
        { type: 'button', id: 'clear', icon: RemoveFormatting, label: `Clear formatting – xóa định dạng ${el}`, disabled: !hasStyle, disabledReason: `${el} chưa có định dạng riêng`, onClick: onClearStyle },
      ],
    },
    {
      id: 'exercise', label: 'Exercise Tools',
      items: [
        { type: 'button', id: 'addw', icon: Plus, text: 'W', label: 'Add word – thêm một từ vào cột Word', onClick: onAddWord },
        { type: 'button', id: 'addd', icon: Plus, text: 'D', label: 'Add definition – thêm một định nghĩa vào cột Definition', onClick: onAddDefinition },
        { type: 'button', id: 'import', icon: FileUp, label: 'Import – nhập nhanh các cặp “từ – định nghĩa”', onClick: onImport },
        { type: 'button', id: 'ai', icon: Sparkles, label: 'Smart AI – dán văn bản bất kỳ, tự tách hai cột và chọn layout phù hợp', onClick: onSmartAI },
        { type: 'button', id: 'paste', icon: ClipboardPaste, label: 'Smart Paste – dán văn bản có đánh số 1., 2. và a., b.', onClick: onSmartPaste },
        { type: 'button', id: 'shuffle', icon: Shuffle, label: 'Shuffle definitions – xáo trộn thứ tự định nghĩa', disabled: data.definitions.length < 2, disabledReason: 'Cần ít nhất 2 định nghĩa', onClick: onShuffleDefinitions },
        { type: 'button', id: 'exercise', icon: FilePlus2, label: 'Insert exercise – lưu bài này và chọn dạng bài mới trong thư mục', onClick: onInsertExercise },
      ],
    },
    {
      id: 'insert', label: 'Insert',
      items: [
        { type: 'button', id: 'boxes', icon: Square, label: settings.showAnswerBoxes ? 'Answer boxes – đang hiện ô trả lời, bấm để ẩn' : 'Answer boxes – hiện ô trả lời cho học sinh', active: settings.showAnswerBoxes, onClick: () => onSettings({ showAnswerBoxes: !settings.showAnswerBoxes }) },
        { type: 'button', id: 'numbering', icon: ListOrdered, label: settings.showNumbering ? 'Numbering – đang hiện số 1., a., bấm để ẩn' : 'Numbering – hiện số thứ tự 1., 2. và a., b.', active: settings.showNumbering, onClick: () => onSettings({ showNumbering: !settings.showNumbering }) },
        { type: 'button', id: 'divider', icon: SeparatorVertical, label: settings.showDivider ? 'Divider – đang hiện đường kẻ giữa hai cột, bấm để ẩn' : 'Divider – hiện đường kẻ giữa hai cột', active: settings.showDivider, onClick: () => onSettings({ showDivider: !settings.showDivider }) },
      ],
    },
    {
      id: 'layout', label: 'Page & Layout',
      items: [
        {
          type: 'layout', id: 'layout', value: settings.layout, onChange: (id) => onSettings({ layout: id as MatchingVocabularyData['settings']['layout'] }),
          options: VOCAB_LAYOUTS.map((l) => ({
            id: l.id, label: l.label, desc: l.desc,
            thumb: (
              <div className="w-full h-14 p-1.5 bg-slate-50 border border-slate-300 rounded flex gap-1.5">
                <div className="flex-1 space-y-1">{[0, 1, 2, 3].map((i) => <div key={i} className="flex items-center gap-1"><span className="h-0.5 flex-1 bg-slate-400 rounded" />{l.id !== 'plain_list' && <span className="w-1.5 h-1.5 border border-slate-500 rounded-xs" />}</div>)}</div>
                {l.id !== 'plain_list' && <span className="w-px bg-slate-300" />}
                <div className="flex-1 space-y-1">{[0, 1, 2, 3].map((i) => <span key={i} className="block h-0.5 bg-slate-400 rounded" />)}</div>
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
