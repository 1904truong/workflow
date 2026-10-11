import { 
  Plus, Trash2, Copy, MoveUp, MoveDown, 
  FileText, Clock, Award 
} from 'lucide-react';
import type { Worksheet, Exercise } from '../../types';
import { EXERCISE_REGISTRY } from '../../templates/registry';

interface StructureSidebarProps {
  worksheet: Worksheet;
  activeExerciseId: string | null;
  onSelectExercise: (id: string) => void;
  onAddExercise: () => void;
  onDuplicateExercise: (id: string) => void;
  onDeleteExercise: (id: string) => void;
  onMoveExercise: (id: string, direction: 'up' | 'down') => void;
  onUpdateMetadata: (field: keyof Worksheet, value: any) => void;
}

export const StructureSidebar: React.FC<StructureSidebarProps> = ({
  worksheet,
  activeExerciseId,
  onSelectExercise,
  onAddExercise,
  onDuplicateExercise,
  onDeleteExercise,
  onMoveExercise,
  onUpdateMetadata,
}) => {
  return (
    <aside className="w-80 border-r border-slate-200 bg-white flex flex-col h-full builder-sidebar shrink-0">
      {/* Top Header: Worksheet Metadata */}
      <div className="p-4 border-b border-slate-200 space-y-3 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <FileText size={13} className="text-blue-600" />
            Document Settings
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
            ISO A4 Standard
          </span>
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase">Worksheet Title</label>
          <input
            type="text"
            value={worksheet.title}
            onChange={(e) => onUpdateMetadata('title', e.target.value)}
            className="w-full text-xs font-semibold px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 mt-0.5"
            placeholder="e.g. WONDERS OF NATURE"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Unit / Module</label>
            <input
              type="text"
              value={worksheet.unit}
              onChange={(e) => onUpdateMetadata('unit', e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white mt-0.5"
              placeholder="Unit 1"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Lesson</label>
            <input
              type="text"
              value={worksheet.lesson}
              onChange={(e) => onUpdateMetadata('lesson', e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white mt-0.5"
              placeholder="Lesson 1"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
              <Clock size={10} /> Time (min)
            </label>
            <input
              type="number"
              value={worksheet.totalTimeMinutes || 45}
              onChange={(e) => onUpdateMetadata('totalTimeMinutes', Number(e.target.value))}
              className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white mt-0.5"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
              <Award size={10} /> Max Points
            </label>
            <input
              type="number"
              value={worksheet.totalPoints || 100}
              onChange={(e) => onUpdateMetadata('totalPoints', Number(e.target.value))}
              className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white mt-0.5"
            />
          </div>
        </div>
      </div>

      {/* Exercise Structure List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Exercises ({worksheet.exercises.length})
          </span>
          <button
            onClick={onAddExercise}
            className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200"
          >
            <Plus size={13} /> Add Exercise
          </button>
        </div>

        {worksheet.exercises.map((ex: Exercise, idx: number) => {
          const isActive = ex.id === activeExerciseId;
          const meta = EXERCISE_REGISTRY[ex.type];

          return (
            <div
              key={ex.id}
              onClick={() => onSelectExercise(ex.id)}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative group ${
                isActive
                  ? 'border-blue-500 bg-blue-50/40 shadow-sm ring-1 ring-blue-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-1">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      #{idx + 1}
                    </span>
                    <span className="text-[10px] font-semibold text-blue-600 truncate">
                      {meta?.category || 'General'}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-800 mt-1 truncate">
                    {ex.title || `Exercise ${idx + 1}`}
                  </h4>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                    {meta?.label || ex.type} · {ex.questions.length} questions
                  </p>
                </div>

                {/* Quick actions */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    title="Move up"
                    disabled={idx === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveExercise(ex.id, 'up');
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                  >
                    <MoveUp size={12} />
                  </button>
                  <button
                    title="Move down"
                    disabled={idx === worksheet.exercises.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveExercise(ex.id, 'down');
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                  >
                    <MoveDown size={12} />
                  </button>
                  <button
                    title="Duplicate"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicateExercise(ex.id);
                    }}
                    className="p-1 text-slate-400 hover:text-blue-600"
                  >
                    <Copy size={12} />
                  </button>
                  <button
                    title="Delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteExercise(ex.id);
                    }}
                    className="p-1 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
