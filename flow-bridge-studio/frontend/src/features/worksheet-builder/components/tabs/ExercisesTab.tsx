import { useState } from 'react';
import { 
  Plus, Trash2, Copy, MoveUp, MoveDown, 
  HelpCircle, Image as ImageIcon, ArrowRight,
  Headphones, BookOpen, SpellCheck, PenTool
} from 'lucide-react';
import type { Worksheet, Exercise, ExerciseType } from '../../types';
import { EXERCISE_REGISTRY, TEMPLATE_METADATA } from '../../templates/registry';
import { ExerciseTypePickerModal } from './ExerciseTypePickerModal';

interface ExercisesTabProps {
  worksheet: Worksheet;
  activeExerciseId: string | null;
  onSelectExercise: (id: string) => void;
  onAddExerciseWithType: (type: ExerciseType) => void;
  onDuplicateExercise: (id: string) => void;
  onDeleteExercise: (id: string) => void;
  onMoveExercise: (id: string, direction: 'up' | 'down') => void;
  onNavigateToContent: () => void;
}

export const ExercisesTab = ({
  worksheet,
  activeExerciseId,
  onSelectExercise,
  onAddExerciseWithType,
  onDuplicateExercise,
  onDeleteExercise,
  onMoveExercise,
  onNavigateToContent,
}: ExercisesTabProps) => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const handleSelectTypeFromModal = (type: ExerciseType) => {
    setIsPickerOpen(false);
    onAddExerciseWithType(type);
    onNavigateToContent();
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-6 space-y-6">
      {/* Top Banner */}
      <div className="flex justify-between items-start">
        <div>
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
            Step 2 · Exercise Management
          </span>
          <h2 className="text-2xl font-bold text-slate-900 mt-1">Exercise Curriculum Sequence</h2>
          <p className="text-xs text-slate-500 mt-1">
            Reorder, duplicate, remove, or append exercise modules. Click any exercise to edit its content.
          </p>
        </div>

        <button
          onClick={() => setIsPickerOpen(true)}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all active:scale-95"
        >
          <Plus size={16} />
          <span>Add New Exercise</span>
        </button>
      </div>

      {/* Exercise Cards List */}
      <div className="space-y-3">
        {worksheet.exercises.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
            <BookOpen size={40} className="text-slate-300 mx-auto mb-3" />
            <h4 className="font-bold text-slate-700 text-sm">No exercises added yet</h4>
            <p className="text-xs text-slate-400 mt-1 mb-4">Click below to pick from 15 canonical English exercise formats.</p>
            <button
              onClick={() => setIsPickerOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
            >
              <Plus size={14} /> Add First Exercise
            </button>
          </div>
        ) : (
          worksheet.exercises.map((ex: Exercise, idx: number) => {
            const isActive = ex.id === activeExerciseId;
            const meta = EXERCISE_REGISTRY[ex.type];
            const CategoryIcon =
              meta?.category === 'Listening' ? Headphones :
              meta?.category === 'Reading' ? BookOpen :
              meta?.category === 'Writing' ? PenTool : SpellCheck;

            return (
              <div
                key={ex.id}
                onClick={() => onSelectExercise(ex.id)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer bg-white relative ${
                  isActive
                    ? 'border-blue-500 shadow-md shadow-blue-500/5 ring-2 ring-blue-500/20'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left: Position badge & Details */}
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                      isActive ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600'
                    }`}>
                      #{idx + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-blue-600 flex items-center gap-1">
                          <CategoryIcon size={12} />
                          {meta?.category || 'General'}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-xs font-bold text-slate-800">
                          {meta?.label || ex.type}
                        </span>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                          {TEMPLATE_METADATA[ex.layoutType]?.name || ex.layoutType}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-slate-900 mt-1 truncate">
                        {ex.title || `Exercise ${idx + 1}`}
                      </h3>

                      {ex.instructions && (
                        <p className="text-xs text-slate-500 italic mt-0.5 truncate">
                          &quot;{ex.instructions}&quot;
                        </p>
                      )}

                      {/* Stat pills */}
                      <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <HelpCircle size={13} className="text-slate-400" />
                          <strong>{ex.questions.length}</strong> questions
                        </span>
                        {ex.imageSlots.length > 0 && (
                          <span className="flex items-center gap-1">
                            <ImageIcon size={13} className="text-slate-400" />
                            <strong>{ex.imageSlots.length}</strong> image {ex.imageSlots.length === 1 ? 'slot' : 'slots'}
                          </span>
                        )}
                        <span>
                          Points: <strong>{ex.pointsTotal || 10} pts</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Quick actions & Navigate Button */}
                  <div className="flex flex-col items-end gap-3 shrink-0">
                    <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                      <button
                        title="Move Up"
                        disabled={idx === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveExercise(ex.id, 'up');
                        }}
                        className="p-1.5 text-slate-500 hover:text-slate-800 disabled:opacity-30 rounded hover:bg-white"
                      >
                        <MoveUp size={13} />
                      </button>

                      <button
                        title="Move Down"
                        disabled={idx === worksheet.exercises.length - 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveExercise(ex.id, 'down');
                        }}
                        className="p-1.5 text-slate-500 hover:text-slate-800 disabled:opacity-30 rounded hover:bg-white"
                      >
                        <MoveDown size={13} />
                      </button>

                      <button
                        title="Duplicate Exercise"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicateExercise(ex.id);
                        }}
                        className="p-1.5 text-slate-500 hover:text-blue-600 rounded hover:bg-white"
                      >
                        <Copy size={13} />
                      </button>

                      <button
                        title="Delete Exercise"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteExercise(ex.id);
                        }}
                        className="p-1.5 text-slate-500 hover:text-rose-600 rounded hover:bg-white"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectExercise(ex.id);
                        onNavigateToContent();
                      }}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                    >
                      <span>Edit Content</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Picker Modal */}
      <ExerciseTypePickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelectType={handleSelectTypeFromModal}
      />
    </div>
  );
};
