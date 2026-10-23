// Dữ liệu và hàm thuần cho bài "Look at the table and write sentences":
// bảng có hàng đầu là ảnh, cột đầu là người, mỗi ô là mặt cười / mặt buồn; bên phải là các dòng kẻ để học sinh viết câu.

import type { TextStyle } from '../matching-pictures/matchingPicturesCore.ts';

export type TableSentencesLayoutId = 'table_lines';

export const TABLE_SENTENCES_LAYOUTS: { id: TableSentencesLayoutId; label: string; desc: string }[] = [
  { id: 'table_lines', label: '1. Bảng + dòng kẻ', desc: 'Bảng ảnh với mặt cười / mặt buồn ở bên trái, các dòng kẻ để viết câu ở bên phải' },
];

/** '' = ô trống, 'happy' = mặt cười, 'sad' = mặt buồn */
export type FaceMark = '' | 'happy' | 'sad';
export const FACE_CYCLE: FaceMark[] = ['', 'happy', 'sad'];
export const nextFace = (f: FaceMark | undefined): FaceMark => FACE_CYCLE[(FACE_CYCLE.indexOf(f || '') + 1) % FACE_CYCLE.length];

export interface TsColumn {
  id: string;
  imageUrl?: string;
  /** Chữ thay cho ảnh (hoặc chú thích khi chưa có ảnh) */
  label: string;
}

export interface TsRow {
  id: string;
  label: string;
  /** Mặt cười / buồn theo id cột */
  cells: Record<string, FaceMark>;
}

export type TsStyleKey = 'title' | 'instruction' | 'table';
export const TS_STYLE_LABELS: Record<TsStyleKey, string> = {
  title: 'Tiêu đề bài',
  instruction: 'Ghi chú dưới tiêu đề',
  table: 'Chữ trong bảng',
};
export type TsTextStyles = Partial<Record<TsStyleKey, TextStyle>>;

export interface TableSentencesSettings {
  layout: TableSentencesLayoutId;
  fontFamily: string;
  fontSizePt: number;
  headingFontSizePt: number;
  lineHeight: number;
  /** Số dòng kẻ bên phải */
  lineCount: number;
  lineGapMm: number;
  /** Chiều rộng bảng (phần trăm trang), phần còn lại là dòng kẻ */
  tableWidthPct: number;
  imageHeightMm: number;
  faceSizeMm: number;
  showExerciseTitle: boolean;
  pageBreakBefore: boolean;
}

export interface TableSentencesData {
  /** Định dạng từng từ của các ô chữ sửa trên trang A4 (xem services/richFields.ts) */
  richMarks?: import('../richFields.ts').RichMarks;
  exerciseTitle: string;
  instruction: string;
  exerciseNumber?: number;
  columns: TsColumn[];
  rows: TsRow[];
  textStyles?: TsTextStyles;
  settings: TableSentencesSettings;
}

export const DEFAULT_TS_SETTINGS: TableSentencesSettings = {
  layout: 'table_lines',
  fontFamily: 'Quicksand',
  fontSizePt: 11,
  headingFontSizePt: 12.5,
  lineHeight: 1.5,
  lineCount: 8,
  lineGapMm: 8,
  tableWidthPct: 66,
  imageHeightMm: 22,
  faceSizeMm: 6,
  showExerciseTitle: true,
  pageBreakBefore: false,
};

let counter = 0;
export const newTsId = (): string => {
  counter += 1;
  return `ts_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
};

export const createTableSentences = (partial?: Partial<TableSentencesData>): TableSentencesData => {
  const cols: TsColumn[] = [0, 1, 2, 3].map(() => ({ id: newTsId(), label: '' }));
  const blank = (label: string): TsRow => ({ id: newTsId(), label, cells: {} });
  return {
    exerciseTitle: 'LOOK AT THE TABLE AND WRITE SENTENCES',
    instruction: '',
    columns: cols,
    rows: [blank('I'), blank('Mom & Dad')],
    ...partial,
    settings: { ...DEFAULT_TS_SETTINGS, ...(partial?.settings || {}) },
  };
};

export const addTsColumn = (d: TableSentencesData): TableSentencesData => ({ ...d, columns: [...d.columns, { id: newTsId(), label: '' }] });
export const removeTsColumn = (d: TableSentencesData, id: string): TableSentencesData => ({
  ...d,
  columns: d.columns.filter((c) => c.id !== id),
  rows: d.rows.map((r) => {
    const cells = { ...r.cells };
    delete cells[id];
    return { ...r, cells };
  }),
});
export const addTsRow = (d: TableSentencesData): TableSentencesData => ({ ...d, rows: [...d.rows, { id: newTsId(), label: '', cells: {} }] });
export const removeTsRow = (d: TableSentencesData, id: string): TableSentencesData => ({ ...d, rows: d.rows.filter((r) => r.id !== id) });

/** Bấm vào ô: trống -> cười -> buồn -> trống */
export const cycleTsCell = (d: TableSentencesData, rowId: string, colId: string): TableSentencesData => ({
  ...d,
  rows: d.rows.map((r) => (r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: nextFace(r.cells[colId]) } } : r)),
});

export const validateTableSentences = (d: TableSentencesData): { errors: string[]; warnings: string[] } => {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (d.columns.length === 0) errors.push('Bảng chưa có cột nào.');
  if (d.rows.length === 0) errors.push('Bảng chưa có hàng nào.');
  d.rows.forEach((r, i) => { if (!r.label.trim()) warnings.push(`Hàng ${i + 1} chưa có tên (I, Mom & Dad…).`); });
  d.columns.forEach((c, i) => { if (!c.imageUrl && !c.label.trim()) warnings.push(`Cột ${i + 1} chưa có ảnh hoặc chữ.`); });
  return { errors, warnings };
};

export const setTsStyle = (styles: TsTextStyles | undefined, key: TsStyleKey, patch: Partial<TextStyle>): TsTextStyles => {
  const merged: TextStyle = { ...(styles?.[key] || {}), ...patch };
  (Object.keys(merged) as (keyof TextStyle)[]).forEach((k) => { if (merged[k] === undefined) delete merged[k]; });
  const next: TsTextStyles = { ...(styles || {}) };
  if (Object.keys(merged).length === 0) delete next[key];
  else next[key] = merged;
  return next;
};

export const bumpTsSize = (styles: TsTextStyles | undefined, key: TsStyleKey, base: number, delta: number): TsTextStyles => {
  const cur = styles?.[key]?.sizePt ?? base;
  return setTsStyle(styles, key, { sizePt: Math.min(30, Math.max(7, Math.round((cur + delta) * 2) / 2)) });
};
