import React from 'react';
import { Lock } from 'lucide-react';
import type { ExerciseType } from '../../types';
import { EXERCISE_REGISTRY } from '../../templates/registry';

interface Props {
  currentType: ExerciseType;
  /** Bài đã làm (đã lưu): chỉ hiện dạng bài, không cho đổi */
  locked: boolean;
  onChange: (type: ExerciseType) => void;
}

const CATEGORY_ORDER = ['Listening', 'Reading', 'Grammar & Vocab', 'Writing'] as const;

/** Dòng trên cùng của mọi trình soạn: cho biết đang soạn dạng bài nào; đổi dạng được khi bài chưa làm, khóa khi bài đã lưu. */
export const ExerciseTypeBar: React.FC<Props> = ({ currentType, locked, onChange }) => {
  const current = EXERCISE_REGISTRY[currentType];
  const selectable = Object.values(EXERCISE_REGISTRY).filter((m) => !m.hidden || m.type === currentType);

  return (
    <div className="shrink-0 flex items-center gap-3 px-4 py-1.5 bg-white border-b border-slate-200 text-xs">
      <span className="font-semibold text-slate-500">Dạng bài</span>
      {locked ? (
        <span
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-slate-100 border border-slate-200 font-semibold text-slate-700"
          title="Bài đã làm nên không đổi được dạng bài. Muốn đổi, hãy tạo bài mới."
        >
          <Lock size={13} className="text-slate-400" />
          {current?.label || currentType}
        </span>
      ) : (
        <select
          aria-label="Đổi dạng bài"
          title="Bài chưa làm: có thể đổi sang dạng bài khác"
          value={currentType}
          onChange={(e) => onChange(e.target.value as ExerciseType)}
          className="h-8 px-2.5 min-w-64 bg-white border border-slate-200 rounded-lg font-semibold text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
        >
          {CATEGORY_ORDER.map((cat) => {
            const list = selectable.filter((m) => m.category === cat);
            if (list.length === 0) return null;
            return (
              <optgroup key={cat} label={cat}>
                {list.map((m) => <option key={m.type} value={m.type}>{m.label}</option>)}
              </optgroup>
            );
          })}
        </select>
      )}
      {current && <span className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-[11px] font-semibold text-blue-700">{current.category}</span>}
      {current && <span className="hidden lg:inline min-w-0 truncate text-slate-400">{current.description}</span>}
      {locked && <span className="ml-auto text-[11px] text-slate-400 shrink-0">Đã khóa vì bài đã làm</span>}
    </div>
  );
};
