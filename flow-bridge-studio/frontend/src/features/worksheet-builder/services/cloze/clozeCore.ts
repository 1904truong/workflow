// Logic thuần (không import gì) cho bài Multiple Choice Cloze Test: dữ liệu, chỗ trống, Smart Paste, định dạng chữ.
// Dự án làm giáo trình: KHÔNG có đáp án đúng. Chỉ có đoạn văn, chỗ trống và các lựa chọn để học sinh khoanh.

export type ClozeLayoutId =
  | 'original'       // Kiểu 1: đoạn văn phía trên, lựa chọn 1-4 cột phía dưới
  | 'inline'         // Kiểu 2: lựa chọn nằm ngay sau chỗ trống
  | 'two_columns'    // Kiểu 3: đoạn văn bên trái, danh sách lựa chọn bên phải
  | 'answer_grid'    // Kiểu 4: đoạn văn trên, bảng lưới lựa chọn bên dưới
  | 'answer_boxes'   // Kiểu 5: đoạn văn trên, ô vuông ghi chữ cái bên dưới
  | 'compact';       // Kiểu 6: thu gọn, tiết kiệm giấy

export interface ClozeOption {
  id: string;
  label: string; // 'a' | 'b' | 'c' | 'd'
  text: string;
}

export interface ClozeQuestion {
  id: string;
  number: number;
  blankId: string;
  options: ClozeOption[];
}

export interface ClozeSettings {
  layout: ClozeLayoutId;
  imagePosition: 'right' | 'left' | 'top' | 'none';
  imageWidthPercent: number; // 15 - 50
  imageUrl?: string;
  answerColumns: 1 | 2 | 3 | 4;
  optionLabelStyle: 'lowercase' | 'uppercase' | 'numeric';
  fontFamily: string;
  passageFontSizePt: number;
  answerFontSizePt: number;
  /** Chiều cao dòng (1.2 – 2.0) */
  lineHeight: number;
  /** Khoảng cách giữa các đoạn văn */
  paragraphSpacing: 'compact' | 'normal' | 'spacious';
  passageAlign: 'left' | 'justify' | 'center' | 'right';
  showExerciseTitle: boolean;
  showPassageTitle: boolean;
  showPoints: boolean;
  /** Hiện số trong chỗ trống: (1) ________ hay chỉ ________ */
  showBlankNumbers: boolean;
  autoNumberQuestions: boolean;
  /** Tự đồng bộ chỗ trống <-> câu hỏi khi rời ô đoạn văn */
  autoSync: boolean;
  /** Không để một câu bị cắt đôi giữa hai trang */
  keepTogether: boolean;
  /** Bắt đầu bài này ở trang mới */
  pageBreakBefore: boolean;
  /** Giữ tỉ lệ ảnh (tắt: cắt ảnh theo khung cố định) */
  maintainAspect: boolean;
  /** Chữ bao quanh ảnh (tắt: ảnh nằm riêng một khối) */
  wrapText: boolean;
  /** Đã trộn thứ tự lựa chọn (chỉ ghi nhận; việc trộn thực hiện một lần khi bật) */
  shuffleOptions: boolean;
}

export interface ClozeData {
  exerciseTitle: string;
  passageTitle: string;
  passageTitleTag: 'H1' | 'H2' | 'H3';
  /** Văn bản thường, có chỗ trống dạng (1) ________ và dấu định dạng **đậm**, *nghiêng*, ++gạch chân++ */
  passage: string;
  questions: ClozeQuestion[];
  /** Tổng điểm (không bắt buộc) */
  points?: number;
  settings: ClozeSettings;
}

export const CLOZE_LAYOUTS: { id: ClozeLayoutId; label: string; desc: string }[] = [
  { id: 'original', label: 'Kiểu 1: Bố cục gốc', desc: 'Đoạn văn phía trên, lựa chọn phía dưới' },
  { id: 'inline', label: 'Kiểu 2: Inline Options', desc: 'Lựa chọn nằm ngay sau chỗ trống' },
  { id: 'two_columns', label: 'Kiểu 3: Two Columns', desc: 'Đoạn văn bên trái, lựa chọn bên phải' },
  { id: 'answer_grid', label: 'Kiểu 4: Answer Grid', desc: 'Bảng lưới lựa chọn bên dưới đoạn văn' },
  { id: 'answer_boxes', label: 'Kiểu 5: Answer Boxes', desc: 'Ô vuông đánh số để học sinh ghi chữ cái' },
  { id: 'compact', label: 'Kiểu 6: Bố cục thu gọn', desc: 'Tiết kiệm giấy, phù hợp đề dài' },
];

export const DEFAULT_CLOZE_SETTINGS: ClozeSettings = {
  layout: 'original',
  imagePosition: 'right',
  imageWidthPercent: 35,
  imageUrl: undefined, // không tự chèn ảnh; giáo viên tự tải lên
  answerColumns: 3,
  optionLabelStyle: 'lowercase',
  fontFamily: 'Quicksand',
  passageFontSizePt: 12,
  answerFontSizePt: 12,
  lineHeight: 1.5,
  paragraphSpacing: 'normal',
  passageAlign: 'justify',
  showExerciseTitle: true,
  showPassageTitle: true,
  showPoints: false,
  showBlankNumbers: true,
  autoNumberQuestions: true,
  autoSync: true,
  keepTogether: true,
  pageBreakBefore: false,
  maintainAspect: true,
  wrapText: true,
  shuffleOptions: false,
};

export const DEFAULT_EXERCISE_TITLE = 'CIRCLE THE CORRECT WORDS TO COMPLETE THE TEXT.';
const LABELS = ['a', 'b', 'c', 'd'];

// ───────── Bài mẫu (chỉ nạp khi giáo viên bấm nút) ─────────
export const SAMPLE_WALL_STREET_PASSAGE = `Wall Street is a street (1) ________ New York City's financial district. People also use Wall Street to mean the whole financial district. The Dutch gave the street (2) ________ name. They built a wall there to protect the area from the British in the 17th century.

Wall Street is one of the main financial centres in the world, (3) ________ with London, Hong Kong and Tokyo. The New York Stock Exchange opens every morning at 9:30 a.m. and closes at 4 p.m. The (4) ________ for opening and closing is a bell and they often invite a celebrity to ring it.

In the early part of the 20th century, Wall Street was the centre of the financial world. Millions of people wanted to invest money in the New York Stock Exchange because it was (5) ________ so well. Their money grew and grew and investors became rich. It seemed (6) ________ good to be true - and it was.

The Wall Street Crash began on 24 October 1929. The value of investments started to fall and soon everybody wanted to get their money back. Investors panicked and the situation got (7) ________.`;

const SAMPLE_OPTIONS: string[][] = [
  ['at', 'in', 'on'],
  ['its', "it's", 'their'],
  ['also', 'moreover', 'together'],
  ['alarm', 'signal', 'symbol'],
  ['becoming', 'being', 'doing'],
  ['enough', 'more', 'too'],
  ['badly', 'worse', 'worst'],
];

let uid = 0;
const nextId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${(uid++).toString(36)}`;

export const makeQuestion = (number: number, texts: string[] = ['', '', '']): ClozeQuestion => ({
  id: nextId('cq'),
  number,
  blankId: `blank_${number}`,
  options: texts.map((text, i) => ({ id: nextId('co'), label: LABELS[i], text })),
});

const LEGACY_LINE: Record<string, number> = { compact: 1.3, normal: 1.5, spacious: 1.85 };

export const createCloze = (partial?: Partial<ClozeData>): ClozeData => {
  const incoming = { ...(partial?.settings || {}) } as Record<string, unknown>;
  // dữ liệu cũ dùng lineSpacing dạng chữ -> đổi sang số
  if (incoming.lineHeight === undefined && typeof incoming.lineSpacing === 'string') {
    incoming.lineHeight = LEGACY_LINE[incoming.lineSpacing] ?? 1.5;
  }
  delete incoming.lineSpacing;
  return {
    exerciseTitle: DEFAULT_EXERCISE_TITLE,
    passageTitle: '',
    passageTitleTag: 'H2',
    passage: '',
    questions: [],
    ...(partial || {}),
    settings: { ...DEFAULT_CLOZE_SETTINGS, ...(incoming as Partial<ClozeSettings>) },
  };
};

export const createSampleCloze = (base?: ClozeData): ClozeData =>
  createCloze({
    ...(base || {}),
    exerciseTitle: 'CIRCLE THE CORRECT WORDS TO COMPLETE THE TEXT.',
    passageTitle: 'WALL STREET',
    passage: SAMPLE_WALL_STREET_PASSAGE,
    questions: SAMPLE_OPTIONS.map((texts, i) => makeQuestion(i + 1, texts)),
  });

export const formatOptionLabel = (
  idx: number,
  style: ClozeSettings['optionLabelStyle'] = 'lowercase'
): string => {
  if (style === 'numeric') return `${idx + 1}.`;
  return `${String.fromCharCode((style === 'uppercase' ? 65 : 97) + idx)}.`;
};

// ───────── Chỗ trống trong đoạn văn ─────────

const BLANK_RE = /\((\d+)\)\s*_{2,}/g;

export const blankNumbersInPassage = (passage: string): number[] =>
  [...passage.matchAll(BLANK_RE)].map((m) => Number(m[1]));

/**
 * Đánh số lại các chỗ trống theo THỨ TỰ XUẤT HIỆN trong đoạn văn (1, 2, 3...) và đồng bộ danh sách câu hỏi:
 * câu hỏi đi theo chỗ trống cũ của nó; chỗ trống mới (số 0) nhận một câu hỏi trống mới;
 * câu hỏi không còn chỗ trống được giữ lại ở cuối (xem orphanQuestionIds).
 */
export const syncBlanks = (data: ClozeData): ClozeData => {
  const used = new Set<string>();
  const ordered: ClozeQuestion[] = [];
  let idx = 0;
  const passage = data.passage.replace(BLANK_RE, (_m, n) => {
    idx += 1;
    const old = Number(n);
    let q = old === 0 ? undefined : data.questions.find((x) => x.number === old && !used.has(x.id));
    if (!q) q = makeQuestion(idx);
    used.add(q.id);
    ordered.push({ ...q, number: idx, blankId: `blank_${idx}` });
    return `(${idx}) ________`;
  });
  const orphans = data.questions.filter((q) => !used.has(q.id));
  orphans.forEach((q, i) => ordered.push({ ...q, number: idx + i + 1, blankId: `blank_${idx + i + 1}` }));
  return { ...data, passage, questions: ordered };
};

/** Chèn một chỗ trống mới tại vị trí con trỏ (hoặc cuối đoạn văn) rồi đánh số lại theo thứ tự */
export const insertBlank = (data: ClozeData, insertPos?: number): ClozeData => {
  const token = '(0) ________';
  const p = data.passage;
  const pos = typeof insertPos === 'number' && insertPos >= 0 && insertPos <= p.length ? insertPos : p.length;
  const before = p.slice(0, pos);
  const after = p.slice(pos);
  const sepBefore = before && !/\s$/.test(before) ? ' ' : '';
  const sepAfter = after && !/^[\s.,;:!?)]/.test(after) ? ' ' : '';
  return syncBlanks({ ...data, passage: `${before}${sepBefore}${token}${sepAfter}${after}` });
};

/** Xóa câu hỏi cùng chỗ trống tương ứng, các chỗ trống sau tự đánh số lại */
export const removeQuestion = (data: ClozeData, questionId: string): ClozeData => {
  const q = data.questions.find((x) => x.id === questionId);
  if (!q) return data;
  const re = new RegExp(`[ \\t]?\\(${q.number}\\)\\s*_{2,}`);
  const passage = data.passage.replace(re, (m) => (m.startsWith(' ') || m.startsWith('\t') ? '' : ''));
  return syncBlanks({ ...data, passage, questions: data.questions.filter((x) => x.id !== questionId) });
};

/** Nhân bản câu hỏi: thêm một chỗ trống mới ở cuối đoạn văn với cùng danh sách lựa chọn */
export const duplicateQuestion = (data: ClozeData, questionId: string): ClozeData => {
  const q = data.questions.find((x) => x.id === questionId);
  if (!q) return data;
  const withBlank = insertBlank(data);
  const last = withBlank.questions[withBlank.questions.length - 1];
  const options = q.options.map((o, i) => ({ id: nextId('co'), label: LABELS[i], text: o.text }));
  return { ...withBlank, questions: withBlank.questions.map((x) => (x.id === last.id ? { ...x, options } : x)) };
};

/** Đổi thứ tự câu hỏi: bộ lựa chọn chuyển sang chỗ trống có số tương ứng (đoạn văn giữ nguyên) */
export const reorderQuestions = (data: ClozeData, from: number, to: number): ClozeData => {
  const n = data.questions.length;
  if (from === to || from < 0 || to < 0 || from >= n || to >= n) return data;
  const copy = [...data.questions];
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved);
  return { ...data, questions: copy.map((q, i) => ({ ...q, number: i + 1, blankId: `blank_${i + 1}` })) };
};

/** Câu hỏi không còn chỗ trống nào trong đoạn văn (ví dụ giáo viên xóa tay chỗ trống) */
export const orphanQuestionIds = (data: ClozeData): string[] => {
  const nums = new Set(blankNumbersInPassage(data.passage));
  return data.questions.filter((q) => !nums.has(q.number)).map((q) => q.id);
};

export const addOption = (q: ClozeQuestion): ClozeQuestion =>
  q.options.length >= 4 ? q : { ...q, options: [...q.options, { id: nextId('co'), label: LABELS[q.options.length], text: '' }] };

export const removeOption = (q: ClozeQuestion, optIdx: number): ClozeQuestion => {
  if (q.options.length <= 2) return q;
  const options = q.options.filter((_, i) => i !== optIdx).map((o, i) => ({ ...o, label: LABELS[i] }));
  return { ...q, options };
};

/** Trộn thứ tự các lựa chọn trong từng câu (nhãn a, b, c giữ nguyên vị trí). rng mặc định Math.random */
export const shuffleOptionOrder = (data: ClozeData, rng: () => number = Math.random): ClozeData => ({
  ...data,
  questions: data.questions.map((q) => {
    const texts = q.options.map((o) => o.text);
    for (let i = texts.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [texts[i], texts[j]] = [texts[j], texts[i]];
    }
    return { ...q, options: q.options.map((o, i) => ({ ...o, text: texts[i] })) };
  }),
});

// ───────── Định dạng chữ trong đoạn văn: **đậm**, *nghiêng*, ++gạch chân++ ─────────

export type MarkupSeg = { text: string; bold?: boolean; italic?: boolean; underline?: boolean };

export const parseMarkup = (src: string): MarkupSeg[] => {
  const segs: MarkupSeg[] = [];
  let bold = false;
  let italic = false;
  let underline = false;
  let buf = '';
  const flush = () => {
    if (buf) segs.push({ text: buf, ...(bold ? { bold } : {}), ...(italic ? { italic } : {}), ...(underline ? { underline } : {}) });
    buf = '';
  };
  // chỉ coi là dấu định dạng nếu có dấu đóng tương ứng phía sau (tránh nuốt dấu * đơn lẻ)
  const hasClose = (marker: string, from: number) => src.indexOf(marker, from) !== -1;
  for (let i = 0; i < src.length; ) {
    if (src.startsWith('**', i) && (bold || hasClose('**', i + 2))) { flush(); bold = !bold; i += 2; continue; }
    if (src.startsWith('++', i) && (underline || hasClose('++', i + 2))) { flush(); underline = !underline; i += 2; continue; }
    if (src[i] === '*' && !src.startsWith('**', i) && (italic || hasClose('*', i + 1))) { flush(); italic = !italic; i += 1; continue; }
    buf += src[i];
    i += 1;
  }
  flush();
  return segs;
};

export interface TextEdit { text: string; selStart: number; selEnd: number }

/** Bọc/bỏ bọc phần đang chọn bằng dấu định dạng (marker) */
export const toggleWrap = (text: string, selStart: number, selEnd: number, marker: string): TextEdit => {
  const m = marker.length;
  const before = text.slice(0, selStart);
  const sel = text.slice(selStart, selEnd);
  const after = text.slice(selEnd);
  if (before.endsWith(marker) && after.startsWith(marker)) {
    return { text: before.slice(0, -m) + sel + after.slice(m), selStart: selStart - m, selEnd: selEnd - m };
  }
  if (sel.startsWith(marker) && sel.endsWith(marker) && sel.length >= 2 * m) {
    const inner = sel.slice(m, sel.length - m);
    return { text: before + inner + after, selStart, selEnd: selEnd - 2 * m };
  }
  return { text: before + marker + sel + marker + after, selStart: selStart + m, selEnd: selEnd + m };
};

/** Thêm/bỏ tiền tố danh sách ("• " hoặc "1. ") cho các dòng đang chọn */
export const toggleListPrefix = (text: string, selStart: number, selEnd: number, kind: 'bullet' | 'numbered'): TextEdit => {
  const start = text.lastIndexOf('\n', selStart - 1) + 1;
  let end = text.indexOf('\n', selEnd);
  if (end === -1) end = text.length;
  const lines = text.slice(start, end).split('\n');
  const isBulletLine = (l: string) => l.startsWith('• ');
  const isNumLine = (l: string) => /^\d+\.\s/.test(l);
  const has = kind === 'bullet' ? lines.every(isBulletLine) : lines.every(isNumLine);
  const out = lines.map((l, i) => {
    const plain = l.replace(/^(• |\d+\.\s)/, '');
    if (has) return plain;
    return kind === 'bullet' ? `• ${plain}` : `${i + 1}. ${plain}`;
  });
  const joined = out.join('\n');
  return { text: text.slice(0, start) + joined + text.slice(end), selStart: start, selEnd: start + joined.length };
};

// ───────── Smart Paste ─────────

export interface ClozeParseResult {
  data: ClozeData;
  warnings: string[];
  questionCount: number;
  blankCount: number;
}

// Dấu chấm sau số là tùy chọn: "1. a. at b. in" và "1 a. at b. in" (hay gặp khi copy từ PDF) đều được nhận
const NUM_Q_RE = /^\s*(\d{1,3})\s*[.)]?\s*(.*)$/;
const OPT_ONLY_RE = /^\s*\(?([a-dA-D])[.)]\s*(.+)$/;
const FIRST_OPT_AFTER_NUM = /^\s*\(?[aA][.)]\s*\S/;

const parseInlineOptions = (rest: string): { label: string; text: string }[] => {
  const out: { label: string; text: string }[] = [];
  const re = /(?:^|\s)\(?([a-dA-D])[.)]\s*(.+?)(?=\s+\(?[a-dA-D][.)]\s|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rest)) !== null) out.push({ label: m[1].toLowerCase(), text: m[2].trim() });
  return out;
};

/**
 * Tách: tiêu đề bài, tiêu đề đoạn văn (dòng ngắn VIẾT HOA), đoạn văn có chỗ trống (1) ________ và danh sách lựa chọn
 * (cả dạng "1. a. at b. in c. on" lẫn dạng mỗi lựa chọn một dòng). KHÔNG bịa nội dung nếu thiếu.
 */
export const parseClozeSmartPaste = (raw: string): ClozeParseResult => {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim());
  const warnings: string[] = [];

  // 1. tìm dòng bắt đầu phần câu hỏi: "N. a. ..." hoặc "N." rồi dòng "a. ..."
  let qStart = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = NUM_Q_RE.exec(lines[i]);
    if (!m) continue;
    const rest = m[2];
    const nextLine = lines.slice(i + 1).find((l) => l) || '';
    if (FIRST_OPT_AFTER_NUM.test(rest) || (rest === '' && FIRST_OPT_AFTER_NUM.test(nextLine))) { qStart = i; break; }
  }
  const head = qStart === -1 ? lines : lines.slice(0, qStart);
  const tail = qStart === -1 ? [] : lines.slice(qStart);

  // 2. đầu bài
  const nonEmpty = head.map((l, i) => ({ l, i })).filter((x) => x.l);
  let exerciseTitle = '';
  let passageTitle = '';
  let consumed = 0;
  if (nonEmpty.length) {
    const first = nonEmpty[0].l;
    if (!/_{2,}/.test(first) && first.length < 120 && (first === first.toUpperCase() || /circle|choose|complete|read/i.test(first))) {
      exerciseTitle = first;
      consumed = 1;
    }
    const second = nonEmpty[consumed];
    if (second && !/_{2,}/.test(second.l) && second.l.length < 60 && second.l === second.l.toUpperCase() && /[A-Z]/.test(second.l)) {
      passageTitle = second.l;
      consumed += 1;
    }
  }
  const passageStartLine = nonEmpty[consumed]?.i ?? head.length;
  const passage = head.slice(passageStartLine).join('\n').replace(/\n{3,}/g, '\n\n').trim();

  // 3. câu hỏi
  const questions: ClozeQuestion[] = [];
  let cur: ClozeQuestion | null = null;
  const push = (n: number) => {
    cur = { id: nextId('cq'), number: n, blankId: `blank_${n}`, options: [] };
    questions.push(cur);
  };
  const addOpt = (q: ClozeQuestion, text: string) => {
    if (q.options.length >= 4) return;
    q.options.push({ id: nextId('co'), label: LABELS[q.options.length], text });
  };
  for (const line of tail) {
    if (!line) continue;
    const qm = NUM_Q_RE.exec(line);
    if (qm && (qm[2] === '' || FIRST_OPT_AFTER_NUM.test(qm[2]))) {
      push(Number(qm[1]));
      if (qm[2]) for (const o of parseInlineOptions(qm[2])) addOpt(cur!, o.text);
      continue;
    }
    const om = OPT_ONLY_RE.exec(line);
    if (om && cur) {
      const inline = parseInlineOptions(line);
      if (inline.length > 1) for (const o of inline) addOpt(cur, o.text);
      else addOpt(cur, om[2].trim());
    }
  }

  const blanks = blankNumbersInPassage(passage);
  if (qStart === -1) warnings.push('Không tìm thấy danh sách lựa chọn (dạng "1. a. ... b. ... c. ..."). Phần đoạn văn vẫn được giữ.');
  if (!passage) warnings.push('Không tìm thấy đoạn văn.');
  if (passage && blanks.length === 0) warnings.push('Đoạn văn chưa có chỗ trống dạng (1) ________.');
  if (blanks.length && questions.length && blanks.length !== questions.length) {
    warnings.push(`Số chỗ trống (${blanks.length}) khác số câu hỏi (${questions.length}). Hãy kiểm tra lại.`);
  }
  const few = questions.filter((q) => q.options.length < 2).length;
  if (few) warnings.push(`${few} câu có ít hơn 2 lựa chọn.`);

  const data = createCloze({
    ...(exerciseTitle ? { exerciseTitle } : {}),
    passageTitle,
    passage,
    questions,
  });
  return { data, warnings, questionCount: questions.length, blankCount: blanks.length };
};

// ───────── Tiện ích cho bảng soạn ─────────

const stripMarkup = (t: string) => t.replace(/\*\*|\+\+/g, '').replace(/\*/g, '');

/** Vài từ ngay trước chỗ trống, để biết câu hỏi nằm ở đâu: "Wall Street is a street ..." */
export const contextBefore = (passage: string, number: number, words = 5): string => {
  const m = new RegExp(`\\(${number}\\)\\s*_{2,}`).exec(passage);
  if (!m) return '';
  const before = stripMarkup(passage.slice(0, m.index)).replace(BLANK_RE, ' ___ ');
  const w = before.split(/\s+/).filter(Boolean);
  const take = w.slice(-words).join(' ');
  return take ? `${take} ...` : '...';
};

export const wordCount = (passage: string): number =>
  stripMarkup(passage).replace(BLANK_RE, ' ').split(/\s+/).filter((x) => /[\p{L}\p{N}]/u.test(x)).length;

/** Mỗi dòng một câu: "1. at | in | on" */
export const bulkTextFromQuestions = (data: ClozeData): string =>
  data.questions.map((q) => `${q.number}. ${q.options.map((o) => o.text).join(' | ')}`).join('\n');

/**
 * Áp văn bản nhiều dòng vào các câu hỏi theo thứ tự. Dòng dư tạo thêm câu (kèm chỗ trống ở cuối đoạn);
 * câu không có dòng tương ứng được giữ nguyên.
 */
export const applyBulkText = (data: ClozeData, text: string): ClozeData => {
  const rows = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const body = l.replace(/^\d{1,3}\s*[.)]\s*/, '');
      const parts = (body.includes('|') ? body.split('|') : body.split(/\s+\/\s+/)).map((x) => x.trim()).filter((x) => x !== '');
      return parts.slice(0, 4);
    })
    .filter((r) => r.length > 0);
  let out = data;
  while (out.questions.length < rows.length) out = insertBlank(out);
  return {
    ...out,
    questions: out.questions.map((q, i) => {
      const r = rows[i];
      if (!r) return q;
      const texts = [...r];
      while (texts.length < 2) texts.push('');
      return { ...q, options: texts.map((t, oi) => ({ id: q.options[oi]?.id || nextId('co'), label: LABELS[oi], text: t })) };
    }),
  };
};
