import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Sparkles, Wand2 } from 'lucide-react';
import { AiImageReader } from '../shared/AiImageReader';
import { AiRewriteBox } from '../shared/AiRewriteBox';
import {
  allSmartLayoutsForAi, analyzeSmartText, SMART_TYPES, splitSmartLayoutKey,
  type SmartDraft, type SmartTypeId,
} from '../../services/smartAdd';
import type { ExerciseType } from '../../types';

interface Props {
  /** Phân tích xong: mở trình soạn của dạng bài với dữ liệu điền sẵn */
  onAnalyzed: (exerciseType: ExerciseType, draft: SmartDraft) => void;
}

const fieldCls =
  'w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500';

const AUTO = 'auto';

/** Khối "Smart" ở màn hình Add exercise: chọn dạng bài → chọn layout → dán đề hoặc đưa ảnh → Phân tích. */
export const SmartAddPanel: React.FC<Props> = ({ onAnalyzed }) => {
  const [open, setOpen] = useState(false);
  const [typeId, setTypeId] = useState<SmartTypeId | typeof AUTO>(AUTO);
  const [layoutId, setLayoutId] = useState<string>(AUTO);
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');

  const typeOpt = SMART_TYPES.find((t) => t.type === typeId);
  const layoutOpt = typeOpt?.layouts.find((l) => l.id === layoutId);
  // Layout/dạng bài để trống = để AI hoặc bộ đọc tự chọn
  const aiLayouts = typeOpt ? typeOpt.layouts : allSmartLayoutsForAi();

  const analyze = () => {
    const r = analyzeSmartText({ type: typeOpt?.type, layout: layoutOpt?.id, text });
    if (!r.ok || !r.draft || !r.exerciseType) { setMsg(r.warnings[0] || 'Không phân tích được nội dung này.'); return; }
    onAnalyzed(r.exerciseType, r.draft);
  };

  return (
    <div className="bg-white rounded-2xl border border-violet-200 shadow-xs overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-violet-50/50">
        <span className="w-7 h-7 rounded-lg bg-violet-600 text-white flex items-center justify-center shrink-0"><Sparkles size={15} /></span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-bold text-slate-900">Smart – dán đề hoặc ảnh, AI chọn layout</span>
          <span className="block text-[11px] text-slate-500">Chọn dạng bài và layout (hoặc để tự nhận dạng) → dán chữ / đưa ảnh → Phân tích → mở sẵn trình soạn đã điền nội dung.</span>
        </span>
        {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-violet-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-[11px] font-semibold text-slate-600 space-y-1 block">1. Dạng bài
              <select value={typeId} onChange={(e) => { setTypeId(e.target.value as SmartTypeId | typeof AUTO); setLayoutId(AUTO); setMsg(''); }} className={fieldCls}>
                <option value={AUTO}>Tự nhận dạng</option>
                {SMART_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-semibold text-slate-600 space-y-1 block">2. Layout
              <select value={layoutId} disabled={!typeOpt} onChange={(e) => { setLayoutId(e.target.value); setMsg(''); }} className={`${fieldCls} disabled:bg-slate-50 disabled:text-slate-400`}>
                <option value={AUTO}>{typeOpt ? 'Tự nhận dạng' : 'Chọn dạng bài trước, hoặc để AI chọn từ ảnh'}</option>
                {typeOpt?.layouts.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </label>
          </div>

          <AiImageReader
            kind={typeOpt ? typeOpt.label : 'English worksheet exercise (Sentence Completion or Draw Lines and Match)'}
            layouts={aiLayouts}
            layoutLabel={(id) => {
              const sp = splitSmartLayoutKey(id);
              if (sp) return `${SMART_TYPES.find((t) => t.type === sp.type)?.label} – ${SMART_TYPES.find((t) => t.type === sp.type)?.layouts.find((l) => l.id === sp.layout)?.label}`;
              return typeOpt?.layouts.find((l) => l.id === id)?.label || id;
            }}
            currentText={text}
            onResult={(r) => {
              const sp = splitSmartLayoutKey(r.layout);
              if (sp) { setTypeId(sp.type); setLayoutId(sp.layout); } else setLayoutId(r.layout);
              setText(r.text);
              setMsg('');
            }}
          />

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600 block">3. Nội dung đề {layoutOpt ? <span className="font-normal text-slate-400">– {layoutOpt.hint}</span> : null}</label>
            <textarea
              rows={7}
              value={text}
              onChange={(e) => { setText(e.target.value); setMsg(''); }}
              placeholder={layoutOpt?.example || 'Dán đề vào đây, hoặc đưa ảnh ở khung trên để AI chép giúp.'}
              className={`${fieldCls} font-mono resize-y`}
            />
          </div>
          {typeOpt && (
            <AiRewriteBox
              kind={`${typeOpt.label}${layoutOpt ? ` – ${layoutOpt.label}` : ''}`}
              hint={layoutOpt?.hint || typeOpt.layouts.map((l) => `${l.label}: ${l.hint}`).join('\n')}
              example={layoutOpt?.example || typeOpt.layouts[0].example}
              text={text}
              onText={(v) => { setText(v); setMsg(''); }}
            />
          )}
          {msg && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">{msg}</p>}
          <div className="flex justify-end">
            <button type="button" onClick={analyze} disabled={!text.trim()} className="h-9 px-4 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-40 rounded-lg flex items-center gap-1.5">
              <Wand2 size={14} /> Phân tích
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
