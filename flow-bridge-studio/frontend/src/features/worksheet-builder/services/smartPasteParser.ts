import type { 
  Worksheet, Exercise, QuestionItem, ChoiceOption, 
  ExerciseType, TemplateLayoutType, ImageSlot, TableData 
} from '../types/index.ts';
import { classifyByHeading, enrichExercise } from './smartPasteEnrich.ts';
import { PRINT_TOKENS } from '../tokens/printTokens.ts';

export interface ParseResult {
  worksheet: Worksheet;
  warnings: string[];
  unparsedBlocks: string[];
  rawText: string;
}

/**
 * Standard default PrintSettings matching ISO A4 specifications
 */
export const DEFAULT_A4_PRINT_SETTINGS: Worksheet['printSettings'] = {
  paperSize: 'A4',
  orientation: 'portrait',
  widthMm: 210,
  heightMm: 297,
  marginMm: 15,
  printableWidthMm: 180,
  printableHeightMm: 267,
  showStudentInfo: true,
  showEmptyImagePlaceholders: true,
  mode: 'student',
  fontSizeBasePt: 11,
  lineHeight: 1.35,
};

/**
 * Sample authentic Cambridge English exam text for the "Insert Sample" button
 */
export const SAMPLE_SMART_PASTE_TEXT = `CAMBRIDGE ENGLISH ACADEMY
MID-TERM ASSESSMENT - SEMESTER 2
Unit 7: The Living Planet · Lesson: Biodiversity & Habitats
Grade 7 / Level B1 · Time: 45 minutes · Max Points: 20

Exercise 1: Grammar and Vocabulary
Instructions: Choose the best answer (A, B, C or D) to complete each sentence.
1. Many endangered species are ________ risk of extinction due to habitat loss.
A. at
B. in
C. on
D. under
2. The Amazon rainforest produces approximately twenty percent of the world's ________.
A. nitrogen
B. carbon
C. oxygen
D. water
3. If human beings ________ protecting natural habitats, biodiversity will vanish.
A. stopped
B. don't stop
C. wouldn't
D. stop

Exercise 2: Reading Comprehension
Instructions: Read the passage below and decide whether the statements are True (T), False (F), or Not Given (NG).
Passage:
Tropical rainforests cover only six percent of Earth's land surface, but they harbor more than half of the planet's plant and animal species. Scientists estimate that millions of insect species living in the rainforest canopy remain undiscovered. Deforestation for agriculture and cattle ranching continues to destroy vast areas of the forest each day. Conservationists are working with local indigenous communities to establish sustainable protection zones that preserve rare wildlife while supporting sustainable agriculture.

4. Rainforests cover more than half of the Earth's total land surface.
5. Millions of insect species in the canopy have not yet been discovered by scientists.
6. The government provided financial rewards to all indigenous families.
7. Deforestation is primarily caused by agricultural expansion and cattle ranching.

Exercise 3: Matching Pictures
Instructions: Look at pictures A–E and match each sentence with the correct picture.
8. The marine biologist is cataloging coral reef specimens underwater.
9. A camera trap recorded a rare snow leopard in the high mountain peaks.
10. Volunteers are planting mangrove saplings along the coastal wetlands.
11. Solar panels provide clean renewable electricity to the research station.
12. Students are collecting water samples from the local forest stream.

Exercise 4: Gap Filling with Word Bank
Instructions: Complete the sentences using the words from the box.
Word bank: [biodiversity, nocturnal, migration, endangered, fragile]
13. The Arctic tundra is an extremely ________ ecosystem that is vulnerable to global warming.
14. Owls and bats are ________ creatures that hunt for food during the night.
15. Seasonal ________ of birds involves journeys spanning thousands of kilometers.
16. The Bengal tiger is classified as an ________ animal requiring strict legal protection.

Exercise 5: Short Answer Questions
Instructions: Answer the questions in complete sentences based on the reading text.
17. What percentage of Earth's land surface is covered by tropical rainforests?
18. Where do millions of undiscovered insect species live according to scientists?

ANSWER KEY:
1. A
2. C
3. D
4. F
5. T
6. NG
7. T
8. A
9. B
10. C
11. D
12. E
13. fragile
14. nocturnal
15. migration
16. endangered
17. Approximately six percent.
18. In the rainforest canopy.
`;

/**
 * Intelligent Worksheet Parser
 * Deterministic multi-exercise parser with fuzzy classification and error resilience
 */
export function parseWorksheetText(rawText: string): ParseResult {
  const warnings: string[] = [];
  const unparsedBlocks: string[] = [];
  const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  if (!normalized.trim()) {
    throw new Error('Pasted content is empty. Please paste text to analyze.');
  }

  // 1. Extract Document Header metadata if present
  const headerMeta = extractDocumentHeader(normalized);

  // 2. Extract Separate Answer Key block if present
  const { cleanText, answerKeyMap } = extractGlobalAnswerKey(normalized);

  // 3. Partition document into Exercise chunks
  const exerciseChunks = splitIntoExerciseChunks(cleanText);

  if (exerciseChunks.length === 0 || (exerciseChunks.length === 1 && !/^(?:Exercise|PART|Section|Task|BÀI|PHẦN|I|II|III|IV|V|VI)\b/i.test(exerciseChunks[0]))) {
    warnings.push('No explicit exercise sections detected. Content parsed as a general exercise.');
  }

  // 4. Parse each exercise chunk
  const exercises: Exercise[] = [];
  let currentOrder = 1;

  for (const chunk of exerciseChunks) {
    // If multiple chunks exist and this leading chunk has no exercise label and no numbered questions, it is the document header
    if (
      exerciseChunks.length > 1 &&
      !/^(?:Exercise|PART|Section|Task|BÀI|PHẦN|I|II|III|IV|V|VI)\b/i.test(chunk) &&
      !/^\d+[\.\)]\s+/m.test(chunk)
    ) {
      continue;
    }

    try {
      const parsedExercise = parseSingleExerciseChunk(
        chunk, 
        currentOrder, 
        answerKeyMap, 
        warnings, 
        unparsedBlocks
      );
      if (parsedExercise) {
        exercises.push(enrichExercise(parsedExercise, chunk));
        currentOrder++;
      }
    } catch (err: any) {
      warnings.push(`Warning in exercise block ${currentOrder}: ${err?.message || 'Formatting anomaly'}`);
      unparsedBlocks.push(chunk);
    }
  }

  // If no exercises parsed successfully, create fallback
  if (exercises.length === 0) {
    exercises.push({
      id: `ex_${Date.now()}_1`,
      type: 'grammar_vocab_multiple_choice',
      layoutType: 'template_a',
      title: 'Exercise 1: General Test',
      instructions: 'Answer the questions according to instructions.',
      order: 1,
      imageSlots: [],
      questions: [
        {
          id: `q_${Date.now()}_1`,
          number: 1,
          text: cleanText.slice(0, 300),
          points: 1,
        }
      ]
    });
    warnings.push('Parsed as a single fallback exercise due to irregular formatting.');
  }

  // Calculate total points
  const totalPoints = exercises.reduce((sum, ex) => sum + (ex.pointsTotal || 0), 0) || headerMeta.points || 20;

  const worksheet: Worksheet = {
    id: `ws_${Date.now()}`,
    title: headerMeta.title || 'ENGLISH WORKSHEET',
    unit: headerMeta.unit || 'UNIT 1',
    lesson: headerMeta.lesson || 'LESSON 1',
    gradeLevel: headerMeta.gradeLevel || 'Level B1',
    subject: 'English',
    schoolName: headerMeta.schoolName || 'Pinta English',
    teacherName: headerMeta.teacherName || 'English Teacher',
    totalTimeMinutes: headerMeta.timeMinutes || 45,
    totalPoints: totalPoints,
    status: 'draft',
    printSettings: DEFAULT_A4_PRINT_SETTINGS,
    exercises,
    importMetadata: {
      rawText,
      importedAt: Date.now(),
      warnings,
      unparsedBlocks,
      stats: {
        detectedExercises: exercises.length,
        detectedQuestions: exercises.reduce((sum, ex) => sum + ex.questions.length, 0),
        detectedImageSlots: exercises.reduce((sum, ex) => sum + ex.imageSlots.length, 0),
        hasExplicitAnswerKey: Object.keys(answerKeyMap).length > 0,
      }
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return {
    worksheet,
    warnings,
    unparsedBlocks,
    rawText,
  };
}

/**
 * Extracts Title, School, Unit, Time, and Points from the top document lines
 */
function extractDocumentHeader(text: string) {
  const lines = text.split('\n').slice(0, 8);
  const result = {
    title: '',
    schoolName: '',
    unit: '',
    lesson: '',
    gradeLevel: '',
    teacherName: '',
    timeMinutes: 45,
    points: 0,
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // School
    if (/academy|school|university|trường|college/i.test(trimmed) && !result.schoolName) {
      result.schoolName = trimmed.replace(/^(school|trường):\s*/i, '');
      continue;
    }

    // Title / Test Name
    if (/test|assessment|worksheet|examination|mid-term|final|quiz/i.test(trimmed) && !result.title) {
      result.title = trimmed.toUpperCase();
      continue;
    }

    // Unit & Lesson
    const unitMatch = trimmed.match(/(?:unit|chương|module)\s*(\d+[^·\n\r]*)/i);
    if (unitMatch) {
      result.unit = unitMatch[0].trim();
    }
    const lessonMatch = trimmed.match(/(?:lesson|bài)\s*([^\n\r·]+)/i);
    if (lessonMatch) {
      result.lesson = lessonMatch[0].trim();
    }

    // Grade / Level
    const gradeMatch = trimmed.match(/(?:grade|lớp|level|cefr)\s*([a-z0-9+]+)/i);
    if (gradeMatch) {
      result.gradeLevel = gradeMatch[0].trim();
    }

    // Time
    const timeMatch = trimmed.match(/(?:time|duration|thời gian)[:\s]+(\d+)\s*(?:mins|min|minutes|phút)/i);
    if (timeMatch) {
      result.timeMinutes = parseInt(timeMatch[1], 10);
    }

    // Points
    const pointsMatch = trimmed.match(/(?:max|total|điểm|points)[:\s]+(\d+)/i);
    if (pointsMatch) {
      result.points = parseInt(pointsMatch[1], 10);
    }
  }

  if (!result.title) {
    result.title = 'ENGLISH WORKSHEET';
  }

  return result;
}

/**
 * Extracts Answer Key section if present at the end of the text
 */
function extractGlobalAnswerKey(text: string): { cleanText: string; answerKeyMap: Record<number, string> } {
  const answerKeyMap: Record<number, string> = {};
  
  // Look for ANSWER KEY header
  const keyHeaderMatch = text.search(/\n\s*(?:ANSWER KEY|ANSWERS?|ĐÁP ÁN|SOLUTIONS?|KEY)[:\s]*\n/i);
  if (keyHeaderMatch === -1) {
    return { cleanText: text, answerKeyMap };
  }

  const cleanText = text.slice(0, keyHeaderMatch).trim();
  const keyText = text.slice(keyHeaderMatch);

  // Extract individual mappings: e.g. "1. A", "2. False", "3: NG", "4 - C"
  const lines = keyText.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    // Patterns like: "1. A", "1: True", "1 - cat", "1/ B"
    const match = trimmed.match(/^(\d+)[\.\:\-\/\s]+([a-zA-Z0-9\s,\/]+)$/);
    if (match) {
      const qNum = parseInt(match[1], 10);
      const ansVal = match[2].trim();
      answerKeyMap[qNum] = ansVal;
    } else {
      // In-line answers like "1.A 2.B 3.C"
      const inlineMatches = trimmed.matchAll(/(\d+)[\.\:\-]\s*([a-zA-Z0-9]+)/g);
      for (const m of inlineMatches) {
        answerKeyMap[parseInt(m[1], 10)] = m[2].trim();
      }
    }
  }

  return { cleanText, answerKeyMap };
}

/**
 * Splits document into distinct exercise chunks
 */
function splitIntoExerciseChunks(text: string): string[] {
  // Delimiter regex matching "Exercise 1", "Part 2", "Section A", "Task 3", "I.", "II."
  const splitRegex = /(?:\n|^)(?=(?:Exercise|PART|Section|Task|Task|BÀI|PHẦN)\s*(?:[0-9]+|[A-Z]+|IV|V|VI|VII|VIII|IX|X)[\s\:\.\-]|(?:I|II|III|IV|V|VI|VII|VIII|IX|X)[\.\:\-]\s+[A-Z])/i;

  const chunks = text
    .split(splitRegex)
    .map((c) => c.trim())
    .filter((c) => c.length > 10);

  if (chunks.length <= 1) {
    // Check if there are multiple strong instruction blocks
    const instructionSplitRegex = /(?:\n\n)(?=(?:Choose the best|Read the following|Match the|Complete the|Fill in the|Listen and|Put the words)\b)/i;
    const subChunks = text
      .split(instructionSplitRegex)
      .map((c) => c.trim())
      .filter((c) => c.length > 10);
    if (subChunks.length > 1) {
      return subChunks;
    }
  }

  return chunks.length > 0 ? chunks : [text];
}

/**
 * Parses a single exercise chunk into structured Exercise
 */
function parseSingleExerciseChunk(
  chunk: string,
  exerciseOrder: number,
  answerKeyMap: Record<number, string>,
  _warnings: string[],
  _unparsedBlocks: string[]
): Exercise {
  const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
  const exerciseId = `ex_${Date.now()}_${exerciseOrder}`;

  // 1. Detect Exercise Title & Instructions
  let title = `Exercise ${exerciseOrder}`;
  let instructions = 'Answer the questions according to instructions.';
  let lineIdx = 0;

  if (lines.length > 0 && /^(?:Exercise|PART|Section|Task|BÀI|PHẦN|I|II|III|IV|V|VI)\b/i.test(lines[0])) {
    title = lines[0].replace(/^[\s\:\.\-]+/, '');
    lineIdx++;
  }

  if (lineIdx < lines.length && /^(?:Instructions?|Hướng dẫn)[:\s]*/i.test(lines[lineIdx])) {
    instructions = lines[lineIdx].replace(/^(?:Instructions?|Hướng dẫn)[:\s]*/i, '');
    lineIdx++;
  } else if (lineIdx < lines.length && !/^\d+[\.\)]/.test(lines[lineIdx]) && !/^Passage/i.test(lines[lineIdx])) {
    // If the next line isn't a question or passage, it's likely an instruction
    if (/read|choose|listen|match|fill|complete|write|arrange|underlined|circle|answer|suggest|put |order|unscramble|true|false|use |find|tick|identify|nối|chọn|điền|sắp xếp/i.test(lines[lineIdx])) {
      instructions = lines[lineIdx];
      lineIdx++;
    }
  }

  // 2. Identify Exercise Type
  const detectedType = classifyByHeading(title + ' ' + instructions) ?? classifyExerciseType(title + ' ' + instructions + ' ' + chunk);

  // 3. Remaining lines after title and instructions
  const remainingLines = lines.slice(lineIdx);

  // Check for Table (lines starting with '|')
  const tableLines = remainingLines.filter((l) => l.startsWith('|') && l.endsWith('|'));
  let tableData: TableData | undefined;
  if (tableLines.length >= 2) {
    tableData = parseMarkdownTable(tableLines);
  }

  // 3. Extract Reading Passage if present
  let passage = '';
  // Check for explicit "Passage:" or "Reading text:"
  let questionStartIndex = remainingLines.findIndex((l) => /^\d+[\.\)]\s+/.test(l));
  
  if (questionStartIndex > 0) {
    const nonTablePreLines = remainingLines
      .slice(0, questionStartIndex)
      .filter((l) => !l.startsWith('|'));
    const potentialPassage = nonTablePreLines.join('\n').trim();

    // If it's a reading type or is sufficiently long prose (and not just table lines)
    if (
      potentialPassage.length > 0 &&
      (detectedType.includes('reading') || 
       detectedType === 'true_false_not_given' || 
       potentialPassage.length > 120 || 
       /^(?:Passage|Text|Đoạn văn)/i.test(remainingLines[0]))
    ) {
      passage = potentialPassage.replace(/^(?:Passage|Text|Đoạn văn)[:\s]*/i, '').trim();
      lineIdx += questionStartIndex;
    }
  }

  // 4. Extract Questions, Options, Word Bank
  const questions: QuestionItem[] = [];
  const questionContentLines = lines.slice(lineIdx);
  let currentQuestion: QuestionItem | null = null;
  let wordBank: string[] = [];

  // Check for Word bank: [word1, word2, word3]
  for (const line of questionContentLines) {
    const wbMatch = line.match(/(?:Word bank|Box|Từ cho sẵn)[:\s]*\[?([^\]]+)\]?/i);
    if (wbMatch) {
      wordBank = wbMatch[1]
        .split(/[,;\s]+/)
        .map((w) => w.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
      break;
    }
  }

  // Parse questions and choices
  for (let i = 0; i < questionContentLines.length; i++) {
    const line = questionContentLines[i];
    
    // Skip word bank header line in questions stream
    if (/(?:Word bank|Box|Từ cho sẵn)[:\s]*/i.test(line)) continue;
    // Skip table lines if already parsed
    if (line.startsWith('|') && line.endsWith('|')) continue;

    // Pattern: "1. What did..." or "1) Complete..."
    const qMatch = line.match(/^(\d+)[\.\)]\s+(.*)/);
    if (qMatch) {
      if (currentQuestion) {
        questions.push(currentQuestion);
      }

      const qNum = parseInt(qMatch[1], 10);
      const qText = qMatch[2].trim();

      // Look up answer key if exists
      const extractedAnswer = answerKeyMap[qNum] || undefined;

      currentQuestion = {
        id: `q_${Date.now()}_${exerciseOrder}_${qNum}`,
        number: qNum,
        text: qText,
        options: [],
        correctAnswer: extractedAnswer,
        points: 1,
      };

      // Check if options are inline on the same line: "A. cat  B. dog  C. bird  D. fish"
      const inlineOptions = extractInlineOptions(qText);
      if (inlineOptions.options.length >= 2) {
        currentQuestion.text = inlineOptions.cleanText;
        currentQuestion.options = inlineOptions.options;
      }
      continue;
    }

    // Pattern: Independent choice line "A. Option text" or "B) Option text"
    const optMatch = line.match(/^([A-D])[\.\)]\s+(.*)/);
    if (optMatch && currentQuestion) {
      const label = optMatch[1].toUpperCase();
      const text = optMatch[2].trim();
      currentQuestion.options = currentQuestion.options || [];
      currentQuestion.options.push({
        id: `opt_${Date.now()}_${label}`,
        label,
        text,
      });
      continue;
    }

    // Append supplementary lines to current question
    if (currentQuestion) {
      // Check if line contains choices formatted together
      const inlineOptions = extractInlineOptions(line);
      if (inlineOptions.options.length >= 2) {
        currentQuestion.options = inlineOptions.options;
      } else if (!currentQuestion.options || currentQuestion.options.length === 0) {
        currentQuestion.text += '\n' + line;
      }
    }
  }

  if (currentQuestion) {
    questions.push(currentQuestion);
  }

  // Attach detected wordBank to questions if present
  if (wordBank.length > 0) {
    questions.forEach((q) => {
      if (!q.options || q.options.length === 0) {
        q.wordBank = wordBank;
      }
    });
  }

  // 5. Infer Image Slots
  const imageSlots = inferImageSlots(chunk, title, instructions, detectedType, exerciseId, passage);

  // 6. Infer Layout Template
  const layoutType = selectLayoutTemplate(detectedType, passage, imageSlots, tableData);

  // Points total
  const pointsTotal = questions.length > 0 ? questions.length : 10;

  return {
    id: exerciseId,
    type: detectedType,
    layoutType,
    title,
    instructions,
    passage: passage || undefined,
    questions,
    imageSlots,
    tableData,
    pointsTotal,
    order: exerciseOrder,
  };
}

/**
 * Classifies the exercise into one of the 15 canonical types
 */
export function classifyExerciseType(text: string): ExerciseType {
  const lower = text.toLowerCase();

  // Listening categories
  if (/listen|audio|recording|nghe/i.test(lower)) {
    if (/table|bảng/i.test(lower)) return 'listening_table_completion';
    if (/true|false|đúng|sai/i.test(lower)) return 'listening_true_false';
    if (/gap|blank|fill|điền/i.test(lower)) return 'listening_gap_fill';
    if (/picture|hình|tranh/i.test(lower)) return 'matching_pictures';
    return 'listening_multiple_choice';
  }

  // Matching Pictures
  if (
    /(?:picture|image|illustration|photo|tranh|hình)s?\s*(?:[A-E]|to [A-E]|đến [A-E]|và nối)/i.test(lower) || 
    /match.*(?:picture|tranh|hình)/i.test(lower) ||
    /nối.*(?:tranh|hình)/i.test(lower)
  ) {
    return 'matching_pictures';
  }

  // True / False / Not Given
  if (/true.*false.*not given|t\/f\/ng|\bnot given\b|đúng.*sai.*không đề cập/i.test(lower)) {
    return 'true_false_not_given';
  }

  // Reading classifications
  if (/reading|passage|đoạn văn|read the following|đọc đoạn văn/i.test(lower)) {
    if (/short answer|answer the questions|trả lời câu hỏi/i.test(lower)) return 'reading_short_answer';
    if (/heading|main idea|tiêu đề/i.test(lower)) return 'matching_headings';
    if (/match.*information|thông tin/i.test(lower)) return 'matching_information';
    return 'reading_multiple_choice';
  }

  // Matching vocabulary
  if (/match.*(?:word|vocabulary|definition|meaning)|nối từ/i.test(lower)) {
    return 'matching_vocabulary';
  }

  // Sentence Rearrangement
  if (/rearrange|unscramble|order.*words|sắp xếp từ/i.test(lower)) {
    return 'sentence_rearrangement';
  }

  // Sentence Construction
  if (/construct.*sentence|write.*using.*cues|viết lại câu/i.test(lower)) {
    return 'sentence_construction';
  }

  // Gap filling / Word formation
  if (/word formation|form of the word|fill in the (?:blank|gap)|word bank|từ loại|điền từ/i.test(lower)) {
    return 'gap_filling_word_formation';
  }

  // Default to Multiple Choice if options present
  return 'grammar_vocab_multiple_choice';
}

/**
 * Extracts inline options on the same line (e.g., "A. red  B. blue  C. green  D. yellow")
 */
function extractInlineOptions(text: string): { cleanText: string; options: ChoiceOption[] } {
  const optionRegex = /\b([A-D])[\.\)]\s+([^\sA-D][^A-D]*?)(?=(?:\b[A-D][\.\)]|$))/g;
  const options: ChoiceOption[] = [];
  let firstIndex = -1;

  for (const match of text.matchAll(optionRegex)) {
    if (firstIndex === -1) firstIndex = match.index || 0;
    options.push({
      id: `opt_${Date.now()}_${match[1]}`,
      label: match[1].toUpperCase(),
      text: match[2].trim(),
    });
  }

  const cleanText = firstIndex > 0 ? text.slice(0, firstIndex).trim() : text;
  return { cleanText, options };
}

/**
 * Infers image slots based on textual cues and extracts smart educational captions
 */
function inferImageSlots(
  chunk: string, 
  title: string, 
  instructions: string, 
  type: ExerciseType, 
  exerciseId: string,
  passage?: string
): ImageSlot[] {
  const combined = `${title} ${instructions} ${chunk}`.toLowerCase();
  const slots: ImageSlot[] = [];

  // Extract question texts or numbered statements from the chunk for smart captioning
  const itemTexts: string[] = [];
  const lines = chunk.split('\n').map((l) => l.trim());
  for (const line of lines) {
    const qMatch = line.match(/^\d+[\.\)]\s+(.+)$/);
    if (qMatch) {
      itemTexts.push(qMatch[1].trim());
    }
  }

  // 1. Match Pictures A-E or Vietnamese (tranh/hình A đến E)
  const rangeMatch = combined.match(/(?:pictures?|tranh|hình|bức tranh)\s*([a-e])\s*(?:to|–|-|đến)\s*([a-e])/i);
  if (rangeMatch) {
    const startChar = rangeMatch[1].toUpperCase().charCodeAt(0);
    const endChar = rangeMatch[2].toUpperCase().charCodeAt(0);
    const count = Math.min(6, Math.max(2, endChar - startChar + 1));
    for (let i = 0; i < count; i++) {
      const label = String.fromCharCode(startChar + i);
      const smartCaption = itemTexts[i] ? itemTexts[i] : `Picture ${label}`;
      slots.push({
        slotId: `slot_${Date.now()}_${label}`,
        exerciseId,
        label,
        widthMm: PRINT_TOKENS.imageSlots.matching.widthMm,
        heightMm: PRINT_TOKENS.imageSlots.matching.heightMm,
        aspectRatio: '4:3',
        status: 'empty',
        caption: smartCaption,
      });
    }
    return slots;
  }

  // 2. Matching pictures default 4-5 slots
  if (type === 'matching_pictures' || /nối.*(?:tranh|hình|ảnh)|nhìn.*(?:tranh|hình|ảnh)/i.test(combined)) {
    const count = Math.min(6, Math.max(4, itemTexts.length > 0 ? itemTexts.length : 4));
    for (let i = 0; i < count; i++) {
      const label = String.fromCharCode(65 + i);
      const smartCaption = itemTexts[i] ? itemTexts[i] : `Picture ${label}`;
      slots.push({
        slotId: `slot_${Date.now()}_${label}`,
        exerciseId,
        label,
        widthMm: PRINT_TOKENS.imageSlots.matching.widthMm,
        heightMm: PRINT_TOKENS.imageSlots.matching.heightMm,
        aspectRatio: '4:3',
        status: 'empty',
        caption: smartCaption,
      });
    }
    return slots;
  }

  // 3. Single Illustration / Diagram / Passage Graphic
  if (
    /look at the (?:picture|diagram|illustration|photo|map|chart)/i.test(combined) ||
    /nhìn (?:tranh|hình)|quan sát (?:hình|tranh)|minh hoạ/i.test(combined) ||
    (passage && /illustration|diagram|minh hoạ/i.test(combined))
  ) {
    let caption = 'Reference Illustration';
    if (passage) {
      const firstSentence = passage.split(/[.\n]/)[0]?.trim();
      if (firstSentence && firstSentence.length > 10) {
        caption = firstSentence.slice(0, 100);
      }
    } else if (itemTexts[0]) {
      caption = itemTexts[0].slice(0, 100);
    }

    slots.push({
      slotId: `slot_${Date.now()}_A`,
      exerciseId,
      label: 'A',
      widthMm: PRINT_TOKENS.imageSlots.readingIllustration.widthMm,
      heightMm: PRINT_TOKENS.imageSlots.readingIllustration.heightMm,
      aspectRatio: '4:3',
      status: 'empty',
      caption,
    });
    return slots;
  }

  return slots;
}

/**
 * Maps exercise characteristics to one of 5 A4 print templates
 */
export function selectLayoutTemplate(
  type: ExerciseType,
  passage: string | undefined,
  imageSlots: ImageSlot[],
  tableData: TableData | undefined
): TemplateLayoutType {
  if (tableData || type === 'listening_table_completion') {
    return 'template_e'; // Image + Table
  }

  if (imageSlots.length > 1 || type === 'matching_pictures') {
    return 'template_b'; // Text + Image Grid
  }

  if (passage && passage.length > 200) {
    return 'template_d'; // Two Columns (Passage + Questions)
  }

  if (imageSlots.length === 1) {
    return 'template_c'; // Text + Single Image
  }

  return 'template_a'; // Text Only
}

/**
 * Parses markdown table into structured TableData
 */
function parseMarkdownTable(lines: string[]): TableData {
  const rows = lines
    .filter((l) => !/^\|[\s\-:]+\|$/.test(l)) // Filter delimiter line
    .map((l) =>
      l
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim())
    );

  const headers = rows[0] || [];
  const bodyRows = rows.slice(1).map((row, rIdx) =>
    row.map((content, cIdx) => ({
      id: `cell_${rIdx}_${cIdx}`,
      content,
      isBlank: content.includes('___') || content.includes('...'),
    }))
  );

  return {
    headers,
    rows: bodyRows,
  };
}
