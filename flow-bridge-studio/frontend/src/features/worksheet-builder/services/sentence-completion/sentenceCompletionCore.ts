// Dữ liệu và hàm thuần cho bài Sentence Completion – Grammar Practice:
// một bài gom 4 kiểu bài câu ngắn (khung từ / từ trong ngoặc / viết lại với gợi ý / hai cột at-on-in),
// có Target Grammar / Target Word (từ hoặc cấu trúc trọng tâm) và mã QR audio khi bài có nghe.
// Dự án làm giáo trình: KHÔNG có đáp án, chỉ có câu ví dụ (tùy chọn) để học sinh nhìn mẫu.

import type { ListeningAudio } from '../listening/listeningGapFillCore.ts';
import type { TextStyle } from '../matching-pictures/matchingPicturesCore.ts';
import { parseGapFillingText, passageSentences } from '../gap-filling/gapFillingCore.ts';

export type SentenceLayoutId = 'word_bank' | 'brackets' | 'transform' | 'two_columns' | 'error_correction' | 'rewrite' | 'dialogue_order' | 'dialogue_gap_fill' | 'pos_neg' | 'q_and_a';

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
  { id: 'error_correction', label: '5. Tìm lỗi và sửa', typeLabel: 'Error Correction', desc: 'Mỗi câu có một lỗi sai; bên phải có đường kẻ để học sinh viết lại câu đã sửa' },
  { id: 'dialogue_order', label: '7. Sắp xếp hội thoại', typeLabel: 'Dialogue Ordering', desc: 'Mỗi dòng thoại "Amy: …" có đường kẻ ngắn ở đầu để điền số thứ tự, tên người nói tô màu (người 1 đỏ, người 2 xanh), rồi lời thoại' },
  { id: 'dialogue_gap_fill', label: '10. Write – Hội thoại điền từ', typeLabel: 'Write – Dialogue Gap Fill', desc: 'Bài Write: tiêu đề cam, tên người nói màu đen và chỗ trống đánh số (1), (2)…' },
  { id: 'rewrite', label: '6. Viết lại câu (xếp dọc)', typeLabel: 'Rewrite Sentences', desc: 'Câu gốc một dòng; bên dưới là phần mở đầu cho sẵn (I prefer …) rồi đường kẻ dài để viết tiếp' },
  { id: 'pos_neg', label: '8. Khẳng định → Phủ định (2 cột)', typeLabel: 'Positive / Negative', desc: 'Hai cột có tiêu đề POSITIVE / NEGATIVE: cột trái là câu khẳng định đầy đủ, cột phải là câu phủ định có chỗ trống (I ______ tea.)' },
  { id: 'q_and_a', label: '9. Hỏi và trả lời (3 cột)', typeLabel: 'Questions and Answers', desc: 'Ba cột: gợi ý (you / get up), câu hỏi có chỗ trống ở đầu (______ at seven o\'clock?), câu trả lời cho sẵn phần đầu (Yes, I ______.)' },
];

export interface SentenceItem {
  id: string;
  /** Câu có chỗ trống ______ (hoặc phần đầu câu trả lời ở layout "Viết lại") */
  text: string;
  /** Gợi ý: (money/buy), (I'm not going out / cold)… */
  hint?: string;
  /** Đáp án mẫu cho câu ví dụ (hiện chữ đỏ gạch chân khi bật Show Example) */
  example?: string;
  /** Layout "Khẳng định → Phủ định": câu phủ định có chỗ trống (cột phải). Layout "Viết lại câu": phần mở đầu cho sẵn của câu trả lời: I prefer, You don't … */
  starter?: string;
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
  /** Định dạng từng từ của các ô chữ sửa trên trang A4 (xem services/richFields.ts) */
  richMarks?: import('../richFields.ts').RichMarks;
  exerciseTitle: string;
  instruction: string;
  /** Từ / cấu trúc ngữ pháp trọng tâm, ví dụ "enough", "too … to", "at / on / in" */
  targetWord: string;
  /** Tiêu đề hai cột của layout "Khẳng định → Phủ định" */
  columnHeaders?: [string, string];
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
  sentences: { text: string; hint?: string; starter?: string }[];
  layout: SentenceLayoutId;
  columnHeaders?: [string, string];
  warnings: string[];
}

const HINT_END_RE = /\s*\(([^()]{2,60})\)\s*$/;
const HINT_START_RE = /^\s*\(([^()]{2,80})\)\s*(.*)$/;
const ERROR_TITLE_RE = /\b(?:find|spot|correct)\b.*\b(?:mistakes?|errors?)\b|tìm lỗi/i;
const REWRITE_TITLE_RE = /\brewrite\b|viết lại/i;
const NUMBERED_LINE_RE = /^\d{1,3}\s*[.)]\s*\S/;

/** Bỏ dấu gạch dưới / chấm / gạch ngang ở cuối phần mở đầu: "I prefer ______" -> "I prefer" */
const cleanStarter = (s: string): string => s.replace(/[\s_.…–-]+$/, '').trim();

/** Layout "Viết lại câu": dòng đánh số là câu gốc, dòng không số ngay sau đó là phần mở đầu cho sẵn */
const parseRewriteSentences = (passage: string): { text: string; starter?: string }[] => {
  const items: { text: string; starter?: string }[] = [];
  for (const line of passage.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean)) {
    if (NUMBERED_LINE_RE.test(line) || items.length === 0) {
      items.push({ text: line.replace(/^\d{1,3}\s*[.)]\s*/, '') });
      continue;
    }
    const cur = items[items.length - 1];
    const part = cleanStarter(line);
    cur.starter = cur.starter ? `${cur.starter} ${part}` : part;
  }
  return items;
};

/** Đoán từ trọng tâm từ tiêu đề: cụm in nghiêng/hoa sau "USE", "USING" hoặc "WITH THESE WORDS" */
export const guessTargetWord = (title: string): string => {
  const m = /\bUSE\s+(?:THE\s+)?([A-Za-z/’' …-]{2,24}?)(?=\s+(?:WITH|\+|\(|TO\b|AND\b|IN\b)|[.:,]|$)/i.exec(title);
  const word = (m?.[1] || '').trim();
  if (!word || /^(these|the|a|an|words?|verbs?)\b/i.test(word)) return '';
  return word.toLowerCase();
};

const DIALOGUE_ORDER_TITLE_RE = /\b(?:dialogue|conversation)\b.*\border\b|correct order|sắp xếp hội thoại/i;
const DIALOGUE_LINE_RE = /^([A-Z][A-Za-z]{1,20}):\s*(.*)$/;

/** Bài Write dạng hội thoại: mỗi lượt nói bắt đầu bằng tên, trong câu có (1) ______. */
const parseDialogueGapFill = (raw: string, forced = false): ParsedSentenceCompletion | null => {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n').map((line) => line.trim()).filter(Boolean);
  const start = lines.findIndex((line) => DIALOGUE_LINE_RE.test(line));
  const speakerLineCount = lines.filter((line) => DIALOGUE_LINE_RE.test(line)).length;
  const hasBlanks = lines.some((line) => /_{3,}/.test(line));
  if (start < 0 || (!forced && (speakerLineCount < 2 || !hasBlanks))) return null;

  const sentences: { text: string }[] = [];
  for (const line of lines.slice(start)) {
    if (DIALOGUE_LINE_RE.test(line)) sentences.push({ text: line });
    else if (sentences.length) sentences[sentences.length - 1].text += ` ${line}`;
  }
  const speakers = new Set(sentences.map((item) => DIALOGUE_LINE_RE.exec(item.text)?.[1]).filter(Boolean));
  if (!forced && speakers.size < 2) return null;
  const warnings = sentences.length === 0 ? ['Không thấy dòng thoại dạng "Vicky: …".'] : [];
  return { ok: sentences.length > 0, title: lines.slice(0, start).join(' ').trim(), targetWord: '', words: [], sentences, layout: 'dialogue_gap_fill', warnings };
};

/** Các dòng "1. câu khẳng định <Tab> câu phủ định có chỗ trống" */
const parsePosNegRows = (rows: string[]): { text: string; starter?: string }[] => {
  const out: { text: string; starter?: string }[] = [];
  for (const line of rows) {
    const body = line.replace(/^\d{1,3}\s*[.)]\s*/, '');
    const parts = body.split(/\t+|\s{2,}/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) out.push({ text: parts[0], starter: parts.slice(1).join(' ') });
    else {
      const m = /^(.*?[.!?])\s+(\S.*_{3,}.*)$/.exec(body);
      out.push(m ? { text: m[1], starter: m[2] } : { text: body });
    }
  }
  return out;
};

/** Layout "Hỏi và trả lời": "1. gợi ý <Tab> câu hỏi có ______ <Tab> câu trả lời cho sẵn" */
const parseQAndA = (raw: string): ParsedSentenceCompletion => {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/\u00a0/g, ' ').trim()).filter(Boolean);
  const first = lines.findIndex((l) => NUMBERED_LINE_RE.test(l));
  const start = first < 0 ? lines.length : first;
  // Dòng bị ngắt: "1. you / get up" rồi dòng kế bắt đầu bằng ______ -> ghép lại thành một hàng
  const rows: string[] = [];
  for (const line of lines.slice(start)) {
    if (!NUMBERED_LINE_RE.test(line) && rows.length > 0) rows[rows.length - 1] += `\t${line}`;
    else rows.push(line);
  }
  const sentences = rows.map((row) => {
    let parts = row.replace(/^\d{1,3}\s*[.)]\s*/, '').split(/\t+|\s{2,}/).map((p) => p.trim()).filter(Boolean);
    // Câu hỏi và câu trả lời dính nhau: "______ at seven o'clock? Yes, I ______."
    if (parts.length === 2) {
      const m = /^(.*?\?)\s+((?:Yes|No)\b.*)$/i.exec(parts[1]);
      if (m) parts = [parts[0], m[1], m[2]];
    }
    if (parts.length >= 3) return { hint: parts[0], text: parts[1], starter: parts.slice(2).join(' ') };
    if (parts.length === 2) return { hint: parts[0], text: parts[1] };
    return { text: parts[0] || '' };
  });
  const warnings = sentences.length === 0 ? ['Không thấy câu nào. Mỗi dòng: 1. gợi ý (Tab) câu hỏi có ______ (Tab) câu trả lời'] : [];
  return { ok: sentences.length > 0, title: lines.slice(0, start).join(' ').trim(), targetWord: '', words: [], sentences, layout: 'q_and_a', warnings };
};

const POS_NEG_HEAD_RE = /^\s*(POSITIVE|AFFIRMATIVE)[\s\t|]+(NEGATIVE)\s*$/i;

/** Bài 2 cột "POSITIVE  NEGATIVE": dòng tiêu đề cột, rồi mỗi dòng "1. câu khẳng định <Tab> câu phủ định có chỗ trống" */
const parsePosNeg = (raw: string, forced = false): ParsedSentenceCompletion | null => {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/ /g, ' ').trim()).filter(Boolean);
  const headIdx = lines.findIndex((l) => POS_NEG_HEAD_RE.test(l));
  if (headIdx < 0) {
    if (!forced) return null;
    const first = lines.findIndex((l) => NUMBERED_LINE_RE.test(l));
    const start = first < 0 ? lines.length : first;
    const rows = parsePosNegRows(lines.slice(start));
    const warnings = rows.length === 0 ? ['Không thấy câu nào. Mỗi dòng: 1. câu khẳng định (Tab) câu phủ định có ______'] : [];
    return { ok: rows.length > 0, title: lines.slice(0, start).join(' ').trim(), targetWord: '', words: [], sentences: rows, layout: 'pos_neg', warnings };
  }
  const heads = lines[headIdx].split(/[\s\t|]+/).filter(Boolean).map((h) => h.toUpperCase());
  const title = lines.slice(0, headIdx).join(' ').trim();
  const sentences = parsePosNegRows(lines.slice(headIdx + 1));
  const warnings = sentences.length === 0 ? ['Không thấy câu nào dưới dòng POSITIVE / NEGATIVE.'] : [];
  return { ok: sentences.length > 0, title, targetWord: '', words: [], sentences, layout: 'pos_neg', columnHeaders: [heads[0], heads[1]], warnings };
};


/** Layout chọn sẵn trong hộp Smart Paste: hướng dẫn định dạng + ví dụ, dùng cho cả nút "Viết lại bằng AI" */
export const SENTENCE_PASTE_FORMATS: Record<SentenceLayoutId, { hint: string; example: string }> = {
  word_bank: { hint: 'Dòng tiêu đề viết hoa, dòng khung từ (cách nhau bằng khoảng trắng), rồi các câu 1., 2., … có chỗ trống ______.', example: "COMPLETE THE SENTENCES. USE ENOUGH WITH THESE WORDS\nbig   eat   loud   milk   old\n\n1. 'Is there ______ in your coffee?'\n2. Can you hear the radio? Is it ______ for you?" },
  brackets: { hint: 'Tiêu đề, rồi các câu 1., 2., … có chỗ trống ______; gợi ý trong ngoặc ở cuối câu.', example: 'COMPLETE THE SENTENCES.\n\n1. We haven’t got ______ a new car. (money/buy)\n2. This knife isn’t ______ tomatoes. (sharp/cut)' },
  transform: { hint: 'Tiêu đề, rồi các câu 1., 2., … bắt đầu bằng gợi ý trong ngoặc, sau đó là phần đầu câu trả lời có chỗ trống.', example: "REWRITE THE SENTENCES.\n\n1. (I'm not going out / cold) It's ______ to go out.\n2. (She can't lift it / heavy) It's ______ for her." },
  two_columns: { hint: 'Tiêu đề, rồi các câu ngắn 1., 2., … có chỗ trống ______ (chia hai cột).', example: 'COMPLETE WITH AT / ON / IN.\n\n1. I get up ______ seven o’clock.\n2. We have class ______ Monday.' },
  error_correction: { hint: 'Tiêu đề (có chữ find / correct the mistakes), rồi các câu 1., 2., … mỗi câu có một lỗi sai.', example: 'FIND THE MISTAKES AND CORRECT THEM.\n\n1. She don’t like cheese.\n2. They is playing football.' },
  rewrite: { hint: 'Tiêu đề có chữ "rewrite"; mỗi câu gốc đánh số 1., 2., … rồi một dòng không số ngay bên dưới là phần mở đầu cho sẵn.', example: 'REWRITE THE SENTENCES.\n\n1. I like tea more than coffee.\nI prefer\n2. Don’t talk in class.\nYou must not' },
  dialogue_order: { hint: 'Tiêu đề có chữ "dialogue … order"; mỗi dòng một lời thoại dạng "Amy: …".', example: 'PUT THE DIALOGUE IN THE CORRECT ORDER.\n\nAmy: Hi, Tom!\nTom: Hello, Amy. How are you?' },
  dialogue_gap_fill: { hint: 'Tiêu đề bài Write, rồi mỗi lượt nói một dòng dạng "Vicky: …"; chỗ trống ghi (1) ______, (2) ______, …', example: "WRITE DO, DOES, DON'T OR DOESN'T\n\nVicky: (1) ______ you like ice cream?\nZoe: Yes, I (2) ______.\nVicky: (3) ______ Corky like ice cream, too?\nZoe: Yes, he (4) ______." },
  pos_neg: { hint: 'Tiêu đề, dòng "POSITIVE   NEGATIVE", rồi mỗi dòng: 1. câu khẳng định (Tab) câu phủ định có chỗ trống ______.', example: 'WRITE\nPOSITIVE\tNEGATIVE\n1. I drink milk.\tI ______ tea.\n2. We play basketball.\tWe ______ football.' },
  q_and_a: { hint: 'Tiêu đề, rồi mỗi dòng: 1. gợi ý (Tab) câu hỏi có chỗ trống ______ (Tab) câu trả lời cho sẵn phần đầu.', example: 'WRITE QUESTIONS AND ANSWERS\n1. you / get up\t______ at seven o’clock?\tYes, I ______.\n2. they / drink\t______ juice in the morning?\tNo, they ______.' },
};

export const parseSentenceCompletionText = (raw: string, forced?: SentenceLayoutId): ParsedSentenceCompletion => {
  if (forced === 'pos_neg') return parsePosNeg(raw, true)!;
  if (forced === 'q_and_a') return parseQAndA(raw);
  if (forced === 'dialogue_gap_fill') return parseDialogueGapFill(raw, true)!;
  const posNeg = forced ? null : parsePosNeg(raw);
  if (posNeg) return posNeg;
  const dialogueGapFill = forced ? null : parseDialogueGapFill(raw);
  if (dialogueGapFill && !DIALOGUE_ORDER_TITLE_RE.test(dialogueGapFill.title)) return dialogueGapFill;
  const base = parseGapFillingText(raw);
  if (forced === 'rewrite' || forced === 'dialogue_order') {
    const items = forced === 'rewrite'
      ? parseRewriteSentences(base.passage)
      : base.passage.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim().replace(/^\d{1,3}\s*[.)]\s*/, '').replace(/^[_\s]+(?=[A-Z])/, '')).filter(Boolean).map((text) => ({ text }));
    return { ok: items.length > 0, title: base.title, targetWord: '', words: [], sentences: items, layout: forced, warnings: items.length === 0 ? ['Không thấy câu nào.'] : [] };
  }
  if (!forced && DIALOGUE_ORDER_TITLE_RE.test(base.title)) {
    const items = base.passage
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((l) => l.trim().replace(/^\d{1,3}\s*[.)]\s*/, '').replace(/^[_\s]+(?=[A-Z])/, ''))
      .filter(Boolean)
      .map((text) => ({ text }));
    const warnings = items.length === 0 ? ['Không thấy dòng thoại nào. Mỗi dòng viết dạng "Amy: …".'] : [];
    return { ok: items.length > 0, title: base.title, targetWord: '', words: [], sentences: items, layout: 'dialogue_order', warnings };
  }
  if (!forced && !ERROR_TITLE_RE.test(base.title) && REWRITE_TITLE_RE.test(base.title)) {
    const items = parseRewriteSentences(base.passage);
    const warnings = items.length === 0 ? ['Không thấy câu nào. Mỗi câu một dòng đánh số 1., 2., …, dòng mở đầu (I prefer …) ngay bên dưới.'] : [];
    return { ok: items.length > 0, title: base.title, targetWord: '', words: [], sentences: items, layout: 'rewrite', warnings };
  }
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
  const layout: SentenceLayoutId = ERROR_TITLE_RE.test(base.title) ? 'error_correction' : startHints >= 2 ? 'transform' : endHints >= 2 ? 'brackets' : base.words.length >= 3 ? 'word_bank' : 'two_columns';
  const warnings: string[] = [];
  if (sentences.length === 0) warnings.push('Không thấy câu nào. Mỗi câu một dòng, đánh số 1., 2., …');
  return { ok: sentences.length > 0, title: base.title, targetWord: guessTargetWord(base.title), words: base.words, sentences, layout: forced ?? layout, warnings };
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
