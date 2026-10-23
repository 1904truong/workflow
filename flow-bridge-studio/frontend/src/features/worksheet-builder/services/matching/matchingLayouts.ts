// Danh sách layout RIÊNG của từng dạng bài dùng dữ liệu Matching: Matching Information và Draw Lines and Match,
// kèm mô tả định dạng + ví dụ của hộp Smart Paste cho từng layout (dùng cho cả "Viết lại bằng AI" và "Đọc từ ảnh bằng AI").

import type { MatchingLayoutId } from './matchingCore.ts';

export type MatchingVariant = 'matching_information' | 'draw_lines_match';

export interface MatchingLayoutOption {
  id: MatchingLayoutId;
  label: string;
  desc: string;
}

const ALL: Record<MatchingLayoutId, MatchingLayoutOption> = {
  two_columns: { id: 'two_columns', label: '1. Hai cột', desc: 'Hai cột: câu / ý ở trái có ô trả lời, lựa chọn a, b, c… ở phải' },
  connect_lines: { id: 'connect_lines', label: 'Nối chấm', desc: 'Hai cột, mỗi mục có một chấm tròn hướng vào giữa để học sinh nối' },
  facing_tables: { id: 'facing_tables', label: 'Hai bảng đối xứng', desc: 'Hai bảng viền ô, số 1, 2, 3… và chữ cái A, B, C… sát mép giữa; khoảng trống ở giữa để kẻ nối' },
  answer_table: { id: 'answer_table', label: 'Bảng đáp án', desc: 'Các câu / ý ở trên, bên dưới là bảng ô để học sinh điền chữ cái' },
  inline_answer: { id: 'inline_answer', label: 'Đáp án cuối câu', desc: 'Mỗi câu có chỗ viết chữ cái ngay cuối dòng, danh sách lựa chọn a, b, c… ở dưới' },
  cut_paste: { id: 'cut_paste', label: 'Cắt và dán', desc: 'Các thẻ lựa chọn để cắt dán vào ô trả lời (hoặc viết chữ cái)' },
  image_matching: { id: 'image_matching', label: 'Nối ảnh', desc: 'Cột ảnh (có số) và cột chữ (có chữ cái) để nối' },
  reading_images: { id: 'reading_images', label: 'Bài đọc + ảnh', desc: 'Bài đọc có ảnh minh họa bên phải (Name / Location …), bên dưới là danh sách câu hỏi và lựa chọn để nối' },
};

const pick = (...ids: MatchingLayoutId[]): MatchingLayoutOption[] => ids.map((id, i) => ({ ...ALL[id], label: `${i + 1}. ${ALL[id].label.replace(/^\d+\.\s*/, '')}` }));

/** Matching Information: nối câu / ý với lựa chọn (không cần kẻ đường nối) */
export const MATCHING_INFO_LAYOUT_OPTIONS: MatchingLayoutOption[] = pick('two_columns', 'answer_table', 'inline_answer', 'cut_paste', 'image_matching', 'reading_images');

/** Draw Lines and Match: học sinh kẻ đường nối giữa hai cột */
export const DRAW_LINES_LAYOUT_OPTIONS: MatchingLayoutOption[] = pick('facing_tables', 'connect_lines', 'image_matching');

export const layoutOptionsFor = (variant: MatchingVariant): MatchingLayoutOption[] =>
  variant === 'draw_lines_match' ? DRAW_LINES_LAYOUT_OPTIONS : MATCHING_INFO_LAYOUT_OPTIONS;

export const defaultLayoutFor = (variant: MatchingVariant): MatchingLayoutId => (variant === 'draw_lines_match' ? 'facing_tables' : 'two_columns');

export interface MatchingPasteFormat {
  hint: string;
  example: string;
}

const LISTS: MatchingPasteFormat = {
  hint: 'Tiêu đề viết hoa, rồi danh sách cột trái đánh số 1., 2., … và danh sách cột phải đánh chữ cái a., b., … (mỗi mục một dòng). Số mục hai cột có thể khác nhau.',
  example: 'MATCH THE QUESTIONS WITH THE ANSWERS.\n1. What’s your name?\n2. How old are you?\n3. Where do you live?\na. I’m eight.\nb. I live in London.\nc. My name is Lan.',
};

export const MATCHING_PASTE_FORMATS: Partial<Record<MatchingLayoutId, MatchingPasteFormat>> & { default: MatchingPasteFormat } = {
  default: LISTS,
  facing_tables: {
    hint: 'Tiêu đề (có chữ DRAW LINES AND MATCH), rồi các mục cột trái 1., 2., … và các mục cột phải a., b., … (mỗi mục một dòng).',
    example: 'DRAW LINES AND MATCH\n1. When’s Tom’s birthday?\n2. How are you?\n3. How old are you?\na. It’s on the 14th of September.\nb. I’m fine.\nc. I’m ten.',
  },
  reading_images: {
    hint: 'Tiêu đề, đoạn dẫn, các khối bài đọc mở đầu bằng "Name: … Location: …" (kèm Then / Why / Now), rồi danh sách 1., 2., … và các lựa chọn A., B., ….',
    example: 'GHOST TOWNS\nRead about three ghost towns.\nName: Craco   Location: Italy\nThen: Farmers lived here.\nNow: Nobody lives here.\n\n1. People left because of a landslide.   A. Craco\n2. It is now a film set.   B. Kolmanskop',
  },
};

export const pasteFormatFor = (layout: MatchingLayoutId): MatchingPasteFormat => MATCHING_PASTE_FORMATS[layout] ?? MATCHING_PASTE_FORMATS.default;
