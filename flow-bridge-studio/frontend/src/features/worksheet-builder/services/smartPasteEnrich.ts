// Smart Paste tổng (trong thư mục bài): nhận ra dạng bài từ tiêu đề / hướng dẫn rồi dựng sẵn dữ liệu của đúng trình soạn
// (Grammar MC, Pronunciation, Sentence Rearrangement / Construction, Reading MC / Short Answer, Listening MC),
// để mở ra là có layout và thanh công cụ của dạng đó.

import type { Exercise, ExerciseType } from '../types/index.ts';
import { createGrammarMcq, newMcqId, newQuestion, parseMcqText, parsePronunciationText, parseSentenceLines } from './grammar-mcq/grammarMcqCore.ts';
import type { McqQuestion } from './grammar-mcq/grammarMcqCore.ts';
import { createReadingMcq, parseReadingFull } from './reading-mcq/readingMcqCore.ts';
import { parseClozeSmartPaste } from './cloze/clozeCore.ts';
import { createListeningMcq } from './listening-mcq/listeningMcqCore.ts';
import { autoParseVocabulary, createMatchingVocabulary, newVocabId } from './matching-vocabulary/matchingVocabularyCore.ts';
import { createTfng, newTfngId, parseTfngText } from './tfng/tfngCore.ts';
import { createListeningTrueFalse, newTfId, parseTrueFalseText } from './listening-true-false/listeningTrueFalseCore.ts';
import { createGapFilling, newGapId, parseGapFillingText } from './gap-filling/gapFillingCore.ts';
import { createMatchingHeadings, newHeadingId, parseHeadingsText } from './matching-headings/matchingHeadingsCore.ts';
import { createSentenceCompletion, newSentenceId, parseSentenceCompletionText } from './sentence-completion/sentenceCompletionCore.ts';
import type { SentenceItem } from './sentence-completion/sentenceCompletionCore.ts';
import { DIALOGUE_PRESET, SENTENCE_LIST_PRESET, parseListeningSmartPaste } from './listening/listeningGapFillCore.ts';
import { parseMatchingText, matchingFromParsed } from './matching/matchingCore.ts';

/**
 * Nhận dạng theo TIÊU ĐỀ + HƯỚNG DẪN (không nhìn cả bài để khỏi nhầm vì chữ "listen", "read" trong đoạn văn).
 * Trả null khi không chắc để bộ phân loại cũ quyết định.
 */
export const classifyByHeading = (heading: string): ExerciseType | null => {
  const h = heading.toLowerCase();
  if (/underlined part|pronounced differently|pronunciation|phát âm/.test(h)) return 'pronunciation_multiple_choice';
  if (/arrange.*words|rearrange|unscramble|put the words|sắp xếp/.test(h)) return 'sentence_rearrangement';
  if (/suggested words|suggested cues|cue words|using the (?:words|cues)|construct/.test(h)) return 'sentence_construction';
  if (/headings?|main ideas?/.test(h) && /match|choose|paragraph/.test(h)) return 'matching_headings';
  if (/word formation|form of the (?:word|verb)|in brackets|in parentheses|words? in the box|from the box|phrases? in the box|chia động từ|đổi dạng/.test(h)) return 'gap_filling_word_formation';
  if (/\b(?:find|spot|correct)\b.*\b(?:mistakes?|errors?)\b|tìm lỗi/.test(h)) return 'sentence_completion';
  if (/\benough\b|\btoo\b.*\bto\b|complete the sentences|sentence completion|rewrite the sentences/.test(h)) return 'sentence_completion';
  if (/\bwrite\b.*\b(?:do|does|don['’]?t|doesn['’]?t)\b/.test(h)) return 'sentence_completion';
  if (/draw\s+lines?|kẻ\s+đường/.test(h)) return 'draw_lines_match';
  if (/match.*(?:phrasal verb|word|vocabulary|definition|meaning)|nối/.test(h)) return 'matching_vocabulary';
  if (/true.*false.*not given|t\/f\/ng/.test(h)) return 'true_false_not_given';
  // Đọc bài rồi viết T / F (không có Not Given, không phải bài nghe): dùng Reading Short Answer có bài đọc và dòng kẻ ngắn
  if (!/listen/.test(h) && /\btrue\b.*\bfalse\b|\(t\)\s*or\s*false/.test(h)) return 'reading_short_answer';
  if (/listen/.test(h)) {
    if (/are the sentences|true or false|\btrue\b.*\bfalse\b/.test(h) && !/fill|gap|blank/.test(h)) return 'listening_true_false';
    if (/fill|gap|blank|complete|điền/.test(h)) return 'listening_gap_fill';
    if (/table/.test(h)) return 'listening_table_completion';
    if (/true|false/.test(h)) return 'listening_true_false';
    if (/choose|circle|correct answer|chọn/.test(h)) return 'listening_multiple_choice';
    return null;
  }
  if (/read the (?:text|passage)|reading/.test(h)) {
    if (/answer the questions|short answer|trả lời/.test(h)) return 'reading_short_answer';
    if (/choose|correct answer|circle|chọn/.test(h)) return 'reading_multiple_choice';
    if (/heading|main idea/.test(h)) return 'matching_headings';
    return null;
  }
  return null;
};

const cleanTitle = (t: string): string =>
  (t || '').replace(/\[\[|\]\]/g, '').replace(/^\s*(exercise|bài|part|task)\s*\d+\s*[:.\-–—]?\s*/i, '').replace(/^\s*\d+\s*[.)]\s+(?=[A-Z])/, '').trim();

/** Bỏ dòng đầu của khối nếu nó chỉ là nhãn bài ("Exercise 6", "PART 2: …") */
const bodyOf = (chunk: string): string => {
  const lines = chunk.replace(/\r\n?/g, '\n').split('\n');
  const first = (lines[0] || '').trim();
  if (/^(exercise|part|section|task|bài|phần)\b/i.test(first) || /^[IVX]+[.)]\s/.test(first)) return lines.slice(1).join('\n');
  return chunk;
};

const toQuestions = (items: { text: string; options: string[] }[], minOptions = 0): McqQuestion[] =>
  items.map((it) => {
    const opts = it.options.map((t) => ({ id: newMcqId('o'), text: t }));
    while (opts.length < minOptions) opts.push({ id: newMcqId('o'), text: '' });
    return { ...newQuestion(it.text), options: opts };
  });

const withQuestions = (ex: Exercise, qs: McqQuestion[]): Exercise['questions'] =>
  qs.map((q, i) => ({
    id: q.id,
    number: i + 1,
    text: q.text,
    options: q.options.map((o, oi) => ({ id: o.id, label: String.fromCharCode(65 + oi), text: o.text })),
    points: 1,
  })) || ex.questions;

/** Dựng dữ liệu riêng của trình soạn tương ứng; dạng chưa hỗ trợ giữ nguyên bài đã tách */
export const enrichExercise = (ex: Exercise, chunk: string): Exercise => {
  const bare = !cleanTitle(ex.title) || /^(exercise|part|section|task|bài|phần)\s*\d*$/i.test(ex.title.trim());
  const defaultInstr = ex.instructions === 'Answer the questions according to instructions.';
  const title = (bare && !defaultInstr ? ex.instructions : cleanTitle(ex.title)) || ex.title;
  const body = bodyOf(chunk);
  const base = { ...ex, title };

  switch (ex.type) {
    case 'grammar_vocab_multiple_choice': {
      const p = parseMcqText(body);
      if (!p.ok) return base;
      const qs = toQuestions(p.questions, 4);
      return { ...base, questions: withQuestions(ex, qs), grammarMcq: createGrammarMcq({ exerciseTitle: title.toUpperCase(), instruction: ex.instructions || '', questions: qs }) };
    }
    case 'pronunciation_multiple_choice': {
      const rows = parsePronunciationText(body);
      if (rows.length === 0) return base;
      const qs: McqQuestion[] = rows.map((r) => ({ ...newQuestion(), options: r.map((t) => ({ id: newMcqId('o'), text: t })) }));
      return {
        ...base,
        type: 'pronunciation_multiple_choice',
        questions: withQuestions(ex, qs),
        grammarMcq: createGrammarMcq({ pronunciation: true, exerciseTitle: title.toUpperCase(), questions: qs, settings: { optionColumns: 4, optionLabelStyle: 'uppercase' } as never }),
      };
    }
    case 'sentence_rearrangement':
    case 'sentence_construction': {
      const r = parseSentenceLines(body);
      if (r.sentences.length === 0) return base;
      const qs: McqQuestion[] = r.sentences.map((t) => ({ ...newQuestion(t), options: [] }));
      return {
        ...base,
        questions: withQuestions(ex, qs),
        grammarMcq: createGrammarMcq({
          sentenceMode: ex.type === 'sentence_rearrangement' ? 'rearrange' : 'construct',
          exerciseTitle: title.toUpperCase(),
          answerLineLength: 'long',
          answerLines: 1,
          questions: qs,
          settings: { optionColumns: 1, showAnswerBoxes: true, showInstruction: false } as never,
        }),
      };
    }
    case 'reading_multiple_choice':
    case 'reading_short_answer':
    case 'reading_comic': {
      const r = parseReadingFull(body);
      if (!r.passage && r.questions.length === 0) return base;
      const isComic = ex.type === 'reading_comic';
      const sa = ex.type === 'reading_short_answer' || isComic;
      const qs = toQuestions(r.questions.map((q) => ({ text: q.text, options: sa ? [] : q.options })), sa ? 0 : 3);
      return {
        ...base,
        passage: r.passage || ex.passage,
        questions: withQuestions(ex, qs),
        readingMcq: createReadingMcq({
          ...(sa ? { shortAnswer: true } : {}),
          exerciseTitle: (r.exerciseTitle || title).toUpperCase(),
          instruction: ex.instructions || '',
          passageTitle: r.passageTitle,
          passageAuthor: r.author,
          passage: r.passage,
          questions: qs,
          settings: (isComic
            ? { layout: 'comic_story', themeColor: 'orange', questionGapMm: 6, answerLineCount: 1 }
            : sa
            ? { showPassageImage: false, questionGapMm: 4.5, ...(/\btrue\b.*\bfalse\b/i.test(title) ? { answerLineWidthMm: 26 } : {}) }
            : {}) as never,
        }),
      };
    }
    case 'listening_multiple_choice': {
      const p = parseMcqText(body);
      if (!p.ok) return base;
      const qs = toQuestions(p.questions, 3);
      return { ...base, questions: withQuestions(ex, qs), listeningMcq: createListeningMcq({ exerciseTitle: title.toUpperCase(), instruction: ex.instructions || '', questions: qs }) };
    }
    case 'grammar_vocab_cloze': {
      const r = parseClozeSmartPaste(chunk);
      if (r.questionCount === 0) return base;
      const d = r.data;
      return {
        ...base,
        title: d.exerciseTitle || title,
        passage: d.passage,
        pointsTotal: d.points || d.questions.length,
        questions: d.questions.map((q) => ({
          id: q.id,
          number: q.number,
          text: `(${q.number})`,
          options: q.options.map((o) => ({ id: o.id, label: o.label.toUpperCase(), text: o.text })),
          points: 1,
        })),
        cloze: d,
      };
    }
    case 'matching_vocabulary': {
      const p = autoParseVocabulary(body);
      if (!p.ok) return base;
      return {
        ...base,
        questions: p.words.map((w, i) => ({ id: newVocabId('w'), number: i + 1, text: w, points: 1 })),
        matchingVocabulary: createMatchingVocabulary({
          exerciseTitle: title.toUpperCase(),
          words: p.words.map((text) => ({ id: newVocabId('w'), text })),
          definitions: p.definitions.map((text) => ({ id: newVocabId('d'), text })),
          settings: { layout: 'plain_list' } as never,
        }),
      };
    }
    case 'draw_lines_match':
    case 'matching_information': {
      const p = parseMatchingText(body);
      const m = matchingFromParsed(p);
      if (ex.type === 'draw_lines_match') m.layout = 'facing_tables';
      return {
        ...base,
        matching: m,
        questions: m.problems.map((prob, i) => ({ id: prob.id, number: i + 1, text: prob.text, points: 1 })),
        pointsTotal: m.problems.length,
      };
    }
    case 'true_false_not_given': {
      const p = parseTfngText(body);
      if (!p.ok) return base;
      return {
        ...base,
        questions: p.statements.map((t, i) => ({ id: newTfngId(), number: i + 1, text: t, points: 1 })),
        tfng: createTfng({ exerciseTitle: title.toUpperCase(), statements: p.statements.map((t) => ({ id: newTfngId(), text: t })) }),
      };
    }
    case 'listening_true_false': {
      const p = parseTrueFalseText(body);
      if (!p.ok) return base;
      return {
        ...base,
        questions: p.statements.map((t, i) => ({ id: newTfId(), number: i + 1, text: t, points: 1 })),
        listeningTrueFalse: createListeningTrueFalse({ exerciseTitle: title.toUpperCase(), statements: p.statements.map((t) => ({ id: newTfId(), text: t })) }),
      };
    }
    case 'gap_filling_word_formation': {
      const p = parseGapFillingText(body);
      if (!p.ok) return base;
      return {
        ...base,
        passage: p.passage,
        gapFilling: createGapFilling({
          exerciseTitle: title.toUpperCase(),
          passage: p.passage,
          words: p.words.map((text) => ({ id: newGapId(), text })),
          settings: { layout: p.layout } as never,
        }),
      };
    }
    case 'matching_headings': {
      const p = parseHeadingsText(body);
      if (!p.ok) return base;
      return {
        ...base,
        matchingHeadings: createMatchingHeadings({
          exerciseTitle: (p.exerciseTitle || title).toUpperCase(),
          passageTitle: p.passageTitle,
          paragraphs: p.paragraphs.map((text) => ({ id: newHeadingId('p'), text })),
          ideas: p.ideas.map((text) => ({ id: newHeadingId('i'), text })),
        }),
      };
    }
    case 'sentence_completion': {
      const p = parseSentenceCompletionText(body);
      if (!p.ok) return base;
      return {
        ...base,
        questions: p.sentences.map((x, i) => ({ id: newSentenceId(), number: i + 1, text: x.text, points: 1 })),
        sentenceCompletion: createSentenceCompletion({
          exerciseTitle: (p.title || title).toUpperCase(),
          targetWord: p.targetWord,
          words: p.words.map((text) => ({ id: newSentenceId(), text })),
          sentences: p.sentences.map((x): SentenceItem => ({ id: newSentenceId(), text: x.text, ...(x.hint ? { hint: x.hint } : {}), ...(x.starter ? { starter: x.starter } : {}) })),
          settings: { layout: p.layout, showWordBank: p.words.length > 0 } as never,
        }),
      };
    }
    case 'listening_gap_fill': {
      // Dòng "You will hear …" ngay dưới tiêu đề là dòng giới thiệu in nghiêng
      const lines = body.replace(/\r\n?/g, '\n').split('\n');
      const ii = lines.findIndex((l) => /^\s*you will (?:hear|listen)/i.test(l));
      const intro = ii >= 0 ? lines[ii].trim() : '';
      const raw = ii >= 0 ? lines.filter((_, k) => k !== ii).join('\n') : body;
      const d = parseListeningSmartPaste(raw);
      if (d.blanks.length === 0) return base;
      const short = d.paragraphs.length >= 3 && d.paragraphs.every((pp) => pp.text.length <= 130 && (pp.text.match(/\.\s+[A-Z]/g) || []).length === 0);
      const settings = d.settings.layout === 'dialogue' ? DIALOGUE_PRESET : intro || short ? SENTENCE_LIST_PRESET : {};
      return {
        ...base,
        passage: d.paragraphs.map((pp) => `${pp.order}. ${pp.text}`).join('\n\n'),
        questions: d.blanks.map((b) => ({ id: b.id, number: b.number, text: `(${b.label})`, correctAnswer: b.correctAnswer, points: 1 })),
        pointsTotal: d.blanks.length,
        listeningGapFill: { ...d, exerciseTitle: title.toUpperCase(), ...(intro ? { intro } : {}), settings: { ...d.settings, ...settings } },
      };
    }
    default:
      return base;
  }
};

/** Bỏ dữ liệu riêng của dạng đã đoán lúc phân tích, để chọn dạng khác thì dựng lại từ đầu và mở đúng trình soạn */
export const stripSpecialized = (ex: Exercise): Exercise => {
  const {
    matching, cloze, listeningGapFill, matchingPictures, matchingHeadings, tfng, gapFilling, sentenceCompletion,
    matchingVocabulary, listeningTrueFalse, listeningTable, listeningMcq, readingMcq, grammarMcq, ...rest
  } = ex;
  void matching; void cloze; void listeningGapFill; void matchingPictures; void matchingHeadings; void tfng; void gapFilling;
  void sentenceCompletion; void matchingVocabulary; void listeningTrueFalse; void listeningTable; void listeningMcq; void readingMcq; void grammarMcq;
  return rest;
};
