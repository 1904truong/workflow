import type { ExerciseType, TemplateLayoutType } from '../types';
import { PRINT_TOKENS } from '../tokens/printTokens';

export interface ExerciseTypeMeta {
  type: ExerciseType;
  label: string;
  category: 'Listening' | 'Reading' | 'Grammar & Vocab' | 'Writing';
  defaultTemplate: TemplateLayoutType;
  defaultSlotsCount: number;
  slotPreset?: keyof typeof PRINT_TOKENS.imageSlots;
  description: string;
}

export const EXERCISE_REGISTRY: Record<ExerciseType, ExerciseTypeMeta> = {
  listening_gap_fill: {
    type: 'listening_gap_fill',
    label: 'Listening Fill in the Gap',
    category: 'Listening',
    defaultTemplate: 'template_a',
    defaultSlotsCount: 0,
    slotPreset: 'readingIllustration',
    description: 'Students listen and fill in missing words in a passage or sentences.',
  },
  listening_multiple_choice: {
    type: 'listening_multiple_choice',
    label: 'Listening Multiple Choice',
    category: 'Listening',
    defaultTemplate: 'template_a',
    defaultSlotsCount: 0,
    slotPreset: 'smallMultipleChoice',
    description: 'Multiple-choice questions with text or picture options based on audio.',
  },
  listening_true_false: {
    type: 'listening_true_false',
    label: 'Listening True / False',
    category: 'Listening',
    defaultTemplate: 'template_a',
    defaultSlotsCount: 0,
    description: 'Students decide whether statements are True or False.',
  },
  listening_table_completion: {
    type: 'listening_table_completion',
    label: 'Listening Table Completion',
    category: 'Listening',
    defaultTemplate: 'template_e',
    defaultSlotsCount: 1,
    slotPreset: 'readingIllustration',
    description: 'Listen and complete missing cells in a structured information table.',
  },
  reading_multiple_choice: {
    type: 'reading_multiple_choice',
    label: 'Reading Multiple Choice',
    category: 'Reading',
    defaultTemplate: 'template_d',
    defaultSlotsCount: 1,
    slotPreset: 'readingIllustration',
    description: 'Reading passage accompanied by multiple-choice comprehension questions.',
  },
  true_false_not_given: {
    type: 'true_false_not_given',
    label: 'True / False / Not Given (T/F/NG)',
    category: 'Reading',
    defaultTemplate: 'template_d',
    defaultSlotsCount: 0,
    description: 'Evaluate reading statements as True, False, or Not Given.',
  },
  reading_short_answer: {
    type: 'reading_short_answer',
    label: 'Reading Short Answer',
    category: 'Reading',
    defaultTemplate: 'template_d',
    defaultSlotsCount: 1,
    slotPreset: 'readingIllustration',
    description: 'Passage with questions requiring concise written answers on ruled lines.',
  },
  matching_headings: {
    type: 'matching_headings',
    label: 'Matching Headings / Main Ideas',
    category: 'Reading',
    defaultTemplate: 'template_d',
    defaultSlotsCount: 0,
    description: 'Match paragraphs (A, B, C...) to their correct heading or theme.',
  },
  matching_information: {
    type: 'matching_information',
    label: 'Matching Information',
    category: 'Reading',
    defaultTemplate: 'template_d',
    defaultSlotsCount: 0,
    description: 'Match two groups of related information or facts.',
  },
  matching_vocabulary: {
    type: 'matching_vocabulary',
    label: 'Matching Vocabulary',
    category: 'Grammar & Vocab',
    defaultTemplate: 'template_a',
    defaultSlotsCount: 0,
    description: 'Match target vocabulary words with their corresponding definitions.',
  },
  matching_pictures: {
    type: 'matching_pictures',
    label: 'Matching Pictures',
    category: 'Listening',
    defaultTemplate: 'template_b',
    defaultSlotsCount: 4,
    slotPreset: 'matching',
    description: 'Match descriptive statements or audio cues to a grid of numbered/lettered pictures.',
  },
  grammar_vocab_multiple_choice: {
    type: 'grammar_vocab_multiple_choice',
    label: 'Grammar & Vocabulary Multiple Choice',
    category: 'Grammar & Vocab',
    defaultTemplate: 'template_a',
    defaultSlotsCount: 0,
    description: 'Standard 4-option (A, B, C, D) grammar and vocabulary test questions.',
  },
  gap_filling_word_formation: {
    type: 'gap_filling_word_formation',
    label: 'Gap Filling / Word Formation',
    category: 'Grammar & Vocab',
    defaultTemplate: 'template_a',
    defaultSlotsCount: 0,
    description: 'Fill in missing words, verb tenses, prepositions, or word forms using a word bank.',
  },
  sentence_rearrangement: {
    type: 'sentence_rearrangement',
    label: 'Sentence Rearrangement',
    category: 'Writing',
    defaultTemplate: 'template_a',
    defaultSlotsCount: 0,
    description: 'Unscramble mixed-order words to construct grammatically correct English sentences.',
  },
  sentence_construction: {
    type: 'sentence_construction',
    label: 'Sentence Construction',
    category: 'Writing',
    defaultTemplate: 'template_a',
    defaultSlotsCount: 0,
    description: 'Write complete sentences based on suggested cue words or phrases.',
  },
};

export const TEMPLATE_METADATA: Record<TemplateLayoutType, { name: string; description: string }> = {
  template_a: {
    name: 'Template A — Text Only',
    description: 'Clean single-column layout for text-focused questions, grammar, and writing.',
  },
  template_b: {
    name: 'Template B — Text + Image Grid',
    description: 'Balanced multi-image grid (2 to 6 slots) with descriptive text or matching choices.',
  },
  template_c: {
    name: 'Template C — Text + Single Image',
    description: 'Passage or exercise with a prominent illustration positioned at Top, Left, Right, or Bottom.',
  },
  template_d: {
    name: 'Template D — Two-Column',
    description: 'Side-by-side reading passage / data column and adjacent questions column.',
  },
  template_e: {
    name: 'Template E — Image + Table',
    description: 'Dedicated illustration paired with a structured tabular exercise.',
  },
};
