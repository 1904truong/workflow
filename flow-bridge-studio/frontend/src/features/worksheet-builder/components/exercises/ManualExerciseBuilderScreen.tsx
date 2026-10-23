import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, Check, Plus, Trash2, Copy, Search, Sparkles, BookOpen, 
  Headphones, PenTool, Image as ImageIcon, HelpCircle
} from 'lucide-react';
import type { LessonFolder, Exercise, QuestionItem, ExerciseType, TemplateLayoutType } from '../../types';
import { EXERCISE_REGISTRY, TEMPLATE_METADATA } from '../../templates/registry';
import { PRINT_TOKENS } from '../../tokens/printTokens';
import { MatchingEditor } from '../matching/MatchingEditor';
import { ExerciseTypeBar } from './ExerciseTypeBar';
import { MultipleChoiceClozeEditor } from '../cloze/MultipleChoiceClozeEditor';
import { ListeningGapFillEditor } from '../listening/ListeningGapFillEditor';
import { MatchingPicturesEditor } from '../matching-pictures/MatchingPicturesEditor';
import { MatchingHeadingsEditor } from '../matching-headings/MatchingHeadingsEditor';
import { TfngEditor } from '../tfng/TfngEditor';
import { GapFillingEditor } from '../gap-filling/GapFillingEditor';
import { ReadingMcqEditor } from '../reading-mcq/ReadingMcqEditor';
import { ListeningMcqEditor } from '../listening-mcq/ListeningMcqEditor';
import { SmartAddPanel } from './SmartAddPanel';
import type { SmartDraft } from '../../services/smartAdd';
import { MatchingInfoEditor } from '../matching/MatchingInfoEditor';
import { TableSentencesEditor } from '../table-sentences/TableSentencesEditor';
import { SentenceCompletionEditor } from '../sentence-completion/SentenceCompletionEditor';
import { MatchingVocabularyEditor } from '../matching-vocabulary/MatchingVocabularyEditor';
import { ListeningTrueFalseEditor } from '../listening-true-false/ListeningTrueFalseEditor';
import { ListeningMatchingEditor } from '../listening-matching/ListeningMatchingEditor';
import { ListeningTableEditor } from '../listening-table/ListeningTableEditor';
import { GrammarMcqEditor } from '../grammar-mcq/GrammarMcqEditor';
import type { MatchingData } from '../../services/matching/matchingCore';
import { createMatching, validateMatching } from '../../services/matching/matchingCore';

interface ManualExerciseBuilderScreenProps {
  folder: LessonFolder;
  editingExercise?: Exercise | null;
  /** Dạng bài chọn sẵn từ menu Add Exercise: bỏ qua bước chọn dạng bài */
  initialType?: ExerciseType;
  onSaveExercise: (exercise: Exercise, nextAction: 'return' | 'add_another' | 'stay') => void;
  onCancel: () => void;
  onDeleteExercise?: (exerciseId: string) => void;
}

export const ManualExerciseBuilderScreen: React.FC<ManualExerciseBuilderScreenProps> = ({
  folder,
  editingExercise,
  initialType,
  onSaveExercise,
  onCancel,
  onDeleteExercise,
}) => {
  // If editing an existing exercise, start directly in editor mode; otherwise start in type selection
  const [step, setStep] = useState<'select_type' | 'editor'>(editingExercise ? 'editor' : 'select_type');
  /** Bản nháp từ Smart (Add exercise): trình soạn dạng bài tương ứng mở với nội dung điền sẵn */
  const [smartDraft, setSmartDraft] = useState<SmartDraft | null>(null);
  
  // Exercise state
  const [exerciseType, setExerciseType] = useState<ExerciseType>(
    editingExercise?.type || 'grammar_vocab_multiple_choice'
  );
  const [title, setTitle] = useState<string>(
    editingExercise?.title || `Exercise ${folder.exercises.length + 1}: Multiple Choice`
  );
  const [instructions, setInstructions] = useState<string>(
    editingExercise?.instructions || 'Choose the correct answer (A, B, C or D) to complete each sentence.'
  );
  const [layoutType, setLayoutType] = useState<TemplateLayoutType>(
    editingExercise?.layoutType || 'template_a'
  );
  const [passage, setPassage] = useState<string>(editingExercise?.passage || '');

  // Questions
  const [questions, setQuestions] = useState<QuestionItem[]>(
    editingExercise?.questions || [
      {
        id: `q_${Date.now()}_1`,
        number: 1,
        text: 'The scientist observed the animal behavior in its natural ________.',
        options: [
          { id: 'opt_1', label: 'A', text: 'habitat' },
          { id: 'opt_2', label: 'B', text: 'atmosphere' },
          { id: 'opt_3', label: 'C', text: 'climate' },
          { id: 'opt_4', label: 'D', text: 'weather' },
        ],
        correctAnswer: 'A',
        points: 1,
      },
    ]
  );

  // Matching Information / Draw Lines: dữ liệu 7 layout. Bài cũ chưa có thì dựng từ danh sách câu hỏi.
  const [matching, setMatching] = useState<MatchingData | undefined>(
    editingExercise?.matching ??
      (editingExercise?.type === 'matching_information' || editingExercise?.type === 'draw_lines_match'
        ? createMatching({
            layout: editingExercise?.type === 'draw_lines_match' ? 'facing_tables' : 'two_columns',
            problems: editingExercise.questions.map((q) => ({ id: q.id, text: q.text })),
          })
        : undefined)
  );
  const isMatchingInfo = exerciseType === 'matching_information';

  // Image slots
  const [imageSlots, setImageSlots] = useState(editingExercise?.imageSlots || []);

  // Search & categories for step 1
  const [typeSearch, setTypeSearch] = useState('');
  const [ribbonSlot, setRibbonSlot] = useState<HTMLDivElement | null>(null);
  const [typeCategory, setTypeCategory] = useState<string>('all');

  const categories = useMemo(() => {
    const all = Object.values(EXERCISE_REGISTRY).filter((m) => !m.hidden);
    const count = (cat: string) => all.filter((m) => m.category === cat).length;
    return [
      { id: 'all', label: `All (${all.length})` },
      { id: 'Listening', label: `Listening (${count('Listening')})`, icon: Headphones },
      { id: 'Reading', label: `Reading (${count('Reading')})`, icon: BookOpen },
      { id: 'Grammar & Vocab', label: `Grammar & Vocab (${count('Grammar & Vocab')})`, icon: Sparkles },
      { id: 'Writing', label: `Writing (${count('Writing')})`, icon: PenTool },
    ];
  }, []);

  const handleSelectType = (type: ExerciseType) => {
    const meta = EXERCISE_REGISTRY[type];
    setExerciseType(type);
    const defaultTitle = type === 'draw_lines_match' ? 'DRAW LINES AND MATCH' : type === 'reading_comic' ? 'READ AND ANSWER THE QUESTIONS' : `Exercise ${folder.exercises.length + 1}: ${meta?.label || 'New Exercise'}`;
    const defaultInstr = type === 'draw_lines_match' ? 'Draw lines to match the questions with the correct answers.' : type === 'reading_comic' ? 'Look at the pictures and answer the questions.' : (meta?.description || 'Answer the questions according to instructions.');
    setTitle(defaultTitle);
    setInstructions(defaultInstr);
    setLayoutType(meta?.defaultTemplate || 'template_a');
    if (type === 'matching_information' || type === 'draw_lines_match') {
      setMatching((m) => m ?? createMatching({
        layout: type === 'draw_lines_match' ? 'facing_tables' : 'two_columns',
      }));
    }
    setStep('editor');
  };

  useEffect(() => {
    if (initialType && !editingExercise) handleSelectType(initialType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Question CRUD
  const handleAddQuestion = () => {
    const nextNum = questions.length + 1;
    const isMC = exerciseType.includes('multiple_choice') || exerciseType === 'true_false_not_given';

    const newQ: QuestionItem = {
      id: `q_${Date.now()}_${nextNum}`,
      number: nextNum,
      text: `Question ${nextNum} text...`,
      options: isMC
        ? exerciseType === 'true_false_not_given'
          ? [
              { id: 'opt_1', label: 'T', text: 'True' },
              { id: 'opt_2', label: 'F', text: 'False' },
              { id: 'opt_3', label: 'NG', text: 'Not Given' },
            ]
          : [
              { id: 'opt_1', label: 'A', text: 'Option A' },
              { id: 'opt_2', label: 'B', text: 'Option B' },
              { id: 'opt_3', label: 'C', text: 'Option C' },
              { id: 'opt_4', label: 'D', text: 'Option D' },
            ]
        : undefined,
      correctAnswer: '',
      points: 1,
    };
    setQuestions([...questions, newQ]);
  };

  const handleDuplicateQuestion = (idx: number) => {
    const target = questions[idx];
    const duplicated: QuestionItem = {
      ...target,
      id: `q_${Date.now()}_dup`,
      number: questions.length + 1,
      options: target.options ? [...target.options] : undefined,
    };
    setQuestions([...questions, duplicated]);
  };

  const handleRemoveQuestion = (idx: number) => {
    if (questions.length <= 1) {
      alert('An exercise must have at least one question.');
      return;
    }
    const updated = questions.filter((_, i) => i !== idx).map((q, i) => ({ ...q, number: i + 1 }));
    setQuestions(updated);
  };

  const handleUpdateQuestion = (idx: number, field: keyof QuestionItem, val: any) => {
    const updated = [...questions];
    updated[idx] = { ...updated[idx], [field]: val };
    setQuestions(updated);
  };

  const handleUpdateOption = (qIdx: number, optIdx: number, text: string) => {
    const q = questions[qIdx];
    if (!q.options) return;
    const updatedOptions = [...q.options];
    updatedOptions[optIdx] = { ...updatedOptions[optIdx], text };
    handleUpdateQuestion(qIdx, 'options', updatedOptions);
  };

  // Image slots handlers
  const handleAddSlot = () => {
    const nextChar = String.fromCharCode(65 + imageSlots.length);
    const newSlot = {
      slotId: `slot_${Date.now()}_${nextChar}`,
      exerciseId: editingExercise?.id || 'new_ex',
      label: nextChar,
      widthMm: PRINT_TOKENS.imageSlots.matching.widthMm,
      heightMm: PRINT_TOKENS.imageSlots.matching.heightMm,
      aspectRatio: '4:3' as const,
      status: 'empty' as const,
      caption: `Picture ${nextChar}`,
    };
    setImageSlots([...imageSlots, newSlot]);
  };

  const handleRemoveSlot = (idx: number) => {
    setImageSlots(imageSlots.filter((_, i) => i !== idx));
  };

  // Build final Exercise object and submit
  const handleSave = (nextAction: 'return' | 'add_another' | 'stay') => {
    if (isMatchingInfo && matching) {
      const v = validateMatching(matching);
      if (v.errors.length > 0) {
        window.alert('Chưa lưu được bài Matching:\n\n• ' + v.errors.join('\n• '));
        return;
      }
    }
    const finalExercise: Exercise = {
      id: editingExercise?.id || `ex_${Date.now()}`,
      type: exerciseType,
      layoutType,
      title: title.trim() || 'Exercise',
      instructions: instructions.trim(),
      passage: passage.trim() || undefined,
      questions: isMatchingInfo && matching
        ? matching.problems.map((p, i) => ({ id: p.id, number: i + 1, text: p.text, points: 1 }))
        : questions,
      imageSlots: isMatchingInfo ? [] : imageSlots,
      matching: isMatchingInfo ? matching : undefined,
      pointsTotal: isMatchingInfo && matching ? matching.problems.length : questions.reduce((s, q) => s + (q.points || 1), 0),
      order: editingExercise?.order || folder.exercises.length + 1,
    };

    onSaveExercise(finalExercise, nextAction);

    if (nextAction === 'add_another') {
      // Reset form for next exercise
      setTitle(`Exercise ${folder.exercises.length + 2}: Multiple Choice`);
      setQuestions([
        {
          id: `q_${Date.now()}_1`,
          number: 1,
          text: 'Enter question sentence here...',
          options: [
            { id: 'opt_1', label: 'A', text: 'Option A' },
            { id: 'opt_2', label: 'B', text: 'Option B' },
            { id: 'opt_3', label: 'C', text: 'Option C' },
            { id: 'opt_4', label: 'D', text: 'Option D' },
          ],
          correctAnswer: '',
          points: 1,
        },
      ]);
      setImageSlots([]);
      setPassage('');
      setStep('select_type');
    }
  };

  const filteredTypes = Object.values(EXERCISE_REGISTRY).filter((meta) => !meta.hidden).filter((meta) => {
    const matchesCategory = typeCategory === 'all' || meta.category === typeCategory;
    const matchesSearch =
      typeSearch.trim() === '' ||
      meta.label.toLowerCase().includes(typeSearch.toLowerCase()) ||
      meta.description.toLowerCase().includes(typeSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Bài Grammar & Vocabulary MC cũ có đoạn văn (Wall Street…) mở bằng trình soạn Cloze; bài mới dạng danh sách câu dùng trình soạn riêng
  const isCloze =
    exerciseType === 'grammar_vocab_cloze' ||
    editingExercise?.cloze !== undefined ||
    (exerciseType === 'grammar_vocab_multiple_choice' && !!editingExercise && editingExercise.grammarMcq === undefined && !!editingExercise.passage?.trim());
  const isPronunciation = exerciseType === 'pronunciation_multiple_choice' || editingExercise?.grammarMcq?.pronunciation === true;
  const sentenceMode: 'rearrange' | 'construct' | undefined = exerciseType === 'sentence_rearrangement' ? 'rearrange' : exerciseType === 'sentence_construction' ? 'construct' : editingExercise?.grammarMcq?.sentenceMode;
  const isGrammarMcq = !isCloze && (exerciseType === 'grammar_vocab_multiple_choice' || isPronunciation || !!sentenceMode || editingExercise?.grammarMcq !== undefined);
  const isListeningGapFill = exerciseType === 'listening_gap_fill' || (editingExercise?.listeningGapFill !== undefined);
  const isMatchingPictures = exerciseType === 'matching_pictures' || (editingExercise?.matchingPictures !== undefined);
  const isListeningTable = exerciseType === 'listening_table_completion' || (editingExercise?.listeningTable !== undefined);
  const isListeningMatching = exerciseType === 'listening_matching' || (editingExercise?.listeningMatching !== undefined);
  const isListeningTrueFalse = exerciseType === 'listening_true_false' || (editingExercise?.listeningTrueFalse !== undefined);
  const isMatchingHeadings = exerciseType === 'matching_headings' || (editingExercise?.matchingHeadings !== undefined);
  const isTfng = exerciseType === 'true_false_not_given' || (editingExercise?.tfng !== undefined);
  const isGapFilling = exerciseType === 'gap_filling_word_formation' || (editingExercise?.gapFilling !== undefined);
  const isListeningMcq = exerciseType === 'listening_multiple_choice' || (editingExercise?.listeningMcq !== undefined);
  const isReadingMcq = exerciseType === 'reading_multiple_choice' || exerciseType === 'reading_short_answer' || exerciseType === 'reading_comic' || (editingExercise?.readingMcq !== undefined);
  const isSentenceCompletion = exerciseType === 'sentence_completion' || (editingExercise?.sentenceCompletion !== undefined);
  const isDrawLines = exerciseType === 'draw_lines_match' || editingExercise?.type === 'draw_lines_match';
  const isMatchingInfoNew = exerciseType === 'matching_information' || editingExercise?.type === 'matching_information';
  const isTableSentences = exerciseType === 'table_sentences' || (editingExercise?.tableSentences !== undefined);
  const isMatchingVocabulary = exerciseType === 'matching_vocabulary' || (editingExercise?.matchingVocabulary !== undefined);

  // Dòng "Dạng bài" trên cùng mọi trình soạn: đổi dạng được khi bài chưa làm, khóa khi bài đã lưu
  const handleChangeType = (type: ExerciseType) => {
    if (type === exerciseType) return;
    if (!window.confirm('Đổi dạng bài sẽ bỏ nội dung đang soạn của bài này. Tiếp tục?')) return;
    handleSelectType(type);
  };
  const withTypeBar = (editor: React.ReactNode) => (
    <div key={exerciseType} className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
      <ExerciseTypeBar currentType={exerciseType} locked={!!editingExercise} onChange={handleChangeType} />
      {editor}
    </div>
  );

  if (step === 'editor' && isGrammarMcq) {
    return withTypeBar(
      <GrammarMcqEditor
        pronunciation={isPronunciation}
        sentenceMode={sentenceMode}
        folder={folder}
        editingExercise={editingExercise}
        onSaveExercise={onSaveExercise}
        onCancel={!editingExercise ? () => setStep('select_type') : onCancel}
        onDeleteExercise={onDeleteExercise}
      />
    );
  }

  if (step === 'editor' && isCloze) {
    return withTypeBar(
      <MultipleChoiceClozeEditor
        folder={folder}
        editingExercise={editingExercise}
        onSaveExercise={onSaveExercise}
        onCancel={!editingExercise ? () => setStep('select_type') : onCancel}
        onDeleteExercise={onDeleteExercise}
      />
    );
  }

  if (step === 'editor' && isListeningGapFill) {
    return withTypeBar(
      <ListeningGapFillEditor
        folder={folder}
        editingExercise={editingExercise}
        onSaveExercise={onSaveExercise}
        onCancel={!editingExercise ? () => setStep('select_type') : onCancel}
        onDeleteExercise={onDeleteExercise}
      />
    );
  }

  if (step === 'editor' && isListeningTable) {
    return withTypeBar(
      <ListeningTableEditor
        folder={folder}
        editingExercise={editingExercise}
        onSaveExercise={onSaveExercise}
        onCancel={!editingExercise ? () => setStep('select_type') : onCancel}
        onDeleteExercise={onDeleteExercise}
      />
    );
  }

  if (step === 'editor' && isListeningMatching) {
    return withTypeBar(
      <ListeningMatchingEditor
        folder={folder}
        editingExercise={editingExercise}
        onSaveExercise={onSaveExercise}
        onCancel={!editingExercise ? () => setStep('select_type') : onCancel}
        onDeleteExercise={onDeleteExercise}
      />
    );
  }

  if (step === 'editor' && (isDrawLines || isMatchingInfoNew)) {
    const variant = isDrawLines ? 'draw_lines_match' : 'matching_information';
    return withTypeBar(
      <MatchingInfoEditor
        key={variant}
        variant={variant}
        folder={folder}
        editingExercise={editingExercise}
        onSaveExercise={onSaveExercise}
        onCancel={!editingExercise ? () => setStep('select_type') : onCancel}
        onDeleteExercise={onDeleteExercise}
      />
    );
  }

  if (step === 'editor' && isTableSentences) {
    return withTypeBar(
      <TableSentencesEditor
        folder={folder}
        editingExercise={editingExercise}
        onSaveExercise={onSaveExercise}
        onCancel={!editingExercise ? () => setStep('select_type') : onCancel}
        onDeleteExercise={onDeleteExercise}
      />
    );
  }

  if (step === 'editor' && isListeningTrueFalse) {
    return withTypeBar(
      <ListeningTrueFalseEditor
        folder={folder}
        editingExercise={editingExercise}
        onSaveExercise={onSaveExercise}
        onCancel={!editingExercise ? () => setStep('select_type') : onCancel}
        onDeleteExercise={onDeleteExercise}
      />
    );
  }

  if (step === 'editor' && isMatchingHeadings) {
    return withTypeBar(
      <MatchingHeadingsEditor
        folder={folder}
        editingExercise={editingExercise}
        onSaveExercise={onSaveExercise}
        onCancel={!editingExercise ? () => setStep('select_type') : onCancel}
        onDeleteExercise={onDeleteExercise}
      />
    );
  }

  if (step === 'editor' && isTfng) {
    return withTypeBar(
      <TfngEditor
        folder={folder}
        editingExercise={editingExercise}
        onSaveExercise={onSaveExercise}
        onCancel={!editingExercise ? () => setStep('select_type') : onCancel}
        onDeleteExercise={onDeleteExercise}
      />
    );
  }

  if (step === 'editor' && isGapFilling) {
    return withTypeBar(
      <GapFillingEditor
        folder={folder}
        editingExercise={editingExercise}
        onSaveExercise={onSaveExercise}
        onCancel={!editingExercise ? () => setStep('select_type') : onCancel}
        onDeleteExercise={onDeleteExercise}
      />
    );
  }

  if (step === 'editor' && isListeningMcq) {
    return withTypeBar(
      <ListeningMcqEditor
        folder={folder}
        editingExercise={editingExercise}
        onSaveExercise={onSaveExercise}
        onCancel={!editingExercise ? () => setStep('select_type') : onCancel}
        onDeleteExercise={onDeleteExercise}
      />
    );
  }

  if (step === 'editor' && isReadingMcq) {
    return withTypeBar(
      <ReadingMcqEditor
        shortAnswer={exerciseType === 'reading_short_answer' || exerciseType === 'reading_comic' || editingExercise?.readingMcq?.shortAnswer === true}
        comic={exerciseType === 'reading_comic' || editingExercise?.type === 'reading_comic'}
        folder={folder}
        editingExercise={editingExercise}
        onSaveExercise={onSaveExercise}
        onCancel={!editingExercise ? () => setStep('select_type') : onCancel}
        onDeleteExercise={onDeleteExercise}
      />
    );
  }

  if (step === 'editor' && isSentenceCompletion) {
    return withTypeBar(
      <SentenceCompletionEditor
        folder={folder}
        editingExercise={editingExercise}
        onSaveExercise={onSaveExercise}
        onCancel={!editingExercise ? () => setStep('select_type') : onCancel}
        onDeleteExercise={onDeleteExercise}
        draft={smartDraft?.type === 'sentence_completion' ? smartDraft.data : undefined}
      />
    );
  }

  if (step === 'editor' && isMatchingVocabulary) {
    return withTypeBar(
      <MatchingVocabularyEditor
        folder={folder}
        editingExercise={editingExercise}
        onSaveExercise={onSaveExercise}
        onCancel={!editingExercise ? () => setStep('select_type') : onCancel}
        onDeleteExercise={onDeleteExercise}
      />
    );
  }

  if (step === 'editor' && isMatchingPictures) {
    return withTypeBar(
      <MatchingPicturesEditor
        folder={folder}
        editingExercise={editingExercise}
        onSaveExercise={onSaveExercise}
        onCancel={!editingExercise ? () => setStep('select_type') : onCancel}
        onDeleteExercise={onDeleteExercise}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 select-text">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-2">
          <button
            onClick={step === 'editor' && !editingExercise ? () => setStep('select_type') : onCancel}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1 transition-colors mr-2"
          >
            <ArrowLeft size={13} /> {step === 'editor' && !editingExercise ? 'Change Type' : `Back to ${folder.name}`}
          </button>
          <span className="text-slate-300">|</span>
          <span className="text-xs font-bold text-slate-800">
            {editingExercise ? 'Edit Exercise' : 'Add Exercise to:'} <strong>{folder.name}</strong>
          </span>
        </div>

        {step === 'editor' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSave('stay')}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
            >
              Save Draft
            </button>
            <button
              onClick={() => handleSave('add_another')}
              className="px-3.5 py-1.5 bg-white border border-slate-200 hover:border-blue-400 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <Plus size={13} /> Save & Add Another
            </button>
            <button
              onClick={() => handleSave('return')}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm shadow-blue-500/20 transition-all active:scale-95"
            >
              <Check size={14} /> Save & Return to Folder
            </button>
          </div>
        )}
      </div>

      {/* Thanh công cụ (Matching Information) – MatchingEditor đưa vào đây bằng portal */}
      {step === 'editor' && isMatchingInfo && <div ref={setRibbonSlot} className="shrink-0" />}

      {/* STEP 1: SELECT EXERCISE TYPE */}
      {step === 'select_type' && (
        <div className="flex-1 overflow-y-auto p-6 md:p-8 max-w-5xl w-full mx-auto space-y-6">
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">
              Select Exercise Format
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Choose one of the 15 standard English exercise types. The editor will automatically configure matching layout and input fields.
            </p>
          </div>

          <SmartAddPanel
            onAnalyzed={(type, draft) => {
              setSmartDraft(draft);
              handleSelectType(type);
            }}
          />

          {/* Search & Categories Filter */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={typeSearch}
                onChange={(e) => setTypeSearch(e.target.value)}
                placeholder="Search formats (e.g. gap fill, matching, reading, true/false)..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
                autoFocus
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setTypeCategory(c.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    typeCategory === c.id
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Exercise Types Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredTypes.map((meta) => {
              const layout = TEMPLATE_METADATA[meta.defaultTemplate];

              return (
                <button
                  key={meta.type}
                  onClick={() => handleSelectType(meta.type)}
                  className="group text-left p-4 rounded-2xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-md hover:shadow-blue-500/5 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          meta.category === 'Listening'
                            ? 'bg-purple-100 text-purple-700'
                            : meta.category === 'Reading'
                            ? 'bg-emerald-100 text-emerald-700'
                            : meta.category === 'Writing'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {meta.category}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {layout?.name.split('—')[1] || meta.defaultTemplate}
                      </span>
                    </div>

                    <h3 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {meta.label}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed line-clamp-2">
                      {meta.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Default slots: {meta.defaultSlotsCount}</span>
                    <span className="text-blue-600 font-bold group-hover:translate-x-0.5 transition-transform">
                      Configure →
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 2: CONTENT EDITOR */}
      {step === 'editor' && (
        <div className={`flex-1 overflow-y-auto p-6 md:p-8 w-full mx-auto space-y-6 ${isMatchingInfo ? 'max-w-[1400px]' : 'max-w-4xl'}`}>
          {/* Exercise Info Card */}
          {!isMatchingInfo && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                <Sparkles size={14} className="text-blue-600" />
                Exercise Details & Instructions
              </span>
              <span className="text-[11px] font-semibold text-slate-400">
                Type: {EXERCISE_REGISTRY[exerciseType]?.label || exerciseType}
              </span>
            </div>

            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-8">
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Exercise Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                />
              </div>

              <div className="col-span-4">
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  A4 Print Layout Template
                </label>
                <select
                  value={layoutType}
                  onChange={(e) => setLayoutType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                >
                  <option value="template_a">Template A — Text Only</option>
                  <option value="template_b">Template B — Text + Image Grid</option>
                  <option value="template_c">Template C — Text + Single Image</option>
                  <option value="template_d">Template D — Two Columns</option>
                  <option value="template_e">Template E — Image + Table</option>
                </select>
              </div>

              <div className="col-span-12">
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Student Instructions
                </label>
                <input
                  type="text"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs italic text-slate-800"
                />
              </div>
            </div>
          </div>
          )}

          {isMatchingInfo && matching ? (
            <MatchingEditor
              value={matching}
              onChange={setMatching}
              onTitleDetected={(detected) => setInstructions(detected)}
              title={title}
              setTitle={setTitle}
              instructions={instructions}
              setInstructions={setInstructions}
              ribbonSlot={ribbonSlot}
              shell={{
                onSave: () => handleSave('stay'),
                onSaveAndAdd: () => handleSave('add_another'),
                onSaveAndReturn: () => handleSave('return'),
                onBack: step === 'editor' && !editingExercise ? () => setStep('select_type') : onCancel,
              }}
            />
          ) : (
          <>
          {/* Reading Passage (if reading or two-column) */}
          {(exerciseType.includes('reading') || layoutType === 'template_d') && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                  <BookOpen size={14} className="text-blue-600" />
                  Reading Passage / Context
                </span>
                <span className="text-xs text-slate-400">{passage.length} chars</span>
              </div>
              <textarea
                rows={5}
                value={passage}
                onChange={(e) => setPassage(e.target.value)}
                placeholder="Paste or write the reading text here. It will be formatted into a clean reading column on the A4 page..."
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs leading-relaxed text-slate-800 font-sans"
              />
            </div>
          )}

          {/* Image Slots Manager Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                <ImageIcon size={14} className="text-blue-600" />
                Image Placeholders ({imageSlots.length})
              </span>
              <button
                type="button"
                onClick={handleAddSlot}
                className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100 flex items-center gap-1"
              >
                <Plus size={12} /> Add Image Slot
              </button>
            </div>

            {imageSlots.length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                No image slots reserved for this exercise. (Click &apos;+ Add Image Slot&apos; if needed)
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {imageSlots.map((slot, sIdx) => (
                  <div
                    key={slot.slotId}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        Picture {slot.label || sIdx + 1}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {slot.widthMm} × {slot.heightMm} mm
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveSlot(sIdx)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Questions List Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                <HelpCircle size={14} className="text-blue-600" />
                Exercise Questions ({questions.length})
              </span>
              <button
                type="button"
                onClick={handleAddQuestion}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm"
              >
                <Plus size={13} /> Add Question
              </button>
            </div>

            <div className="space-y-4">
              {questions.map((q, qIdx) => (
                <div
                  key={q.id}
                  className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 flex-1">
                      <span className="w-6 h-6 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                        {q.number || qIdx + 1}
                      </span>
                      <textarea
                        rows={2}
                        value={q.text}
                        onChange={(e) => handleUpdateQuestion(qIdx, 'text', e.target.value)}
                        placeholder="Enter question text or sentence with gap..."
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 resize-none"
                      />
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDuplicateQuestion(qIdx)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded"
                        title="Duplicate question"
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveQuestion(qIdx)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded"
                        title="Remove question"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Multiple Choice Options */}
                  {q.options && q.options.length > 0 && (
                    <div className="pl-8 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.options.map((opt, optIdx) => (
                        <div key={opt.id} className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-500 w-4">
                            {opt.label}.
                          </span>
                          <input
                            type="text"
                            value={opt.text}
                            onChange={(e) => handleUpdateOption(qIdx, optIdx, e.target.value)}
                            className="flex-1 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                          />
                        </div>
                      ))}
                    </div>
                  )}


                </div>
              ))}
            </div>
          </div>
          </>
          )}
        </div>
      )}
    </div>
  );
};
