import { ChevronRight, Layers, Plus } from 'lucide-react';
import type { Worksheet, Exercise } from '../../types';
import { EXERCISE_REGISTRY } from '../../templates/registry';

interface ActiveExerciseBarProps {
  worksheet: Worksheet;
  activeExerciseId: string | null;
  onSelectExercise: (id: string) => void;
  onAddExercise: () => void;
}

export const ActiveExerciseBar = ({
  worksheet,
  activeExerciseId,
  onSelectExercise,
  onAddExercise,
}: ActiveExerciseBarProps) => {
  const activeEx = worksheet.exercises.find((e) => e.id === activeExerciseId) || worksheet.exercises[0];
  const meta = activeEx ? EXERCISE_REGISTRY[activeEx.type] : null;

  return (
    <div className="h-11 bg-slate-50 border-b border-slate-200 px-6 flex items-center justify-between shrink-0 select-none text-xs">
      {/* Left: Breadcrumbs & Active Exercise Selector */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-semibold text-slate-500 truncate max-w-[200px]">
          {worksheet.title || 'Untitled Worksheet'}
        </span>
        <ChevronRight size={13} className="text-slate-400 shrink-0" />

        <div className="flex items-center gap-1.5">
          <Layers size={13} className="text-blue-600 shrink-0" />
          <span className="font-bold text-slate-700">Active Exercise:</span>
          
          <select
            value={activeExerciseId || ''}
            onChange={(e) => onSelectExercise(e.target.value)}
            className="bg-white border border-slate-200 rounded-md px-2 py-0.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[260px] truncate"
          >
            {worksheet.exercises.map((ex: Exercise, idx: number) => (
              <option key={ex.id} value={ex.id}>
                #{idx + 1}: {ex.title || `Exercise ${idx + 1}`} ({EXERCISE_REGISTRY[ex.type]?.category || 'General'})
              </option>
            ))}
          </select>
        </div>

        {meta && (
          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-[10px] font-bold shrink-0">
            {meta.label}
          </span>
        )}
      </div>

      {/* Right: Quick action */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[11px] text-slate-400">
          {worksheet.exercises.length} {worksheet.exercises.length === 1 ? 'exercise' : 'exercises'} total
        </span>
        <button
          onClick={onAddExercise}
          className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
        >
          <Plus size={12} /> Add Exercise
        </button>
      </div>
    </div>
  );
};
