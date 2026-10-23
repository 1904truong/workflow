// Dữ liệu và hàm thuần cho bài Listening True / False: tiêu đề, danh sách câu cần chọn T/F, audio + mã QR, ảnh minh họa.
// Dự án làm giáo trình: KHÔNG có đáp án, mỗi câu chỉ có một dòng kẻ để học sinh viết T hoặc F.

import type { ListeningAudio } from '../listening/listeningGapFillCore.ts';
import type { TextStyle } from '../matching-pictures/matchingPicturesCore.ts';
import type { AiImagePlan } from '../ai/imagePlanSchema.ts';

export type TfLayoutId = 'answer_line';

export interface TfLayoutMeta {
  id: TfLayoutId;
  label: string;
  desc: string;
  supportsImages?: boolean;
}

/** Layout sau này sẽ thêm vào đây */
export const TF_LAYOUTS: TfLayoutMeta[] = [
  { id: 'answer_line', label: '1. Answer line', desc: 'Ảnh + QR bên phải tiêu đề, mỗi câu có một dòng kẻ ở cuối', supportsImages: true },
];

export interface TfStatement {
  id: string;
  text: string;
}

export type TfStyleKey = 'title' | 'instruction' | 'statements';
export const TF_STYLE_LABELS: Record<TfStyleKey, string> = {
  title: 'Tiêu đề bài',
  instruction: 'Ghi chú dưới tiêu đề',
  statements: 'Các câu',
};
export type TfTextStyles = Partial<Record<TfStyleKey, TextStyle>>;

export interface TfImage {
  url?: string;
  /** Tỉ lệ rộng/cao của khung ảnh (tự theo ảnh thật khi có ảnh) */
  ratio?: number;
  /** Prompt tạo ảnh (tự sinh từ nội dung, sửa được) */
  prompt?: string;
}

export interface ListeningTrueFalseSettings {
  layout: TfLayoutId;
  fontFamily: string;
  fontSizePt: number;
  headingFontSizePt: number;
  lineHeight: number;
  rowGapMm: number;
  showNumbering: boolean;
  showAnswerLine: boolean;
  answerLineWidthMm: number;
  showExerciseTitle: boolean;
  showAudioIcon: boolean;
  showImage: boolean;
  showQrCode: boolean;
  pageBreakBefore: boolean;
}

export interface ListeningTrueFalseData {
  /** Định dạng từng từ của các ô chữ sửa trên trang A4 (xem services/richFields.ts) */
  richMarks?: import('../richFields.ts').RichMarks;
  exerciseTitle: string;
  instruction: string;
  exerciseNumber?: number;
  statements: TfStatement[];
  audio: ListeningAudio;
  image: TfImage;
  textStyles?: TfTextStyles;
  settings: ListeningTrueFalseSettings;
}

export const DEFAULT_TF_SETTINGS: ListeningTrueFalseSettings = {
  layout: 'answer_line',
  fontFamily: 'Quicksand',
  fontSizePt: 11,
  headingFontSizePt: 12.5,
  lineHeight: 1.5,
  rowGapMm: 4.5,
  showNumbering: true,
  showAnswerLine: true,
  answerLineWidthMm: 26,
  showExerciseTitle: true,
  showAudioIcon: false,
  showImage: true,
  showQrCode: true,
  pageBreakBefore: false,
};

export const EMPTY_TF_AUDIO: ListeningAudio = {
  filename: 'No audio attached',
  sizeMb: '0 MB',
  durationStr: '00:00',
};

let counter = 0;
export const newTfId = (): string => {
  counter += 1;
  return `tf_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
};

export const createListeningTrueFalse = (partial?: Partial<ListeningTrueFalseData>): ListeningTrueFalseData => ({
  exerciseTitle: 'LISTEN TO A RADIO PROGRAMME. ARE THE SENTENCES [[TRUE (T)]] OR [[FALSE (F)]]?',
  instruction: '',
  statements: [],
  audio: { ...EMPTY_TF_AUDIO },
  image: {},
  ...partial,
  settings: { ...DEFAULT_TF_SETTINGS, ...(partial?.settings || {}) },
});

// ───────────── Nhập nhanh ─────────────

export interface ParsedTrueFalse {
  ok: boolean;
  title: string;
  statements: string[];
  warnings: string[];
}

const ITEM_RE = /^\s*(\d{1,3})\s*[.)]\s*(.+?)\s*$/;
const TRAILING_LINE_RE = /\s*[_▁—\-]{3,}\s*$/;
const TF_WORDS_RE = /\b(TRUE|FALSE)\b(?:\s*\((T|F)\))?/g;

/**
 * Tự tô màu đỏ các từ TRUE (T) / FALSE (F) trong tiêu đề: đặt trong [[ ]] (chữ đỏ đậm khi in).
 * Chỉ áp dụng cho chữ in hoa như trong đề mẫu và bỏ qua phần đã có [[ ]].
 */
export const highlightTfWords = (title: string): string =>
  title.includes('[[') ? title : title.replace(TF_WORDS_RE, (m) => `[[${m}]]`);

/** Smart Paste: các dòng trước "1." là tiêu đề; "1. câu … ______" là các câu (bỏ dòng kẻ ở cuối) */
export const parseTrueFalseText = (raw: string): ParsedTrueFalse => {
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
      statements.push(m[2].replace(TRAILING_LINE_RE, '').trim());
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
  return { ok: statements.length > 0, title: title ? highlightTfWords(title) : '', statements, warnings };
};

export const validateTrueFalse = (d: ListeningTrueFalseData): { errors: string[]; warnings: string[] } => {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (d.statements.length === 0) errors.push('Chưa có câu nào.');
  d.statements.forEach((s, i) => { if (!s.text.trim()) errors.push(`Câu ${i + 1} đang trống.`); });
  if (d.settings.showQrCode && !d.audio.shareUrl) warnings.push('Chưa có đường dẫn audio nên mã QR chưa dùng được.');
  return { errors, warnings };
};

export const moveTfItem = <T,>(list: T[], from: number, to: number): T[] => {
  if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

// ───────────── Định dạng chữ theo thành phần ─────────────

export const setTfStyle = (styles: TfTextStyles | undefined, key: TfStyleKey, patch: Partial<TextStyle>): TfTextStyles => {
  const merged: TextStyle = { ...(styles?.[key] || {}), ...patch };
  (Object.keys(merged) as (keyof TextStyle)[]).forEach((k) => { if (merged[k] === undefined) delete merged[k]; });
  const next: TfTextStyles = { ...(styles || {}) };
  if (Object.keys(merged).length === 0) delete next[key];
  else next[key] = merged;
  return next;
};

export const bumpTfSize = (styles: TfTextStyles | undefined, key: TfStyleKey, base: number, delta: number): TfTextStyles => {
  const cur = styles?.[key]?.sizePt ?? base;
  return setTfStyle(styles, key, { sizePt: Math.min(30, Math.max(7, Math.round((cur + delta) * 2) / 2)) });
};

// ───────────── Ảnh minh họa ─────────────

/** Prompt dự phòng cho ảnh minh họa, tạo từ tiêu đề và các câu */
export const buildTfImagePrompt = (d: ListeningTrueFalseData): string => {
  const title = d.exerciseTitle.replace(/\[\[|\]\]/g, '').replace(/ARE THE SENTENCES.*$/i, '').replace(/^LISTEN TO\s+(A|AN|THE)?\s*/i, '').trim();
  const sample = d.statements.slice(0, 3).map((s) => s.text).join(' ');
  return `Illustration for a listening exercise about: ${title || 'the recording'}. ${sample ? `Topic hints: ${sample}` : ''}`.trim();
};

/** AI gợi ý ảnh cho bài này (nếu có): prompt của ảnh đầu tiên khi bài cần ảnh */
export const imagePromptFromPlan = (plan: AiImagePlan | null | undefined): string | null => {
  const ex = plan?.exercises[0];
  if (!plan || !ex?.needsImages) return null;
  return plan.images.find((im) => im.exerciseIndex === ex.index)?.prompt || null;
};
