// Core data models, sample data, and helpers for Listening Fill in the Gap worksheets.

export type ListeningLayoutId =
  | 'original'       // Layout 1: Một cột – phổ biến nhất
  | 'numbered'       // Layout 2: Đánh số chỗ trống (1–13)
  | 'two_columns'    // Layout 3: Hai cột (Tiết kiệm diện tích)
  | 'answer_grid'    // Layout 4: Đoạn văn + Bảng đáp án "YOUR ANSWERS"
  | 'spaced_blocks'  // Layout 5: Từng câu riêng (Nhiều khoảng trống để viết)
  | 'illustrated'    // Layout 6: Kết hợp hình ảnh minh họa (Hấp dẫn)
  | 'dialogue'       // Layout 7: Hội thoại (SUE: ... TEO: ...), không đánh số đoạn
  | 'passage_qr'     // Layout 8: Bài đọc đánh số, QR nhỏ chạy chữ vòng quanh, ảnh nhân vật ở đầu bài
  | 'passage_image' // Layout 9: Bài đọc không đánh số, ảnh lớn bên phải (QR đè góc ảnh), câu hỏi trả lời ngắn bên dưới
  | 'outline';      // Layout 10: Dàn ý gạch đầu dòng (• / +), QR góc phải tiêu đề, ảnh bên phải

export type BlankStyle = 'underline' | 'box' | 'dotted';
export type BlankNumberingStyle = 'letters_lower' | 'letters_upper' | 'numbers';

export interface ListeningBlank {
  id: string;             // Stable ID e.g. 'blank_a'
  paragraphId: string;    // Belongs to paragraph id
  label: string;          // 'a', 'b', ... 'm'
  number: number;         // 1..13
  correctAnswer: string;  // e.g. 'sights', 'buses'
  acceptedAnswers?: string[];
  teacherNote?: string;
}

export interface ListeningParagraphFormat {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  highlight?: string;
  align?: 'left' | 'center' | 'right';
  list?: 'number' | 'bullet' | 'none';
  indentMm?: number;
}

export type ListeningExtraType = 'text' | 'line' | 'shape' | 'table';

/** Phần tử chèn thêm (Text Box / Line / Shape / Table) – xếp theo thứ tự sau đoạn văn */
export interface ListeningExtra {
  id: string;
  type: ListeningExtraType;
  align: 'left' | 'center' | 'right';
  widthPercent: number;
  text?: string;
  shape?: 'rect' | 'ellipse';
  rows?: number;
  cols?: number;
  cells?: string[][];
}

export interface ListeningParagraph {
  id: string;
  order: number;
  text: string;           // Paragraph text containing markers like (a) ________
  imageAssetUrl?: string; // Optional image for this paragraph
  imageCaption?: string;
  format?: ListeningParagraphFormat;
}

export interface ListeningAudio {
  filename: string;
  sizeMb: string;
  durationStr: string;
  durationSeconds?: number;
  audioUrl?: string;
  storagePath?: string;
  /** 'file' = chọn từ máy (chỉ nghe thử trong editor), 'link' = dán đường dẫn công khai */
  sourceType?: 'file' | 'link';
  /** Đường dẫn công khai mà học sinh quét QR để nghe (chỉ có khi nguồn là link) */
  shareUrl?: string;
}

export interface ListeningGapFillSettings {
  layout: ListeningLayoutId;
  blankStyle: BlankStyle;
  blankNumbering: BlankNumberingStyle;
  blankWidthMm: number;        // default 30, range 10 - 60
  autoNumberBlanks: boolean;   // default true
  
  // Image settings
  imagePosition: 'right' | 'left' | 'top' | 'none';
  imageWidthPercent: number;   // default 30, range 15 - 50
  maintainAspectRatio: boolean;
  wrapTextAroundImage: boolean;
  
  // Answer settings
  showAnswerSection: boolean;  // toggle for answer grid
  answerLayout: 'grid' | 'list';
  answerColumns: 1 | 2 | 3 | 4; // default 4
  answerLabelStyle: 'lowercase' | 'uppercase' | 'numeric';
  
  // Typography
  fontFamily: string;          // default 'Arial'
  passageFontSizePt: number;   // default 12
  headingFontSizePt: number;   // default 14
  lineHeight: number;          // default 1.5
  paragraphSpacing: 'compact' | 'normal' | 'spacious';
  
  // Advanced toggles
  showExerciseTitle: boolean;
  showPassageTitle: boolean;
  showAudioIcon: boolean;
  showQrCode: boolean;
  qrPosition: 'top_right' | 'top_left' | 'bottom_right' | 'bottom_left';
  showPoints: boolean;
  pageBreakBefore: boolean;
  showTeacherKey: boolean;
}

export interface ListeningBodyImage {
  url?: string;
  /** Tỉ lệ rộng/cao của khung ảnh (tự theo ảnh thật khi có ảnh) */
  ratio?: number;
  /** Prompt tạo ảnh (tự sinh từ nội dung, sửa được) */
  prompt?: string;
}

export interface ListeningShortQuestion {
  id: string;
  text: string;
}

export interface ListeningGapFillData {
  /** Ảnh lớn cạnh bài đọc (layout "Bài đọc + ảnh") */
  bodyImage?: ListeningBodyImage;
  /** Câu hỏi trả lời ngắn bên dưới bài đọc (layout "Bài đọc + ảnh") */
  questions?: ListeningShortQuestion[];
  /** Ảnh nhỏ ở góc phải hàng tiêu đề (nhân vật minh họa) */
  headerImage?: { url?: string };
  exerciseTitle: string;
  passageTitle: string;
  exerciseNumber: number;
  pointsTotal?: number;
  paragraphs: ListeningParagraph[];
  blanks: ListeningBlank[];
  extras?: ListeningExtra[];
  audio: ListeningAudio;
  settings: ListeningGapFillSettings;
}

/** Dòng mở đầu lượt nói: "SUE:", "Teo:" (1–15 chữ cái, theo sau là dấu hai chấm) */
export const SPEAKER_RE = /^([A-Z][A-Za-z]{1,14}):\s+/;

/** Cài đặt khớp phiếu mẫu hội thoại: chữ nhỏ vừa, dòng sát, chỗ trống ngắn, không tai nghe cạnh tiêu đề */
export const DIALOGUE_PRESET: Partial<ListeningGapFillSettings> = {
  layout: 'dialogue',
  passageFontSizePt: 10.5,
  lineHeight: 1.45,
  paragraphSpacing: 'compact',
  blankWidthMm: 18,
  showAudioIcon: false,
  blankStyle: 'underline',
};

/** Cài đặt khớp phiếu mẫu "bài đọc + QR": chữ nhỏ vừa, dòng sát, chỗ trống ngắn, không ảnh từng đoạn */
export const PASSAGE_QR_PRESET: Partial<ListeningGapFillSettings> = {
  layout: 'passage_qr',
  passageFontSizePt: 10.5,
  lineHeight: 1.5,
  paragraphSpacing: 'compact',
  blankWidthMm: 18,
  showAudioIcon: false,
  imagePosition: 'none',
  blankStyle: 'underline',
};

/** Cài đặt khớp phiếu mẫu "bài đọc + ảnh lớn + câu hỏi" */
export const PASSAGE_IMAGE_PRESET: Partial<ListeningGapFillSettings> = {
  layout: 'passage_image',
  passageFontSizePt: 10.5,
  lineHeight: 1.5,
  paragraphSpacing: 'compact',
  blankWidthMm: 18,
  showAudioIcon: false,
  imagePosition: 'none',
  blankStyle: 'underline',
};

/** Cài đặt khớp phiếu mẫu "dàn ý gạch đầu dòng + ảnh bên phải" */
export const OUTLINE_PRESET: Partial<ListeningGapFillSettings> = {
  layout: 'outline',
  passageFontSizePt: 10.5,
  lineHeight: 1.6,
  paragraphSpacing: 'compact',
  blankWidthMm: 18,
  showAudioIcon: false,
  imagePosition: 'none',
  blankStyle: 'underline',
  blankNumbering: 'numbers',
};

export const LISTENING_LAYOUTS: { id: ListeningLayoutId; label: string; desc: string }[] = [
  { id: 'original', label: '1. Original (1 cột)', desc: 'Bố cục gốc một cột, phổ biến nhất' },
  { id: 'numbered', label: '2. Đánh số (1–13)', desc: 'Đánh số thứ tự 1-13 thay cho chữ cái' },
  { id: 'two_columns', label: '3. Hai cột', desc: 'Chia 2 cột tiết kiệm diện tích giấy' },
  { id: 'answer_grid', label: '4. Bảng đáp án', desc: 'Đoạn văn trên, bảng YOUR ANSWERS bên dưới' },
  { id: 'spaced_blocks', label: '5. Từng câu riêng', desc: 'Nhiều khoảng trống thoáng để viết tay' },
  { id: 'illustrated', label: '6. Kết hợp hình ảnh', desc: 'Mỗi đoạn văn có ảnh minh họa sinh động' },
  { id: 'dialogue', label: '7. Hội thoại', desc: 'Mỗi lượt nói bắt đầu bằng tên người nói in đậm (SUE:, TEO:), không đánh số' },
  { id: 'passage_image', label: '9. Bài đọc + ảnh lớn', desc: 'Bài đọc không đánh số, ảnh lớn bên phải với QR đè góc ảnh, câu hỏi trả lời ngắn bên dưới' },
  { id: 'outline', label: '10. Dàn ý gạch đầu dòng', desc: 'Dòng • và dòng con + , chỗ trống đánh số (1), (2)…, QR góc phải tiêu đề, ảnh bên phải' },
  { id: 'passage_qr', label: '8. Bài đọc + QR', desc: 'Đoạn đánh số kín chữ, mã QR nhỏ ở đầu bài chữ chạy vòng quanh, ảnh nhân vật ở góc tiêu đề' },
];

export const DEFAULT_LISTENING_SETTINGS: ListeningGapFillSettings = {
  layout: 'original',
  blankStyle: 'underline',
  blankNumbering: 'letters_lower',
  blankWidthMm: 26,
  autoNumberBlanks: true,
  imagePosition: 'right',
  imageWidthPercent: 22,
  maintainAspectRatio: true,
  wrapTextAroundImage: true,
  showAnswerSection: false,
  answerLayout: 'grid',
  answerColumns: 4,
  answerLabelStyle: 'lowercase',
  fontFamily: 'Arial',
  passageFontSizePt: 12,
  headingFontSizePt: 14,
  lineHeight: 1.7,
  paragraphSpacing: 'normal',
  showExerciseTitle: true,
  showPassageTitle: true,
  showAudioIcon: true,
  showQrCode: true,
  qrPosition: 'top_right',
  showPoints: false,
  pageBreakBefore: false,
  showTeacherKey: false,
};

// ── Default Reference Exercise: THINGS TO SEE AND DO IN LONDON ──
export const SAMPLE_LONDON_PARAGRAPHS: ListeningParagraph[] = [
  {
    id: 'p1',
    order: 1,
    text: `Go on a Big Bus tour and see the famous (a) __________ in London, like the Tower of London, Trafalgar Square and Buckingham Palace, one of the Queen's homes. There are now 80 open-top (b) __________ that do tours of the city.`,
    imageAssetUrl: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=400&q=80',
    imageCaption: 'London Big Bus',
  },
  {
    id: 'p2',
    order: 2,
    text: `Visit the Tate Modern and see a fantastic (c) __________ of modern art by famous artists like Picasso and Dali. The Tate Modern has a total floor (d) __________ of 34,000 square metres and is on the south side of the River Thames, not far from the famous Globe (e) __________ .`,
    imageAssetUrl: 'https://images.unsplash.com/photo-1549144511-f099e773c147?auto=format&fit=crop&w=400&q=80',
    imageCaption: 'Tate Modern Gallery',
  },
  {
    id: 'p3',
    order: 3,
    text: `Meet famous sports people, pop stars and (f) __________ at Madame Tussauds wax museum. There are almost 400 wax models to see. It takes about four months to make a (g) __________ of a famous person and costs £150,000!`,
    imageAssetUrl: 'https://images.unsplash.com/photo-1526129318478-62ed807ebdf9?auto=format&fit=crop&w=400&q=80',
    imageCaption: 'Madame Tussauds',
  },
  {
    id: 'p4',
    order: 4,
    text: `Come to the Hard Rock Café in Old Park Lane and try the food: eat Hickory Bar-B-Que Ribs or a Haystack Chicken (h) __________ . There's a great collection of 70,000 things from the world of (i) __________ music - like old guitars and (k) __________ from famous bands.`,
    imageAssetUrl: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=400&q=80',
    imageCaption: 'Hard Rock Cafe',
  },
  {
    id: 'p5',
    order: 5,
    text: `Thirty million (l) __________ a year visit Covent Garden. They watch the jugglers, clowns and musicians, and visit the great cafés and (m) __________ .`,
    imageAssetUrl: 'https://images.unsplash.com/photo-1508873696983-2df5293cb32f?auto=format&fit=crop&w=400&q=80',
    imageCaption: 'Covent Garden Market',
  },
];

export const SAMPLE_LONDON_BLANKS: ListeningBlank[] = [
  { id: 'blank_a', paragraphId: 'p1', label: 'a', number: 1, correctAnswer: 'sights', acceptedAnswers: ['places'], teacherNote: 'Tourist landmarks' },
  { id: 'blank_b', paragraphId: 'p1', label: 'b', number: 2, correctAnswer: 'buses', acceptedAnswers: ['double-decker buses'], teacherNote: 'Sightseeing buses' },
  { id: 'blank_c', paragraphId: 'p2', label: 'c', number: 3, correctAnswer: 'collection', acceptedAnswers: ['exhibition'], teacherNote: 'Art collection' },
  { id: 'blank_d', paragraphId: 'p2', label: 'd', number: 4, correctAnswer: 'area', acceptedAnswers: ['space'], teacherNote: 'Measurement of surface' },
  { id: 'blank_e', paragraphId: 'p2', label: 'e', number: 5, correctAnswer: 'Theatre', acceptedAnswers: ['Theater'], teacherNote: "Shakespeare's Globe" },
  { id: 'blank_f', paragraphId: 'p3', label: 'f', number: 6, correctAnswer: 'politicians', acceptedAnswers: ['celebrities'], teacherNote: 'World leaders' },
  { id: 'blank_g', paragraphId: 'p3', label: 'g', number: 7, correctAnswer: 'figure', acceptedAnswers: ['statue', 'model'], teacherNote: 'Wax figure' },
  { id: 'blank_h', paragraphId: 'p4', label: 'h', number: 8, correctAnswer: 'Salad', acceptedAnswers: ['sandwich'], teacherNote: 'Menu item' },
  { id: 'blank_i', paragraphId: 'p4', label: 'i', number: 9, correctAnswer: 'rock', acceptedAnswers: ['pop'], teacherNote: 'Genre of music' },
  { id: 'blank_k', paragraphId: 'p4', label: 'k', number: 10, correctAnswer: 'clothes', acceptedAnswers: ['costumes'], teacherNote: 'Stage outfits' },
  { id: 'blank_l', paragraphId: 'p5', label: 'l', number: 11, correctAnswer: 'visitors', acceptedAnswers: ['tourists', 'people'], teacherNote: 'Annual attendance' },
  { id: 'blank_m', paragraphId: 'p5', label: 'm', number: 12, correctAnswer: 'restaurants', acceptedAnswers: ['shops'], teacherNote: 'Dining venues' },
];

export const SAMPLE_LONDON_AUDIO: ListeningAudio = {
  filename: 'london-listening.mp3',
  sizeMb: '3.2 MB',
  durationStr: '02:34',
  durationSeconds: 154,
  audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
};

// ── Factory helper ──
export const createListeningGapFill = (partial?: Partial<ListeningGapFillData>): ListeningGapFillData => {
  const base: ListeningGapFillData = {
    exerciseTitle: 'LISTEN AND FILL IN THE GAP',
    passageTitle: 'THINGS TO SEE AND DO IN LONDON',
    exerciseNumber: 3,
    pointsTotal: 12,
    // Bài mới mặc định chưa có ảnh: ảnh được thêm theo layout có hỗ trợ ảnh
    paragraphs: SAMPLE_LONDON_PARAGRAPHS.map((p) => ({ ...p, imageAssetUrl: undefined, imageCaption: undefined })),
    blanks: SAMPLE_LONDON_BLANKS,
    audio: SAMPLE_LONDON_AUDIO,
    settings: { ...DEFAULT_LISTENING_SETTINGS },
  };

  if (!partial) return base;

  return {
    ...base,
    ...partial,
    settings: {
      ...base.settings,
      ...(partial.settings || {}),
    },
  };
};

// ── Next letter generator (a -> b -> c ... z -> aa) ──
export const getNextBlankLabel = (blanks: ListeningBlank[]): string => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
  // Check which lowercase letter is not yet taken
  for (const char of alphabet) {
    if (!blanks.some((b) => b.label.toLowerCase() === char)) {
      return char;
    }
  }
  return `b${blanks.length + 1}`;
};

// ── Format blank label according to user style ──
export const formatBlankLabel = (
  blank: ListeningBlank,
  style: BlankNumberingStyle
): string => {
  if (style === 'numbers') {
    return `(${blank.number})`;
  }
  if (style === 'letters_upper') {
    return `(${blank.label.toUpperCase()})`;
  }
  return `(${blank.label.toLowerCase()})`;
};

// ── Insert Blank at cursor position in a specific paragraph ──
export const insertBlankInParagraph = (
  data: ListeningGapFillData,
  paragraphIndex: number,
  cursorPos?: number
): ListeningGapFillData => {
  const paras = [...data.paragraphs];
  const targetPara = paras[paragraphIndex];
  if (!targetPara) return data;

  const nextLabel = getNextBlankLabel(data.blanks);
  const nextNum = data.blanks.length + 1;
  const blankId = `blank_${Date.now()}_${nextLabel}`;
  const blankMarker = `(${nextLabel}) __________`;

  let newText = targetPara.text;
  if (typeof cursorPos === 'number' && cursorPos >= 0 && cursorPos <= newText.length) {
    newText = newText.slice(0, cursorPos) + ` ${blankMarker} ` + newText.slice(cursorPos);
  } else {
    newText = `${newText} ${blankMarker}`;
  }

  paras[paragraphIndex] = {
    ...targetPara,
    text: newText,
  };

  const newBlank: ListeningBlank = {
    id: blankId,
    paragraphId: targetPara.id,
    label: nextLabel,
    number: nextNum,
    correctAnswer: '',
    acceptedAnswers: [],
  };

  // Re-number blanks
  const updatedBlanks = [...data.blanks, newBlank].map((b, i) => ({
    ...b,
    number: i + 1,
  }));

  return {
    ...data,
    paragraphs: paras,
    blanks: updatedBlanks,
    pointsTotal: updatedBlanks.length,
  };
};

// ── Delete a Blank ──
export const removeBlank = (data: ListeningGapFillData, blankId: string): ListeningGapFillData => {
  const target = data.blanks.find((b) => b.id === blankId);
  if (!target) return data;

  // Remove marker from paragraph text
  const labelEscaped = target.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\(${labelEscaped}\\)\\s*_{2,}`, 'gi');

  const paras = data.paragraphs.map((p) => {
    if (p.id === target.paragraphId) {
      return {
        ...p,
        text: p.text.replace(regex, '').replace(/\s{2,}/g, ' ').trim(),
      };
    }
    return p;
  });

  const updatedBlanks = data.blanks
    .filter((b) => b.id !== blankId)
    .map((b, i) => ({
      ...b,
      number: i + 1,
    }));

  return {
    ...data,
    paragraphs: paras,
    blanks: updatedBlanks,
    pointsTotal: updatedBlanks.length,
  };
};

// ── Reorder Paragraphs ──
export const reorderParagraphs = (
  data: ListeningGapFillData,
  fromIndex: number,
  toIndex: number
): ListeningGapFillData => {
  const paras = [...data.paragraphs];
  const [removed] = paras.splice(fromIndex, 1);
  paras.splice(toIndex, 0, removed);

  const reordered = paras.map((p, i) => ({
    ...p,
    order: i + 1,
  }));

  return {
    ...data,
    paragraphs: reordered,
  };
};

// ── Smart Paste Parser for Listening Gap Fill ──
export const parseListeningSmartPaste = (raw: string): ListeningGapFillData => {
  const allLines = raw.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim());
  let exerciseTitle = 'LISTEN AND FILL IN THE GAP';
  let passageTitle = 'THINGS TO SEE AND DO IN LONDON';
  const paragraphTexts: string[] = [];

  // Câu hỏi trả lời ngắn: dòng đánh số kết thúc bằng "?" và không có chỗ trống (a) ____ → tách ra khỏi bài đọc
  const BLANK_IN_LINE = /\(([a-zA-Z0-9]+)\)\s*_{2,}/;
  const questionTexts: string[] = [];
  const lines: string[] = [];
  for (const line of allLines) {
    const qm = line.match(/^\d+[.)]\s*(.+?)\s*$/);
    const body = qm ? qm[1].replace(/\s*[_\u2581\u2014-]{3,}\s*$/, '').trim() : '';
    if (qm && body.endsWith('?') && !BLANK_IN_LINE.test(qm[1])) questionTexts.push(body);
    else lines.push(line);
  }
  const OUTLINE_RE = /^([•●▪▫◦·]|\+)\s*(.*)$/;
  const isOutline = lines.filter((l) => OUTLINE_RE.test(l)).length >= 2;
  const outlineSub: boolean[] = [];
  const hasNumbered = lines.some((l) => /^\d+[.)]\s+\S/.test(l));
  const hasSpeakers = lines.filter((l) => SPEAKER_RE.test(l)).length >= 2;
  // Bài đọc không đánh số và không phải hội thoại: các đoạn cách nhau bằng dòng trống
  const prose = !hasNumbered && !hasSpeakers && questionTexts.length > 0;
  let proseBuf: string[] = [];
  const flushProse = () => {
    if (proseBuf.length) paragraphTexts.push(proseBuf.join(' ').replace(/\s+/g, ' ').trim());
    proseBuf = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) {
      if (prose) flushProse();
      continue;
    }

    // Detect exercise title
    if (i === 0 && (line.toUpperCase() === line || line.toLowerCase().includes('listen') || line.toLowerCase().includes('fill'))) {
      exerciseTitle = line;
      continue;
    }

    // Detect passage title (short uppercase line before text)
    if (paragraphTexts.length === 0 && proseBuf.length === 0 && line.length < 50 && line === line.toUpperCase()) {
      passageTitle = line;
      continue;
    }

    if (prose) {
      proseBuf.push(line);
      continue;
    }

    // Dàn ý: "• ..." là dòng chính, "+ ..." là dòng con thụt vào
    if (isOutline) {
      const om = line.match(OUTLINE_RE);
      if (om) {
        paragraphTexts.push(om[2].trim());
        outlineSub.push(om[1] === '+');
      } else if (paragraphTexts.length > 0) {
        paragraphTexts[paragraphTexts.length - 1] += ' ' + line;
      }
      continue;
    }

    // Numbered paragraphs e.g. "1. Go on a..." or "1) ..."
    const numMatch = line.match(/^(\d+)[\.\)]\s*(.*)$/);
    if (numMatch) {
      paragraphTexts.push(numMatch[2].trim());
    } else if (SPEAKER_RE.test(line)) {
      // Hội thoại: mỗi lượt nói là một đoạn mới
      paragraphTexts.push(line);
    } else if (paragraphTexts.length > 0) {
      // Append to last paragraph if continuation
      paragraphTexts[paragraphTexts.length - 1] += ' ' + line;
    } else {
      paragraphTexts.push(line);
    }
  }
  if (prose) flushProse();

  const paragraphs: ListeningParagraph[] = paragraphTexts.map((text, idx) => ({
    id: `p_${idx + 1}`,
    order: idx + 1,
    text,
    imageCaption: SAMPLE_LONDON_PARAGRAPHS[idx]?.imageCaption,
    ...(isOutline ? { format: { list: 'bullet' as const, indentMm: outlineSub[idx] ? 6 : 0 } } : {}),
  }));

  // Detect blanks like (a) ____ or (1) ____
  const blanks: ListeningBlank[] = [];
  const blankRegex = /\(([a-zA-Z0-9]+)\)\s*_{2,}/g;

  paragraphs.forEach((p) => {
    let match;
    while ((match = blankRegex.exec(p.text)) !== null) {
      const label = match[1];
      blanks.push({
        id: `blank_${p.id}_${label}`,
        paragraphId: p.id,
        label: label.toLowerCase(),
        number: blanks.length + 1,
        correctAnswer: '',
      });
    }
  });

  // Có từ 2 người nói trở lên -> tự chọn layout Hội thoại, không dùng tiêu đề đoạn mẫu
  const speakers = new Set(paragraphTexts.map((t) => SPEAKER_RE.exec(t)?.[1]?.toUpperCase()).filter(Boolean));
  const isDialogue = !isOutline && speakers.size >= 2;

  return createListeningGapFill({
    exerciseTitle: exerciseTitle || 'LISTEN AND FILL IN THE GAP',
    ...(prose ? { settings: { ...DEFAULT_LISTENING_SETTINGS, ...PASSAGE_IMAGE_PRESET } as ListeningGapFillSettings, questions: questionTexts.map((t, i) => ({ id: `q_${Date.now().toString(36)}_${i}`, text: t })), bodyImage: {} } : {}),
    passageTitle: isDialogue ? '' : passageTitle || 'THINGS TO SEE AND DO IN LONDON',
    ...(isOutline ? { settings: { ...DEFAULT_LISTENING_SETTINGS, ...OUTLINE_PRESET } as ListeningGapFillSettings, bodyImage: {} } : {}),
    ...(isDialogue ? { settings: { ...DEFAULT_LISTENING_SETTINGS, ...DIALOGUE_PRESET } as ListeningGapFillSettings } : {}),
    paragraphs: paragraphs.length > 0 ? paragraphs : SAMPLE_LONDON_PARAGRAPHS,
    blanks: blanks.length > 0 ? blanks : SAMPLE_LONDON_BLANKS,
  });
};

// ── Generate QR Code URL ──
export const getAudioQrCodeUrl = (shareUrl: string): string => {
  const targetUrl = shareUrl;
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=0&data=${encodeURIComponent(targetUrl)}`;
};

/** Chỉ nhận đường dẫn http(s) hợp lệ; trả về URL chuẩn hóa hoặc null */
export const normalizeAudioLink = (raw: string): string | null => {
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    if (!u.hostname.includes('.')) return null;
    return u.toString();
  } catch {
    return null;
  }
};

export const formatAudioDuration = (seconds: number): string => {
  if (!isFinite(seconds) || seconds <= 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const sec = Math.round(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

/** Các layout có chỗ cho ảnh minh họa; layout khác (Bảng đáp án, Từng câu riêng) không hiển thị ảnh */
export const LISTENING_IMAGE_LAYOUTS: ListeningLayoutId[] = ['original', 'numbered', 'two_columns', 'illustrated'];
export const layoutSupportsImages = (layout: ListeningLayoutId): boolean =>
  LISTENING_IMAGE_LAYOUTS.includes(layout);
