import { 
  Plus, Trash2, Layout, BookOpen, 
  HelpCircle, ArrowRight
} from 'lucide-react';
import type { Exercise, QuestionItem, ExerciseType, TemplateLayoutType } from '../../types';
import { EXERCISE_REGISTRY, TEMPLATE_METADATA } from '../../templates/registry';

interface ContentEditorTabProps {
  exercise: Exercise | null;
  onUpdateExercise: (exercise: Exercise) => void;
  onNavigateToAnswerKey: () => void;
  onNavigateToImages: () => void;
}

export const ContentEditorTab = ({
  exercise,
  onUpdateExercise,
  onNavigateToAnswerKey,
  onNavigateToImages,
}: ContentEditorTabProps) => {
  if (!exercise) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-6 text-center bg-white rounded-2xl border border-slate-200 mt-8">
        <BookOpen size={48} className="mb-3 text-slate-300 mx-auto" />
        <h3 className="font-bold text-slate-700 text-base">No Exercise Selected</h3>
        <p className="text-xs text-slate-400 mt-1">Please select or add an exercise from the Exercises tab first.</p>
      </div>
    );
  }

  const handleFieldChange = (field: keyof Exercise, value: any) => {
    onUpdateExercise({ ...exercise, [field]: value });
  };

  const handleAddQuestion = () => {
    const nextNum = exercise.questions.length + 1;
    const newQuestion: QuestionItem = {
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      number: nextNum,
      text: 'Enter question description...',
      options: [
        { id: `opt_${Date.now()}_a`, label: 'A', text: 'Option A' },
        { id: `opt_${Date.now()}_b`, label: 'B', text: 'Option B' },
        { id: `opt_${Date.now()}_c`, label: 'C', text: 'Option C' },
        { id: `opt_${Date.now()}_d`, label: 'D', text: 'Option D' },
      ],
      correctAnswer: 'A',
      linesCount: 2,
    };
    onUpdateExercise({
      ...exercise,
      questions: [...exercise.questions, newQuestion],
    });
  };

  const handleRemoveQuestion = (qIndex: number) => {
    const updated = exercise.questions.filter((_, idx) => idx !== qIndex);
    onUpdateExercise({ ...exercise, questions: updated });
  };

  const handleUpdateQuestion = (qIndex: number, field: keyof QuestionItem, value: any) => {
    const updated = [...exercise.questions];
    updated[qIndex] = { ...updated[qIndex], [field]: value };
    onUpdateExercise({ ...exercise, questions: updated });
  };

  const handleUpdateOption = (qIndex: number, optIndex: number, newText: string) => {
    const updated = [...exercise.questions];
    const opts = [...(updated[qIndex].options || [])];
    opts[optIndex] = { ...opts[optIndex], text: newText };
    updated[qIndex] = { ...updated[qIndex], options: opts };
    onUpdateExercise({ ...exercise, questions: updated });
  };

  const isReadingType = 
    exercise.type.includes('reading') || 
    exercise.type === 'true_false_not_given' ||
    exercise.type === 'matching_headings';

  const isMultipleChoice =
    exercise.type.includes('multiple_choice');

  const isRuledLinesType =
    exercise.type === 'reading_short_answer' ||
    exercise.type === 'reading_comic' ||
    exercise.type === 'sentence_construction' ||
    exercise.type === 'sentence_rearrangement';

  return (
    <div className="max-w-4xl mx-auto py-8 px-6 space-y-6">
      {/* Top Header */}
      <div className="flex justify-between items-start">
        <div>
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
            Step 3 · Content Authoring
          </span>
          <h2 className="text-2xl font-bold text-slate-900 mt-1">Exercise Content & Questions</h2>
          <p className="text-xs text-slate-500 mt-1">
            Edit instructions, reading source passage, question items, and multiple-choice options.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {exercise.imageSlots.length > 0 && (
            <button
              onClick={onNavigateToImages}
              className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors"
            >
              Image Manager ({exercise.imageSlots.length})
            </button>
          )}

          <button
            onClick={onNavigateToAnswerKey}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-blue-500/20 flex items-center gap-1.5 transition-all"
          >
            <span>Proceed to Answer Key</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Primary Exercise Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-8">
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
              Exercise Heading / Label
            </label>
            <input
              type="text"
              value={exercise.title}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              placeholder="e.g. PART 1: READING COMPREHENSION"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div className="col-span-4">
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
              Exercise Type
            </label>
            <select
              value={exercise.type}
              onChange={(e) => {
                const newType = e.target.value as ExerciseType;
                const meta = EXERCISE_REGISTRY[newType];
                onUpdateExercise({
                  ...exercise,
                  type: newType,
                  layoutType: meta?.defaultTemplate || exercise.layoutType,
                });
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
            >
              {Object.entries(EXERCISE_REGISTRY).map(([typeKey, meta]) => (
                <option key={typeKey} value={typeKey}>
                  {meta.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Compact Layout Selector */}
        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
              <Layout size={13} className="text-blue-600" />
              Compact Print Layout Selector
            </label>
            <span className="text-[11px] text-slate-400 font-medium">
              Active: {TEMPLATE_METADATA[exercise.layoutType]?.name}
            </span>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {(
              [
                { id: 'template_a', label: 'Text Only' },
                { id: 'template_b', label: 'Text + Image Grid' },
                { id: 'template_c', label: 'Text + Single Image' },
                { id: 'template_d', label: 'Two Columns' },
                { id: 'template_e', label: 'Image + Table' },
              ] as Array<{ id: TemplateLayoutType; label: string }>
            ).map((tmpl) => (
              <button
                key={tmpl.id}
                onClick={() => handleFieldChange('layoutType', tmpl.id)}
                className={`py-2 px-2.5 rounded-xl border text-center transition-all text-xs font-bold truncate ${
                  exercise.layoutType === tmpl.id
                    ? 'border-blue-500 bg-blue-50/50 text-blue-700 shadow-xs ring-1 ring-blue-500/20'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-700'
                }`}
              >
                {tmpl.label}
              </button>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
            Student Instructions
          </label>
          <input
            type="text"
            value={exercise.instructions}
            onChange={(e) => handleFieldChange('instructions', e.target.value)}
            placeholder="e.g. Read the text carefully and circle the best answer (A, B, C, or D)..."
            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 italic"
          />
        </div>

        {/* Reading Passage if applicable */}
        {(isReadingType || exercise.layoutType === 'template_d' || exercise.layoutType === 'template_c') && (
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                <BookOpen size={13} className="text-blue-600" />
                Reading Passage / Source Text
              </label>
              <span className="text-[11px] text-slate-400">
                {exercise.passage?.length || 0} characters
              </span>
            </div>
            <textarea
              rows={6}
              value={exercise.passage || ''}
              onChange={(e) => handleFieldChange('passage', e.target.value)}
              placeholder="Paste or write the reading comprehension passage here..."
              className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs leading-relaxed text-slate-900 resize-y focus:bg-white focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}
      </div>

      {/* Questions List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <HelpCircle size={16} className="text-blue-600" />
              Questions ({exercise.questions.length})
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Set question prompts and answer choices. Correct answer keys can be reviewed in Tab 4.
            </p>
          </div>

          <button
            onClick={handleAddQuestion}
            className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Plus size={14} /> Add Question
          </button>
        </div>

        <div className="space-y-4">
          {exercise.questions.map((q, qIdx) => (
            <div
              key={q.id}
              className="p-4 bg-slate-50/60 border border-slate-200 rounded-2xl space-y-3"
            >
              {/* Question text & delete */}
              <div className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  {q.number || qIdx + 1}
                </span>

                <input
                  type="text"
                  value={q.text}
                  onChange={(e) => handleUpdateQuestion(qIdx, 'text', e.target.value)}
                  placeholder="Enter question text..."
                  className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                />

                <button
                  onClick={() => handleRemoveQuestion(qIdx)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded"
                  title="Remove question"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Multiple Choice Options (A, B, C, D) */}
              {isMultipleChoice && q.options && (
                <div className="pl-8 grid grid-cols-2 gap-2">
                  {q.options.map((opt, optIdx) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <span className="w-5 text-center text-xs font-bold text-slate-500">
                        {opt.label}.
                      </span>
                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => handleUpdateOption(qIdx, optIdx, e.target.value)}
                        placeholder={`Option ${opt.label}...`}
                        className="flex-1 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Ruled lines for short answer */}
              {isRuledLinesType && (
                <div className="pl-8 flex items-center gap-2 text-xs text-slate-600">
                  <span>Number of ruled writing lines:</span>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={q.linesCount || 2}
                    onChange={(e) => handleUpdateQuestion(qIdx, 'linesCount', Number(e.target.value))}
                    className="w-14 px-2 py-0.5 border border-slate-200 rounded text-center font-bold bg-white"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
