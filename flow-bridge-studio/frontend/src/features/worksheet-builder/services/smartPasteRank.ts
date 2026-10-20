// Smart Paste tổng: chấm điểm mức giống nhau giữa nội dung vừa dán và từng dạng bài trong menu Add Exercise,
// để giáo viên chọn dạng giống nhất (đứng đầu danh sách) rồi chuyển thẳng tới trình soạn của dạng đó.

import type { ExerciseType } from '../types/index.ts';
import { EXERCISE_REGISTRY } from '../templates/registry.ts';
import { classifyByHeading } from './smartPasteEnrich.ts';

export interface TypeSuggestion {
  type: ExerciseType;
  label: string;
  category: string;
  /** 0–100 */
  score: number;
  reasons: string[];
}

interface Features {
  words: number;
  passageWords: number;
  blanks: number;
  numberedLines: number;
  optionQuestions: number;
  shortQuestions: number;
  slashLines: number;
  audio: boolean;
  tfWords: boolean;
  notGiven: boolean;
  wordBox: boolean;
  letteredLines: number;
  headingKeywords: boolean;
}

export const extractFeatures = (raw: string): Features => {
  const text = raw.replace(/\r\n?/g, '\n');
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const firstNum = lines.findIndex((l) => /^\d{1,3}\s*[.)]\s*\S/.test(l));
  const head = firstNum < 0 ? lines : lines.slice(0, firstNum);
  // Bài đọc: các dòng trước câu "1." (bỏ dòng tiêu đề viết hoa ngắn)
  const passageWords = head.filter((l) => !(l.length <= 100 && l === l.toUpperCase())).join(' ').split(/\s+/).filter(Boolean).length;
  const numbered = lines.filter((l) => /^\d{1,3}\s*[.)]\s*\S/.test(l));
  const hasOpt = (l: string) => /(?:^|\s)\(?[a-dA-D][.)]\s+\S/.test(l.replace(/^\d{1,3}\s*[.)]\s*/, ''));
  const lettered = lines.filter((l) => /^\(?[a-dA-D][.)]\s+\S/.test(l));
  // Câu có lựa chọn: dòng "1. a. x b. y" hoặc câu "N." theo sau là dòng a. b. c.
  let optionQuestions = 0;
  lines.forEach((l, i) => {
    if (!/^\d{1,3}\s*[.)]/.test(l)) return;
    if (hasOpt(l) || (lines[i + 1] && /^\(?[a-dA-D][.)]\s/.test(lines[i + 1]))) optionQuestions += 1;
  });
  const shortQuestions = numbered.filter((l) => /\?\s*[_\s]*$/.test(l) && !hasOpt(l)).length;
  const lower = text.toLowerCase();
  return {
    words: text.split(/\s+/).filter(Boolean).length,
    passageWords,
    blanks: (text.match(/\(\d+\)\s*_{2,}|_{3,}/g) || []).length,
    numberedLines: numbered.length,
    optionQuestions,
    shortQuestions,
    slashLines: lines.filter((l) => (l.match(/\s?\/\s/g) || []).length >= 2).length,
    // Chỉ tính phần tiêu đề / hướng dẫn và cụm đặc trưng, không tính lựa chọn (vd. "a. listen")
    audio: /listen|nghe/.test(head.filter((l) => l.length <= 160).slice(0, 3).join(' ').toLowerCase()) || /you will hear|audio|recording|track \d/.test(lower),
    tfWords: /\btrue\b[\s\S]*\bfalse\b/.test(lower),
    notGiven: /not given|\bng\b/.test(lower),
    wordBox: /word bank|in the box|from the box|words? in brackets/.test(lower),
    letteredLines: lettered.length,
    headingKeywords: /heading|main idea/.test(lower),
  };
};

type Scorer = (f: Features) => { score: number; reasons: string[] };

const SCORERS: Partial<Record<ExerciseType, Scorer>> = {
  grammar_vocab_cloze: (f) => {
    const r: string[] = [];
    let s = 0;
    if (f.blanks >= 3 && f.passageWords >= 50) { s += 62; r.push(`Đoạn văn dài có ${f.blanks} chỗ trống đánh số`); }
    if (f.optionQuestions >= f.blanks * 0.6 && f.optionQuestions >= 3) { s += 34; r.push('Mỗi chỗ trống có lựa chọn a, b, c'); }
    else if (f.optionQuestions >= 2 && f.blanks >= 3) { s += 20; r.push('Có lựa chọn a, b, c cho các chỗ trống'); }
    return { score: s, reasons: r };
  },
  gap_filling_word_formation: (f) => {
    const r: string[] = [];
    let s = 0;
    if (f.blanks >= 3) { s += 35; r.push('Có nhiều chỗ trống cần điền'); }
    if (f.wordBox) { s += 40; r.push('Có khung từ / từ trong ngoặc'); }
    if (f.optionQuestions === 0 && f.blanks >= 3) { s += 18; r.push('Không có lựa chọn a, b, c'); }
    if (f.blanks >= 3 && f.optionQuestions >= 3) s -= 10;
    return { score: s, reasons: r };
  },
  reading_multiple_choice: (f) => {
    const r: string[] = [];
    let s = 0;
    if (f.passageWords >= 50 && f.optionQuestions >= 2 && f.blanks < 3) { s = 88; r.push('Bài đọc kèm câu hỏi có lựa chọn'); }
    else if (f.passageWords >= 50 && f.optionQuestions >= 2) { s = 38; r.push('Có bài đọc và câu hỏi có lựa chọn'); }
    return { score: s, reasons: r };
  },
  reading_short_answer: (f) => {
    const r: string[] = [];
    let s = 0;
    if (f.passageWords >= 30 && f.shortQuestions >= 2 && f.optionQuestions === 0) { s = 88; r.push('Bài đọc kèm câu hỏi trả lời ngắn'); }
    return { score: s, reasons: r };
  },
  grammar_vocab_multiple_choice: (f) => {
    const r: string[] = [];
    let s = 0;
    if (f.optionQuestions >= 3 && f.passageWords < 40) { s = 78; r.push('Nhiều câu rời, mỗi câu có lựa chọn'); }
    else if (f.optionQuestions >= 3) { s = 30; r.push('Có câu hỏi kèm lựa chọn'); }
    return { score: s, reasons: r };
  },
  pronunciation_multiple_choice: (f) => ({ score: f.optionQuestions >= 3 && f.passageWords < 20 ? 30 : 0, reasons: ['Các câu có 4 từ để chọn'] }),
  sentence_rearrangement: (f) => ({ score: f.slashLines >= 2 ? 62 : 0, reasons: ['Các câu gồm từ cách nhau bằng dấu /'] }),
  sentence_construction: (f) => ({ score: f.slashLines >= 2 ? 58 : 0, reasons: ['Các câu gồm từ gợi ý cách nhau bằng dấu /'] }),
  sentence_completion: (f) => ({ score: f.blanks >= 2 && f.passageWords < 30 && f.optionQuestions === 0 ? 55 : 0, reasons: ['Câu ngắn có chỗ trống'] }),
  matching_vocabulary: (f) => ({ score: f.numberedLines >= 3 && f.letteredLines >= 3 && f.optionQuestions === 0 && f.passageWords < 20 ? 72 : 0, reasons: ['Cột số 1, 2, 3 và cột chữ a, b, c để nối'] }),
  true_false_not_given: (f) => ({ score: f.notGiven ? 75 : f.tfWords && !f.audio ? 45 : 0, reasons: [f.notGiven ? 'Có "Not Given"' : 'Có True / False'] }),
  listening_true_false: (f) => ({ score: f.audio && f.tfWords ? 80 : 0, reasons: ['Bài nghe có True / False'] }),
  listening_gap_fill: (f) => ({ score: f.audio && f.blanks >= 2 ? 82 : 0, reasons: ['Bài nghe có chỗ trống cần điền'] }),
  listening_multiple_choice: (f) => ({ score: f.audio && f.optionQuestions >= 2 ? 82 : 0, reasons: ['Bài nghe có câu hỏi chọn đáp án'] }),
  matching_headings: (f) => ({ score: f.headingKeywords && f.passageWords >= 40 ? 70 : 0, reasons: ['Có đoạn văn và danh sách ý chính / heading'] }),
};

export const rankExerciseTypes = (raw: string): TypeSuggestion[] => {
  const f = extractFeatures(raw);
  const headingText = raw.split('\n').map((l) => l.trim()).filter((l) => l && l.length <= 160).slice(0, 3).join(' ');
  const byHeading = classifyByHeading(headingText);
  const out: TypeSuggestion[] = Object.values(EXERCISE_REGISTRY)
    .filter((m) => !m.hidden || m.type === 'sentence_construction')
    .map((m) => {
      const base = SCORERS[m.type]?.(f) ?? { score: 0, reasons: [] };
      let score = Math.max(0, base.score);
      const reasons = [...base.reasons];
      // Có nhiều chỗ trống đánh số trong đoạn văn: "read the text, choose…" là hướng dẫn của Cloze, không phải Reading MC
      const headingApplies = !(m.type === 'reading_multiple_choice' && f.blanks >= 3);
      if (byHeading === m.type && headingApplies) { score = Math.min(99, score + 40 + (score === 0 ? 20 : 0)); reasons.unshift('Tiêu đề / hướng dẫn khớp dạng này'); }
      // Nghe: dạng không phải bài nghe bị trừ khi bài có audio, và ngược lại
      if (m.category === 'Listening' && !f.audio) score = Math.min(score, 10);
      return { type: m.type, label: m.label, category: m.category, score: Math.min(99, Math.round(score)), reasons: score > 0 ? reasons : [] };
    });
  return out.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
};
