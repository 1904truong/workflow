// Dữ liệu và hàm thuần cho bài Listening Table Completion: bảng cần điền (có chỗ trống đánh số), ảnh/bản đồ,
// audio + QR, và các câu hỏi trả lời ngắn bên dưới. Giáo trình: KHÔNG có đáp án, chỗ trống chỉ là dòng kẻ.

import type { ListeningAudio } from '../listening/listeningGapFillCore.ts';
import type { TextStyle } from '../matching-pictures/matchingPicturesCore.ts';
import type { AiImagePlan } from '../ai/imagePlanSchema.ts';

export type TableLayoutId = 'image_table' | 'image_only';

export interface TableLayoutMeta { id: TableLayoutId; label: string; desc: string }
/** Layout sau này sẽ thêm vào đây */
export const TABLE_LAYOUTS: TableLayoutMeta[] = [
  { id: 'image_table', label: '1. Ảnh + Bảng', desc: 'Ảnh/bản đồ ở trên, bảng điền ở giữa, câu hỏi trả lời ngắn bên dưới; QR ở góc phải tiêu đề' },
  { id: 'image_only', label: '2. Chỉ ảnh / bản đồ', desc: 'Tiêu đề + dòng đề bài in đậm, QR góc phải, ảnh lớn ở giữa để học sinh vẽ đường đi hoặc ghi lên ảnh; không có bảng và câu hỏi' },
];

export interface TableRow { id: string; cells: string[] }
export interface TableData { columns: string[]; rows: TableRow[] }
export interface TableQuestion { id: string; text: string }

export type TableStyleKey = 'title' | 'instruction' | 'table' | 'questions';
export const TABLE_STYLE_LABELS: Record<TableStyleKey, string> = {
  title: 'Tiêu đề bài',
  instruction: 'Hướng dẫn',
  table: 'Nội dung bảng',
  questions: 'Các câu hỏi',
};
export type TableTextStyles = Partial<Record<TableStyleKey, TextStyle>>;

export interface TableImage {
  url?: string;
  /** Tỉ lệ rộng/cao của khung ảnh (tự theo ảnh thật khi có ảnh) */
  ratio?: number;
  prompt?: string;
  /** Ảnh thứ 2, 3, 4 khi settings.imageCount > 1 (ảnh thứ nhất là url/ratio ở trên) */
  extra?: { url?: string; ratio?: number }[];
}

export interface ListeningTableSettings {
  layout: TableLayoutId;
  fontFamily: string;
  fontSizePt: number;
  headingFontSizePt: number;
  lineHeight: number;
  showExerciseTitle: boolean;
  showAudioIcon: boolean;
  showQrCode: boolean;
  showImage: boolean;
  /** Số khung ảnh xếp ngang phía trên bảng (1–4) */
  imageCount?: number;
  /** Chiều rộng ảnh theo % bề ngang trang in */
  imageWidthPercent: number;
  tableBorderColor: string;
  headerBold: boolean;
  firstColumnBold: boolean;
  showQuestionNumbers: boolean;
  showAnswerLines: boolean;
  questionGapMm: number;
  blankWidthMm: number;
  pageBreakBefore: boolean;
}

export interface ListeningTableData {
  exerciseTitle: string;
  instruction: string;
  exerciseNumber?: number;
  audio: ListeningAudio;
  image: TableImage;
  table: TableData;
  questions: TableQuestion[];
  textStyles?: TableTextStyles;
  settings: ListeningTableSettings;
}

export const DEFAULT_TABLE_SETTINGS: ListeningTableSettings = {
  layout: 'image_table',
  fontFamily: 'Quicksand',
  fontSizePt: 10.5,
  headingFontSizePt: 12.5,
  lineHeight: 1.45,
  showExerciseTitle: true,
  showAudioIcon: false,
  showQrCode: true,
  showImage: true,
  imageWidthPercent: 100,
  tableBorderColor: '#3b6fd4',
  headerBold: true,
  firstColumnBold: true,
  showQuestionNumbers: true,
  showAnswerLines: true,
  questionGapMm: 4,
  blankWidthMm: 24,
  pageBreakBefore: false,
};

let counter = 0;
export const newTableId = (prefix = 't'): string => {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
};

export const createEmptyTable = (cols = 3, rows = 3): TableData => ({
  columns: ['Place', 'Advantages', 'Disadvantages'].slice(0, cols).concat(Array.from({ length: Math.max(0, cols - 3) }, (_, i) => `Column ${i + 4}`)),
  rows: Array.from({ length: rows }, () => ({ id: newTableId('r'), cells: Array.from({ length: cols }, () => '') })),
});

export const createListeningTable = (partial?: Partial<ListeningTableData>): ListeningTableData => ({
  exerciseTitle: 'LISTEN AND FILL IN THE TABLE. THEN ANSWER THE QUESTIONS BELOW.',
  instruction: '',
  audio: { filename: 'No audio attached', sizeMb: '0 MB', durationStr: '00:00' },
  image: {},
  table: createEmptyTable(),
  questions: [],
  ...partial,
  settings: { ...DEFAULT_TABLE_SETTINGS, ...(partial?.settings || {}) },
});

// ───────────── Chỉnh sửa bảng (không sửa bản cũ) ─────────────

export const insertRow = (t: TableData, after: number): TableData => {
  const row: TableRow = { id: newTableId('r'), cells: t.columns.map(() => '') };
  const rows = [...t.rows];
  rows.splice(Math.min(Math.max(after + 1, 0), rows.length), 0, row);
  return { ...t, rows };
};

export const deleteRow = (t: TableData, index: number): TableData =>
  t.rows.length <= 1 ? t : { ...t, rows: t.rows.filter((_, i) => i !== index) };

export const insertColumn = (t: TableData, after: number): TableData => {
  const at = Math.min(Math.max(after + 1, 0), t.columns.length);
  const columns = [...t.columns];
  columns.splice(at, 0, `Column ${t.columns.length + 1}`);
  return { columns, rows: t.rows.map((r) => { const cells = [...r.cells]; cells.splice(at, 0, ''); return { ...r, cells }; }) };
};

export const deleteColumn = (t: TableData, index: number): TableData =>
  t.columns.length <= 2 ? t : { columns: t.columns.filter((_, i) => i !== index), rows: t.rows.map((r) => ({ ...r, cells: r.cells.filter((_, i) => i !== index) })) };

export const setCell = (t: TableData, row: number, col: number, text: string): TableData => ({
  ...t, rows: t.rows.map((r, i) => (i === row ? { ...r, cells: r.cells.map((c, j) => (j === col ? text : c)) } : r)),
});

export const setHeader = (t: TableData, col: number, text: string): TableData => ({ ...t, columns: t.columns.map((c, j) => (j === col ? text : c)) });

// ───────────── Chỗ trống trong ô: "(1) ______" ─────────────

export const BLANK_RE = /(\(\d{1,3}\)\s*_{2,})/g;
const BLANK_PARTS_RE = /^\((\d{1,3})\)\s*(_{2,})$/;

/** Tách một dòng của ô thành các đoạn chữ và chỗ trống để hiển thị */
export const splitCellLine = (line: string): { type: 'text' | 'blank'; text: string; label?: string }[] =>
  line.split(BLANK_RE).filter((p) => p !== '').map((part) => {
    const m = BLANK_PARTS_RE.exec(part);
    return m ? { type: 'blank' as const, text: part, label: m[1] } : { type: 'text' as const, text: part };
  });

/** Số chỗ trống đánh số trong cả bảng, theo thứ tự xuất hiện */
export const countBlanks = (t: TableData): number =>
  t.rows.reduce((n, r) => n + r.cells.reduce((m, c) => m + (c.match(BLANK_RE)?.length || 0), 0), 0);

// ───────────── Nhập nhanh ─────────────

export interface ParsedTable {
  ok: boolean;
  title: string;
  table: TableData | null;
  questions: string[];
  warnings: string[];
}

const QUESTION_RE = /^\s*(\d{1,3})\s*[.)]\s*(.+?)\s*$/;
const TRAILING_LINE_RE = /\s*[_▁—\-]{3,}\s*$/;

const splitCells = (line: string): string[] => {
  const t = line.trim();
  if (t.includes('|')) return t.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
  if (t.includes('\t')) return t.split('\t').map((c) => c.trim());
  return t.split(/\s{2,}/).map((c) => c.trim());
};

/** Trong một ô, " -chữ" mở đầu một gạch đầu dòng mới (không đụng tới từ có gạch nối như "well-known") */
export const splitBullets = (cell: string): string => cell.replace(/\s+-(?=\S)/g, '\n-').trim();

/**
 * Smart Paste: dòng tiêu đề → bảng (các dòng phân tách bằng Tab, "|" hoặc ≥2 khoảng trắng) → câu hỏi "1. …".
 * Dòng đầu bảng là tiêu đề cột.
 */
export const parseTableText = (raw: string): ParsedTable => {
  const clean = raw
    .replace(/\r\n?/g, '\n')
    .replace(/[\u000b\u000c\u0085\u2028\u2029]/g, '\n')
    .replace(/[\u00a0\u2007\u202f\u200b\ufeff]/g, ' ')
    .replace(/[☐□▢■▪]/g, '');
  const lines = clean.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim());
  const titleParts: string[] = [];
  const grid: string[][] = [];
  const questions: string[] = [];
  let phase: 'title' | 'table' | 'questions' = 'title';
  for (const line of lines) {
    const q = QUESTION_RE.exec(line);
    if (q && (phase === 'table' || phase === 'questions' || grid.length > 0)) {
      phase = 'questions';
      questions.push(q[2].replace(TRAILING_LINE_RE, '').trim());
      continue;
    }
    if (phase === 'questions') {
      if (questions.length) questions[questions.length - 1] += ` ${line.replace(TRAILING_LINE_RE, '').trim()}`;
      continue;
    }
    const cells = splitCells(line);
    if (cells.length >= 2 && (phase === 'table' || cells.length >= 3 || /[|	]/.test(line))) {
      phase = 'table';
      grid.push(cells);
    } else if (phase === 'title') {
      titleParts.push(line.replace(/^\d+\s+(?=[A-Z])/, ''));
    }
  }
  const warnings: string[] = [];
  let table: TableData | null = null;
  if (grid.length >= 2) {
    const cols = Math.max(...grid.map((r) => r.length));
    const pad = (r: string[]) => Array.from({ length: cols }, (_, i) => splitBullets(r[i] || ''));
    table = { columns: pad(grid[0]).map((c) => c.replace(/\n/g, ' ')), rows: grid.slice(1).map((r) => ({ id: newTableId('r'), cells: pad(r) })) };
  } else {
    warnings.push('Không nhận ra bảng. Mỗi hàng của bảng cần các ô phân tách bằng Tab, dấu | hoặc từ 2 khoảng trắng.');
  }
  return { ok: !!table, title: titleParts.join(' ').trim(), table, questions, warnings };
};

export const validateListeningTable = (d: ListeningTableData): { errors: string[]; warnings: string[] } => {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (d.settings.layout !== 'image_only' && d.table.rows.every((r) => r.cells.every((c) => !c.trim()))) errors.push('Bảng chưa có nội dung.');
  d.questions.forEach((q, i) => { if (!q.text.trim()) errors.push(`Câu hỏi ${i + 1} đang trống.`); });
  if (d.settings.showQrCode && !d.audio.shareUrl) warnings.push('Chưa có đường dẫn audio nên mã QR chưa dùng được.');
  return { errors, warnings };
};

export const moveListItem = <T,>(list: T[], from: number, to: number): T[] => {
  if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

// ───────────── Định dạng chữ theo thành phần ─────────────

export const setTableStyle = (styles: TableTextStyles | undefined, key: TableStyleKey, patch: Partial<TextStyle>): TableTextStyles => {
  const merged: TextStyle = { ...(styles?.[key] || {}), ...patch };
  (Object.keys(merged) as (keyof TextStyle)[]).forEach((k) => { if (merged[k] === undefined) delete merged[k]; });
  const next: TableTextStyles = { ...(styles || {}) };
  if (Object.keys(merged).length === 0) delete next[key];
  else next[key] = merged;
  return next;
};

export const bumpTableSize = (styles: TableTextStyles | undefined, key: TableStyleKey, base: number, delta: number): TableTextStyles => {
  const cur = styles?.[key]?.sizePt ?? base;
  return setTableStyle(styles, key, { sizePt: Math.min(30, Math.max(7, Math.round((cur + delta) * 2) / 2)) });
};

// ───────────── Ảnh minh họa ─────────────

/** Phong cách ảnh bản đồ / sơ đồ minh họa */
export const MAP_STYLE = 'Clean flat illustrated top-down map, soft green and beige colours, simple shapes, no text, no letters, no labels, no watermark.';

/** Prompt dự phòng cho ảnh, tạo từ tiêu đề và cột đầu của bảng (các địa điểm) */
export const buildTableImagePrompt = (d: ListeningTableData): string => {
  const places = d.table.rows.map((r) => r.cells[0]?.trim()).filter(Boolean).slice(0, 6);
  const topic = d.exerciseTitle.replace(/^LISTEN AND FILL IN THE TABLE\.?\s*/i, '').trim();
  return `Illustration for a listening exercise${places.length ? ` showing a small town map with: ${places.join(', ')}` : ''}.${topic ? ` ${topic}` : ''}`.trim();
};

export const imagePromptFromPlan = (plan: AiImagePlan | null | undefined): string | null => {
  const ex = plan?.exercises[0];
  if (!plan || !ex?.needsImages) return null;
  return plan.images.find((im) => im.exerciseIndex === ex.index)?.prompt || null;
};
