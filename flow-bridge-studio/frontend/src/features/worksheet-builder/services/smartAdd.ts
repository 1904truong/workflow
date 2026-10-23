// Smart ở màn hình "Add exercise": giáo viên dán đề hoặc đưa ảnh, chọn (hoặc để AI chọn) dạng bài + layout, bấm Phân tích
// -> sinh sẵn dữ liệu cho trình soạn của dạng bài đó. Chỉ gồm các dạng bài đã có bộ đọc theo từng layout.

import type { ExerciseType } from '../types';
import {
  createSentenceCompletion, newSentenceId, parseSentenceCompletionText, SENTENCE_LAYOUTS, SENTENCE_PASTE_FORMATS,
  type SentenceCompletionData, type SentenceItem, type SentenceLayoutId,
} from './sentence-completion/sentenceCompletionCore.ts';

export type SmartTypeId = 'sentence_completion';

export interface SmartLayoutOption {
  id: string;
  label: string;
  desc: string;
  hint: string;
  example: string;
}

export interface SmartTypeOption {
  type: SmartTypeId;
  /** Tên dạng bài hiển thị và gửi cho AI */
  label: string;
  layouts: SmartLayoutOption[];
}

export const SMART_TYPES: SmartTypeOption[] = [
  {
    type: 'sentence_completion',
    label: 'Sentence Completion – Grammar Practice',
    layouts: SENTENCE_LAYOUTS.map((l) => ({ id: l.id, label: l.label, desc: l.desc, ...SENTENCE_PASTE_FORMATS[l.id] })),
  },
];

/** Khi để AI chọn cả dạng bài: id layout gửi cho AI có tiền tố dạng bài, ví dụ "sentence_completion:pos_neg" */
export const SMART_ID_SEP = ':';
export const smartLayoutKey = (type: SmartTypeId, layout: string): string => `${type}${SMART_ID_SEP}${layout}`;
export const splitSmartLayoutKey = (key: string): { type: SmartTypeId; layout: string } | null => {
  const i = key.indexOf(SMART_ID_SEP);
  if (i < 0) return null;
  const type = key.slice(0, i) as SmartTypeId;
  return SMART_TYPES.some((t) => t.type === type) ? { type, layout: key.slice(i + 1) } : null;
};

/** Danh sách layout gửi cho AI khi để AI chọn cả dạng bài */
export const allSmartLayoutsForAi = (): SmartLayoutOption[] =>
  SMART_TYPES.flatMap((t) => t.layouts.map((l) => ({ ...l, id: smartLayoutKey(t.type, l.id), label: `${t.label} – ${l.label}` })));

export type SmartDraft = { type: 'sentence_completion'; data: SentenceCompletionData };

export interface SmartResult {
  ok: boolean;
  draft?: SmartDraft;
  /** Dạng bài mở trong trình soạn (khớp ExerciseType) */
  exerciseType?: ExerciseType;
  layout?: string;
  warnings: string[];
}

/** Hiện chỉ có Sentence Completion: dạng bài khác thêm vào SMART_TYPES khi có bộ đọc theo layout */
export const guessSmartType = (_text: string): SmartTypeId => 'sentence_completion';

/** Phân tích văn bản theo dạng bài + layout đã chọn (layout rỗng = tự đoán trong dạng bài đó) */
export const analyzeSmartText = (opts: { type?: SmartTypeId; layout?: string; text: string }): SmartResult => {
  const type = opts.type ?? guessSmartType(opts.text);
  const forced = SENTENCE_LAYOUTS.some((l) => l.id === opts.layout) ? (opts.layout as SentenceLayoutId) : undefined;
  const p = parseSentenceCompletionText(opts.text, forced);
  if (!p.ok) return { ok: false, warnings: p.warnings.length ? p.warnings : ['Không nhận ra câu nào.'] };
  const data = createSentenceCompletion({
    ...(p.title ? { exerciseTitle: p.title } : {}),
    targetWord: p.targetWord,
    ...(p.columnHeaders ? { columnHeaders: p.columnHeaders } : {}),
    words: p.words.map((text) => ({ id: newSentenceId(), text })),
    sentences: p.sentences.map((s): SentenceItem => ({ id: newSentenceId(), text: s.text, ...(s.hint ? { hint: s.hint } : {}), ...(s.starter ? { starter: s.starter } : {}) })),
    settings: { layout: p.layout, showWordBank: p.words.length > 0 } as SentenceCompletionData['settings'],
  });
  return { ok: true, draft: { type, data }, exerciseType: 'sentence_completion', layout: p.layout, warnings: p.warnings };
};
