export type ExerciseType =
  | 'listening_gap_fill'
  | 'listening_multiple_choice'
  | 'listening_true_false'
  | 'listening_table_completion'
  | 'reading_multiple_choice'
  | 'true_false_not_given'
  | 'reading_short_answer'
  | 'matching_headings'
  | 'matching_information'
  | 'matching_vocabulary'
  | 'matching_pictures'
  | 'grammar_vocab_multiple_choice'
  | 'grammar_vocab_cloze'
  | 'gap_filling_word_formation'
  | 'sentence_rearrangement'
  | 'sentence_construction';

export type TemplateLayoutType =
  | 'template_a' // Text Only
  | 'template_b' // Text + Image Grid
  | 'template_c' // Text + Single Image
  | 'template_d' // Two-Column
  | 'template_e'; // Image + Table

export type ImagePosition = 'top' | 'left' | 'right' | 'bottom';

export interface ImageSlot {
  slotId: string;
  exerciseId: string;
  label?: string; // A, B, C...
  widthMm: number;
  heightMm: number;
  aspectRatio: '1:1' | '4:3' | '16:9' | '3:4';
  assetUrl?: string;
  caption?: string;
  status: 'empty' | 'assigned';
  fitMode?: 'contain' | 'cover';
  /** Ảnh do AI tạo: prompt đã dùng, đường dẫn trên Supabase Storage, đang chờ giáo viên duyệt */
  aiPrompt?: string;
  assetStoragePath?: string;
  needsReview?: boolean;
}

export interface ChoiceOption {
  id: string;
  label: string; // A, B, C, D
  text: string;
  imageUrl?: string;
}

export interface TableCell {
  id: string;
  content: string;
  isBlank?: boolean;
  correctAnswer?: string;
}

export interface TableData {
  headers: string[];
  rows: TableCell[][];
}

export interface MatchingPair {
  id: string;
  leftItem: string;
  rightItem: string;
  matchedId?: string;
}

export interface QuestionItem {
  id: string;
  number?: number;
  text: string;
  options?: ChoiceOption[];
  correctAnswer?: string;
  acceptableAnswers?: string[];
  wordBank?: string[];
  mixedWords?: string[];
  givenWords?: string[];
  linesCount?: number;
  points?: number;
  explanation?: string;
}

export interface Exercise {
  id: string;
  type: ExerciseType;
  layoutType: TemplateLayoutType;
  title: string;
  instructions: string;
  passage?: string;
  questions: QuestionItem[];
  imageSlots: ImageSlot[];
  imagePosition?: ImagePosition;
  tableData?: TableData;
  matchingPairs?: MatchingPair[];
  pointsTotal?: number;
  /** Ngắt trang trước bài này (đặt ở Preview & Export) */
  pageBreakBefore?: boolean;
  /** Buộc bài này ở CÙNG TRANG với bài ngay trước (chọn ở Preview & Export > Dồn trang) */
  mergeWithPrevious?: boolean;
  /** Dữ liệu bài Matching (6 layout in được). Có giá trị thì trang in dùng MatchingRenderer. */
  matching?: import('../services/matching/matchingCore').MatchingData;
  /** Dữ liệu bài Multiple Choice Cloze Test (6 layout in được, xem trước thời gian thực). */
  cloze?: import('../services/cloze/clozeCore').ClozeData;
  /** Dữ liệu bài Listening Gap Fill (6 layout in được, xem trước thời gian thực). */
  listeningGapFill?: import('../services/listening/listeningGapFillCore').ListeningGapFillData;
  /** Dữ liệu bài Matching Pictures (6 layout in được, xem trước thời gian thực). */
  matchingPictures?: import('../services/matching-pictures/matchingPicturesCore').MatchingPicturesData;
  /** Dữ liệu bài Matching Vocabulary (hai cột Word / Definition). */
  matchingHeadings?: import('../services/matching-headings/matchingHeadingsCore').MatchingHeadingsData;
  tfng?: import('../services/tfng/tfngCore').TfngData;
  gapFilling?: import('../services/gap-filling/gapFillingCore').GapFillingData;
  matchingVocabulary?: import('../services/matching-vocabulary/matchingVocabularyCore').MatchingVocabularyData;
  /** Dữ liệu bài Listening True / False (câu T/F, audio + QR, ảnh minh họa). */
  listeningTrueFalse?: import('../services/listening-true-false/listeningTrueFalseCore').ListeningTrueFalseData;
  /** Dữ liệu bài Listening Table Completion (bảng điền, ảnh/bản đồ, audio + QR, câu hỏi). */
  listeningTable?: import('../services/listening-table/listeningTableCore').ListeningTableData;
  /** Dữ liệu bài Grammar & Vocabulary Multiple Choice dạng danh sách câu (6 layout in được). */
  grammarMcq?: import('../services/grammar-mcq/grammarMcqCore').GrammarMcqData;
  order: number;
}

export interface PrintSettings {
  paperSize: 'A4';
  orientation: 'portrait';
  widthMm: number;
  heightMm: number;
  marginMm: number;
  printableWidthMm: number;
  printableHeightMm: number;
  showStudentInfo: boolean;
  showEmptyImagePlaceholders: boolean;
  mode: 'student' | 'teacher_key';
  fontSizeBasePt: number;
  lineHeight: number;
  showAnswerKey?: boolean;
  showPlaceholders?: boolean;
  /** Header/footer kiểu phiếu bài tập (logo, QR, mức độ...). Chỉnh ở màn Preview & Export. */
  branding?: import('./branding').WorksheetBranding;
}

export interface ImportMetadata {
  rawText: string;
  importedAt: number;
  warnings?: string[];
  unparsedBlocks?: string[];
  stats?: {
    detectedExercises: number;
    detectedQuestions: number;
    detectedImageSlots: number;
    hasExplicitAnswerKey: boolean;
  };
}

export interface Worksheet {
  id: string;
  title: string;
  unit: string;
  lesson: string;
  gradeLevel: string;
  subject: string;
  schoolName: string;
  teacherName: string;
  totalTimeMinutes?: number;
  totalPoints: number;
  status: 'draft' | 'ready' | 'published';
  printSettings: PrintSettings;
  exercises: Exercise[];
  importMetadata?: ImportMetadata;
  createdAt: number;
  updatedAt: number;
}

export interface LessonFolder {
  id: string;
  name: string; // Folder Name / Main Title
  gradeLevel: string; // e.g. "Grade 7" or "Level B1"
  subject: string; // e.g. "English"
  unitTopic?: string; // e.g. "Unit 5: Nature & Environment"
  lessonTitle?: string; // e.g. "Biodiversity & Habitats"
  description?: string;
  estimatedDuration?: number; // minutes, e.g. 45
  targetSkills?: string[]; // e.g. ["Reading", "Writing", "Vocabulary"]
  coverImage?: string;
  schoolName?: string;
  teacherName?: string;
  totalPoints?: number;
  status: 'draft' | 'ready' | 'published';
  printSettings: PrintSettings;
  exercises: Exercise[];
  importMetadata?: ImportMetadata;
  createdAt: number;
  updatedAt: number;
}

export interface ExportHistoryItem {
  id: string;
  lessonId: string;
  lessonName: string;
  exportType: 'pdf_student' | 'pdf_teacher' | 'docx_student' | 'docx_teacher';
  exportedAt: number;
  fileSizeEstimate?: string;
  exercisesCount: number;
}

/**
 * Normalizes a LessonFolder into a Worksheet structure for A4 print and Word export
 */
export function folderToWorksheet(folder: LessonFolder): Worksheet {
  return {
    id: folder.id,
    title: folder.name || folder.unitTopic || 'ENGLISH WORKSHEET',
    unit: folder.unitTopic || 'UNIT 1',
    lesson: folder.lessonTitle || 'LESSON 1',
    gradeLevel: folder.gradeLevel || 'General',
    subject: folder.subject || 'English',
    schoolName: folder.schoolName || 'Cambridge International Academy',
    teacherName: folder.teacherName || 'English Teacher',
    totalTimeMinutes: folder.estimatedDuration || 45,
    totalPoints: folder.totalPoints || folder.exercises.reduce((s, e) => s + (e.pointsTotal || 0), 0) || 20,
    status: folder.status || 'draft',
    printSettings: folder.printSettings,
    exercises: folder.exercises,
    importMetadata: folder.importMetadata,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
  };
}

