// Dữ liệu và hàm thuần cho bài Grammar & Vocabulary Multiple Choice dạng danh sách câu:
// mỗi câu có chỗ trống ________ và các lựa chọn a, b, c, d. Giáo trình: KHÔNG có đáp án, học sinh tự khoanh.

import type { TextStyle } from '../matching-pictures/matchingPicturesCore.ts';

export type McqLayoutId = 'original' | 'two_columns' | 'compact' | 'answer_grid' | 'question_blocks' | 'exam_style';

export interface McqLayoutMeta { id: McqLayoutId; label: string; desc: string }
export const MCQ_LAYOUTS: McqLayoutMeta[] = [
  { id: 'original', label: 'Original', desc: 'Mỗi câu một khối: câu hỏi, lựa chọn xếp 2 hoặc 4 cột bên dưới' },
  { id: 'two_columns', label: 'Two Columns', desc: 'Chia các câu thành hai cột trên trang' },
  { id: 'compact', label: 'Compact', desc: 'Tiết kiệm giấy: lựa chọn nằm trên một dòng, khoảng cách hẹp' },
  { id: 'answer_grid', label: 'Answer Grid', desc: 'Bảng lưới: mỗi hàng một câu, các cột là lựa chọn a, b, c, d' },
  { id: 'question_blocks', label: 'Question Blocks', desc: 'Mỗi câu nằm trong một khung riêng' },
  { id: 'exam_style', label: 'Exam Style', desc: 'Kiểu đề thi: ô trả lời ở đầu câu, lựa chọn A. B. C. D. trên một dòng' },
];

export interface McqOption { id: string; text: string }
export interface McqQuestion { id: string; text: string; options: McqOption[] }

export type McqStyleKey = 'title' | 'instruction' | 'questions' | 'options';
export const MCQ_STYLE_LABELS: Record<McqStyleKey, string> = {
  title: 'Tiêu đề bài',
  instruction: 'Hướng dẫn',
  questions: 'Câu hỏi',
  options: 'Các lựa chọn',
};
export type McqTextStyles = Partial<Record<McqStyleKey, TextStyle>>;

export interface GrammarMcqSettings {
  layout: McqLayoutId;
  fontFamily: string;
  fontSizePt: number;
  headingFontSizePt: number;
  lineHeight: number;
  questionGapMm: number;
  optionLabelStyle: 'lowercase' | 'uppercase';
  showNumbering: boolean;
  showAnswerBoxes: boolean;
  /** Số cột lựa chọn: tự động (4 cột nếu lựa chọn ngắn, ngược lại 2 cột) hoặc cố định */
  optionColumns: 'auto' | 1 | 2 | 4;
  showExerciseTitle: boolean;
  showInstruction: boolean;
  pageBreakBefore: boolean;
}

export interface GrammarMcqData {
  exerciseTitle: string;
  instruction: string;
  exerciseNumber?: number;
  questions: McqQuestion[];
  textStyles?: McqTextStyles;
  settings: GrammarMcqSettings;
}

export const DEFAULT_MCQ_SETTINGS: GrammarMcqSettings = {
  layout: 'original',
  fontFamily: 'Arial',
  fontSizePt: 10.5,
  headingFontSizePt: 12.5,
  lineHeight: 1.4,
  questionGapMm: 3.5,
  optionLabelStyle: 'lowercase',
  showNumbering: true,
  showAnswerBoxes: false,
  optionColumns: 'auto',
  showExerciseTitle: true,
  showInstruction: true,
  pageBreakBefore: false,
};

let counter = 0;
export const newMcqId = (prefix = 'q'): string => {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
};

export const emptyOptions = (n = 4): McqOption[] => Array.from({ length: n }, () => ({ id: newMcqId('o'), text: '' }));
export const newQuestion = (text = ''): McqQuestion => ({ id: newMcqId('q'), text, options: emptyOptions() });

export const createGrammarMcq = (partial?: Partial<GrammarMcqData>): GrammarMcqData => ({
  exerciseTitle: 'CHOOSE THE CORRECT ANSWER.',
  instruction: '',
  questions: [],
  ...partial,
  settings: { ...DEFAULT_MCQ_SETTINGS, ...(partial?.settings || {}) },
});

/** a, b, c, … (hoặc A, B, C, …) */
export const optionLabel = (index: number, style: 'lowercase' | 'uppercase' = 'lowercase'): string => {
  const ch = String.fromCharCode(97 + (index % 26));
  return style === 'uppercase' ? ch.toUpperCase() : ch;
};

/** Số cột lựa chọn cho một câu: cố định theo cài đặt, hoặc tự động (4 cột khi mọi lựa chọn ngắn) */
export const resolveOptionColumns = (q: McqQuestion, setting: GrammarMcqSettings['optionColumns']): 1 | 2 | 4 => {
  if (setting !== 'auto') return setting;
  const n = q.options.length;
  const longest = Math.max(0, ...q.options.map((o) => o.text.length));
  if (n >= 4 && longest <= 16) return 4;
  return n <= 1 ? 1 : 2;
};

/** Tách câu thành chữ và chỗ trống (chuỗi gạch dưới liên tiếp) để hiển thị */
export const splitBlanks = (text: string): { type: 'text' | 'blank'; text: string }[] =>
  text.split(/(_{2,})/).filter((p) => p !== '').map((p) => ({ type: /^_{2,}$/.test(p) ? 'blank' as const : 'text' as const, text: p }));

// ───────────── Nhập nhanh (Smart Paste) ─────────────

export interface ParsedMcq {
  ok: boolean;
  title: string;
  questions: { text: string; options: string[] }[];
  warnings: string[];
}

const Q_RE = /^\s*(\d{1,3})\s*[.)]\s*(.+?)\s*$/;
const OPT_START_RE = /^\s*\(?([a-dA-D])[.)]\s+/;
/** Tách nhiều lựa chọn trên cùng một dòng: "a. ran  b. was running  c. has run  d. had been running" */
const splitInlineOptions = (line: string): string[] => {
  const parts = line.split(/(?:^|\s+)(?=\(?[a-dA-D][.)]\s)/).map((p) => p.trim()).filter(Boolean);
  return parts.map((p) => p.replace(/^\(?[a-dA-D][.)]\s+/, '').trim()).filter((p) => p !== '');
};

export const parseMcqText = (raw: string): ParsedMcq => {
  const clean = raw
    .replace(/\r\n?/g, '\n')
    .replace(/[\u000b\u000c\u0085\u2028\u2029]/g, '\n')
    .replace(/[\u00a0\u2007\u202f\u200b\ufeff]/g, ' ')
    .replace(/[☐□▢■▪]/g, '');
  const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean);
  const titleParts: string[] = [];
  const questions: { text: string; options: string[] }[] = [];
  for (const line of lines) {
    const q = Q_RE.exec(line);
    // "a. xxx" cũng khớp mẫu "1." khi nhãn là chữ số; chỉ coi là câu hỏi khi bắt đầu bằng số
    if (q && !OPT_START_RE.test(line)) {
      questions.push({ text: q[2], options: [] });
      continue;
    }
    const cur = questions[questions.length - 1];
    if (OPT_START_RE.test(line) && cur) {
      cur.options.push(...splitInlineOptions(line));
      continue;
    }
    if (cur) {
      // dòng tiếp theo của câu hỏi (chưa có lựa chọn) hoặc của lựa chọn cuối
      if (cur.options.length === 0) cur.text += ` ${line}`;
      else cur.options[cur.options.length - 1] += ` ${line}`;
    } else {
      titleParts.push(line.replace(/^\d+\s+(?=[A-Z])/, ''));
    }
  }
  const warnings: string[] = [];
  if (questions.length === 0) warnings.push('Không tìm thấy câu nào dạng "1. …".');
  const noOpts = questions.filter((q) => q.options.length === 0).length;
  if (noOpts > 0 && noOpts < questions.length) warnings.push(`${noOpts} câu chưa có lựa chọn a, b, c, d.`);
  return { ok: questions.length > 0, title: titleParts.join(' ').trim(), questions, warnings };
};

// ───────────── Chỉnh sửa ─────────────

export const moveMcq = <T,>(list: T[], from: number, to: number): T[] => {
  if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

export const shuffleOptionsOf = (q: McqQuestion, random: () => number = Math.random): McqQuestion => {
  const opts = [...q.options];
  for (let i = opts.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [opts[i], opts[j]] = [opts[j], opts[i]];
  }
  return { ...q, options: opts };
};

export const validateGrammarMcq = (d: GrammarMcqData): { errors: string[]; warnings: string[] } => {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (d.questions.length === 0) errors.push('Chưa có câu hỏi nào.');
  d.questions.forEach((q, i) => {
    if (!q.text.trim()) errors.push(`Câu ${i + 1} đang trống.`);
    const filled = q.options.filter((o) => o.text.trim()).length;
    if (filled < 2) warnings.push(`Câu ${i + 1} có dưới 2 lựa chọn.`);
    else if (filled < q.options.length) warnings.push(`Câu ${i + 1} có lựa chọn để trống.`);
  });
  return { errors, warnings };
};

// ───────────── Định dạng chữ theo thành phần ─────────────

export const setMcqStyle = (styles: McqTextStyles | undefined, key: McqStyleKey, patch: Partial<TextStyle>): McqTextStyles => {
  const merged: TextStyle = { ...(styles?.[key] || {}), ...patch };
  (Object.keys(merged) as (keyof TextStyle)[]).forEach((k) => { if (merged[k] === undefined) delete merged[k]; });
  const next: McqTextStyles = { ...(styles || {}) };
  if (Object.keys(merged).length === 0) delete next[key];
  else next[key] = merged;
  return next;
};

export const bumpMcqSize = (styles: McqTextStyles | undefined, key: McqStyleKey, base: number, delta: number): McqTextStyles => {
  const cur = styles?.[key]?.sizePt ?? base;
  return setMcqStyle(styles, key, { sizePt: Math.min(30, Math.max(7, Math.round((cur + delta) * 2) / 2)) });
};
