// Định dạng theo từng đoạn chữ (từ/cụm từ) cho đoạn văn Listening Gap Fill.
//
// `para.text` vẫn là nguồn dữ liệu chính (chứa marker chỗ trống "(a) ____"), nên bài cũ và mọi layout đang đọc text
// không đổi. `para.marks` là danh sách đoạn [start, end) trên chuỗi đó, không chồng nhau, sắp theo vị trí.
// File này chỉ chứa hàm thuần (không React) để test được bằng `node --test`.

export interface TextMarkAttrs {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  /** Chỉ số trên / dưới (x², H₂O) */
  script?: 'super' | 'sub';
  color?: string;
  highlight?: string;
  fontFamily?: string;
  fontSizePt?: number;
}

export interface TextMark extends TextMarkAttrs {
  start: number;
  end: number;
}

export type MarkKey = keyof TextMarkAttrs;
const KEYS: MarkKey[] = ['bold', 'italic', 'underline', 'strike', 'script', 'color', 'highlight', 'fontFamily', 'fontSizePt'];

export const markAttrs = (m: TextMarkAttrs): TextMarkAttrs => attrsOf(m);
const attrsOf = (m: TextMarkAttrs): TextMarkAttrs => {
  const o: TextMarkAttrs = {};
  for (const k of KEYS) if (m[k] !== undefined && m[k] !== false) (o as Record<string, unknown>)[k] = m[k];
  return o;
};
const sameAttrs = (a: TextMarkAttrs, b: TextMarkAttrs) => KEYS.every((k) => (a[k] || undefined) === (b[k] || undefined));
const isEmptyAttrs = (a: TextMarkAttrs) => KEYS.every((k) => !a[k]);

/** Sắp xếp, cắt theo độ dài chữ, bỏ đoạn rỗng/không có thuộc tính, gộp đoạn kề nhau cùng thuộc tính. */
export function normalizeMarks(marks: TextMark[] | undefined, textLen: number): TextMark[] | undefined {
  if (!marks?.length) return undefined;
  const sorted = marks
    .map((m) => ({ ...attrsOf(m), start: Math.max(0, m.start), end: Math.min(textLen, m.end) }))
    .filter((m) => m.end > m.start && !isEmptyAttrs(m))
    .sort((a, b) => a.start - b.start);
  const out: TextMark[] = [];
  for (const m of sorted) {
    const last = out[out.length - 1];
    if (last && last.end === m.start && sameAttrs(last, m)) last.end = m.end;
    else out.push({ ...m });
  }
  return out.length ? out : undefined;
}

/** Thuộc tính của từng ký tự trong [start, end) (ký tự không có mark → {}). */
function perCharAttrs(marks: TextMark[] | undefined, start: number, end: number): TextMarkAttrs[] {
  const res: TextMarkAttrs[] = [];
  for (let i = start; i < end; i++) {
    const m = marks?.find((x) => x.start <= i && i < x.end);
    res.push(m ? attrsOf(m) : {});
  }
  return res;
}

/** Áp `patch` lên [start, end). Giá trị `undefined`/`false` trong patch = bỏ thuộc tính đó. */
export function applyMarkPatch(marks: TextMark[] | undefined, textLen: number, start: number, end: number, patch: TextMarkAttrs): TextMark[] | undefined {
  const s = Math.max(0, Math.min(start, end));
  const e = Math.min(textLen, Math.max(start, end));
  if (e <= s) return normalizeMarks(marks, textLen);
  const chars = perCharAttrs(marks, 0, textLen);
  const keys = KEYS.filter((k) => k in patch);
  for (let i = s; i < e; i++) {
    const a = { ...chars[i] } as Record<string, unknown>;
    for (const k of keys) {
      const v = patch[k];
      if (v === undefined || v === false) delete a[k];
      else a[k] = v;
    }
    chars[i] = a as TextMarkAttrs;
  }
  return charsToMarks(chars);
}

/** Xóa toàn bộ định dạng từng-từ trong [start, end). */
export function clearMarks(marks: TextMark[] | undefined, textLen: number, start: number, end: number): TextMark[] | undefined {
  const chars = perCharAttrs(marks, 0, textLen);
  for (let i = Math.max(0, start); i < Math.min(textLen, end); i++) chars[i] = {};
  return charsToMarks(chars);
}

function charsToMarks(chars: TextMarkAttrs[]): TextMark[] | undefined {
  const out: TextMark[] = [];
  let i = 0;
  while (i < chars.length) {
    if (isEmptyAttrs(chars[i])) { i++; continue; }
    let j = i + 1;
    while (j < chars.length && sameAttrs(chars[i], chars[j])) j++;
    out.push({ ...attrsOf(chars[i]), start: i, end: j });
    i = j;
  }
  return out.length ? out : undefined;
}

/** Thuộc tính chung của vùng chọn: thuộc tính nào MỌI ký tự đều có (cùng giá trị) thì mới được tính. */
export function attrsInRange(marks: TextMark[] | undefined, textLen: number, start: number, end: number): TextMarkAttrs {
  let s = Math.max(0, Math.min(start, end));
  let e = Math.min(textLen, Math.max(start, end));
  if (e <= s) { // con trỏ: lấy theo ký tự đứng ngay trước (giống Word)
    const p = Math.min(Math.max(s - 1, 0), Math.max(textLen - 1, 0));
    if (textLen === 0) return {};
    s = p; e = p + 1;
  }
  const chars = perCharAttrs(marks, s, e);
  const common: TextMarkAttrs = { ...chars[0] };
  for (const c of chars.slice(1)) for (const k of KEYS) if ((common[k] || undefined) !== (c[k] || undefined)) delete common[k];
  return common;
}

export interface TextEdit { at: number; oldLen: number; newLen: number }

/** Dịch vị trí marks sau một loạt thay thế (at, oldLen→newLen) tính theo vị trí chuỗi CŨ, sắp theo `at`. */
export function remapMarks(marks: TextMark[] | undefined, edits: TextEdit[], newTextLen: number): TextMark[] | undefined {
  if (!marks?.length) return undefined;
  if (!edits.length) return normalizeMarks(marks, newTextLen);
  const map = (pos: number, isEnd: boolean): number => {
    let delta = 0;
    for (const ed of edits) {
      const edEnd = ed.at + ed.oldLen;
      if (pos <= ed.at) break;
      if (pos >= edEnd) { delta += ed.newLen - ed.oldLen; continue; }
      // pos nằm trong vùng bị thay: kẹp vào đầu/cuối vùng mới
      return ed.at + delta + (isEnd ? ed.newLen : 0);
    }
    return pos + delta;
  };
  const out = marks.map((m) => ({ ...m, start: map(m.start, false), end: map(m.end, true) }));
  return normalizeMarks(out, newTextLen);
}

/** Tìm vùng khác nhau duy nhất (tiền tố/hậu tố chung) giữa hai chuỗi. */
export function diffEdit(oldText: string, newText: string): TextEdit {
  let p = 0;
  const max = Math.min(oldText.length, newText.length);
  while (p < max && oldText[p] === newText[p]) p++;
  let s = 0;
  while (s < max - p && oldText[oldText.length - 1 - s] === newText[newText.length - 1 - s]) s++;
  return { at: p, oldLen: oldText.length - p - s, newLen: newText.length - p - s };
}

/**
 * Dịch marks sau MỘT lần chỉnh sửa đã biết vị trí; chữ mới chèn mang `inherit`
 * (thuộc tính đang chờ hoặc của ký tự đứng trước con trỏ, giống Word).
 */
export function marksAfterEdit(marks: TextMark[] | undefined, newTextLen: number, ed: TextEdit, inherit?: TextMarkAttrs): TextMark[] | undefined {
  let next = remapMarks(marks, [ed], newTextLen);
  if (ed.newLen > 0) {
    const chars = perCharAttrs(next, 0, newTextLen);
    const fill = inherit && !isEmptyAttrs(inherit) ? attrsOf(inherit) : {};
    for (let i = ed.at; i < ed.at + ed.newLen; i++) chars[i] = { ...fill };
    next = charsToMarks(chars);
  }
  return next;
}

/** Như marksAfterEdit nhưng tự tìm vùng khác nhau (dùng khi không biết chính xác chỗ sửa, vd. xóa marker bằng regex). */
export function marksAfterTextChange(oldText: string, newText: string, marks: TextMark[] | undefined, inherit?: TextMarkAttrs): TextMark[] | undefined {
  return marksAfterEdit(marks, newText.length, diffEdit(oldText, newText), inherit);
}

/** Lấy marks của đoạn con [from, to) và dịch về gốc 0 (dùng khi layout cắt tiền tố khỏi text). */
export function sliceMarks(marks: TextMark[] | undefined, from: number, to: number): TextMark[] | undefined {
  if (!marks?.length) return undefined;
  const out = marks
    .filter((m) => m.end > from && m.start < to)
    .map((m) => ({ ...m, start: Math.max(m.start, from) - from, end: Math.min(m.end, to) - from }));
  return normalizeMarks(out, to - from);
}

export interface TextSegment { start: number; end: number; attrs: TextMarkAttrs }

/** Cắt đoạn [from, to) thành các khúc cùng thuộc tính để vẽ. */
export function segmentText(marks: TextMark[] | undefined, from: number, to: number): TextSegment[] {
  if (to <= from) return [];
  if (!marks?.length) return [{ start: from, end: to, attrs: {} }];
  const chars = perCharAttrs(marks, from, to);
  const out: TextSegment[] = [];
  let i = 0;
  while (i < chars.length) {
    let j = i + 1;
    while (j < chars.length && sameAttrs(chars[i], chars[j])) j++;
    out.push({ start: from + i, end: from + j, attrs: chars[i] });
    i = j;
  }
  return out;
}

/** CSS tương ứng một bộ thuộc tính. */
export function attrsToStyle(a: TextMarkAttrs): Record<string, string | number | undefined> {
  return {
    fontWeight: a.bold ? 700 : undefined,
    fontStyle: a.italic ? 'italic' : undefined,
    textDecoration: [a.underline && 'underline', a.strike && 'line-through'].filter(Boolean).join(' ') || undefined,
    color: a.color,
    backgroundColor: a.highlight,
    fontFamily: a.fontFamily,
    // Chỉ số trên/dưới: chữ nhỏ lại 0.7 lần (theo cỡ riêng nếu có)
    fontSize: a.script ? (a.fontSizePt ? `${a.fontSizePt * 0.7}pt` : '0.7em') : a.fontSizePt ? `${a.fontSizePt}pt` : undefined,
    verticalAlign: a.script === 'super' ? 'super' : a.script === 'sub' ? 'sub' : undefined,
  };
}
