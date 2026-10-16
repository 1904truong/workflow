// Dữ liệu cho bài Reading Multiple Choice: bài đọc (tiêu đề, tác giả, các đoạn, ảnh minh họa bên phải)
// + danh sách câu hỏi A / B / C dùng lại mô hình của Grammar MCQ. Giáo trình: KHÔNG có đáp án.
// Hiện chỉ có layout 'original'; các layout khác sẽ bổ sung sau.

import type { TextStyle } from '../matching-pictures/matchingPicturesCore.ts';
import type { GrammarMcqData, GrammarMcqSettings, McqLayoutMeta, McqStyleKey } from '../grammar-mcq/grammarMcqCore.ts';
import { parseMcqText, DEFAULT_MCQ_SETTINGS, MCQ_LAYOUTS, MCQ_STYLE_LABELS, createGrammarMcq, validateGrammarMcq } from '../grammar-mcq/grammarMcqCore.ts';

export const READING_MCQ_LAYOUTS: McqLayoutMeta[] = MCQ_LAYOUTS.filter((l) => l.id === 'original')
  .map((l) => ({ ...l, label: 'Original (bài đọc + ảnh)', desc: 'Bài đọc có ảnh bài báo ở góc phải, chữ chạy quanh; câu hỏi A / B / C xếp dọc bên dưới' }));

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
}

export interface ReadingMcqData extends Omit<GrammarMcqData, 'settings' | 'textStyles'> {
  /** Reading Short Answer: câu hỏi tự luận ngắn, mỗi câu một dòng kẻ trả lời, không có lựa chọn */
  shortAnswer?: boolean;
  passageTitle: string;
  passageAuthor: string;
  /** Mỗi đoạn cách nhau một dòng trống */
  passage: string;
  imageUrl?: string;
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
    settings: { ...DEFAULT_READING_MCQ_SETTINGS, ...(settings || {}), layout: 'original' },
  };
};

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
