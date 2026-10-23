// Dữ liệu và hàm thuần cho bài Grammar & Vocabulary Multiple Choice dạng danh sách câu:
// mỗi câu có chỗ trống ________ và các lựa chọn a, b, c, d. Giáo trình: KHÔNG có đáp án, học sinh tự khoanh.

import type { TextStyle } from '../matching-pictures/matchingPicturesCore.ts';

export type McqLayoutId = 'original' | 'two_columns' | 'compact' | 'answer_grid' | 'question_blocks' | 'exam_style' | 'pictures' | 'comic_story';

export interface McqLayoutMeta { id: McqLayoutId; label: string; desc: string }
export const MCQ_LAYOUTS: McqLayoutMeta[] = [
  { id: 'original', label: 'Original', desc: 'Mỗi câu một khối: câu hỏi, lựa chọn xếp 2 hoặc 4 cột bên dưới' },
  { id: 'two_columns', label: 'Two Columns', desc: 'Chia các câu thành hai cột trên trang' },
  { id: 'compact', label: 'Compact', desc: 'Tiết kiệm giấy: lựa chọn nằm trên một dòng, khoảng cách hẹp' },
  { id: 'answer_grid', label: 'Answer Grid', desc: 'Bảng lưới: mỗi hàng một câu, các cột là lựa chọn a, b, c, d' },
  { id: 'question_blocks', label: 'Question Blocks', desc: 'Mỗi câu nằm trong một khung riêng' },
  { id: 'exam_style', label: 'Exam Style', desc: 'Kiểu đề thi: ô trả lời ở đầu câu, lựa chọn A. B. C. D. trên một dòng' },
];

/** imageUrl: chỉ dùng ở bài Listening MC dạng ảnh A/B/C (text khi đó là mô tả ảnh, không in) */
export interface McqOption { id: string; text: string; imageUrl?: string }
/** heading: dòng tiêu đề phần in trước câu này (bài phát âm: "A. Choose the word …"); số câu đếm lại từ 1 sau mỗi tiêu đề */
export interface McqQuestion { id: string; text: string; options: McqOption[]; heading?: string }

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
  /** Định dạng từng từ của các ô chữ sửa trên trang A4 (xem services/richFields.ts) */
  richMarks?: import('../richFields.ts').RichMarks;
  /** Bài phát âm: lựa chọn là từ ngắn, phần đặt trong [ ] được gạch chân */
  pronunciation?: boolean;
  /** Sentence Rearrangement / Sentence Construction: mỗi câu là các từ cách nhau bằng " / ", kèm dòng kẻ để viết lại, không có lựa chọn */
  sentenceMode?: 'rearrange' | 'construct';
  answerLineLength?: 'long' | 'medium' | 'short';
  answerLines?: number;
  exerciseTitle: string;
  instruction: string;
  exerciseNumber?: number;
  questions: McqQuestion[];
  textStyles?: McqTextStyles;
  settings: GrammarMcqSettings;
}

export const DEFAULT_MCQ_SETTINGS: GrammarMcqSettings = {
  layout: 'original',
  fontFamily: 'Quicksand',
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

/** Tách chữ và phần gạch chân: "[ch]air" → ch (gạch chân) + air */
export const splitUnderline = (text: string): { text: string; underline: boolean }[] =>
  text.split(/(\[[^\]]+\])/).filter((p) => p !== '').map((p) => (/^\[[^\]]+\]$/.test(p) ? { text: p.slice(1, -1), underline: true } : { text: p, underline: false }));

/** Gạch chân phần đang bôi đen [start, end) của chuỗi; bôi lại đúng phần đã gạch thì bỏ gạch */
export const toggleUnderline = (text: string, start: number, end: number): string => {
  if (start >= end) return text;
  const sel = text.slice(start, end);
  if (text[start - 1] === '[' && text[end] === ']') return text.slice(0, start - 1) + sel + text.slice(end + 1);
  return text.slice(0, start) + '[' + sel.replace(/[\[\]]/g, '') + ']' + text.slice(end);
};

/** Tách câu thành chữ và chỗ trống (chuỗi gạch dưới liên tiếp) để hiển thị */
export const splitBlanks = (text: string): { type: 'text' | 'blank'; text: string }[] =>
  text.split(/(_{2,})/).filter((p) => p !== '').map((p) => ({ type: /^_{2,}$/.test(p) ? 'blank' as const : 'text' as const, text: p }));

// ───────────── Nhập nhanh (Smart Paste) ─────────────

export interface ParsedMcq {
  ok: boolean;
  title: string;
  /** Dòng giải thích ngay dưới tiêu đề (vd. "You will hear an interview with a young pilot…") */
  instruction: string;
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

const LETTERS = ['a', 'b', 'c', 'd'];

/**
 * Lựa chọn viết KHÔNG có dấu chấm sau chữ cái (hay gặp khi copy từ PDF): "a he first went on an aeroplane."
 * Chỉ nhận khi chữ cái đúng là nhãn kế tiếp của câu đang đọc, để không nhầm với mạo từ "a" trong câu.
 * Cả dòng có thể chứa nhiều lựa chọn: "a to a town b to a city c to a village".
 */
const splitBareOptions = (line: string, expected: number): string[] | null => {
  const first = LETTERS[expected];
  if (!first || !new RegExp(`^${first}\\s+\\S`, 'i').test(line)) return null;
  const out: string[] = [];
  let rest = line.slice(first.length).trim();
  for (let i = expected + 1; i < LETTERS.length; i++) {
    const m = new RegExp(`\\s${LETTERS[i]}\\s+\\S`, 'i').exec(` ${rest}`);
    if (!m) break;
    // m.index tính trên chuỗi đã thêm 1 dấu cách ở đầu: dấu cách ở rest[m.index - 1], chữ cái nhãn ở rest[m.index]
    out.push(rest.slice(0, m.index - 1).trim());
    rest = rest.slice(m.index + 1).trim();
  }
  out.push(rest.trim());
  return out.filter(Boolean);
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
      const bare = splitBareOptions(line, cur.options.length);
      if (bare && bare.length) { cur.options.push(...bare); continue; }
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
  // Dòng đầu là tiêu đề; các dòng còn lại trước câu 1 là dòng giải thích dưới tiêu đề
  const [title = '', ...rest] = titleParts;
  return { ok: questions.length > 0, title: title.trim(), instruction: rest.join(' ').trim(), questions, warnings };
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

/** Bài phát âm: mỗi dòng "1. A. chair B. school C. couch D. children" → 4 lựa chọn (không có chữ câu hỏi) */
export const parsePronunciationText = (raw: string): string[][] =>
  raw.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean)
    .map((l) => l.replace(/^\d{1,3}\s*[.)]\s*/, ''))
    .map((l) => l.split(/(?:^|\s+)(?=\(?[a-dA-D][.)]\s)/).map((p) => p.replace(/^\(?[a-dA-D][.)]\s+/, '').trim()).filter(Boolean))
    .filter((o) => o.length >= 2);

/** Như parsePronunciationText nhưng giữ tiêu đề phần: dòng không có từ A–D (vd "A. Choose the word …") gắn vào câu kế tiếp */
export const parsePronunciationRows = (raw: string): { heading?: string; options: string[] }[] => {
  const rows: { heading?: string; options: string[] }[] = [];
  let heading: string | undefined;
  for (const line of raw.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean)) {
    const body = line.replace(/^\d{1,3}\s*[.)]\s*/, '');
    const opts = body.split(/(?:^|\s+)(?=\(?[a-dA-D][.)]\s)/).map((p) => p.replace(/^\(?[a-dA-D][.)]\s+/, '').trim()).filter(Boolean);
    if (opts.length >= 2) { rows.push({ heading, options: opts }); heading = undefined; }
    else if (line.length > 14 && line !== line.toUpperCase()) heading = line;
  }
  return rows;
};

/** Chuẩn hóa từ gợi ý: các từ cách nhau bằng " / " (chấp nhận "/" hoặc "|") */
export const normalizeFragments = (line: string): string => {
  const t = line.trim();
  if (/[/|]/.test(t)) return t.split(/\s*[/|]\s*/).map((p) => p.trim()).filter(Boolean).join(' / ');
  return t;
};

/** Smart Paste cho Sentence Writing: dòng viết HOA là tiêu đề, "1." đầu dòng bị bỏ, mỗi dòng còn lại là một câu */
export const parseSentenceLines = (raw: string): { title: string; sentences: string[] } => {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean);
  let title = '';
  if (lines[0] && lines[0].length <= 100 && lines[0] === lines[0].toUpperCase() && /[A-Z]/.test(lines[0]) && !/^\d/.test(lines[0]) && !lines[0].includes('/')) {
    title = lines.shift()!.replace(/^(exercise|bài|ex)\s*\d+\s*[:.\-]\s*/i, '');
  }
  const sentences: string[] = [];
  const numbered = lines.some((l) => /^\d{1,3}\s*[.)]\s*\S/.test(l));
  for (const l of lines) {
    const m = /^\d{1,3}\s*[.)]\s*(.*)$/.exec(l);
    if (m) sentences.push(normalizeFragments(m[1]));
    else if (numbered && sentences.length) sentences[sentences.length - 1] = normalizeFragments(`${sentences[sentences.length - 1]} ${l}`);
    else sentences.push(normalizeFragments(l.replace(/^[-•*]\s*/, '')));
  }
  return { title, sentences: sentences.filter(Boolean) };
};
