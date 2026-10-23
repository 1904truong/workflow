// Logic thuần (không import gì) cho bài Matching: kiểu dữ liệu, tách văn bản dán vào, kiểm tra, sửa đáp án khi xóa/đổi chỗ.
// Dự án làm giáo trình: KHÔNG có đáp án. Chỉ có nội dung problems/solutions và cách trình bày.

export type MatchingLayoutId =
  | 'two_columns'
  | 'connect_lines'
  | 'facing_tables'
  | 'answer_table'
  | 'inline_answer'
  | 'cut_paste'
  | 'image_matching'
  | 'reading_images';

export const MATCHING_LAYOUTS: { id: MatchingLayoutId; label: string }[] = [
  { id: 'two_columns', label: 'Two Columns' },
  { id: 'connect_lines', label: 'Connect Lines' },
  { id: 'facing_tables', label: 'Facing Tables (Draw Lines)' },
  { id: 'answer_table', label: 'Answer Table' },
  { id: 'inline_answer', label: 'Inline Answer' },
  { id: 'cut_paste', label: 'Cut & Paste' },
  { id: 'image_matching', label: 'Image Matching' },
  { id: 'reading_images', label: 'Reading + Images' },
];

export interface MatchingProblem {
  id: string;
  text: string;
  imageUrl?: string;
}

export interface MatchingSolution {
  id: string;
  text: string;
  imageUrl?: string;
}

/** Một khối của bài đọc ở layout "Reading + Images": tiêu đề (tùy chọn), nội dung, ảnh minh họa bên phải.
 *  Trong `text`: dòng trống = đoạn mới, **chữ** = in đậm (ví dụ "**Then:** ..."). */
export interface MatchingReadingBlock {
  id: string;
  /** Dòng "Name: ... Location: ..." của mẫu: tên (in đỏ đậm) và địa điểm */
  name?: string;
  location?: string;
  title?: string;
  text: string;
  imageUrl?: string;
  /** Prompt tạo ảnh (tự sinh từ nội dung, giáo viên sửa được) */
  imagePrompt?: string;
  /** Tỉ lệ rộng/cao của khung ảnh: tự chọn theo độ dài khối chữ, hoặc theo ảnh thật khi có ảnh */
  imageRatio?: number;
}

export interface MatchingSettings {
  fontSizePt: number; // 10-16
  lineSpacing: 'compact' | 'normal' | 'spacious';
  columnGapMm: number;
  showNumbering: boolean;
  showAnswerBoxes: boolean;
  grayscale: boolean;
  /** Cut & Paste: 'cut' = cắt dán thẻ, 'write' = viết chữ cái */
  cutMode: 'cut' | 'write';
}

export interface MatchingData {
  /** Bài đọc có ảnh (chỉ dùng ở layout reading_images) */
  reading?: MatchingReadingBlock[];
  /** Tiêu đề lớn và đoạn dẫn của bài đọc (layout reading_images) */
  readingHeading?: string;
  readingIntro?: string;
  problems: MatchingProblem[];
  solutions: MatchingSolution[];
  layout: MatchingLayoutId;
  settings: MatchingSettings;
}

export const DEFAULT_MATCHING_SETTINGS: MatchingSettings = {
  fontSizePt: 11,
  lineSpacing: 'normal',
  columnGapMm: 10,
  showNumbering: true,
  showAnswerBoxes: true,
  grayscale: false,
  cutMode: 'cut',
};

let counter = 0;
export const newId = (prefix: string): string => {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
};

/** 0 -> a, 25 -> z, 26 -> aa */
export const solutionLabel = (index: number): string => {
  let n = index;
  let s = '';
  do {
    s = String.fromCharCode(97 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
};

export const createMatching = (partial?: Partial<MatchingData>): MatchingData => ({
  problems: [],
  solutions: [],
  layout: 'two_columns',
  settings: { ...DEFAULT_MATCHING_SETTINGS },
  ...partial,
  // luôn có đủ trường cài đặt dù dữ liệu cũ thiếu
  ...(partial?.settings ? { settings: { ...DEFAULT_MATCHING_SETTINGS, ...partial.settings } } : {}),
});

// ───────────── Smart Paste (không dùng AI) ─────────────

export interface ParsedMatching {
  ok: boolean;
  title: string;
  /** Có khi văn bản dán vào là bài đọc (có "Name: ..."): các khối bài đọc + tiêu đề + đoạn dẫn */
  reading?: MatchingReadingBlock[];
  readingHeading?: string;
  readingIntro?: string;
  problems: string[];
  solutions: string[];
  /** Chữ cái ghi trong văn bản gốc (a, b, c...) theo đúng thứ tự solutions */
  solutionLabelsInText: string[];
  warnings: string[];
  /** Các dòng không nhận ra được: giữ nguyên để giáo viên tự sửa */
  unparsedLines: string[];
}

const PROBLEM_RE = /^\s*(\d{1,3})\s*[.)]\s*(.+?)\s*$/;
const SOLUTION_RE = /^\s*\(?([a-zA-Z])\)?\s*[.)]\s*(.+?)\s*$/;

const parseListsOnly = (raw: string): ParsedMatching => {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim());
  const result: ParsedMatching = {
    ok: false, title: '', problems: [], solutions: [], solutionLabelsInText: [], warnings: [], unparsedLines: [],
  };

  let last: 'problem' | 'solution' | null = null;
  for (const line of lines) {
    if (!line) continue;
    const p = PROBLEM_RE.exec(line);
    const s = p ? null : SOLUTION_RE.exec(line);
    if (p) {
      result.problems.push(p[2]);
      last = 'problem';
    } else if (s) {
      result.solutions.push(s[2]);
      result.solutionLabelsInText.push(s[1].toLowerCase());
      last = 'solution';
    } else if (last === null) {
      // dòng đầu chưa có mục nào: coi là tiêu đề (nối nếu nhiều dòng)
      result.title = result.title ? `${result.title} ${line}` : line;
    } else if (last === 'problem' && result.problems.length) {
      result.problems[result.problems.length - 1] += ` ${line}`; // dòng tiếp theo của mục trước
    } else if (last === 'solution' && result.solutions.length) {
      result.solutions[result.solutions.length - 1] += ` ${line}`;
    } else {
      result.unparsedLines.push(line);
    }
  }

  if (result.problems.length === 0) result.warnings.push('Không tìm thấy mục nào dạng "1. ..." (cột Problems).');
  if (result.solutions.length === 0) result.warnings.push('Không tìm thấy mục nào dạng "a. ..." (cột Solutions).');

  // nhãn a, b, c phải liên tục, nếu lệch thì báo để giáo viên kiểm tra
  result.solutionLabelsInText.forEach((l, i) => {
    if (l !== solutionLabel(i) && !result.warnings.some((w) => w.startsWith('Chữ cái'))) {
      result.warnings.push(`Chữ cái đáp án trong văn bản không liên tục (gặp "${l}" ở vị trí ${i + 1}); hệ thống sẽ đánh lại a, b, c theo thứ tự.`);
    }
  });
  if (result.unparsedLines.length) result.warnings.push(`${result.unparsedLines.length} dòng không nhận ra được.`);

  result.ok = result.problems.length > 0 && result.solutions.length > 0;
  return result;
};

// ───────────── Bài đọc có ảnh: tách "Name / Location / Then / Why… / Now" ─────────────

/** Dọn công thức LaTeX lẫn trong văn bản dán từ AI/web: \(0.03\text{ km}^2\) -> 0.03 km², \(\Box\) -> (bỏ) */
export const stripLatex = (s: string): string => {
  const inner = (x: string): string =>
    x
      .replace(/\\text\{([^}]*)\}/g, '$1')
      .replace(/\\(?:Box|square|boxed|blacksquare|Square)\b/g, '')
      .replace(/\^\{?2\}?/g, '²')
      .replace(/\^\{?3\}?/g, '³')
      .replace(/\\[,;:! ]/g, ' ')
      .replace(/\\[a-zA-Z]+/g, '')
      .replace(/[{}]/g, '');
  return s
    .replace(/\\\(([\s\S]*?)\\\)/g, (_m, g: string) => inner(g))
    .replace(/\\\[([\s\S]*?)\\\]/g, (_m, g: string) => inner(g))
    .replace(/[ \t]{2,}(?=\S)/g, (m) => (m.length >= 2 ? m : ' '))
    .replace(/[ \t]+$/gm, '');
};

const BOX_CHARS = /[☐□▢■▪]/g;
const LEAD_RE = /^((?:Then|Now|Today|Later|Before|After):|(?:Why|What|Where|When|Who|How)\b[^?.:]{2,60}\?)\s*(.*)$/;

const isAllCaps = (s: string): boolean => /[A-Z]/.test(s) && s === s.toUpperCase();

/** Tách phần bài đọc (trước câu "1. ...") thành tiêu đề, đoạn dẫn và các khối có Name/Location */
const parseReadingPassage = (lines: string[]) => {
  const nameIdx = lines.findIndex((l) => /^Name\s*:/i.test(l));
  const header = lines.slice(0, nameIdx).filter(Boolean).map((l) => l.replace(/^\d+\s+(?=[A-Z])/, ''));
  let title = '';
  let heading = '';
  let intro: string[] = [];
  if (header.length >= 2 && isAllCaps(header[0]) && (header[1].endsWith(':') || isAllCaps(header[1]))) {
    title = header[0];
    heading = header[1];
    intro = header.slice(2);
  } else if (header.length >= 1 && (header[0].endsWith(':') || isAllCaps(header[0])) && header[0].length <= 50) {
    heading = header[0];
    intro = header.slice(1);
  } else {
    intro = header;
  }

  const blocks: MatchingReadingBlock[] = [];
  let cur: { name: string; location: string; paras: string[] } | null = null;
  let para: string | null = null;
  const flushPara = () => {
    if (cur && para) cur.paras.push(para.trim());
    para = null;
  };
  const flushBlock = () => {
    flushPara();
    if (cur) blocks.push({ id: newId('r'), name: cur.name, location: cur.location, text: cur.paras.join('\n\n') });
    cur = null;
  };

  for (const line of lines.slice(nameIdx)) {
    if (!line) continue;
    if (/^Name\s*:/i.test(line)) {
      flushBlock();
      const both = /^Name\s*:\s*(.*?)\s+Location\s*:\s*(.*)$/i.exec(line);
      cur = both
        ? { name: both[1].trim(), location: both[2].trim(), paras: [] }
        : { name: line.replace(/^Name\s*:\s*/i, '').trim(), location: '', paras: [] };
      continue;
    }
    if (!cur) continue;
    if (/^Location\s*:/i.test(line)) {
      cur.location = line.replace(/^Location\s*:\s*/i, '').trim();
      continue;
    }
    const lead = LEAD_RE.exec(line);
    if (lead) {
      flushPara();
      para = `**${lead[1]}** ${lead[2]}`;
    } else {
      para = para ? `${para} ${line}` : line;
    }
  }
  flushBlock();
  return { title, heading, intro: intro.join('\n'), blocks };
};

export const parseMatchingText = (raw: string): ParsedMatching => {
  // Văn bản copy từ Word/PDF/web thường có "xuống dòng mềm" (U+000B, U+2028, U+2029, U+0085...) và khoảng trắng lạ (NBSP).
  // Nếu không đổi về xuống dòng thường thì nhiều dòng bị dính thành một: "GHOST TOWNS:Read about...".
  let clean = raw
    .replace(/\r\n?/g, '\n')
    .replace(/[\u000b\u000c\u0085\u2028\u2029]/g, '\n')
    .replace(/[\u00a0\u2007\u202f\u200b\ufeff]/g, ' ')
    .replace(BOX_CHARS, '');
  clean = stripLatex(clean);
  const isReading = /^\s*Name\s*:/im.test(clean);
  if (!isReading) return parseListsOnly(clean);

  const lines = clean.split('\n').map((l) => l.trim());
  // Phần "1. câu ..." đầu tiên là ranh giới giữa bài đọc và danh sách cần nối
  const firstProblem = lines.findIndex((l, i) => PROBLEM_RE.test(l) && i > lines.findIndex((x) => /^Name\s*:/i.test(x)));
  const passageLines = firstProblem >= 0 ? lines.slice(0, firstProblem) : lines;
  // Câu hỏi và khung đáp án thường dính cùng một dòng, cách nhau từ 2 khoảng trắng: "1. ... [ ] A. Craco"
  const restLines = (firstProblem >= 0 ? lines.slice(firstProblem) : []).flatMap((l) => {
    const m = /^(\d{1,3}\s*[.)].*?)\s{2,}([A-Z])[.)]\s+(.+)$/.exec(l);
    return m ? [m[1], `${m[2]}. ${m[3]}`] : [l];
  });

  const lists = parseListsOnly(restLines.join('\n'));
  const passage = parseReadingPassage(passageLines);
  const warnings = [...lists.warnings];
  if (passage.blocks.length === 0) warnings.push('Không tìm thấy khối bài đọc nào dạng "Name: ...".');
  return {
    ...lists,
    title: passage.title || lists.title,
    reading: passage.blocks,
    readingHeading: passage.heading,
    readingIntro: passage.intro,
    warnings,
    ok: lists.ok && passage.blocks.length > 0,
  };
};

export const matchingFromParsed = (parsed: ParsedMatching, base?: MatchingData): MatchingData =>
  createMatching({
    ...(base || {}),
    // Văn bản là bài đọc có ảnh → tự chọn layout Reading + Images; ảnh để trống, áp sau
    ...(parsed.reading && parsed.reading.length
      ? { layout: 'reading_images' as const, reading: parsed.reading, readingHeading: parsed.readingHeading, readingIntro: parsed.readingIntro }
      : parsed.title && /draw\s+lines?/i.test(parsed.title)
      ? { layout: 'facing_tables' as const }
      : {}),
    problems: parsed.problems.map((text) => ({ id: newId('p'), text })),
    solutions: parsed.solutions.map((text) => ({ id: newId('s'), text })),
  });

// ───────────── Chỉnh sửa danh sách (giữ đáp án đúng) ─────────────

export const removeProblem = (data: MatchingData, id: string): MatchingData =>
  ({ ...data, problems: data.problems.filter((p) => p.id !== id) });

export const removeSolution = (data: MatchingData, id: string): MatchingData =>
  ({ ...data, solutions: data.solutions.filter((s) => s.id !== id) });

export const moveItem = <T,>(list: T[], from: number, to: number): T[] => {
  if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

export const duplicateProblem = (data: MatchingData, id: string): MatchingData => {
  const i = data.problems.findIndex((p) => p.id === id);
  if (i < 0) return data;
  const copy = { ...data.problems[i], id: newId('p') };
  const problems = [...data.problems];
  problems.splice(i + 1, 0, copy);
  return { ...data, problems };
};

export const duplicateSolution = (data: MatchingData, id: string): MatchingData => {
  const i = data.solutions.findIndex((s) => s.id === id);
  if (i < 0) return data;
  const solutions = [...data.solutions];
  solutions.splice(i + 1, 0, { ...data.solutions[i], id: newId('s') });
  return { ...data, solutions };
};

// ───────────── Kiểm tra ─────────────

export interface MatchingValidation {
  errors: string[];
  warnings: string[];
}

export const validateMatching = (data: MatchingData): MatchingValidation => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (data.problems.length === 0) errors.push('Chưa có mục nào ở cột Problems.');
  if (data.solutions.length === 0) errors.push('Chưa có mục nào ở cột Solutions.');

  const ids = new Set<string>();
  for (const item of [...data.problems, ...data.solutions]) {
    if (ids.has(item.id)) errors.push(`ID bị trùng: ${item.id}`);
    ids.add(item.id);
  }
  data.problems.forEach((p, i) => { if (!p.text.trim() && !p.imageUrl) errors.push(`Problem ${i + 1} đang trống.`); });
  data.solutions.forEach((s, i) => { if (!s.text.trim() && !s.imageUrl) errors.push(`Solution ${solutionLabel(i)} đang trống.`); });

  // Bài đọc "nối câu với địa điểm A/B": nhiều câu dùng chung một lựa chọn là bình thường
  if (data.layout !== 'reading_images' && data.solutions.length < data.problems.length) warnings.push('Số solution ít hơn số problem.');
  return { errors, warnings };
};

export const newReadingBlock = (): MatchingReadingBlock => ({
  id: newId('r'),
  title: '',
  text: '**Then:** \n\n**Why did people go there?** \n\n**Now:** ',
});
