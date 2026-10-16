import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, Sparkles, Printer, FileText, ArrowLeft, ArrowUp, ArrowDown, 
  Trash2, Copy, Edit3, Image as ImageIcon, 
  Award, Clock, BookOpen, Layers, ChevronDown
} from 'lucide-react';
import type { LessonFolder, Exercise, ExerciseType } from '../../types';
import { EXERCISE_REGISTRY } from '../../templates/registry';
import { exportWorksheetToDocx } from '../../services/docxExportService';
import { folderToWorksheet } from '../../types';

interface FolderDetailScreenProps {
  folder: LessonFolder;
  onBackToFolders: () => void;
  onOpenSmartPaste: () => void;
  /** type: dạng bài đã chọn trong menu (bỏ qua bước chọn dạng bài) */
  onOpenAddExercise: (type?: ExerciseType) => void;
  onEditExercise: (exerciseId: string) => void;
  onOpenImages: () => void;
  onOpenPreviewExport: () => void;
  onEditFolderInfo: () => void;
  onUpdateExercises: (updatedExercises: Exercise[]) => void;
  onDuplicateExercise: (exerciseId: string) => void;
  onDeleteExercise: (exerciseId: string) => void;
  onInsertSampleExercises?: () => void;
}

const CATEGORY_ORDER = ['Listening', 'Reading', 'Grammar & Vocab', 'Writing'] as const;

/** Nút "Add Exercise" dạng dropdown: chọn dạng bài là vào thẳng trình soạn */
const AddExerciseMenu: React.FC<{ onPick: (type: ExerciseType) => void }> = ({ onPick }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
      >
        <Plus size={14} />
        <span>Add Exercise</span>
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full mt-2 w-72 max-h-[26rem] overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-1.5">
          {CATEGORY_ORDER.map((cat) => {
            const items = Object.values(EXERCISE_REGISTRY).filter((m) => m.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat} className="pb-1">
                <div className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-400">{cat}</div>
                {items.map((m) => (
                  <button
                    key={m.type}
                    role="menuitem"
                    onClick={() => { setOpen(false); onPick(m.type); }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-800 hover:bg-slate-100 focus:bg-slate-100 focus:outline-none"
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const FolderDetailScreen: React.FC<FolderDetailScreenProps> = ({
  folder,
  onBackToFolders,
  onOpenSmartPaste,
  onOpenAddExercise,
  onEditExercise,
  onOpenImages,
  onOpenPreviewExport,
  onEditFolderInfo,
  onUpdateExercises,
  onDuplicateExercise,
  onDeleteExercise,
  onInsertSampleExercises,
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const totalQuestions = folder.exercises.reduce((s, e) => s + e.questions.length, 0);
  const totalImageSlots = folder.exercises.reduce((s, e) => s + e.imageSlots.length, 0);
  const totalPoints = folder.totalPoints || folder.exercises.reduce((s, e) => s + (e.pointsTotal || 0), 0) || 20;

  // Reorder handlers
  const handleMove = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === folder.exercises.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const reordered = [...folder.exercises];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    // Update order numbers
    const updated = reordered.map((ex, idx) => ({ ...ex, order: idx + 1 }));
    onUpdateExercises(updated);
  };

  // Drag-and-drop
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const reordered = [...folder.exercises];
    const [moved] = reordered.splice(draggedIndex, 1);
    reordered.splice(dropIndex, 0, moved);

    const updated = reordered.map((ex, idx) => ({ ...ex, order: idx + 1 }));
    onUpdateExercises(updated);
    setDraggedIndex(null);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-50 p-6 md:p-8 select-text">
      <div className="max-w-5xl w-full mx-auto space-y-6">
        
        {/* Navigation & Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={onBackToFolders}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft size={14} /> Back to All Folders
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => exportWorksheetToDocx(folderToWorksheet(folder), 'student')}
              className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
              title="Download Student Word DOCX"
            >
              <FileText size={13} className="text-blue-600" />
              <span>Word .doc</span>
            </button>
            <button
              onClick={onEditFolderInfo}
              className="px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <Edit3 size={12} /> Edit Info
            </button>
          </div>
        </div>

        {/* Folder Overview Banner */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 uppercase">
                {folder.gradeLevel}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase">
                {folder.subject}
              </span>
              {folder.unitTopic && (
                <span className="text-xs font-semibold text-slate-500">
                  {folder.unitTopic} {folder.lessonTitle ? `· ${folder.lessonTitle}` : ''}
                </span>
              )}
            </div>

            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {folder.name}
            </h1>

            {folder.description && (
              <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
                {folder.description}
              </p>
            )}

            {/* Quick Metrics Bar */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
              <span className="flex items-center gap-1.5 font-bold text-slate-700">
                <Layers size={14} className="text-blue-600" />
                {folder.exercises.length} Exercises ({totalQuestions} Questions)
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <Clock size={13} className="text-slate-400" />
                {folder.estimatedDuration || 45} mins
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <Award size={13} className="text-amber-500" />
                {totalPoints} Total Points
              </span>
              {totalImageSlots > 0 && (
                <button
                  onClick={onOpenImages}
                  className="flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-700"
                >
                  <ImageIcon size={13} />
                  {totalImageSlots} Image Slots →
                </button>
              )}
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={onOpenSmartPaste}
              className="px-4 py-2.5 bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-all active:scale-95"
            >
              <Sparkles size={14} />
              <span>Smart Paste</span>
            </button>

            <AddExerciseMenu onPick={(t) => onOpenAddExercise(t)} />

            <button
              onClick={onOpenPreviewExport}
              className="px-4 py-2.5 bg-white border border-slate-200 hover:border-blue-400 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
            >
              <Printer size={14} className="text-blue-600" />
              <span>Preview A4</span>
            </button>
          </div>
        </div>

        {/* Main Exercise Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <span>Worksheet Structure ({folder.exercises.length} Exercises)</span>
            </h2>
            <span className="text-[11px] text-slate-400">
              Drag or use arrows to reorder exercises for A4 print sequence
            </span>
          </div>

          {folder.exercises.length === 0 ? (
            /* Empty State with 3 starter cards */
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                <BookOpen size={24} />
              </div>
              <h3 className="text-sm font-bold text-slate-800">This Lesson Folder is Empty</h3>
              <p className="text-xs text-slate-400 max-w-md mt-1 mb-6">
                Add exercises to build your printable worksheet. You can paste an entire test via Smart Paste or create questions individually.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl">
                {/* Option 1: Smart Paste */}
                <button
                  onClick={onOpenSmartPaste}
                  className="p-4 rounded-2xl border border-blue-200 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-400 text-left transition-all group flex flex-col justify-between"
                >
                  <div>
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center mb-2 shadow-xs">
                      <Sparkles size={16} />
                    </div>
                    <h4 className="text-xs font-bold text-blue-900 group-hover:text-blue-700">
                      Smart Paste
                    </h4>
                    <p className="text-[11px] text-blue-700/80 mt-1 leading-relaxed">
                      Paste an entire exam text with multiple exercises.
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-blue-600 mt-3 block">Recommended →</span>
                </button>

                {/* Option 2: Add Manually */}
                <button
                  onClick={() => onOpenAddExercise()}
                  className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs text-left transition-all group flex flex-col justify-between"
                >
                  <div>
                    <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center mb-2">
                      <Plus size={16} />
                    </div>
                    <h4 className="text-xs font-bold text-slate-900">
                      Add Manually
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Choose from 15 formats and enter questions step by step.
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-slate-600 mt-3 block">Create one →</span>
                </button>

                {/* Option 3: Insert Sample Test */}
                <button
                  onClick={onInsertSampleExercises}
                  className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs text-left transition-all group flex flex-col justify-between"
                >
                  <div>
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
                      <BookOpen size={16} />
                    </div>
                    <h4 className="text-xs font-bold text-slate-900">
                      Insert Sample Test
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Load an authentic Cambridge English B1 exam with 4 exercises.
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600 mt-3 block">Load sample →</span>
                </button>
              </div>
            </div>
          ) : (
            /* Ordered Exercise Cards List */
            <div className="space-y-3">
              {folder.exercises.map((exercise, idx) => {
                const meta = EXERCISE_REGISTRY[exercise.type];

                return (
                  <div
                    key={exercise.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, idx)}
                    className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-4 shadow-xs transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group"
                  >
                    {/* Left: Reorder controls + Number + Info */}
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      {/* Order Reorder Arrows */}
                      <div className="flex flex-col gap-0.5 text-slate-300 shrink-0">
                        <button
                          onClick={() => handleMove(idx, 'up')}
                          disabled={idx === 0}
                          className="hover:text-blue-600 disabled:opacity-20 p-0.5 rounded"
                          title="Move up"
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          onClick={() => handleMove(idx, 'down')}
                          disabled={idx === folder.exercises.length - 1}
                          className="hover:text-blue-600 disabled:opacity-20 p-0.5 rounded"
                          title="Move down"
                        >
                          <ArrowDown size={13} />
                        </button>
                      </div>

                      {/* Number Badge */}
                      <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 border border-blue-200/50">
                        #{idx + 1}
                      </span>

                      {/* Exercise Details */}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-[9px] font-bold px-2 py-0.2 rounded-full uppercase tracking-wider ${
                              meta?.category === 'Listening'
                                ? 'bg-purple-100 text-purple-700'
                                : meta?.category === 'Reading'
                                ? 'bg-emerald-100 text-emerald-700'
                                : meta?.category === 'Writing'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {meta?.category || 'General'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {exercise.layoutType.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>

                        <h3 className="text-xs font-bold text-slate-900 truncate mt-1">
                          {exercise.title || `Exercise ${idx + 1}`}
                        </h3>

                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {meta?.label || exercise.type}
                        </p>
                      </div>
                    </div>

                    {/* Middle: Badges for Questions, Images & Keys */}
                    <div className="flex items-center gap-3 text-xs shrink-0 pl-11 sm:pl-0">
                      <span className="text-slate-600 font-semibold">
                        {exercise.questions.length} Qs ({exercise.pointsTotal || exercise.questions.length} pts)
                      </span>

                      {exercise.imageSlots.length > 0 && (
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200">
                          <ImageIcon size={11} />
                          {exercise.imageSlots.length} img
                        </span>
                      )}

                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center pl-11 sm:pl-0">
                      <button
                        onClick={() => onEditExercise(exercise.id)}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                      >
                        <Edit3 size={12} /> Edit
                      </button>

                      <button
                        onClick={() => onDuplicateExercise(exercise.id)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Duplicate exercise"
                      >
                        <Copy size={13} />
                      </button>

                      <button
                        onClick={() => onDeleteExercise(exercise.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete exercise"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
