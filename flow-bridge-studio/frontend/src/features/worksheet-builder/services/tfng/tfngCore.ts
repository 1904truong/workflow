// Dữ liệu và hàm thuần cho bài True / False / Not Given (đọc hiểu): tiêu đề, danh sách câu, kiểu hiển thị T / F / NG, ảnh mascot.
// Dự án làm giáo trình: KHÔNG có đáp án, mỗi câu chỉ có các lựa chọn T, F, NG để học sinh khoanh / đánh dấu.

import type { TextStyle } from '../matching-pictures/matchingPicturesCore.ts';
import type { AiImagePlan } from '../ai/imagePlanSchema.ts';

export type TfngLayoutId = 'original' | 'checkbox' | 'circle' | 'underline' | 'two_columns' | 'answer_grid';

export interface TfngLayoutMeta {
  id: TfngLayoutId;
  label: string;
  desc: string;
  supportsImages?: boolean;
}

export const TFNG_LAYOUTS: TfngLayoutMeta[] = [
  { id: 'original', label: '1. Original', desc: 'Chữ T F NG đơn giản ở cuối mỗi câu', supportsImages: true },
  { id: 'checkbox', label: '2. Checkbox Row', desc: 'Tiêu đề cột T / F / NG ở trên, mỗi câu có ba ô vuông để đánh dấu', supportsImages: true },
  { id: 'circle', label: '3. Circle Option', desc: 'Ba chữ T, F, NG trong vòng tròn để khoanh', supportsImages: true },
  { id: 'underline', label: '4. Underline Answer', desc: 'T / F / NG có dòng kẻ dưới mỗi chữ', supportsImages: true },
  { id: 'two_columns', label: '5. Two-Column Compact', desc: 'Chia hai cột, lựa chọn nằm dưới mỗi câu, tiết kiệm giấy', supportsImages: true },
  { id: 'answer_grid', label: '6. Answer Grid', desc: 'Bảng No. / Statement / T / F / NG có ô đánh dấu', supportsImages: true },
];

export interface TfngStatement {
  id: string;
  text: string;
}

export type TfngStyleKey = 'title' | 'instruction' | 'statements';
export const TFNG_STYLE_LABELS: Record<TfngStyleKey, string> = {
  title: 'Tiêu đề bài',
  instruction: 'Ghi chú dưới tiêu đề',
  statements: 'Các câu',
};
export type TfngTextStyles = Partial<Record<TfngStyleKey, TextStyle>>;

export interface TfngImage {
  url?: string;
  /** Tỉ lệ rộng/cao của khung ảnh (tự theo ảnh thật khi có ảnh) */
  ratio?: number;
  /** Prompt tạo ảnh (tự sinh từ nội dung, sửa được) */
  prompt?: string;
}

export interface TfngSettings {
  layout: TfngLayoutId;
  fontFamily: string;
  fontSizePt: number;
  headingFontSizePt: number;
  lineHeight: number;
  rowGapMm: number;
  showNumbering: boolean;
  showExerciseTitle: boolean;
  showImage: boolean;
  imageHeightMm: number;
  pageBreakBefore: boolean;
}

export interface TfngData {
  exerciseTitle: string;
  instruction: string;
  exerciseNumber?: number;
  statements: TfngStatement[];
  image: TfngImage;
  textStyles?: TfngTextStyles;
  settings: TfngSettings;
}

export const DEFAULT_TFNG_SETTINGS: TfngSettings = {
  layout: 'circle',
  fontFamily: 'Arial',
  fontSizePt: 11,
  headingFontSizePt: 12.5,
  lineHeight: 1.5,
  rowGapMm: 4.5,
  showNumbering: true,
  showExerciseTitle: true,
  showImage: true,
  imageHeightMm: 22,
  pageBreakBefore: false,
};

let counter = 0;
export const newTfngId = (): string => {
  counter += 1;
  return `tfng_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
};

export const createTfng = (partial?: Partial<TfngData>): TfngData => ({
  exerciseTitle: 'CIRCLE T FOR [[TRUE]], F FOR [[FALSE]] OR NG FOR [[NOT GIVEN]]',
  instruction: '',
  statements: [],
  image: {},
  ...partial,
  settings: { ...DEFAULT_TFNG_SETTINGS, ...(partial?.settings || {}) },
});

// ───────────── Nhập nhanh ─────────────

export interface ParsedTfng {
  ok: boolean;
  title: string;
  statements: string[];
  warnings: string[];
}

const ITEM_RE = /^\s*(\d{1,3})\s*[.)]\s*(.+?)\s*$/;
const TRAILING_LINE_RE = /\s*[_▁—\-]{3,}\s*$/;
/** Chữ T F NG (hoặc T / F / NG) dính ở cuối câu khi copy từ phiếu in */
const TFNG_TRAILING_OPTIONS_RE = /\s+T\s*[\s/,]\s*F\s*[\s/,]\s*NG\s*$/;
const TFNG_WORDS_RE = /\b(TRUE|FALSE|NOT GIVEN)\b(?:\s*\((T|F|NG)\))?/g;

/**
 * Tự tô màu đỏ các từ TRUE (T) / FALSE (F) trong tiêu đề: đặt trong [[ ]] (chữ đỏ đậm khi in).
 * Chỉ áp dụng cho chữ in hoa như trong đề mẫu và bỏ qua phần đã có [[ ]].
 */
export const highlightTfngWords = (title: string): string =>
  title.includes('[[') ? title : title.replace(TFNG_WORDS_RE, (m) => `[[${m}]]`);

/** Smart Paste: các dòng trước "1." là tiêu đề; "1. câu … ______" là các câu (bỏ dòng kẻ ở cuối) */
export const parseTfngText = (raw: string): ParsedTfng => {
  const clean = raw
    .replace(/\r\n?/g, '\n')
    .replace(/[\u000b\u000c\u0085\u2028\u2029]/g, '\n')
    .replace(/[\u00a0\u2007\u202f\u200b\ufeff]/g, ' ')
    .replace(/[☐□▢■▪]/g, '');
  const lines = clean.split('\n').map((l) => l.trim());
  const titleParts: string[] = [];
  const statements: string[] = [];
  let last: 'title' | 'item' | null = null;
  for (const line of lines) {
    if (!line) continue;
    const m = ITEM_RE.exec(line);
    if (m) {
      statements.push(m[2].replace(TRAILING_LINE_RE, '').replace(TFNG_TRAILING_OPTIONS_RE, '').trim());
      last = 'item';
    } else if (statements.length === 0) {
      titleParts.push(line.replace(/^\d+\s+(?=[A-Z])/, ''));
      last = 'title';
    } else if (last === 'item') {
      const cont = line.replace(TRAILING_LINE_RE, '').trim();
      if (cont) statements[statements.length - 1] += ` ${cont}`;
    }
  }
  const warnings: string[] = [];
  if (statements.length === 0) warnings.push('Không tìm thấy câu nào dạng "1. ...".');
  const title = titleParts.join(' ').trim();
  return { ok: statements.length > 0, title: title ? highlightTfngWords(title) : '', statements, warnings };
};

export const validateTfng = (d: TfngData): { errors: string[]; warnings: string[] } => {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (d.statements.length === 0) errors.push('Chưa có câu nào.');
  d.statements.forEach((s, i) => { if (!s.text.trim()) errors.push(`Câu ${i + 1} đang trống.`); });
  return { errors, warnings };
};

export const moveTfngItem = <T,>(list: T[], from: number, to: number): T[] => {
  if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

// ───────────── Định dạng chữ theo thành phần ─────────────

export const setTfngStyle = (styles: TfngTextStyles | undefined, key: TfngStyleKey, patch: Partial<TextStyle>): TfngTextStyles => {
  const merged: TextStyle = { ...(styles?.[key] || {}), ...patch };
  (Object.keys(merged) as (keyof TextStyle)[]).forEach((k) => { if (merged[k] === undefined) delete merged[k]; });
  const next: TfngTextStyles = { ...(styles || {}) };
  if (Object.keys(merged).length === 0) delete next[key];
  else next[key] = merged;
  return next;
};

export const bumpTfngSize = (styles: TfngTextStyles | undefined, key: TfngStyleKey, base: number, delta: number): TfngTextStyles => {
  const cur = styles?.[key]?.sizePt ?? base;
  return setTfngStyle(styles, key, { sizePt: Math.min(30, Math.max(7, Math.round((cur + delta) * 2) / 2)) });
};

// ───────────── Ảnh minh họa ─────────────

/** Prompt dự phòng cho ảnh mascot / minh họa, tạo từ các câu của bài */
export const buildTfngImagePrompt = (d: TfngData): string => {
  const sample = d.statements.slice(0, 3).map((x) => x.text).join(' ');
  return `Friendly cartoon mascot character for an English reading exercise, waving, clean white background.${sample ? ` Topic hints: ${sample}` : ''}`.trim();
};

/** AI gợi ý ảnh cho bài này (nếu có): prompt của ảnh đầu tiên khi bài cần ảnh */
export const imagePromptFromPlan = (plan: AiImagePlan | null | undefined): string | null => {
  const ex = plan?.exercises[0];
  if (!plan || !ex?.needsImages) return null;
  return plan.images.find((im) => im.exerciseIndex === ex.index)?.prompt || null;
};
