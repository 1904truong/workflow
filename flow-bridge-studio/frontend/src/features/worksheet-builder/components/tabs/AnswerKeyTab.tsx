import { CheckCircle2, ShieldAlert, FileSpreadsheet, ArrowRight, BookOpen } from 'lucide-react';
import type { Exercise, QuestionItem } from '../../types';

interface AnswerKeyTabProps {
  exercise: Exercise | null;
  onUpdateExercise: (exercise: Exercise) => void;
  onNavigateToImages: () => void;
  onNavigateToPreview: () => void;
}

export const AnswerKeyTab = ({
  exercise,
  onUpdateExercise,
  onNavigateToImages,
  onNavigateToPreview,
}: AnswerKeyTabProps) => {
  if (!exercise) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-6 text-center bg-white rounded-2xl border border-slate-200 mt-8">
        <BookOpen size={48} className="mb-3 text-slate-300 mx-auto" />
        <h3 className="font-bold text-slate-700 text-base">No Exercise Selected</h3>
        <p className="text-xs text-slate-400 mt-1">Please select an exercise to configure its answer key.</p>
      </div>
    );
  }

  const handleUpdateAnswer = (qIndex: number, answer: string) => {
    const updated = [...exercise.questions];
    updated[qIndex] = { ...updated[qIndex], correctAnswer: answer };
    onUpdateExercise({ ...exercise, questions: updated });
  };

  const answeredCount = exercise.questions.filter((q) => Boolean(q.correctAnswer?.trim())).length;
  const isComplete = answeredCount === exercise.questions.length && exercise.questions.length > 0;

  return (
    <div className="max-w-4xl mx-auto py-8 px-6 space-y-6">
      {/* Top Banner */}
      <div className="flex justify-between items-start">
        <div>
          <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 size={14} />
            Step 4 · Teacher Answer Key & Scoring
          </span>
          <h2 className="text-2xl font-bold text-slate-900 mt-1">Master Answer Key Management</h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure official grading keys. Answers are hidden from student copies and revealed only on Teacher Answer Key exports.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {exercise.imageSlots.length > 0 ? (
            <button
              onClick={onNavigateToImages}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-blue-500/20 flex items-center gap-1.5 transition-all"
            >
              <span>Image Manager</span>
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              onClick={onNavigateToPreview}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-500/20 flex items-center gap-1.5 transition-all"
            >
              <span>Preview & Print Document</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Completion Status Badge Card */}
      <div className={`p-4 rounded-2xl border flex items-center justify-between shadow-xs ${
        isComplete 
          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' 
          : 'bg-amber-50/70 border-amber-200 text-amber-900'
      }`}>
        <div className="flex items-center gap-3">
          {isComplete ? (
            <CheckCircle2 size={22} className="text-emerald-600 shrink-0" />
          ) : (
            <ShieldAlert size={22} className="text-amber-600 shrink-0" />
          )}
          <div>
            <h4 className="text-xs font-bold">
              {isComplete 
                ? 'All Answer Keys Specified' 
                : `Answer Key Pending (${answeredCount} of ${exercise.questions.length} configured)`}
            </h4>
            <p className="text-[11px] opacity-80 mt-0.5">
              Current Exercise: <strong>{exercise.title}</strong>
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-xs font-extrabold px-3 py-1 bg-white rounded-lg border border-slate-200 shadow-2xs">
            {answeredCount} / {exercise.questions.length} Questions Set
          </span>
        </div>
      </div>

      {/* Questions Answer Key Form */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 pb-3 border-b border-slate-100">
          <FileSpreadsheet size={16} className="text-blue-600" />
          Answer Key & Scoring Configurations
        </h3>

        <div className="space-y-4">
          {exercise.questions.map((q: QuestionItem, qIdx: number) => {
            const hasOptions = q.options && q.options.length > 0;
            const isTFNG = exercise.type === 'true_false_not_given';
            const isTF = exercise.type === 'listening_true_false';

            return (
              <div
                key={q.id}
                className="p-4 bg-slate-50/60 border border-slate-200 rounded-2xl space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 flex-1">
                    <span className="w-6 h-6 rounded-lg bg-slate-800 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {q.number || qIdx + 1}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-slate-900 leading-snug">{q.text}</p>
                      {q.explanation && (
                        <p className="text-[11px] text-slate-500 italic mt-0.5">{q.explanation}</p>
                      )}
                    </div>
                  </div>

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                    q.correctAnswer ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {q.correctAnswer ? 'KEY SET' : 'UNSET'}
                  </span>
                </div>

                {/* Specific answer input by question style */}
                <div className="pl-8 pt-1">
                  {/* Multiple Choice (Clickable A, B, C, D pills) */}
                  {hasOptions && (
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                        Select Correct Option:
                      </span>
                      <div className="flex items-center gap-2">
                        {q.options?.map((opt) => {
                          const isSelected = q.correctAnswer === opt.label;
                          return (
                            <button
                              key={opt.id}
                              onClick={() => handleUpdateAnswer(qIdx, opt.label)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                                isSelected
                                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                                  : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                              }`}
                            >
                              <span>{opt.label}.</span>
                              <span className="font-normal text-[11px] truncate max-w-[140px]">{opt.text}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* True / False / Not Given pills */}
                  {isTFNG && (
                    <div className="flex items-center gap-2">
                      {['T', 'F', 'NG'].map((val) => (
                        <button
                          key={val}
                          onClick={() => handleUpdateAnswer(qIdx, val)}
                          className={`px-4 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                            q.correctAnswer === val
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {val === 'T' ? 'True (T)' : val === 'F' ? 'False (F)' : 'Not Given (NG)'}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Listening True / False */}
                  {isTF && (
                    <div className="flex items-center gap-2">
                      {['True', 'False'].map((val) => (
                        <button
                          key={val}
                          onClick={() => handleUpdateAnswer(qIdx, val)}
                          className={`px-4 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                            q.correctAnswer === val
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Text / Gap Fill / Short Answer / Sentence Rearrangement / Construction Input */}
                  {!hasOptions && !isTFNG && !isTF && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">
                        Correct Answer / Sample Model Response
                      </label>
                      <input
                        type="text"
                        value={q.correctAnswer || ''}
                        onChange={(e) => handleUpdateAnswer(qIdx, e.target.value)}
                        placeholder="Type official answer key or phrase..."
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
