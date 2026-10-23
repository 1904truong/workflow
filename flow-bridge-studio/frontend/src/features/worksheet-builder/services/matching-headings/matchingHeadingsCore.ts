// Dữ liệu và hàm thuần cho bài Matching Headings / Main Ideas:
// bài đọc nhiều đoạn (ảnh bên phải) + danh sách "Paragraph n" nối với ý chính a, b, c…
// Dự án làm giáo trình: KHÔNG có đáp án, chỉ có nội dung và cách trình bày.

import type { TextStyle } from '../matching-pictures/matchingPicturesCore.ts';

export type HeadingsLayoutId = 'list_columns' | 'list_divider';

export interface HeadingsLayoutMeta {
  id: HeadingsLayoutId;
  label: string;
  desc: string;
}

export const HEADINGS_LAYOUTS: HeadingsLayoutMeta[] = [
  { id: 'list_columns', label: '1. Bài đọc + ảnh, hai cột nối', desc: 'Bài đọc có ảnh bên phải; bên dưới là Paragraph 1–6 và ý chính a–f, đánh số đậm' },
  { id: 'list_divider', label: '2. Hai cột có đường kẻ', desc: 'Giống layout 1 nhưng có đường kẻ dọc giữa hai cột' },
];

export interface HeadingItem {
  id: string;
  text: string;
}

export type HeadingStyleKey = 'title' | 'instruction' | 'passageTitle' | 'passage' | 'ideas';
export const HEADING_STYLE_LABELS: Record<HeadingStyleKey, string> = {
  title: 'Tiêu đề bài',
  instruction: 'Hướng dẫn',
  passageTitle: 'Tiêu đề bài đọc',
  passage: 'Nội dung bài đọc',
  ideas: 'Danh sách ý chính',
};
export type HeadingTextStyles = Partial<Record<HeadingStyleKey, TextStyle>>;

export interface HeadingImage {
  url?: string;
  /** Tỉ lệ rộng/cao của ảnh */
  ratio?: number;
  /** Prompt tạo ảnh bằng AI (tự sinh từ bài đọc, sửa được) */
  prompt?: string;
}

export interface MatchingHeadingsSettings {
  layout: HeadingsLayoutId;
  fontFamily: string;
  fontSizePt: number;
  headingFontSizePt: number;
  lineHeight: number;
  paragraphGapMm: number;
  imageWidthMm: number;
  firstLineIndentMm: number;
  showExerciseTitle: boolean;
  showInstruction: boolean;
  showPassageTitle: boolean;
  /** false = không in bài đọc, chỉ in danh sách Paragraph n – ý chính (bài đọc nằm ở trang khác) */
  showPassage?: boolean;
  showImage: boolean;
  pageBreakBefore: boolean;
}

export interface MatchingHeadingsData {
  /** Định dạng từng từ của các ô chữ sửa trên trang A4 (xem services/richFields.ts) */
  richMarks?: import('../richFields.ts').RichMarks;
  exerciseTitle: string;
  instruction: string;
  passageTitle: string;
  exerciseNumber?: number;
  paragraphs: HeadingItem[];
  ideas: HeadingItem[];
  image?: HeadingImage;
  textStyles?: HeadingTextStyles;
  settings: MatchingHeadingsSettings;
}

export const DEFAULT_HEADINGS_SETTINGS: MatchingHeadingsSettings = {
  layout: 'list_columns',
  fontFamily: 'Quicksand',
  fontSizePt: 10.5,
  headingFontSizePt: 14,
  lineHeight: 1.5,
  paragraphGapMm: 2.5,
  imageWidthMm: 62,
  firstLineIndentMm: 8,
  showExerciseTitle: true,
  showInstruction: false,
  showPassageTitle: true,
  showImage: true,
  pageBreakBefore: false,
};

let counter = 0;
export const newHeadingId = (prefix: string): string => {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
};

/** 0 -> a, 25 -> z, 26 -> aa */
export const ideaLabel = (index: number): string => {
  let n = index;
  let s = '';
  do {
    s = String.fromCharCode(97 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
};

export const createMatchingHeadings = (partial?: Partial<MatchingHeadingsData>): MatchingHeadingsData => ({
  exerciseTitle: 'MATCH EACH PARAGRAPH WITH ITS MAIN IDEA',
  instruction: 'Match each paragraph with its main idea.',
  passageTitle: '',
  paragraphs: [],
  ideas: [],
  image: {},
  ...partial,
  settings: { ...DEFAULT_HEADINGS_SETTINGS, ...(partial?.settings || {}) },
});

export const moveHeadingItem = <T,>(list: T[], from: number, to: number): T[] => {
  if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

export const shuffleHeadingItems = <T,>(list: T[], random: () => number = Math.random): T[] => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export const validateHeadings = (data: MatchingHeadingsData): { errors: string[]; warnings: string[] } => {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (data.paragraphs.length === 0) errors.push('Chưa có đoạn văn nào trong bài đọc.');
  if (data.ideas.length === 0) errors.push('Chưa có ý chính nào.');
  data.paragraphs.forEach((p, i) => { if (!p.text.trim()) errors.push(`Đoạn ${i + 1} đang trống.`); });
  data.ideas.forEach((d, i) => { if (!d.text.trim()) errors.push(`Ý chính ${ideaLabel(i)} đang trống.`); });
  if (data.ideas.length !== data.paragraphs.length) warnings.push('Số ý chính khác số đoạn văn.');
  return { errors, warnings };
};

// ───────────── Định dạng chữ theo từng thành phần ─────────────

export const setHeadingStyle = (styles: HeadingTextStyles | undefined, key: HeadingStyleKey, patch: Partial<TextStyle>): HeadingTextStyles => {
  const merged: TextStyle = { ...(styles?.[key] || {}), ...patch };
  (Object.keys(merged) as (keyof TextStyle)[]).forEach((k) => { if (merged[k] === undefined) delete merged[k]; });
  const next: HeadingTextStyles = { ...(styles || {}) };
  if (Object.keys(merged).length === 0) delete next[key];
  else next[key] = merged;
  return next;
};

export const bumpHeadingSize = (styles: HeadingTextStyles | undefined, key: HeadingStyleKey, base: number, delta: number): HeadingTextStyles => {
  const cur = styles?.[key]?.sizePt ?? base;
  const next = Math.min(30, Math.max(7, Math.round((cur + delta) * 2) / 2));
  return setHeadingStyle(styles, key, { sizePt: next });
};

// ───────────── Smart Paste ─────────────

export interface ParsedHeadings {
  ok: boolean;
  exerciseTitle: string;
  passageTitle: string;
  paragraphs: string[];
  ideas: string[];
  /** Chỉ có danh sách nối (không dán bài đọc): các đoạn là chỗ trống, không in bài đọc */
  listOnly?: boolean;
  warnings: string[];
}

const IDEA_RE = /^([a-zA-Z])\s*[.)]\s+(.+)$/;
// "1. Paragraph 1" (có thể kèm luôn ý chính "a. ..." trên cùng dòng)
const PARA_LABEL_RE = /^\d{1,2}\s*[.)]\s*(?:Paragraph|Đoạn|Para\.?)\s*\d*\s*(.*)$/i;

/**
 * Tách văn bản dán vào: [tiêu đề bài] [tiêu đề bài đọc] đoạn văn… rồi "1. Paragraph 1  a. ý chính" …
 * - Các đoạn văn cách nhau bằng dòng trống (nếu không có dòng trống thì mỗi dòng là một đoạn).
 * - Các dòng "a. …" là ý chính; dòng "1. Paragraph n" chỉ là nhãn và được bỏ.
 */
export const parseHeadingsText = (raw: string): ParsedHeadings => {
  const warnings: string[] = [];
  const lines = raw.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim());
  const ideas: string[] = [];
  const body: string[] = [];
  let inList = false;
  let labelCount = 0;
  for (const line of lines) {
    if (!line) { body.push(''); continue; }
    const pl = PARA_LABEL_RE.exec(line);
    if (pl) {
      inList = true;
      labelCount++;
      const rest = pl[1].trim();
      const im = IDEA_RE.exec(rest);
      if (im) ideas.push(im[2].trim());
      continue;
    }
    const im = IDEA_RE.exec(line);
    if (im && (inList || ideas.length > 0 || /^[a-f]$/i.test(im[1]))) {
      inList = true;
      ideas.push(im[2].trim());
      continue;
    }
    if (inList && ideas.length > 0) { ideas[ideas.length - 1] += ` ${line}`; continue; }
    body.push(line);
  }

  // Dòng tiêu đề viết hoa ở đầu văn bản (không cần dòng trống ngăn cách)
  const isTitleLine = (s: string) => s.length > 0 && s.length <= 80 && !/[.!?]$/.test(s) && s === s.toUpperCase() && /[A-Z]/.test(s);
  let exerciseTitle = '';
  let passageTitle = '';
  let start = 0;
  while (start < body.length && !body[start]) start++;
  while (start < body.length && isTitleLine(body[start])) {
    if (!exerciseTitle && /MATCH|MAIN IDEA|HEADING|PARAGRAPH/i.test(body[start])) exerciseTitle = body[start];
    else if (!passageTitle) passageTitle = body[start];
    else break;
    start++;
  }
  const rest = body.slice(start);

  // Gom các dòng thành khối theo dòng trống
  const blocks: string[][] = [];
  let cur: string[] = [];
  rest.forEach((l) => { if (!l) { if (cur.length) blocks.push(cur); cur = []; } else cur.push(l); });
  if (cur.length) blocks.push(cur);
  const paragraphs: string[] = (blocks.length > 1 ? blocks.map((b) => b.join(' ')) : blocks.flat()).filter(Boolean);

  let listOnly = false;
  if (paragraphs.length === 0 && labelCount > 0) {
    listOnly = true;
    for (let k = 0; k < labelCount; k++) paragraphs.push('');
  }
  if (paragraphs.length === 0) warnings.push('Không thấy đoạn văn nào.');
  if (ideas.length === 0) warnings.push('Không thấy danh sách ý chính a., b., c.');
  return { ok: paragraphs.length > 0 && ideas.length > 0, exerciseTitle, passageTitle, paragraphs, ideas, listOnly, warnings };
};
