// Định dạng theo từng từ cho các ô chữ trên trang A4 của MỌI dạng bài (tiêu đề, hướng dẫn, từ trong khung, câu hỏi, phương án...).
//
// Dữ liệu từng dạng bài vẫn giữ chữ thuần như cũ (parser, Smart Paste, xuất Word... không đổi). Định dạng được lưu riêng
// trong `richMarks` của bài: khóa là chính đoạn chữ, giá trị là marks theo vị trí ký tự (xem listening/textMarks.ts).
//  - Chữ đổi ở nơi khác (cột trái, Smart Paste) → khóa không còn khớp → ô đó hiện chữ thường, không lỗi, không lệch định dạng.
//  - Sửa trực tiếp trên trang → định dạng chuyển sang khóa mới cùng với chữ.
//  - Hai ô có chữ giống hệt nhau dùng chung định dạng (giới hạn đã biết).
// File này chỉ chứa hàm thuần để test bằng `node --test`.

import { normalizeMarks, sliceMarks, type TextMark } from './listening/textMarks.ts';

export type RichMarks = Record<string, TextMark[]>;

/** Marks của một ô; bỏ qua nếu không còn khớp độ dài chữ */
export const richMarksFor = (map: RichMarks | undefined, text: string): TextMark[] | undefined => {
  const m = map?.[text];
  if (!m?.length || m.some((x) => x.end > text.length || x.start < 0)) return undefined;
  return m;
};

/** Cắt khoảng trắng đầu/cuối, nối các dòng thành một dòng; marks dịch theo */
export const tidyRichEdit = (text: string, marks: TextMark[] | undefined): { text: string; marks?: TextMark[] } => {
  // Đổi xuống dòng / nbsp thành dấu cách (cùng độ dài nên marks không lệch), rồi cắt hai đầu
  const flat = text.replace(/[\n ]/g, ' ');
  const lead = flat.length - flat.trimStart().length;
  const out = flat.trim();
  return { text: out, marks: sliceMarks(marks, lead, lead + out.length) };
};

/** Lưu marks của ô vừa sửa: bỏ khóa chữ cũ, ghi khóa chữ mới. Trả về undefined khi không còn định dạng nào. */
export const setRichMarks = (map: RichMarks | undefined, oldText: string, newText: string, marks: TextMark[] | undefined): RichMarks | undefined => {
  const next: RichMarks = { ...(map || {}) };
  if (oldText !== newText) delete next[oldText];
  const norm = normalizeMarks(marks, newText.length);
  if (norm && newText) next[newText] = norm;
  else delete next[newText];
  return Object.keys(next).length ? next : undefined;
};

/** Bỏ các khóa không còn ô nào dùng (giữ dữ liệu gọn khi lưu) */
export const pruneRichMarks = (map: RichMarks | undefined, liveTexts: Iterable<string>): RichMarks | undefined => {
  if (!map) return undefined;
  const live = new Set(liveTexts);
  const next: RichMarks = {};
  for (const [k, v] of Object.entries(map)) if (live.has(k)) next[k] = v;
  return Object.keys(next).length ? next : undefined;
};
