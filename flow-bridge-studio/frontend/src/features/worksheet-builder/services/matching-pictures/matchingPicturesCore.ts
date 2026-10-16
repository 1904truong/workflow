// Core data models, sample data, and helpers for Matching Pictures worksheet editor.

export type MatchingPicturesLayoutId =
  | 'original_grid' // Layout 1: Original Grid (Bố cục gốc)
  | 'picture_grid'  // Layout 2: Picture Grid (Hình ảnh phía trên)
  | 'side_by_side'  // Layout 3: Side-by-Side (Hai cột)
  | 'draw_lines'    // Layout 4: Draw Lines (Kẻ đường nối)
  | 'picture_cards' // Layout 5: Picture Cards (Thẻ hình ảnh)
  | 'compact';      // Layout 6: Compact (Tiết kiệm giấy)

export type AnswerStyle = 'box' | 'underline' | 'circle' | 'draw_lines';

export interface MatchingPictureParagraph {
  id: string; // Stable ID e.g. 'p1'
  sourceParagraphId?: string; // id in linked exercise
  order: number; // 1..N
  title?: string; // e.g. "Paragraph 1"
  text: string; // Full paragraph text
  summary?: string; // Short summary for side-by-side or compact layout
}

export interface MatchingPictureItem {
  id: string; // Stable UUID e.g. 'img_a'
  order: number; // 0..N
  label: string; // 'A', 'B', 'C', 'D', 'E'...
  imageUrl: string;
  storagePath?: string;
  caption?: string; // e.g. "Hard Rock Café", "Tate Modern", etc.
}

export interface MatchingPictureAnswer {
  paragraphId: string;
  imageId: string; // points to MatchingPictureItem.id
}

export interface MatchingPicturesSettings {
  layout: MatchingPicturesLayoutId;

  // Image settings
  imageSizePercent: number; // e.g. 80
  imageShape: 'rectangle' | 'rounded';
  showImageLabels: boolean; // badges [A], [B]...
  showBorders: boolean;
  gapBetweenImagesMm: number; // default 8
  imageOrder: 'ordered' | 'shuffle';
  imageColumns: 1 | 2 | 3 | 'auto';
  imageFit: 'cover' | 'contain';

  // Answer settings
  answerStyle: AnswerStyle;
  answerPosition: 'left' | 'right';
  labelStyle: 'paragraph_numbered' | 'number_only'; // "Paragraph 1, 2, 3..." vs "1, 2, 3..."
  showAnswerArea: boolean;

  // Typography
  fontFamily: string; // default Arial
  fontSizePt: number; // default 12
  headingFontSizePt: number; // default 14
  lineHeight: number; // default 1.5
  paragraphSpacing: 'compact' | 'normal' | 'spacious';

  // Advanced toggles
  showExerciseTitle: boolean;
  showInstruction: boolean;
  showPoints: boolean;
  pointsTotal?: number;
  showImageCaptions: boolean;
  oneToOneMatching: boolean;
  keepImagesTogether: boolean;
  pageBreakBefore: boolean;
  autoFitToA4: boolean;
  showTeacherKey: boolean;
}

export interface MatchingPicturesSource {
  mode: 'linked' | 'manual';
  exerciseId?: string; // e.g. 'ex_u2_listen_gap_fill'
  exerciseTitle?: string;
}

export interface MatchingPicturesData {
  exerciseTitle: string;
  instruction: string;
  exerciseNumber: number;
  pointsTotal?: number;
  /** Ghi chú IN dưới phần hướng dẫn (vd. Work in pairs.) */
  notes?: string;
  /** Ghi chú cho giáo viên, KHÔNG in */
  teacherNote?: string;
  /** Thời lượng dự kiến (phút), chỉ để tham khảo, không in */
  estimatedMinutes?: number;
  /** Kỹ năng để phân loại giáo trình, không in */
  skillTags?: string[];
  /** Định dạng chữ (đậm, nghiêng, cỡ, màu...) cho từng thành phần */
  textStyles?: TextStyles;
  source: MatchingPicturesSource;
  paragraphs: MatchingPictureParagraph[];
  images: MatchingPictureItem[];
  answerMapping: MatchingPictureAnswer[];
  settings: MatchingPicturesSettings;
}

export const MATCHING_PICTURES_LAYOUTS: {
  id: MatchingPicturesLayoutId;
  label: string;
  desc: string;
}[] = [
  { id: 'original_grid', label: '1. Original Grid', desc: 'Bố cục gốc: Paragraphs bên trái, lưới ảnh 2 cột bên phải' },
  { id: 'picture_grid', label: '2. Picture Grid', desc: 'Hình ảnh phía trên (2-3 cột), bảng điền chữ cái bên dưới' },
  { id: 'side_by_side', label: '3. Side-by-Side', desc: 'Hai cột cân đối: nội dung đoạn văn kèm ô điền và ảnh' },
  { id: 'draw_lines', label: '4. Draw Lines', desc: 'Điểm tròn hai bên với khoảng trống để học sinh kẻ đường nối' },
  { id: 'picture_cards', label: '5. Picture Cards', desc: 'Mỗi ảnh nằm trong thẻ riêng có tên địa điểm, bảng điền bên dưới' },
  { id: 'compact', label: '6. Compact', desc: 'Tiết kiệm giấy: hàng ảnh thu nhỏ phía trên, bảng 2 cột phía dưới' },
];

export const DEFAULT_MATCHING_PICTURES_SETTINGS: MatchingPicturesSettings = {
  layout: 'original_grid',
  imageSizePercent: 80,
  imageShape: 'rectangle',
  showImageLabels: true,
  showBorders: true,
  gapBetweenImagesMm: 8,
  imageOrder: 'ordered',
  imageColumns: 2,
  imageFit: 'cover',
  answerStyle: 'box',
  answerPosition: 'left',
  labelStyle: 'paragraph_numbered',
  showAnswerArea: true,
  fontFamily: 'Arial',
  fontSizePt: 12,
  headingFontSizePt: 14,
  lineHeight: 1.5,
  paragraphSpacing: 'normal',
  showExerciseTitle: true,
  showInstruction: true,
  showPoints: false,
  showImageCaptions: true,
  oneToOneMatching: true,
  keepImagesTogether: true,
  pageBreakBefore: false,
  autoFitToA4: true,
  showTeacherKey: false,
};

// ── Default Reference Exercise: Unit 2 - London Matching Pictures ──
export const SAMPLE_LONDON_PARAGRAPHS: MatchingPictureParagraph[] = [
  {
    id: 'p1',
    sourceParagraphId: 'p1',
    order: 1,
    title: 'Paragraph 1',
    text: `Go on a Big Bus tour and see the famous places in London, like the Tower of London, Trafalgar Square and Buckingham Palace, one of the Queen's homes. There are now 80 open-top buses that do tours of the city.`,
    summary: `Go on a Big Bus tour and see the famous places in London.`,
  },
  {
    id: 'p2',
    sourceParagraphId: 'p2',
    order: 2,
    title: 'Paragraph 2',
    text: `Visit the Tate Modern and see a fantastic collection of modern art by famous artists like Picasso and Dali. The Tate Modern has a total floor area of 34,000 square metres and is on the south side of the River Thames, not far from the famous Globe Theatre.`,
    summary: `Visit the Tate Modern and see a fantastic collection of modern art.`,
  },
  {
    id: 'p3',
    sourceParagraphId: 'p3',
    order: 3,
    title: 'Paragraph 3',
    text: `Meet famous sports people, pop stars and film stars at Madame Tussauds wax museum. There are almost 400 wax models to see. It takes about four months to make a statue of a famous person and costs £150,000!`,
    summary: `Meet famous sports people, pop stars and film stars at Madame Tussauds wax museum.`,
  },
  {
    id: 'p4',
    sourceParagraphId: 'p4',
    order: 4,
    title: 'Paragraph 4',
    text: `Come to the Hard Rock Café in Old Park Lane and try the food: eat Hickory Bar-B-Que Ribs or a Haystack Chicken salad. There's a great collection of 70,000 things from the world of rock music - like old guitars and clothes from famous bands.`,
    summary: `Come to the Hard Rock Café in Old Park Lane and try the food.`,
  },
  {
    id: 'p5',
    sourceParagraphId: 'p5',
    order: 5,
    title: 'Paragraph 5',
    text: `Thirty million people a year visit Covent Garden. They watch the jugglers, clowns and musicians, and visit the great cafés and restaurants.`,
    summary: `Thirty million people a year visit Covent Garden. They watch the jugglers, clowns and musicians and visit the great cafés.`,
  },
];

export const SAMPLE_LONDON_IMAGES: MatchingPictureItem[] = [
  {
    id: 'img_a',
    order: 0,
    label: 'A',
    imageUrl: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=600&q=80',
    caption: 'Hard Rock Café',
  },
  {
    id: 'img_b',
    order: 1,
    label: 'B',
    imageUrl: 'https://images.unsplash.com/photo-1549144511-f099e773c147?auto=format&fit=crop&w=600&q=80',
    caption: 'Tate Modern',
  },
  {
    id: 'img_c',
    order: 2,
    label: 'C',
    imageUrl: 'https://images.unsplash.com/photo-1508873696983-2df5293cb32f?auto=format&fit=crop&w=600&q=80',
    caption: 'Covent Garden',
  },
  {
    id: 'img_d',
    order: 3,
    label: 'D',
    imageUrl: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=600&q=80',
    caption: 'Big Bus Tour',
  },
  {
    id: 'img_e',
    order: 4,
    label: 'E',
    imageUrl: 'https://images.unsplash.com/photo-1526129318478-62ed807ebdf9?auto=format&fit=crop&w=600&q=80',
    caption: 'Madame Tussauds',
  },
];

export const SAMPLE_LONDON_ANSWER_MAPPING: MatchingPictureAnswer[] = [
  { paragraphId: 'p1', imageId: 'img_d' }, // Paragraph 1 -> Big Bus (D)
  { paragraphId: 'p2', imageId: 'img_b' }, // Paragraph 2 -> Tate Modern (B)
  { paragraphId: 'p3', imageId: 'img_e' }, // Paragraph 3 -> Madame Tussauds (E)
  { paragraphId: 'p4', imageId: 'img_a' }, // Paragraph 4 -> Hard Rock Cafe (A)
  { paragraphId: 'p5', imageId: 'img_c' }, // Paragraph 5 -> Covent Garden (C)
];

// ── Helper to derive label from index: 0 -> A, 1 -> B, etc. ──
export const deriveImageLabel = (index: number): string => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (index < letters.length) return letters[index];
  return `A${index - letters.length + 1}`;
};

// ── Factory helper ──
export const createMatchingPictures = (
  partial?: Partial<MatchingPicturesData>
): MatchingPicturesData => {
  const base: MatchingPicturesData = {
    exerciseTitle: 'MATCH EACH PARAGRAPH OF EXERCISE 3 AND THE APPROPRIATE PICTURE',
    instruction: 'Match each paragraph of Exercise 3 and the appropriate picture.',
    exerciseNumber: 4,
    pointsTotal: 5,
    source: {
      mode: 'linked',
      exerciseId: 'ex_u2_listen_gap_fill',
      exerciseTitle: 'Exercise 3: Things to See and Do in London',
    },
    paragraphs: SAMPLE_LONDON_PARAGRAPHS,
    images: SAMPLE_LONDON_IMAGES,
    answerMapping: SAMPLE_LONDON_ANSWER_MAPPING,
    settings: { ...DEFAULT_MATCHING_PICTURES_SETTINGS },
  };

  if (!partial) return base;

  return {
    ...base,
    ...partial,
    source: {
      ...base.source,
      ...(partial.source || {}),
    },
    settings: {
      ...base.settings,
      ...(partial.settings || {}),
    },
  };
};

// ── Reorder images and maintain labels ──
export const reorderImages = (
  images: MatchingPictureItem[],
  fromIndex: number,
  toIndex: number
): MatchingPictureItem[] => {
  const copy = [...images];
  const [removed] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, removed);
  return copy.map((img, idx) => ({
    ...img,
    order: idx,
    label: deriveImageLabel(idx),
  }));
};

// ── Shuffle images ──
export const shuffleImages = (images: MatchingPictureItem[]): MatchingPictureItem[] => {
  const copy = [...images];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.map((img, idx) => ({
    ...img,
    order: idx,
    label: deriveImageLabel(idx),
  }));
};

// ── Smart Paste Parser for Paragraphs ──
export const parseParagraphsSmartPaste = (raw: string): MatchingPictureParagraph[] => {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean);
  const result: MatchingPictureParagraph[] = [];

  for (const line of lines) {
    const match = line.match(/^(?:Paragraph\s*)?(\d+)[\.\:\)]\s*(.*)$/i);
    if (match) {
      const order = parseInt(match[1], 10);
      const text = match[2].trim();
      result.push({
        id: `para_${Date.now()}_${order}`,
        order: order || result.length + 1,
        title: `Paragraph ${order || result.length + 1}`,
        text,
        summary: text.length > 80 ? text.slice(0, 80) + '...' : text,
      });
    } else if (result.length > 0) {
      result[result.length - 1].text += ' ' + line;
    } else {
      result.push({
        id: `para_${Date.now()}_1`,
        order: 1,
        title: 'Paragraph 1',
        text: line,
        summary: line.length > 80 ? line.slice(0, 80) + '...' : line,
      });
    }
  }

  return result.map((p, idx) => ({ ...p, order: idx + 1, title: `Paragraph ${idx + 1}` }));
};

// ── Định dạng chữ cho từng thành phần (tiêu đề, hướng dẫn, ghi chú, chú thích ảnh, nhãn Paragraph) ──

export type TextStyleKey = 'title' | 'instruction' | 'notes' | 'captions' | 'paraLabels';

export interface TextStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  /** Cỡ chữ tuyệt đối (pt); không có = dùng cỡ mặc định của thành phần */
  sizePt?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
}

export type TextStyles = Partial<Record<TextStyleKey, TextStyle>>;

export const TEXT_STYLE_LABELS: Record<TextStyleKey, string> = {
  title: 'Tiêu đề bài',
  instruction: 'Hướng dẫn',
  notes: 'Ghi chú',
  captions: 'Chú thích ảnh',
  paraLabels: 'Nhãn Paragraph',
};

/** Quy đổi kiểu chữ thành CSS (object thuần, không phụ thuộc React) */
export const textStyleToCss = (ts?: TextStyle): Record<string, string | number> => {
  if (!ts) return {};
  const css: Record<string, string | number> = {};
  if (ts.bold !== undefined) css.fontWeight = ts.bold ? 800 : 400;
  if (ts.italic !== undefined) css.fontStyle = ts.italic ? 'italic' : 'normal';
  const lines = [ts.underline ? 'underline' : '', ts.strike ? 'line-through' : ''].filter(Boolean).join(' ');
  if (ts.underline !== undefined || ts.strike !== undefined) css.textDecoration = lines || 'none';
  if (ts.sizePt) css.fontSize = `${ts.sizePt}pt`;
  if (ts.color) css.color = ts.color;
  if (ts.align) {
    css.display = 'block';
    css.textAlign = ts.align;
  }
  return css;
};

/** Cập nhật kiểu chữ của một thành phần; giá trị undefined = gỡ thuộc tính. Trả về bản mới (không sửa bản cũ). */
export const setTextStyle = (styles: TextStyles | undefined, key: TextStyleKey, patch: Partial<TextStyle>): TextStyles => {
  const merged: TextStyle = { ...(styles?.[key] || {}), ...patch };
  (Object.keys(merged) as (keyof TextStyle)[]).forEach((k) => {
    if (merged[k] === undefined) delete merged[k];
  });
  const next: TextStyles = { ...(styles || {}) };
  if (Object.keys(merged).length === 0) delete next[key];
  else next[key] = merged;
  return next;
};

/**
 * Bật/tắt in đậm, nghiêng, gạch chân, gạch ngang. `current` là trạng thái đang hiển thị
 * (kể cả mặc định của thành phần, ví dụ tiêu đề mặc định đã đậm) để nút đảo đúng chiều.
 */
export const toggleTextFlag = (
  styles: TextStyles | undefined,
  key: TextStyleKey,
  flag: 'bold' | 'italic' | 'underline' | 'strike',
  current: boolean
): TextStyles => setTextStyle(styles, key, { [flag]: !current } as Partial<TextStyle>);

/** Tăng/giảm cỡ chữ theo bước 0.5pt trong khoảng 7–30pt */
export const bumpTextSize = (styles: TextStyles | undefined, key: TextStyleKey, baseSizePt: number, delta: number): TextStyles => {
  const cur = styles?.[key]?.sizePt ?? baseSizePt;
  const next = Math.min(30, Math.max(7, Math.round((cur + delta) * 2) / 2));
  return setTextStyle(styles, key, { sizePt: next });
};
