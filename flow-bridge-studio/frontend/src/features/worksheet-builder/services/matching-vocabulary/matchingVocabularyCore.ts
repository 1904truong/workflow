// Dữ liệu và hàm thuần cho bài Matching Vocabulary: cột Word (trái) nối với cột Definition (phải).
// Dự án làm giáo trình: KHÔNG có đáp án, chỉ có nội dung hai cột và cách trình bày.

import { parseMatchingText } from '../matching/matchingCore.ts';
import type { TextStyle } from '../matching-pictures/matchingPicturesCore.ts';

export type VocabLayoutId = 'two_columns' | 'plain_list' | 'boxes_no_divider';

import type { AiImagePlan } from '../ai/imagePlanSchema.ts';

/** Layout sau này sẽ được thêm vào đây (mỗi layout: id, nhãn, mô tả) */
export interface VocabLayoutMeta {
  id: VocabLayoutId;
  label: string;
  desc: string;
  /** Layout có chỗ cho ảnh minh họa (dùng khi AI cho biết bài cần ảnh) */
  supportsImages?: boolean;
}

export const VOCAB_LAYOUTS: VocabLayoutMeta[] = [
  { id: 'two_columns', label: '1. Original (2 cột)', desc: 'Từ ở cột trái có ô trả lời, định nghĩa a, b, c… ở cột phải' },
  { id: 'plain_list', label: '2. Plain List (không ô trả lời)', desc: 'Danh sách gọn như giáo trình: 1. 2. 3. bên trái, a. b. c. bên phải, không ô vuông và không đường kẻ giữa' },
  { id: 'boxes_no_divider', label: '3. Boxes (không nét đứng)', desc: 'Giống Original nhưng bỏ đường kẻ dọc giữa ô trả lời và cột định nghĩa' },
];

export interface VocabItem {
  id: string;
  text: string;
}

export type VocabStyleKey = 'title' | 'instruction' | 'words' | 'definitions';
export const VOCAB_STYLE_LABELS: Record<VocabStyleKey, string> = {
  title: 'Tiêu đề bài',
  instruction: 'Hướng dẫn',
  words: 'Cột từ (Word)',
  definitions: 'Cột định nghĩa',
};
export type VocabTextStyles = Partial<Record<VocabStyleKey, TextStyle>>;

export interface MatchingVocabularySettings {
  layout: VocabLayoutId;
  fontFamily: string;
  fontSizePt: number;
  headingFontSizePt: number;
  lineHeight: number;
  rowGapMm: number;
  showNumbering: boolean;
  showAnswerBoxes: boolean;
  answerBoxSizeMm: number;
  showDivider: boolean;
  showExerciseTitle: boolean;
  showInstruction: boolean;
  pageBreakBefore: boolean;
}

export interface MatchingVocabularyData {
  /** Định dạng từng từ của các ô chữ sửa trên trang A4 (xem services/richFields.ts) */
  richMarks?: import('../richFields.ts').RichMarks;
  exerciseTitle: string;
  instruction: string;
  exerciseNumber?: number;
  notes?: string;
  words: VocabItem[];
  definitions: VocabItem[];
  textStyles?: VocabTextStyles;
  settings: MatchingVocabularySettings;
}

export const DEFAULT_VOCAB_SETTINGS: MatchingVocabularySettings = {
  layout: 'two_columns',
  fontFamily: 'Quicksand',
  fontSizePt: 12,
  headingFontSizePt: 14,
  lineHeight: 1.5,
  rowGapMm: 6,
  showNumbering: true,
  showAnswerBoxes: true,
  answerBoxSizeMm: 8,
  showDivider: true,
  showExerciseTitle: true,
  showInstruction: true,
  pageBreakBefore: false,
};

let counter = 0;
export const newVocabId = (prefix: string): string => {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
};

/** 0 -> a, 25 -> z, 26 -> aa */
export const definitionLabel = (index: number): string => {
  let n = index;
  let s = '';
  do {
    s = String.fromCharCode(97 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
};

export const createMatchingVocabulary = (partial?: Partial<MatchingVocabularyData>): MatchingVocabularyData => ({
  exerciseTitle: 'MATCH EACH WORD WITH ITS DEFINITION',
  instruction: 'Match each word with its definition.',
  words: [],
  definitions: [],
  ...partial,
  settings: { ...DEFAULT_VOCAB_SETTINGS, ...(partial?.settings || {}) },
});

// ───────────── Nhập nhanh ─────────────

export interface ParsedVocabulary {
  ok: boolean;
  title: string;
  words: string[];
  definitions: string[];
  warnings: string[];
}

/** Smart Paste: văn bản dạng "1. word … a. definition …" (dùng lại bộ tách của Matching) */
export const parseVocabularyText = (raw: string): ParsedVocabulary => {
  const p = parseMatchingText(raw);
  const warnings = p.warnings.filter((w) => !w.startsWith('Chữ cái'));
  return { ok: p.problems.length > 0 && p.solutions.length > 0, title: p.title, words: p.problems, definitions: p.solutions, warnings };
};

const SEPARATOR_RE = /\s*(?:\t|\s[-–—:]\s|\s*=\s*|:\s)\s*/;

/**
 * Import: mỗi dòng một cặp "từ – định nghĩa" (phân tách bằng Tab, " - ", " – ", ":" hoặc "=").
 * Định nghĩa có thể xáo trộn để thứ tự a, b, c không trùng thứ tự từ.
 */
export const parseVocabularyPairs = (raw: string, shuffle: boolean, random: () => number = Math.random): ParsedVocabulary => {
  const words: string[] = [];
  const defs: string[] = [];
  const warnings: string[] = [];
  raw.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean).forEach((line, i) => {
    const cleaned = line.replace(/^\s*(?:\d{1,3}\s*[.)]|[•*-])\s*/, '');
    const m = SEPARATOR_RE.exec(cleaned);
    if (!m || m.index <= 0 || m.index + m[0].length >= cleaned.length) {
      warnings.push(`Dòng ${i + 1} không có dấu phân tách từ – định nghĩa: "${line.slice(0, 40)}"`);
      return;
    }
    words.push(cleaned.slice(0, m.index).trim());
    defs.push(cleaned.slice(m.index + m[0].length).trim());
  });
  if (shuffle) {
    for (let i = defs.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [defs[i], defs[j]] = [defs[j], defs[i]];
    }
  }
  return { ok: words.length > 0, title: '', words, definitions: defs, warnings };
};

export const shuffleItems = <T,>(list: T[], random: () => number = Math.random): T[] => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export const moveVocabItem = <T,>(list: T[], from: number, to: number): T[] => {
  if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

export const validateVocabulary = (data: MatchingVocabularyData): { errors: string[]; warnings: string[] } => {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (data.words.length === 0) errors.push('Chưa có từ nào ở cột Word.');
  if (data.definitions.length === 0) errors.push('Chưa có định nghĩa nào ở cột Definition.');
  data.words.forEach((w, i) => { if (!w.text.trim()) errors.push(`Word ${i + 1} đang trống.`); });
  data.definitions.forEach((d, i) => { if (!d.text.trim()) errors.push(`Definition ${definitionLabel(i)} đang trống.`); });
  if (data.definitions.length < data.words.length) warnings.push('Số definition ít hơn số word.');
  return { errors, warnings };
};

// ───────────── Định dạng chữ theo từng thành phần ─────────────

export const setVocabStyle = (styles: VocabTextStyles | undefined, key: VocabStyleKey, patch: Partial<TextStyle>): VocabTextStyles => {
  const merged: TextStyle = { ...(styles?.[key] || {}), ...patch };
  (Object.keys(merged) as (keyof TextStyle)[]).forEach((k) => { if (merged[k] === undefined) delete merged[k]; });
  const next: VocabTextStyles = { ...(styles || {}) };
  if (Object.keys(merged).length === 0) delete next[key];
  else next[key] = merged;
  return next;
};

export const bumpVocabSize = (styles: VocabTextStyles | undefined, key: VocabStyleKey, base: number, delta: number): VocabTextStyles => {
  const cur = styles?.[key]?.sizePt ?? base;
  const next = Math.min(30, Math.max(7, Math.round((cur + delta) * 2) / 2));
  return setVocabStyle(styles, key, { sizePt: next });
};

// ───────────── Smart AI: tự nhận dạng định dạng + chọn layout ─────────────

export interface AutoParsedVocabulary extends ParsedVocabulary {
  /** Cách tách đã dùng, để báo cho giáo viên */
  method: 'numbered' | 'pairs' | 'none';
}

/** Thử tách theo "1. từ … a. định nghĩa"; không được thì thử từng dòng "từ – định nghĩa" (có xáo trộn định nghĩa) */
export const autoParseVocabulary = (raw: string, random: () => number = Math.random): AutoParsedVocabulary => {
  const numbered = parseVocabularyText(raw);
  if (numbered.ok) return { ...numbered, method: 'numbered' };
  const pairs = parseVocabularyPairs(raw, true, random);
  if (pairs.ok) return { ...pairs, method: 'pairs' };
  return { ...numbered, ok: false, method: 'none', warnings: [...numbered.warnings, ...pairs.warnings.slice(0, 2)] };
};

/**
 * Chọn layout trong các layout hiện có, dựa trên gợi ý của AI về bài (có cần ảnh không) và nội dung.
 * Khi thêm layout mới chỉ cần khai báo trong VOCAB_LAYOUTS (đặt `supportsImages` nếu có chỗ cho ảnh).
 */
export const decideVocabLayout = (
  plan: AiImagePlan | null | undefined,
  current: VocabLayoutId,
  layouts: VocabLayoutMeta[] = VOCAB_LAYOUTS,
): { layout: VocabLayoutId; reason: string } => {
  const ex = plan?.exercises[0];
  if (plan && ex?.needsImages && plan.images.length > 0) {
    const withImages = layouts.find((l) => l.supportsImages);
    if (withImages) return { layout: withImages.id, reason: `AI: ${ex.reason || 'bài cần ảnh minh họa'} → ${withImages.label}` };
    return { layout: current, reason: 'AI gợi ý bài cần ảnh nhưng chưa có layout có ảnh – giữ layout hiện tại' };
  }
  const known = layouts.some((l) => l.id === current) ? current : layouts[0].id;
  return { layout: known, reason: plan ? 'AI: bài từ vựng chỉ cần hai cột chữ → giữ layout hiện tại' : 'Không cần ảnh → giữ layout hiện tại' };
};
