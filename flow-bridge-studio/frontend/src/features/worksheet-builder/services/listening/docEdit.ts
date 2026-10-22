// Chỉnh sửa cấp TÀI LIỆU cho Listening Gap Fill: vùng chọn có thể trải qua nhiều đoạn (Ctrl+A, kéo chuột) như Word.
// Hàm thuần (không React/DOM) để test được bằng `node --test`. Vị trí là (đoạn, ký tự) trong TOÀN BỘ chữ của đoạn (`para.text`).
//
// Quy tắc giống Word:
//  - xóa/gõ đè qua nhiều đoạn → các đoạn được gộp lại (đoạn đầu giữ id/định dạng, phần đuôi của đoạn cuối nối vào),
//  - Enter tách đoạn (đoạn mới có id mới, chép căn lề/danh sách/thụt lề), số thứ tự `order` đánh lại,
//  - chỗ trống "(a) ____" là khối nguyên: vùng sửa chạm vào chỗ trống thì mở rộng ôm trọn cả chỗ trống.

import type { ListeningParagraph } from './listeningGapFillCore.ts';
import { applyMarkPatch, attrsInRange, clearMarks, normalizeMarks, sliceMarks, type TextMark, type TextMarkAttrs } from './textMarks.ts';

export interface DocPoint { para: number; off: number }
export interface DocRange { from: DocPoint; to: DocPoint }
export interface DocPiece { text: string; marks?: TextMark[] }

const GAP_RE = /\(([A-Za-z0-9_]+)\)\s*_{2,}/g;
export const findGaps = (text: string): { start: number; end: number }[] => {
  const out: { start: number; end: number }[] = [];
  const re = new RegExp(GAP_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push({ start: m.index, end: m.index + m[0].length });
  return out;
};

export const cmpPoint = (a: DocPoint, b: DocPoint) => (a.para !== b.para ? a.para - b.para : a.off - b.off);
export const orderRange = (a: DocPoint, b: DocPoint): DocRange => (cmpPoint(a, b) <= 0 ? { from: a, to: b } : { from: b, to: a });

const clampPoint = (paras: ListeningParagraph[], p: DocPoint): DocPoint => {
  const para = Math.max(0, Math.min(p.para, paras.length - 1));
  return { para, off: Math.max(0, Math.min(p.off, paras[para].text.length)) };
};

/** Mở rộng vùng sửa để không cắt giữa một chỗ trống. */
export function expandForGaps(paras: ListeningParagraph[], range: DocRange): DocRange {
  const from = { ...clampPoint(paras, range.from) };
  const to = { ...clampPoint(paras, range.to) };
  const inside = (p: DocPoint) => findGaps(paras[p.para].text).find((g) => p.off > g.start && p.off < g.end);
  if (cmpPoint(from, to) === 0) {
    const g = inside(from);
    if (g) { from.off = g.end; to.off = g.end; }
    return { from, to };
  }
  const gf = inside(from);
  if (gf) from.off = gf.start;
  const gt = inside(to);
  if (gt) to.off = gt.end;
  return { from, to };
}

function joinMarks(parts: { text: string; marks?: TextMark[] }[]): TextMark[] | undefined {
  let off = 0;
  const out: TextMark[] = [];
  for (const part of parts) {
    for (const m of part.marks ?? []) out.push({ ...m, start: m.start + off, end: m.end + off });
    off += part.text.length;
  }
  return normalizeMarks(out, off);
}

const nonEmpty = (a?: TextMarkAttrs) => !!a && Object.values(a).some(Boolean);
let idSeq = 0;
const defaultNewId = () => `p_${Date.now().toString(36)}${(idSeq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export interface ReplaceResult { paragraphs: ListeningParagraph[]; caret: DocPoint; structureChanged: boolean }

/**
 * Thay vùng [from, to] bằng các `pieces` (mỗi phần tử = một đoạn; nhiều phần tử = có ngắt đoạn).
 * Chữ mới không kèm marks thì mang `inherit` (định dạng đang chờ / của ký tự đứng trước).
 */
export function replaceRange(
  paras: ListeningParagraph[],
  range: DocRange,
  pieces: DocPiece[],
  opts: { inherit?: TextMarkAttrs; newId?: () => string } = {},
): ReplaceResult {
  const { from: f, to: t } = expandForGaps(paras, range);
  const head = paras[f.para];
  const tail = paras[t.para];
  const headPart = { text: head.text.slice(0, f.off), marks: sliceMarks(head.marks, 0, f.off) };
  const tailPart = { text: tail.text.slice(t.off), marks: sliceMarks(tail.marks, t.off, tail.text.length) };
  const P = pieces.length ? pieces : [{ text: '' }];
  const withInherit = (pc: DocPiece): DocPiece =>
    pc.marks || !nonEmpty(opts.inherit) || !pc.text ? pc : { text: pc.text, marks: normalizeMarks([{ start: 0, end: pc.text.length, ...opts.inherit }], pc.text.length) };
  const newId = opts.newId ?? defaultNewId;

  const before = paras.slice(0, f.para);
  const after = paras.slice(t.para + 1);
  const merged = f.para !== t.para;

  if (P.length === 1) {
    const text = headPart.text + P[0].text + tailPart.text;
    const para: ListeningParagraph = {
      ...head,
      text,
      marks: joinMarks([headPart, withInherit(P[0]), tailPart]),
      ...(merged && !head.imageAssetUrl && tail.imageAssetUrl ? { imageAssetUrl: tail.imageAssetUrl, imageCaption: tail.imageCaption } : {}),
    };
    const out = [...before, para, ...after];
    const paragraphs = merged ? out.map((p, i) => ({ ...p, order: i + 1 })) : out;
    return { paragraphs, caret: { para: f.para, off: headPart.text.length + P[0].text.length }, structureChanged: merged };
  }

  // Có ngắt đoạn: phần đầu vào đoạn đầu, các phần giữa và phần cuối thành đoạn mới (kèm phần đuôi của đoạn cuối)
  const first: ListeningParagraph = { ...head, text: headPart.text + P[0].text, marks: joinMarks([headPart, withInherit(P[0])]) };
  const fmt = head.format ? { ...head.format } : undefined;
  const mk = (text: string, marks?: TextMark[]): ListeningParagraph => ({ id: newId(), order: 0, text, marks, ...(fmt ? { format: { ...fmt } } : {}) });
  const created: ListeningParagraph[] = [];
  for (let i = 1; i < P.length - 1; i++) created.push(mk(P[i].text, withInherit(P[i]).marks));
  const lastPiece = withInherit(P[P.length - 1]);
  created.push(mk(lastPiece.text + tailPart.text, joinMarks([lastPiece, tailPart])));
  const paragraphs = [...before, first, ...created, ...after].map((p, i) => ({ ...p, order: i + 1 }));
  return { paragraphs, caret: { para: f.para + P.length - 1, off: lastPiece.text.length }, structureChanged: true };
}

/** Áp định dạng chữ lên mọi ký tự trong vùng chọn (qua nhiều đoạn). */
export function applyFormatDoc(paras: ListeningParagraph[], range: DocRange, patch: TextMarkAttrs): ListeningParagraph[] {
  const { from, to } = range;
  return paras.map((p, i) => {
    if (i < from.para || i > to.para) return p;
    const s = i === from.para ? from.off : 0;
    const e = i === to.para ? to.off : p.text.length;
    return e > s ? { ...p, marks: applyMarkPatch(p.marks, p.text.length, s, e, patch) } : p;
  });
}

/** Xóa định dạng từng-từ trong vùng chọn; để trống vùng (con trỏ) thì xóa của cả đoạn đó. */
export function clearFormatDoc(paras: ListeningParagraph[], range: DocRange): ListeningParagraph[] {
  const { from, to } = range;
  const collapsed = cmpPoint(from, to) === 0;
  return paras.map((p, i) => {
    if (i < from.para || i > to.para) return p;
    if (collapsed) return { ...p, marks: undefined };
    const s = i === from.para ? from.off : 0;
    const e = i === to.para ? to.off : p.text.length;
    return e > s ? { ...p, marks: clearMarks(p.marks, p.text.length, s, e) } : p;
  });
}

/** Thuộc tính định dạng chung của vùng chọn (thuộc tính nào mọi ký tự ở mọi đoạn đều có). */
export function attrsInDocRange(paras: ListeningParagraph[], range: DocRange): TextMarkAttrs {
  const { from, to } = range;
  if (cmpPoint(from, to) === 0) {
    const p = paras[from.para];
    return p ? attrsInRange(p.marks, p.text.length, from.off, from.off) : {};
  }
  let common: TextMarkAttrs | null = null;
  for (let i = from.para; i <= to.para; i++) {
    const p = paras[i];
    if (!p) continue;
    const s = i === from.para ? from.off : 0;
    const e = i === to.para ? to.off : p.text.length;
    if (e <= s) continue;
    const a = attrsInRange(p.marks, p.text.length, s, e);
    if (!common) { common = { ...a }; continue; }
    for (const k of Object.keys(common) as (keyof TextMarkAttrs)[]) if (common[k] !== a[k]) delete common[k];
  }
  return common ?? {};
}

/** Cắt vùng chọn thành các đoạn chữ kèm marks (dùng cho copy/cut). */
export function docSlice(paras: ListeningParagraph[], range: DocRange): DocPiece[] {
  const { from, to } = range;
  const out: DocPiece[] = [];
  for (let i = from.para; i <= to.para; i++) {
    const p = paras[i];
    if (!p) continue;
    const s = i === from.para ? from.off : 0;
    const e = i === to.para ? to.off : p.text.length;
    out.push({ text: p.text.slice(s, e), marks: sliceMarks(p.marks, s, e) });
  }
  return out;
}
