import React, { useMemo, useState } from 'react';
import { ArrowRight, Headphones, BookOpen, Sparkles, PenTool, Layers } from 'lucide-react';
import type { ExerciseType } from '../../types';
import { rankExerciseTypes } from '../../services/smartPasteRank';

interface Props {
  text: string;
  /** Số bài tách được trong văn bản (để báo nếu có nhiều bài) */
  detectedCount: number;
  onPick: (type: ExerciseType) => void;
  /** Xem kết quả tách cũ từng bài (khi dán nhiều bài một lúc) */
  onReviewAll: () => void;
}

const ICONS: Record<string, React.ReactNode> = {
  Listening: <Headphones size={14} />,
  Reading: <BookOpen size={14} />,
  'Grammar & Vocab': <Sparkles size={14} />,
  Writing: <PenTool size={14} />,
};

/** Danh sách các dạng bài trong menu Add Exercise, sắp theo mức giống với nội dung vừa dán */
export const TypeChooser: React.FC<Props> = ({ text, detectedCount, onPick, onReviewAll }) => {
  const ranked = useMemo(() => rankExerciseTypes(text), [text]);
  const [showAll, setShowAll] = useState(false);
  const good = ranked.filter((r) => r.score > 0);
  const shown = showAll ? ranked : (good.length ? good.slice(0, 5) : ranked.slice(0, 5));

  return (
    <div className="flex-1 min-h-0 h-full overflow-y-auto p-6 pb-16">
      <div className="max-w-3xl mx-auto space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Chọn dạng bài phù hợp</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Các dạng trong Add Exercise được xếp theo mức giống với nội dung bạn vừa dán (giống nhất ở trên cùng). Bấm vào một dạng để chuyển tới giao diện soạn của dạng đó.
          </p>
        </div>

        {detectedCount > 1 && (
          <div className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-100 text-amber-800 rounded-xl px-3 py-2">
            <Layers size={14} className="shrink-0" />
            <span>Nội dung có {detectedCount} bài. Danh sách dưới đây dành cho cả khối văn bản như một bài.</span>
            <button type="button" onClick={onReviewAll} className="ml-auto font-bold underline whitespace-nowrap">Xem từng bài đã tách</button>
          </div>
        )}

        <div className="space-y-2">
          {shown.map((r, i) => (
            <button
              key={r.type}
              type="button"
              onClick={() => onPick(r.type)}
              className={`w-full text-left flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all hover:shadow-md hover:border-blue-400 ${i === 0 && r.score > 0 ? 'bg-blue-50/70 border-blue-300' : 'bg-white border-slate-200'}`}
            >
              <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">{ICONS[r.category]}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900 truncate">{r.label}</span>
                  {i === 0 && r.score > 0 && <span className="text-[10px] font-bold uppercase tracking-wide bg-blue-600 text-white rounded-full px-2 py-0.5">Giống nhất</span>}
                </span>
                <span className="block text-[11.5px] text-slate-500 truncate">{r.reasons.length ? r.reasons.join(' · ') : r.category}</span>
              </span>
              <span className="shrink-0 text-right w-20">
                <span className="block text-sm font-extrabold text-slate-800">{r.score}%</span>
                <span className="block h-1 rounded-full bg-slate-100 overflow-hidden"><span className="block h-full bg-blue-500" style={{ width: `${r.score}%` }} /></span>
              </span>
              <ArrowRight size={16} className="text-slate-400 shrink-0" />
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setShowAll((v) => !v)} className="text-xs font-semibold text-blue-600 hover:text-blue-800">
            {showAll ? 'Chỉ hiện các dạng giống nhất' : `Xem tất cả ${ranked.length} dạng`}
          </button>
        </div>
      </div>
    </div>
  );
};
