// Dữ liệu và hàm thuần cho bài Sentence Completion – Grammar Practice:
// một bài gom 4 kiểu bài câu ngắn (khung từ / từ trong ngoặc / viết lại với gợi ý / hai cột at-on-in),
// có Target Grammar / Target Word (từ hoặc cấu trúc trọng tâm) và mã QR audio khi bài có nghe.
// Dự án làm giáo trình: KHÔNG có đáp án, chỉ có câu ví dụ (tùy chọn) để học sinh nhìn mẫu.

import type { ListeningAudio } from '../listening/listeningGapFillCore.ts';
import type { TextStyle } from '../matching-pictures/matchingPicturesCore.ts';
import { parseGapFillingText, passageSentences } from '../gap-filling/gapFillingCore.ts';

export type SentenceLayoutId = 'word_bank' | 'brackets' | 'transform' | 'two_columns';

export interface SentenceLayoutMeta {
  id: SentenceLayoutId;
  label: string;
  /** Tên loại bài hiển thị ở ô chọn "Exercise Type" */
  typeLabel: string;
  desc: string;
}

export const SENTENCE_LAYOUTS: SentenceLayoutMeta[] = [
  { id: 'word_bank', label: '1. Khung từ', typeLabel: 'Word Bank Completion', desc: 'Khung từ ở trên, các câu đánh số có chỗ trống; có thể có câu ví dụ có đáp án mẫu' },
  { id: 'brackets', label: '2. Từ trong ngoặc', typeLabel: 'Words in Brackets', desc: 'Mỗi câu có chỗ trống, gợi ý trong ngoặc nằm cột bên phải, ví dụ (money/buy)' },
  { id: 'transform', label: '3. Viết lại với gợi ý', typeLabel: 'Sentence Transformation', desc: 'Cột trái là gợi ý (I\'m not going out / cold), cột phải là phần đầu câu trả lời: It\'s ______' },
  { id: 'two_columns', label: '4. Hai cột gọn', typeLabel: 'Short Sentences (2 columns)', desc: 'Các câu ngắn chia hai cột, tiết kiệm giấy – hợp bài điền at / on / in' },
];

export interface SentenceItem {
  id: string;
  /** Câu có chỗ trống ______ (hoặc phần đầu câu trả lời ở layout "Viết lại") */
  text: string;
  /** Gợi ý: (money/buy), (I'm not going out / cold)… */
  hint?: string;
  /** Đáp án mẫu cho câu ví dụ (hiện chữ đỏ gạch chân khi bật Show Example) */
  example?: string;
}

export type SentenceStyleKey = 'title' | 'instruction' | 'wordBank' | 'sentences' | 'hints';
export const SENTENCE_STYLE_LABELS: Record<SentenceStyleKey, string> = {
  title: 'Tiêu đề bài',
  instruction: 'Hướng dẫn',
  wordBank: 'Khung từ',
  sentences: 'Các câu',
  hints: 'Gợi ý',
};
export type SentenceTextStyles = Partial<Record<SentenceStyleKey, TextStyle>>;

export interface SentenceCompletionSettings {
  layout: SentenceLayoutId;
  fontFamily: string;
  fontSizePt: number;
  headingFontSizePt: number;
  lineHeight: number;
  rowGapMm: number;
  blankWidthMm: number;
  showNumbering: boolean;
  showExerciseTitle: boolean;
  showWordBank: boolean;
  showExample: boolean;
  showQrCode: boolean;
  pageBreakBefore: boolean;
}

export interface SentenceCompletionData {
  exerciseTitle: string;
  instruction: string;
  /** Từ / cấu trúc ngữ pháp trọng tâm, ví dụ "enough", "too … to", "at / on / in" */
  targetWord: string;
  exerciseNumber?: number;
  words: { id: string; text: string }[];
  sentences: SentenceItem[];
  audio: ListeningAudio;
  textStyles?: SentenceTextStyles;
  settings: SentenceCompletionSettings;
}

export const DEFAULT_SENTENCE_SETTINGS: SentenceCompletionSettings = {
  layout: 'word_bank',
  fontFamily: 'Quicksand',
  fontSizePt: 10.5,
  headingFontSizePt: 12,
  lineHeight: 1.5,
  rowGapMm: 3,
  blankWidthMm: 30,
  showNumbering: true,
  showExerciseTitle: true,
  showWordBank: true,
  showExample: false,
  showQrCode: false,
  pageBreakBefore: false,
};

export const EMPTY_SENTENCE_AUDIO: ListeningAudio = {
  filename: 'No audio attached',
  sizeMb: '0 MB',
  durationStr: '00:00',
};

let counter = 0;
export const newSentenceId = (): string => {
  counter += 1;
  return `sc_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
};

export const createSentenceCompletion = (partial?: Partial<SentenceCompletionData>): SentenceCompletionData => ({
  exerciseTitle: 'COMPLETE THE SENTENCES.',
  instruction: '',
  targetWord: '',
  words: [],
  sentences: [],
  audio: { ...EMPTY_SENTENCE_AUDIO },
  ...partial,
  settings: { ...DEFAULT_SENTENCE_SETTINGS, ...(partial?.settings || {}) },
});

// ───────────── Từ trọng tâm trong tiêu đề ─────────────

export type TitlePart = { text: string; emphasis: boolean };

/** Tách tiêu đề thành các đoạn; các lần xuất hiện của Target Word (không phân biệt hoa thường) được đánh dấu nhấn mạnh */
export const splitTitleByTarget = (title: string, target: string): TitlePart[] => {
  const t = target.trim();
  if (!t) return [{ text: title, emphasis: false }];
  const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  const re = new RegExp(escaped, 'gi');
  const parts: TitlePart[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(title)) !== null) {
    if (m[0].length === 0) { re.lastIndex++; continue; }
    if (m.index > last) parts.push({ text: title.slice(last, m.index), emphasis: false });
    parts.push({ text: m[0], emphasis: true });
    last = m.index + m[0].length;
  }
  if (last < title.length) parts.push({ text: title.slice(last), emphasis: false });
  return parts.length ? parts : [{ text: title, emphasis: false }];
};

// ───────────── Smart Paste ─────────────

export interface ParsedSentenceCompletion {
  ok: boolean;
  title: string;
  targetWord: string;
  words: string[];
  sentences: { text: string; hint?: string }[];
  layout: SentenceLayoutId;
  warnings: string[];
}

const HINT_END_RE = /\s*\(([^()]{2,60})\)\s*$/;
const HINT_START_RE = /^\s*\(([^()]{2,80})\)\s*(.*)$/;

/** Đoán từ trọng tâm từ tiêu đề: cụm in nghiêng/hoa sau "USE", "USING" hoặc "WITH THESE WORDS" */
export const guessTargetWord = (title: string): string => {
  const m = /\bUSE\s+(?:THE\s+)?([A-Za-z/’' …-]{2,24}?)(?=\s+(?:WITH|\+|\(|TO\b|AND\b|IN\b)|[.:,]|$)/i.exec(title);
  const word = (m?.[1] || '').trim();
  if (!word || /^(these|the|a|an|words?|verbs?)\b/i.test(word)) return '';
  return word.toLowerCase();
};

export const parseSentenceCompletionText = (raw: string): ParsedSentenceCompletion => {
  const base = parseGapFillingText(raw);
  const lines = passageSentences(base.passage);
  const sentences: { text: string; hint?: string }[] = [];
  let startHints = 0;
  let endHints = 0;
  for (const line of lines) {
    const sm = HINT_START_RE.exec(line);
    if (sm && sm[2]) { sentences.push({ text: sm[2].trim(), hint: sm[1].trim() }); startHints++; continue; }
    const em = HINT_END_RE.exec(line);
    if (em && em.index > 0) { sentences.push({ text: line.slice(0, em.index).trim(), hint: em[1].trim() }); endHints++; continue; }
    sentences.push({ text: line });
  }
  const layout: SentenceLayoutId = startHints >= 2 ? 'transform' : endHints >= 2 ? 'brackets' : base.words.length >= 3 ? 'word_bank' : 'two_columns';
  const warnings: string[] = [];
  if (sentences.length === 0) warnings.push('Không thấy câu nào. Mỗi câu một dòng, đánh số 1., 2., …');
  return { ok: sentences.length > 0, title: base.title, targetWord: guessTargetWord(base.title), words: base.words, sentences, layout, warnings };
};

export const validateSentenceCompletion = (d: SentenceCompletionData): { errors: string[]; warnings: string[] } => {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (d.sentences.length === 0) errors.push('Chưa có câu nào.');
  d.sentences.forEach((s, i) => { if (!s.text.trim() && !(s.hint || '').trim()) errors.push(`Câu ${i + 1} đang trống.`); });
  if (d.settings.layout === 'word_bank' && d.settings.showWordBank && d.words.length === 0) warnings.push('Khung từ đang trống.');
  if (d.settings.showQrCode && !d.audio.shareUrl) warnings.push('Chưa có đường dẫn audio nên mã QR chưa dùng được.');
  return { errors, warnings };
};

export const moveSentenceItem = <T,>(list: T[], from: number, to: number): T[] => {
  if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

// ───────────── Định dạng chữ theo thành phần ─────────────

export const setSentenceStyle = (styles: SentenceTextStyles | undefined, key: SentenceStyleKey, patch: Partial<TextStyle>): SentenceTextStyles => {
  const merged: TextStyle = { ...(styles?.[key] || {}), ...patch };
  (Object.keys(merged) as (keyof TextStyle)[]).forEach((k) => { if (merged[k] === undefined) delete merged[k]; });
  const next: SentenceTextStyles = { ...(styles || {}) };
  if (Object.keys(merged).length === 0) delete next[key];
  else next[key] = merged;
  return next;
};

export const bumpSentenceSize = (styles: SentenceTextStyles | undefined, key: SentenceStyleKey, base: number, delta: number): SentenceTextStyles => {
  const cur = styles?.[key]?.sizePt ?? base;
  return setSentenceStyle(styles, key, { sizePt: Math.min(30, Math.max(7, Math.round((cur + delta) * 2) / 2)) });
};
