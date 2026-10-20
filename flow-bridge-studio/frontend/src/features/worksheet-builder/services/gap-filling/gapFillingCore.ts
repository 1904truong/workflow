// Dữ liệu và hàm thuần cho bài Gap Filling / Word Formation:
// khung từ (Word Bank) + đoạn văn có chỗ trống (a) ______, kèm audio / mã QR nếu có.
// Dự án làm giáo trình: KHÔNG có đáp án, chỗ trống chỉ là dòng kẻ để học sinh điền.

import type { ListeningAudio } from '../listening/listeningGapFillCore.ts';
import type { TextStyle } from '../matching-pictures/matchingPicturesCore.ts';

export type GapLayoutId = 'box_paragraph' | 'numbered_list';

export interface GapLayoutMeta {
  id: GapLayoutId;
  label: string;
  desc: string;
}

export const GAP_LAYOUTS: GapLayoutMeta[] = [
  { id: 'box_paragraph', label: '1. Khung từ + đoạn văn', desc: 'Khung từ có viền bo tròn ở trên, đoạn văn giãn dòng rộng bên dưới, mã QR góc phải tiêu đề' },
  { id: 'numbered_list', label: '2. Khung từ + câu đánh số', desc: 'Khung từ xếp lưới ba cột, bên dưới là các câu 1., 2., … mỗi câu một chỗ trống, tự tách đoạn theo từng dòng' },
];

export interface GapWord {
  id: string;
  text: string;
}

export type GapStyleKey = 'title' | 'instruction' | 'wordBank' | 'passage';
export const GAP_STYLE_LABELS: Record<GapStyleKey, string> = {
  title: 'Tiêu đề bài',
  instruction: 'Hướng dẫn',
  wordBank: 'Khung từ (Word Bank)',
  passage: 'Đoạn văn',
};
export type GapTextStyles = Partial<Record<GapStyleKey, TextStyle>>;

export interface GapFillingSettings {
  layout: GapLayoutId;
  fontFamily: string;
  fontSizePt: number;
  headingFontSizePt: number;
  lineHeight: number;
  blankWidthMm: number;
  showExerciseTitle: boolean;
  showInstruction: boolean;
  showWordBank: boolean;
  showQrCode: boolean;
  pageBreakBefore: boolean;
}

export interface GapFillingData {
  exerciseTitle: string;
  instruction: string;
  exerciseNumber?: number;
  words: GapWord[];
  /** Đoạn văn; chỗ trống viết dạng "(a) ______"; các đoạn cách nhau một dòng trống */
  passage: string;
  audio: ListeningAudio;
  textStyles?: GapTextStyles;
  settings: GapFillingSettings;
}

export const DEFAULT_GAP_SETTINGS: GapFillingSettings = {
  layout: 'box_paragraph',
  fontFamily: 'Quicksand',
  fontSizePt: 11,
  headingFontSizePt: 12.5,
  lineHeight: 2.1,
  blankWidthMm: 28,
  showExerciseTitle: true,
  showInstruction: false,
  showWordBank: true,
  showQrCode: false,
  pageBreakBefore: false,
};

export const EMPTY_GAP_AUDIO: ListeningAudio = {
  filename: 'No audio attached',
  sizeMb: '0 MB',
  durationStr: '00:00',
};

let counter = 0;
export const newGapId = (): string => {
  counter += 1;
  return `gw_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
};

export const createGapFilling = (partial?: Partial<GapFillingData>): GapFillingData => ({
  exerciseTitle: 'COMPLETE THE PARAGRAPH WITH THE WORDS AND PHRASES FROM THE BOX',
  instruction: 'Use the words in the box to complete the paragraph.',
  words: [],
  passage: '',
  audio: { ...EMPTY_GAP_AUDIO },
  ...partial,
  settings: { ...DEFAULT_GAP_SETTINGS, ...(partial?.settings || {}) },
});

// ───────────── Chỗ trống trong đoạn văn ─────────────

/** "(a) ______" hoặc chỉ "______" (không nhãn) */
export const BLANK_RE = /(?:\(([A-Za-z0-9]{1,3})\)\s*)?_{3,}/g;

export type PassagePart = { kind: 'text'; text: string } | { kind: 'blank'; label: string };

/** Tách một đoạn văn thành các phần chữ / chỗ trống */
export const splitPassage = (text: string): PassagePart[] => {
  const parts: PassagePart[] = [];
  const re = new RegExp(BLANK_RE.source, 'g');
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ kind: 'text', text: text.slice(last, m.index) });
    parts.push({ kind: 'blank', label: m[1] || '' });
    last = re.lastIndex;
  }
  if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) });
  return parts;
};

/** Các câu đánh số của layout "câu đánh số": mỗi dòng một câu, bỏ số "1." đầu dòng */
export const passageSentences = (passage: string): string[] =>
  passage.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim().replace(/^\d{1,3}\s*[.)]\s*/, '')).filter(Boolean);

/** Văn bản có từ 2 dòng bắt đầu bằng "1." / "2)" … được coi là danh sách câu đánh số */
export const looksNumberedList = (passage: string): boolean =>
  passage.split('\n').filter((l) => /^\s*\d{1,3}\s*[.)]\s*\S/.test(l)).length >= 2;

export const passageParagraphs = (passage: string): string[] =>
  passage.replace(/\r\n?/g, '\n').split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);

export const countBlanks = (passage: string): number => (passage.match(new RegExp(BLANK_RE.source, 'g')) || []).length;

/** Nhãn kế tiếp cho nút Add Blank: a, b, c… (bỏ qua nhãn đã dùng) */
export const nextBlankLabel = (passage: string): string => {
  const used = new Set<string>();
  const re = new RegExp(BLANK_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(passage)) !== null) if (m[1]) used.add(m[1].toLowerCase());
  for (let i = 0; i < 26; i++) {
    const l = String.fromCharCode(97 + i);
    if (!used.has(l)) return l;
  }
  return String(used.size + 1);
};

/** Chèn chỗ trống "(x) ________" vào vị trí con trỏ (hoặc cuối đoạn) */
export const insertBlankAt = (passage: string, pos: number | null): { text: string; caret: number } => {
  const label = nextBlankLabel(passage);
  const at = pos === null || pos < 0 || pos > passage.length ? passage.length : pos;
  const before = passage.slice(0, at);
  const after = passage.slice(at);
  const lead = before && !/\s$/.test(before) ? ' ' : '';
  const trail = after && !/^[\s.,;:!?]/.test(after) ? ' ' : '';
  const ins = `${lead}(${label}) ________${trail}`;
  return { text: before + ins + after, caret: (before + ins).length };
};

// ───────────── Nhập nhanh ─────────────

export interface ParsedGapFilling {
  ok: boolean;
  title: string;
  words: string[];
  passage: string;
  /** Layout gợi ý theo cấu trúc văn bản dán vào */
  layout: GapLayoutId;
  warnings: string[];
}

/** Tách danh sách từ trong một dòng: Tab / "|" / "/" / dấu phẩy / từ 2 dấu cách trở lên */
export const splitWordList = (line: string): string[] =>
  line.replace(/^\s*(?:word\s*bank|words?|box)\s*[:\-–]\s*/i, '').split(/\t|\s*\|\s*|\s{2,}|\s*[,;/]\s*/)
    // bỏ dấu "x2" (số lần dùng) dính ở cuối từ khi copy từ phiếu in
    .map((w) => w.trim().replace(/\s*[x×]\s*\d+$/i, '').trim()).filter(Boolean);

const hasBlank = (l: string) => new RegExp(BLANK_RE.source).test(l);
const isUpperLine = (l: string) => l.length > 0 && l.length <= 120 && l === l.toUpperCase() && /[A-Z]{3}/.test(l);
const isNumberedLine = (l: string) => /^\d{1,3}\s*[.)]\s*\S/.test(l);

/** Dòng có thể thuộc khung từ: ngắn, không chỗ trống, không đánh số, có từ 2 từ/cụm trở lên, không giống câu hoàn chỉnh */
const isBankLine = (l: string) => {
  if (!l || l.length > 140 || hasBlank(l) || isNumberedLine(l) || /[.!?]$/.test(l)) return false;
  return splitWordList(l).length >= 2;
};

/**
 * Smart Paste: [tiêu đề viết hoa, có thể xuống 2 dòng] [khung từ, có thể nhiều dòng] đoạn văn / các câu có chỗ trống.
 * Khung từ: bắt đầu bằng "Word bank:", hoặc là các dòng ngắn liền nhau, không có chỗ trống và không đánh số.
 */
export const parseGapFillingText = (raw: string): ParsedGapFilling => {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim());
  const warnings: string[] = [];
  let i = 0;
  while (i < lines.length && !lines[i]) i++;

  // Tiêu đề: các dòng viết hoa liền nhau (cho phép dấu chấm cuối, vì tiêu đề thường xuống dòng)
  const titleParts: string[] = [];
  while (i < lines.length && lines[i] && isUpperLine(lines[i]) && !isNumberedLine(lines[i]) && !hasBlank(lines[i])) {
    titleParts.push(lines[i]);
    i++;
  }
  const title = titleParts.join(' ').trim();
  while (i < lines.length && !lines[i]) i++;

  // Khung từ: một hoặc nhiều dòng liền nhau
  const words: string[] = [];
  if (i < lines.length) {
    if (/^\s*(?:word\s*bank|words?|box)\s*[:\-–]/i.test(lines[i])) {
      while (i < lines.length && lines[i] && !isNumberedLine(lines[i]) && !hasBlank(lines[i])) { words.push(...splitWordList(lines[i])); i++; }
    } else {
      let j = i;
      const bank: string[] = [];
      while (j < lines.length && isBankLine(lines[j])) { bank.push(...splitWordList(lines[j])); j++; }
      if (bank.length >= 3) { words.push(...bank); i = j; }
    }
  }
  const passage = lines.slice(i).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (countBlanks(passage) === 0) warnings.push('Không thấy chỗ trống nào dạng "(a) ______".');
  if (words.length === 0) warnings.push('Không thấy dòng khung từ – nhập thêm trong mục Word Bank.');
  return { ok: passage.length > 0, title, words, passage, layout: looksNumberedList(passage) ? 'numbered_list' : 'box_paragraph', warnings };
};

/** Import khung từ: mỗi dòng một từ/cụm, hoặc cả danh sách trên một dòng */
export const parseWordLines = (raw: string): string[] => {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/^\s*(?:\d{1,3}\s*[.)]|[•*-])\s*/, '').trim()).filter(Boolean);
  return lines.length === 1 ? splitWordList(lines[0]) : lines;
};

export const validateGapFilling = (d: GapFillingData): { errors: string[]; warnings: string[] } => {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!d.passage.trim()) errors.push('Chưa có đoạn văn.');
  else if (countBlanks(d.passage) === 0) errors.push('Đoạn văn chưa có chỗ trống nào.');
  if (d.settings.showWordBank && d.words.length === 0) warnings.push('Khung từ đang trống.');
  d.words.forEach((w, i) => { if (!w.text.trim()) errors.push(`Từ ${i + 1} đang trống.`); });
  if (d.settings.showQrCode && !d.audio.shareUrl) warnings.push('Chưa có đường dẫn audio nên mã QR chưa dùng được.');
  return { errors, warnings };
};

export const moveGapItem = <T,>(list: T[], from: number, to: number): T[] => {
  if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

// ───────────── Định dạng chữ theo thành phần ─────────────

export const setGapStyle = (styles: GapTextStyles | undefined, key: GapStyleKey, patch: Partial<TextStyle>): GapTextStyles => {
  const merged: TextStyle = { ...(styles?.[key] || {}), ...patch };
  (Object.keys(merged) as (keyof TextStyle)[]).forEach((k) => { if (merged[k] === undefined) delete merged[k]; });
  const next: GapTextStyles = { ...(styles || {}) };
  if (Object.keys(merged).length === 0) delete next[key];
  else next[key] = merged;
  return next;
};

export const bumpGapSize = (styles: GapTextStyles | undefined, key: GapStyleKey, base: number, delta: number): GapTextStyles => {
  const cur = styles?.[key]?.sizePt ?? base;
  return setGapStyle(styles, key, { sizePt: Math.min(30, Math.max(7, Math.round((cur + delta) * 2) / 2)) });
};
