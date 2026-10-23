// Dữ liệu cho bài Reading Multiple Choice: bài đọc (tiêu đề, tác giả, các đoạn, ảnh minh họa bên phải)
// + danh sách câu hỏi A / B / C dùng lại mô hình của Grammar MCQ. Giáo trình: KHÔNG có đáp án.
// Hiện chỉ có layout 'original'; các layout khác sẽ bổ sung sau.

import type { TextStyle } from '../matching-pictures/matchingPicturesCore.ts';
import type { GrammarMcqData, GrammarMcqSettings, McqLayoutMeta, McqStyleKey } from '../grammar-mcq/grammarMcqCore.ts';
import { parseMcqText, DEFAULT_MCQ_SETTINGS, MCQ_STYLE_LABELS, createGrammarMcq, validateGrammarMcq } from '../grammar-mcq/grammarMcqCore.ts';

export const READING_MCQ_LAYOUTS: McqLayoutMeta[] = [
  { id: 'original', label: 'Original (bài đọc + ảnh)', desc: 'Bài đọc có ảnh bài báo ở góc phải, chữ chạy quanh; câu hỏi xếp bên dưới' },
  { id: 'comic_story', label: 'Comic Story (Truyện tranh 2 cột)', desc: 'Truyện tranh bên trái, câu hỏi tự luận dòng kẻ chấm bên phải' },
];



export type ReadingStyleKey = McqStyleKey | 'passageTitle' | 'passageAuthor' | 'passage';
export const READING_STYLE_LABELS: Record<ReadingStyleKey, string> = {
  ...MCQ_STYLE_LABELS,
  passageTitle: 'Tiêu đề bài đọc',
  passageAuthor: 'Tên tác giả',
  passage: 'Đoạn văn',
};
export type ReadingTextStyles = Partial<Record<ReadingStyleKey, TextStyle>>;

export interface ReadingMcqSettings extends GrammarMcqSettings {
  showPassageImage: boolean;
  /** Chiều rộng ảnh bài báo (mm), ảnh nằm góc phải và chữ chạy quanh */
  imageWidthMm: number;
  justifyPassage: boolean;
  /** Reading Short Answer / True-False: độ dài dòng kẻ trả lời (mm), mặc định 68; 26 cho dòng ngắn viết T / F */
  answerLineWidthMm?: number;
  /** Theme màu cho tiêu đề & số bài: 'orange' (#ea580c) hoặc 'navy' (#16295f) */
  themeColor?: 'orange' | 'navy';
  /** Số dòng kẻ chấm tự luận dưới mỗi câu (comic layout): mặc định 1 dòng */
  answerLineCount?: number;
  /** Tỉ lệ 2 cột: '55_45' (mặc định), '50_50', '60_40' */
  columnRatio?: '50_50' | '55_45' | '60_40';
}

export interface ReadingMcqData extends Omit<GrammarMcqData, 'settings' | 'textStyles'> {
  /** Định dạng từng từ của các ô chữ sửa trên trang A4 (xem services/richFields.ts) */
  richMarks?: import('../richFields.ts').RichMarks;
  /** Reading Short Answer: câu hỏi tự luận ngắn, mỗi câu một dòng kẻ trả lời, không có lựa chọn */
  shortAnswer?: boolean;
  passageTitle: string;
  passageAuthor: string;
  /** Mỗi đoạn cách nhau một dòng trống */
  passage: string;
  imageUrl?: string;
  /** Ảnh phụ xếp dọc dưới ảnh chính ở cột phải (bài đọc nhiều ảnh như Earthships) */
  extraImages?: string[];
  textStyles?: ReadingTextStyles;
  settings: ReadingMcqSettings;
}

export const DEFAULT_READING_MCQ_SETTINGS: ReadingMcqSettings = {
  ...DEFAULT_MCQ_SETTINGS,
  fontSizePt: 10.5,
  lineHeight: 1.45,
  questionGapMm: 3,
  optionLabelStyle: 'uppercase',
  optionColumns: 1,
  showInstruction: false,
  showPassageImage: true,
  imageWidthMm: 66,
  justifyPassage: true,
  themeColor: 'navy',
  answerLineCount: 1,
  columnRatio: '55_45',
};

export const createReadingMcq = (partial?: Partial<ReadingMcqData>): ReadingMcqData => {
  const { settings, textStyles, passageTitle, passageAuthor, passage, imageUrl, shortAnswer, ...rest } = partial || {};
  const base = createGrammarMcq({ exerciseTitle: 'READ THE TEXT AND CHOOSE THE CORRECT ANSWER', instruction: 'Read the text and choose the correct answer.', ...rest } as Partial<GrammarMcqData>);
  const { textStyles: _ignored, settings: _s, ...base2 } = base;
  void _ignored; void _s;
  return {
    ...base2,
    ...(shortAnswer ? { shortAnswer: true } : {}),
    passageTitle: passageTitle ?? '',
    passageAuthor: passageAuthor ?? '',
    passage: passage ?? '',
    imageUrl,
    ...(textStyles ? { textStyles } : {}),
    settings: { ...DEFAULT_READING_MCQ_SETTINGS, ...(settings || {}), layout: settings?.layout || 'original' },
  };
};

export const createComicStory = (partial?: Partial<ReadingMcqData>): ReadingMcqData =>
  createReadingMcq({
    exerciseTitle: 'READ AND ANSWER THE QUESTIONS',
    instruction: 'Look at the pictures and answer the questions.',
    shortAnswer: true,
    questions: [
      { id: 'q_comic_1', text: "What's her name?", options: [] },
      { id: 'q_comic_2', text: 'Does Vicky like chocolate cake?', options: [] },
      { id: 'q_comic_3', text: 'Does she like music?', options: [] },
      { id: 'q_comic_4', text: 'What does Dave buy for Vicky?', options: [] },
      { id: 'q_comic_5', text: 'Who is very naughty?', options: [] },
    ],
    settings: {
      ...DEFAULT_READING_MCQ_SETTINGS,
      layout: 'comic_story',
      themeColor: 'orange',
      questionGapMm: 6,
      answerLineCount: 1,
    },
    ...partial,
  });

/** Tách bài đọc thành các đoạn (dòng trống hoặc xuống dòng) */
export const splitParagraphs = (passage: string): string[] =>
  passage.replace(/\r\n?/g, '\n').split(/\n+/).map((p) => p.trim()).filter(Boolean);

/** Dán cả bài: dòng đầu là tiêu đề nếu viết hoa, "by …" là tác giả, phần còn lại là đoạn văn */
export const parseReadingPassage = (raw: string): { title: string; author: string; passage: string } => {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean);
  let title = '';
  let author = '';
  if (lines[0] && lines[0].length <= 90 && lines[0] === lines[0].toUpperCase() && /[A-Z]/.test(lines[0])) title = lines.shift()!;
  if (lines[0] && /^by\s+\S/i.test(lines[0]) && lines[0].length <= 60) author = lines.shift()!;
  return { title, author, passage: lines.join('\n\n') };
};

export const setReadingStyle = (styles: ReadingTextStyles | undefined, key: ReadingStyleKey, patch: Partial<TextStyle>): ReadingTextStyles => {
  const merged: TextStyle = { ...(styles?.[key] || {}), ...patch };
  (Object.keys(merged) as (keyof TextStyle)[]).forEach((k) => { if (merged[k] === undefined) delete merged[k]; });
  const next: ReadingTextStyles = { ...(styles || {}) };
  if (Object.keys(merged).length === 0) delete next[key];
  else next[key] = merged;
  return next;
};

export const bumpReadingSize = (styles: ReadingTextStyles | undefined, key: ReadingStyleKey, base: number, delta: number): ReadingTextStyles => {
  const cur = styles?.[key]?.sizePt ?? base;
  return setReadingStyle(styles, key, { sizePt: Math.min(30, Math.max(7, Math.round((cur + delta) * 2) / 2)) });
};

export const validateReadingMcq = (d: ReadingMcqData): { errors: string[]; warnings: string[] } => {
  const r = validateGrammarMcq(d as unknown as GrammarMcqData);
  const errors = [...r.errors];
  const warnings = d.shortAnswer ? [] : [...r.warnings];
  if (!d.passage.trim()) errors.push('Chưa có bài đọc.');
  if (d.settings.showPassageImage && !d.imageUrl) warnings.push('Chưa có ảnh bài báo.');
  return { errors, warnings };
};

export interface ParsedReadingFull {
  exerciseTitle: string;
  passageTitle: string;
  author: string;
  passage: string;
  questions: { text: string; options: string[] }[];
}

/**
 * Dán cả đề: phần trước câu "1." là bài đọc (tiêu đề bài, tiêu đề bài đọc, tác giả, các đoạn),
 * từ câu "1." trở đi là danh sách câu hỏi A / B / C.
 */
export const parseReadingFull = (raw: string): ParsedReadingFull => {
  const lines = raw.replace(/\r\n?/g, '\n').replace(/[ ​﻿]/g, ' ').split('\n').map((l) => l.trim()).filter(Boolean);
  let qStart = lines.findIndex((l) => /^1\s*[.)]\s*\S/.test(l));
  if (qStart < 0) qStart = lines.length;
  const head = lines.slice(0, qStart);
  const isUpper = (l: string) => l.length <= 90 && l === l.toUpperCase() && /[A-Z]/.test(l);
  const heads: string[] = [];
  while (heads.length < 2 && head[0] && isUpper(head[0])) heads.push(head.shift()!);
  let exerciseTitle = '';
  let passageTitle = '';
  if (heads.length === 2) [exerciseTitle, passageTitle] = heads;
  else if (heads.length === 1) {
    if (/^(read|choose|listen|match|complete|answer)\b/i.test(heads[0])) exerciseTitle = heads[0];
    else passageTitle = heads[0];
  }
  let author = '';
  if (head[0] && /^by\s+\S/i.test(head[0]) && head[0].length <= 60) author = head.shift()!;
  const questions = qStart < lines.length ? parseMcqText(lines.slice(qStart).join('\n')).questions : [];
  return { exerciseTitle, passageTitle, author, passage: head.join('\n\n'), questions };
};
