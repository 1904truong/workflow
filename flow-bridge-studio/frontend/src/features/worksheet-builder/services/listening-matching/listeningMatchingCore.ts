// Dữ liệu và hàm thuần cho bài Listening Matching: câu hỏi 1–n, lựa chọn a–e, audio + mã QR, hộp đáp án bên phải.
// Dự án làm giáo trình: KHÔNG có đáp án, học sinh viết chữ cái vào hộp "1. ____".

import type { ListeningAudio } from '../listening/listeningGapFillCore.ts';
import type { TextStyle } from '../matching-pictures/matchingPicturesCore.ts';

export type LmLayoutId = 'side_answer_box' | 'columns_boxes';

export interface LmLayoutMeta {
  id: LmLayoutId;
  label: string;
  desc: string;
}

/** Layout sau này sẽ thêm vào đây */
export const LM_LAYOUTS: LmLayoutMeta[] = [
  { id: 'columns_boxes', label: '2. Hai cột có ô', desc: 'Cột trái có tiêu đề (PLACES) và ô trả lời cạnh mỗi dòng, cột phải có tiêu đề (PROBLEMS) và lựa chọn A, B, C…; đoạn dẫn dưới tiêu đề, QR góc phải' },
  { id: 'side_answer_box', label: '1. Side answer box', desc: 'Câu hỏi và lựa chọn bên trái, hộp đáp án "1. ____" bên phải, QR audio ở góc trên phải' },
];

export interface LmItem {
  id: string;
  text: string;
}

export type LmStyleKey = 'title' | 'instruction' | 'problems' | 'options';
export const LM_STYLE_LABELS: Record<LmStyleKey, string> = {
  title: 'Tiêu đề bài',
  instruction: 'Ghi chú dưới tiêu đề',
  problems: 'Các câu hỏi',
  options: 'Các lựa chọn',
};
export type LmTextStyles = Partial<Record<LmStyleKey, TextStyle>>;

export interface ListeningMatchingSettings {
  layout: LmLayoutId;
  fontFamily: string;
  fontSizePt: number;
  headingFontSizePt: number;
  lineHeight: number;
  rowGapMm: number;
  showNumbering: boolean;
  showAnswerBox: boolean;
  answerBoxWidthMm: number;
  showExerciseTitle: boolean;
  showAudioIcon: boolean;
  showQrCode: boolean;
  pageBreakBefore: boolean;
}

export interface ListeningMatchingData {
  exerciseTitle: string;
  instruction: string;
  exerciseNumber?: number;
  problems: LmItem[];
  options: LmItem[];
  /** Tiêu đề hai cột (layout columns_boxes): PLACES / PROBLEMS */
  problemsHeading?: string;
  optionsHeading?: string;
  audio: ListeningAudio;
  textStyles?: LmTextStyles;
  settings: ListeningMatchingSettings;
}

export const DEFAULT_LM_SETTINGS: ListeningMatchingSettings = {
  layout: 'side_answer_box',
  fontFamily: 'Quicksand',
  fontSizePt: 10.5,
  headingFontSizePt: 12,
  lineHeight: 1.5,
  rowGapMm: 3.5,
  showNumbering: true,
  showAnswerBox: true,
  answerBoxWidthMm: 34,
  showExerciseTitle: true,
  showAudioIcon: false,
  showQrCode: true,
  pageBreakBefore: false,
};

export const EMPTY_LM_AUDIO: ListeningAudio = {
  filename: 'No audio attached',
  sizeMb: '0 MB',
  durationStr: '00:00',
};

let counter = 0;
export const newLmId = (): string => {
  counter += 1;
  return `lm_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
};

export const optionLabel = (i: number, upper = false): string => String.fromCharCode((upper ? 65 : 97) + i);

export const createListeningMatching = (partial?: Partial<ListeningMatchingData>): ListeningMatchingData => ({
  exerciseTitle: 'LISTEN AGAIN. MATCH THE REASONS (A–E) TO THE QUESTIONS (1–5)',
  instruction: '',
  problems: [],
  options: [],
  audio: { ...EMPTY_LM_AUDIO },
  ...partial,
  settings: { ...DEFAULT_LM_SETTINGS, ...(partial?.settings || {}) },
});

// ───────────── Nhập nhanh ─────────────

export interface ParsedListeningMatching {
  ok: boolean;
  title: string;
  /** Các dòng thường ngay sau tiêu đề (đoạn dẫn) */
  instruction?: string;
  problemsHeading?: string;
  optionsHeading?: string;
  problems: string[];
  options: string[];
  warnings: string[];
}

const NUM_RE = /^\s*(\d{1,3})\s*[.)]\s*(.+?)\s*$/;
const LET_RE = /^\s*([a-zA-Z])(?:\s*[.)]\s*|\s+)(.+?)\s*$/;
const TRAILING_LINE_RE = /\s*[_▁—\-]{3,}\s*$/;

/** Smart Paste: dòng trước "1." là tiêu đề; "1. …" là câu hỏi; "a. …" là lựa chọn. Hộp "1. ____" của mẫu tự bị bỏ. */
const isShortCaps = (s: string): boolean => s.length <= 24 && s === s.toUpperCase() && /[A-Z]/.test(s) && !/[.?!:]$/.test(s) && s.split(' ').length <= 3;

export const parseListeningMatchingText = (raw: string): ParsedListeningMatching => {
  const clean = raw
    .replace(/\r\n?/g, '\n')
    .replace(/[\u000b\u000c\u0085\u2028\u2029]/g, '\n')
    .replace(/[\u00a0\u2007\u202f\u200b\ufeff\u3000]/g, ' ')
    .replace(/[☐□▢■▪]/g, '');
  const titleParts: string[] = [];
  let optionsHeading: string | undefined;
  const problems: string[] = [];
  const options: string[] = [];
  let last: 'title' | 'problem' | 'option' | null = null;
  for (const line of clean.split('\n').map((l) => l.trim())) {
    if (!line) continue;
    const body = (s: string) => s.replace(TRAILING_LINE_RE, '').trim();
    const num = NUM_RE.exec(line);
    const let_ = LET_RE.exec(line);
    if (num && !body(num[2])) continue; // "1. ______" của hộp đáp án
    if (num && options.length === 0) { problems.push(body(num[2])); last = 'problem'; }
    else if (num) continue; // hộp đáp án in sau các lựa chọn
    else if (let_ && problems.length > 0 && let_[1].toLowerCase() === optionLabel(options.length) && (/[.)]/.test(line.slice(1, 3)) || options.length > 0 || last === 'title' || last === 'problem')) { options.push(body(let_[2])); last = 'option'; }
    else if (isShortCaps(line) && problems.length > 0 && options.length === 0 && last === 'problem') { optionsHeading = line; last = 'title'; }
    else if (problems.length === 0) { titleParts.push(line.replace(/^\d+\s+(?=[A-Z])/, '')); last = 'title'; }
    else if (last === 'problem') problems[problems.length - 1] += ` ${body(line)}`;
    else if (last === 'option' && options.length) options[options.length - 1] += ` ${body(line)}`;
  }
  const warnings: string[] = [];
  if (problems.length === 0) warnings.push('Không tìm thấy câu hỏi nào dạng "1. ...".');
  if (options.length === 0) warnings.push('Không tìm thấy lựa chọn nào dạng "a. ...".');
  // Dòng chữ hoa ngắn ngay trước câu 1 (PLACES) là tiêu đề cột trái, không phải tiêu đề bài
  let problemsHeading: string | undefined;
  if (titleParts.length >= 2 && isShortCaps(titleParts[titleParts.length - 1])) problemsHeading = titleParts.pop();
  // Dòng chữ hoa đầu tiên là tiêu đề bài; các dòng thường theo sau là đoạn dẫn
  let titleEnd = 0;
  while (titleEnd < titleParts.length && titleParts[titleEnd] === titleParts[titleEnd].toUpperCase()) titleEnd++;
  const titleText = titleParts.slice(0, Math.max(1, titleEnd)).join(' ').trim();
  const instruction = titleParts.slice(Math.max(1, titleEnd)).join(' ').trim();
  return { ok: problems.length > 0, title: titleText, instruction: instruction || undefined, problemsHeading, optionsHeading, problems, options, warnings };
};

export const validateListeningMatching = (d: ListeningMatchingData): { errors: string[]; warnings: string[] } => {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (d.problems.length === 0) errors.push('Chưa có câu hỏi nào.');
  if (d.options.length === 0) errors.push('Chưa có lựa chọn nào.');
  d.problems.forEach((s, i) => { if (!s.text.trim()) errors.push(`Câu hỏi ${i + 1} đang trống.`); });
  d.options.forEach((s, i) => { if (!s.text.trim()) errors.push(`Lựa chọn ${optionLabel(i)} đang trống.`); });
  if (d.options.length < d.problems.length) warnings.push('Số lựa chọn ít hơn số câu hỏi.');
  if (d.settings.showQrCode && !d.audio.shareUrl) warnings.push('Chưa có đường dẫn audio nên mã QR chưa dùng được.');
  return { errors, warnings };
};

export const moveLmItem = <T,>(list: T[], from: number, to: number): T[] => {
  if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

// ───────────── Định dạng chữ theo thành phần ─────────────

export const setLmStyle = (styles: LmTextStyles | undefined, key: LmStyleKey, patch: Partial<TextStyle>): LmTextStyles => {
  const merged: TextStyle = { ...(styles?.[key] || {}), ...patch };
  (Object.keys(merged) as (keyof TextStyle)[]).forEach((k) => { if (merged[k] === undefined) delete merged[k]; });
  const next: LmTextStyles = { ...(styles || {}) };
  if (Object.keys(merged).length === 0) delete next[key];
  else next[key] = merged;
  return next;
};

export const bumpLmSize = (styles: LmTextStyles | undefined, key: LmStyleKey, base: number, delta: number): LmTextStyles => {
  const cur = styles?.[key]?.sizePt ?? base;
  return setLmStyle(styles, key, { sizePt: Math.min(30, Math.max(7, Math.round((cur + delta) * 2) / 2)) });
};
