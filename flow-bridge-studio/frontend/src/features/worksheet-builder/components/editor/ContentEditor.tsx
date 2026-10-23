import { 
  Plus, Trash2, Layout, BookOpen, 
  HelpCircle, CheckCircle2 
} from 'lucide-react';
import type { Exercise, QuestionItem, ExerciseType, TemplateLayoutType } from '../../types';
import { EXERCISE_REGISTRY, TEMPLATE_METADATA } from '../../templates/registry';
import { ImageSlotManager } from './ImageSlotManager';

interface ContentEditorProps {
  exercise: Exercise | null;
  onUpdateExercise: (exercise: Exercise) => void;
}

export const ContentEditor: React.FC<ContentEditorProps> = ({
  exercise,
  onUpdateExercise,
}) => {
  if (!exercise) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 bg-white">
        <BookOpen size={48} className="mb-3 text-slate-300" />
        <p className="font-semibold text-slate-700 text-sm">No Exercise Selected</p>
        <p className="text-xs text-slate-400 mt-1">Select an exercise from the left sidebar to edit its content.</p>
      </div>
    );
  }

  const handleFieldChange = (field: keyof Exercise, value: any) => {
    onUpdateExercise({ ...exercise, [field]: value });
  };

  // Add a new question to the exercise
  const handleAddQuestion = () => {
    const nextNum = exercise.questions.length + 1;
    const newQuestion: QuestionItem = {
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      number: nextNum,
      text: 'Enter question text here...',
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

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white builder-editor-panel">
      {/* Exercise Header & Type Selection */}
      <div className="space-y-4 pb-4 border-b border-slate-200">
        <div className="flex justify-between items-center">
          <div>
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
              {EXERCISE_REGISTRY[exercise.type]?.category}
            </span>
            <h3 className="text-lg font-bold text-slate-900 mt-0.5">Edit Exercise Content</h3>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Points:</span>
            <input
              type="number"
              value={exercise.pointsTotal || 10}
              onChange={(e) => handleFieldChange('pointsTotal', Number(e.target.value))}
              className="w-16 px-2.5 py-1 border border-slate-200 rounded-lg text-xs font-bold text-center"
            />
          </div>
        </div>

        {/* Exercise Title & Type */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-6">
            <label className="text-xs font-bold text-slate-700 uppercase">Exercise Title</label>
            <input
              type="text"
              value={exercise.title}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              className="w-full text-xs font-bold px-3 py-2 border border-slate-200 rounded-xl bg-white mt-1 focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. PART 1: READING COMPREHENSION"
            />
          </div>

          <div className="col-span-6">
            <label className="text-xs font-bold text-slate-700 uppercase">Exercise Type (15 Types)</label>
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
              className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl bg-white mt-1"
            >
              {Object.entries(EXERCISE_REGISTRY).map(([typeKey, meta]) => (
                <option key={typeKey} value={typeKey}>
                  {meta.label} ({meta.category})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Layout Template Selector */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <label className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
            <Layout size={13} className="text-blue-600" />
            Print Layout Template
          </label>
          <div className="grid grid-cols-5 gap-2">
            {(['template_a', 'template_b', 'template_c', 'template_d', 'template_e'] as TemplateLayoutType[]).map((tmpl) => (
              <button
                key={tmpl}
                onClick={() => handleFieldChange('layoutType', tmpl)}
                className={`p-2 rounded-lg border text-left transition-all ${
                  exercise.layoutType === tmpl
                    ? 'border-blue-500 bg-white shadow-sm ring-1 ring-blue-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="text-[11px] font-bold text-slate-800">
                  {tmpl.replace('_', ' ').toUpperCase()}
                </div>
                <div className="text-[9px] text-slate-400 truncate mt-0.5">
                  {TEMPLATE_METADATA[tmpl].name.split('—')[1]?.trim()}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div>
          <label className="text-xs font-bold text-slate-700 uppercase">Instructions for Students</label>
          <input
            type="text"
            value={exercise.instructions}
            onChange={(e) => handleFieldChange('instructions', e.target.value)}
            className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl bg-white mt-1"
            placeholder="e.g. Read the passage and choose the best answer..."
          />
        </div>
      </div>

      {/* Reading Passage Editor (For Template D, C, or reading types) */}
      {(exercise.layoutType === 'template_d' || exercise.layoutType === 'template_c' || exercise.type.includes('reading')) && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
              <BookOpen size={13} className="text-blue-600" />
              Reading Passage / Source Text
            </label>
            <span className="text-[11px] text-slate-400">
              {exercise.passage?.length || 0} characters
            </span>
          </div>
          <textarea
            value={exercise.passage || ''}
            onChange={(e) => handleFieldChange('passage', e.target.value)}
            rows={5}
            placeholder="Type or paste the reading passage here..."
            className="w-full p-3 border border-slate-200 rounded-xl text-xs leading-relaxed font-sans text-slate-800 resize-y"
          />
        </div>
      )}

      {/* Image Slots Manager */}
      <ImageSlotManager
        slots={exercise.imageSlots}
        onUpdateSlots={(slots) => handleFieldChange('imageSlots', slots)}
      />

      {/* Questions Editor Section */}
      <div className="space-y-4 pt-2">
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <HelpCircle size={14} className="text-blue-600" />
            Questions & Answer Keys ({exercise.questions.length})
          </span>
          <button
            onClick={handleAddQuestion}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 flex items-center gap-1 shadow-sm"
          >
            <Plus size={13} /> Add Question
          </button>
        </div>

        {exercise.questions.map((q, qIdx) => (
          <div
            key={q.id}
            className="p-4 bg-slate-50/50 border border-slate-200 rounded-xl space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-1">
                <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                  {q.number || qIdx + 1}
                </span>
                <input
                  type="text"
                  value={q.text}
                  onChange={(e) => handleUpdateQuestion(qIdx, 'text', e.target.value)}
                  placeholder="Enter question text..."
                  className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold bg-white"
                />
              </div>

              <button
                onClick={() => handleRemoveQuestion(qIdx)}
                className="p-1.5 text-slate-400 hover:text-red-600"
                title="Remove question"
              >
                <Trash2 size={14} />
              </button>
            </div>

            {/* If has options (A, B, C, D) */}
            {q.options && q.options.length > 0 && (
              <div className="pl-8 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {q.options.map((opt, optIdx) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <span className="w-5 text-center text-xs font-bold text-slate-500">
                        {opt.label}.
                      </span>
                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => handleUpdateOption(qIdx, optIdx, e.target.value)}
                        className="flex-1 px-2.5 py-1 border border-slate-200 rounded-lg text-xs bg-white"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Answer Key & Ruled Lines Controls */}
            <div className="pl-8 flex items-center gap-6 pt-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-600 flex items-center gap-1">
                  <CheckCircle2 size={13} className="text-emerald-600" />
                  Correct Answer:
                </span>
                <input
                  type="text"
                  value={q.correctAnswer || ''}
                  onChange={(e) => handleUpdateQuestion(qIdx, 'correctAnswer', e.target.value)}
                  placeholder="e.g. B or word"
                  className="w-32 px-2 py-1 border border-emerald-300 bg-emerald-50/50 rounded font-bold text-emerald-800 text-xs"
                />
              </div>

              {(exercise.type === 'reading_short_answer' || exercise.type === 'reading_comic' || exercise.type === 'sentence_construction') && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Writing lines:</span>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={q.linesCount || 2}
                    onChange={(e) => handleUpdateQuestion(qIdx, 'linesCount', Number(e.target.value))}
                    className="w-14 px-2 py-1 border border-slate-200 rounded text-xs text-center"
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
