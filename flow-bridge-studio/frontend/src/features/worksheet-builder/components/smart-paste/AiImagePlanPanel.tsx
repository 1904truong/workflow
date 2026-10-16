import React from 'react';
import { Sparkles, AlertTriangle, ImageIcon, Upload, X, CheckCircle2 } from 'lucide-react';
import type { AiImagePlan } from '../../services/ai/imagePlanSchema';
import type { Disagreement } from '../../services/ai/imagePlanCompare';
import { buildFinalPrompt } from '../../services/ai/imagePlanCompare';

export interface AiPlanEditorState {
  plan: AiImagePlan;
  diffs: Disagreement[];
  warnings: string[];
  /** true nếu kế hoạch đến từ parser (Gemini không dùng được) */
  fromFallback: boolean;
  fallbackReason?: string;
  excluded: Set<string>;
  referenceBySlot: Record<string, string[]>;
  style: string;
}

interface Props {
  state: AiPlanEditorState;
  onChange: (next: AiPlanEditorState) => void;
  onApprove: () => void;
  onDiscard: () => void;
}

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

export const AiImagePlanPanel: React.FC<Props> = ({ state, onChange, onApprove, onDiscard }) => {
  const { plan, diffs, warnings, fromFallback, fallbackReason, excluded, referenceBySlot, style } = state;
  const included = plan.images.filter((im) => !excluded.has(im.slotId));
  const missingRef = included.filter((im) => im.needsReference && !(referenceBySlot[im.slotId]?.length));

  const patchImage = (slotId: string, patch: Partial<AiImagePlan['images'][number]>) =>
    onChange({ ...state, plan: { ...plan, images: plan.images.map((im) => (im.slotId === slotId ? { ...im, ...patch } : im)) } });

  const toggle = (slotId: string) => {
    const next = new Set(excluded);
    if (next.has(slotId)) next.delete(slotId); else next.add(slotId);
    onChange({ ...state, excluded: next });
  };

  const addReference = async (slotId: string, files: FileList | null) => {
    if (!files || !files.length) return;
    const urls: string[] = [];
    for (const f of Array.from(files).slice(0, 3)) {
      if (f.type.startsWith('image/')) urls.push(await fileToDataUrl(f));
    }
    onChange({ ...state, referenceBySlot: { ...referenceBySlot, [slotId]: [...(referenceBySlot[slotId] || []), ...urls].slice(0, 3) } });
  };

  const removeReference = (slotId: string, idx: number) =>
    onChange({ ...state, referenceBySlot: { ...referenceBySlot, [slotId]: (referenceBySlot[slotId] || []).filter((_, i) => i !== idx) } });

  return (
    <section className="bg-white border border-violet-200 rounded-3xl p-5 space-y-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Sparkles size={16} className="text-violet-600" />
            Kế hoạch ảnh {fromFallback ? '(từ parser — không dùng AI)' : '(do Gemini phân tích)'}
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Xem và chỉnh sửa trước khi tạo ảnh. Chưa có ảnh nào được tạo cho tới khi bạn bấm “Duyệt kế hoạch”.
          </p>
        </div>
        <button onClick={onDiscard} className="text-xs font-bold text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg border border-slate-200 bg-white shrink-0">
          ✕ Bỏ kế hoạch
        </button>
      </div>

      {fromFallback && (
        <div className="flex items-start gap-2 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>Không dùng được Gemini ({fallbackReason || 'lỗi không rõ'}). Đang dùng kết quả của parser có sẵn: chỉ các ô ảnh parser tìm thấy, prompt đơn giản. Bạn có thể sửa prompt bên dưới.</span>
        </div>
      )}

      {/* Tổng quan */}
      <div className="grid grid-cols-3 gap-3">
        {[
          ['Bài tập', plan.exerciseCount],
          ['Câu hỏi', plan.questionCount],
          ['Ảnh cần tạo', included.length],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl bg-slate-50 border border-slate-200 p-3 text-center">
            <div className="text-xl font-bold text-slate-900">{value}</div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-1">
        {plan.exercises.map((ex) => (
          <div key={ex.index} className="flex items-center gap-2 text-[11px] text-slate-600">
            <span className="font-bold text-slate-800">Bài {ex.index}</span>
            <span className="truncate">{ex.title}</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono text-[9px]">{ex.detectedType}</span>
            <span>{ex.questionCount} câu</span>
            <span className={ex.needsImages ? 'text-violet-600 font-semibold' : 'text-slate-400'}>
              {ex.needsImages ? `· cần ảnh` : '· không cần ảnh'}
            </span>
            {ex.reason && <span className="text-slate-400 truncate hidden md:inline">— {ex.reason}</span>}
          </div>
        ))}
      </div>

      {/* Bất đồng AI vs parser */}
      {diffs.length > 0 && !fromFallback && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 space-y-1">
          <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
            <AlertTriangle size={13} /> AI và parser có {diffs.length} điểm khác nhau — hãy kiểm tra:
          </div>
          <ul className="text-[11px] text-amber-900 list-disc pl-5 space-y-0.5">
            {diffs.map((d) => <li key={d.id}>{d.message}</li>)}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <ul className="text-[10px] text-slate-500 list-disc pl-5 space-y-0.5">
          {warnings.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      )}

      {/* Phong cách chung */}
      <label className="block text-[11px] font-bold text-slate-600">
        Phong cách chung (gắn vào mọi prompt)
        <textarea
          value={style}
          onChange={(e) => onChange({ ...state, style: e.target.value })}
          rows={2}
          className="mt-1 w-full text-xs rounded-xl border border-slate-200 bg-slate-50 p-2 font-normal focus:outline-none focus:border-violet-400"
        />
      </label>

      {/* Danh sách ảnh */}
      {plan.images.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">AI cho rằng đề này không cần ảnh minh họa.</p>
      ) : (
        <div className="space-y-3">
          {plan.images.map((im) => {
            const off = excluded.has(im.slotId);
            const refs = referenceBySlot[im.slotId] || [];
            return (
              <div key={im.slotId} className={`rounded-2xl border p-3 space-y-2 ${off ? 'border-slate-200 bg-slate-50 opacity-60' : 'border-violet-200 bg-violet-50/30'}`}>
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <label className="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={!off} onChange={() => toggle(im.slotId)} />
                    Bài {im.exerciseIndex} · Picture {im.label}
                  </label>
                  <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-[9px] text-slate-500" title="Mã ô ảnh đích">
                    slotId: {im.slotId}
                  </span>
                  {im.answerKeyLabel && <span className="text-slate-500">đáp án gắn: {im.answerKeyLabel}</span>}
                  {im.relatedQuestionNumbers.length > 0 && <span className="text-slate-500">câu {im.relatedQuestionNumbers.join(', ')}</span>}
                  <select
                    value={im.aspectRatio}
                    onChange={(e) => patchImage(im.slotId, { aspectRatio: e.target.value as any })}
                    className="ml-auto text-[11px] border border-slate-200 rounded-lg bg-white px-1.5 py-0.5"
                    disabled={off}
                  >
                    {['1:1', '4:3', '16:9', '3:4'].map((r) => <option key={r}>{r}</option>)}
                  </select>
                </div>

                <input
                  value={im.subject}
                  onChange={(e) => patchImage(im.slotId, { subject: e.target.value })}
                  disabled={off}
                  className="w-full text-xs font-semibold rounded-lg border border-slate-200 bg-white px-2 py-1"
                  aria-label="Chủ đề ảnh"
                />
                <textarea
                  value={im.prompt}
                  onChange={(e) => patchImage(im.slotId, { prompt: e.target.value })}
                  disabled={off}
                  rows={2}
                  className="w-full text-xs rounded-lg border border-slate-200 bg-white px-2 py-1 leading-relaxed"
                  aria-label="Prompt ảnh"
                />
                <p className="text-[10px] text-slate-400 leading-snug">
                  Prompt gửi đi: {buildFinalPrompt(im.prompt, style)}
                </p>

                <div className="flex flex-wrap items-center gap-3 text-[11px]">
                  <label className="flex items-center gap-1.5 text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={im.needsReference} disabled={off} onChange={(e) => patchImage(im.slotId, { needsReference: e.target.checked })} />
                    Cần ảnh tham chiếu
                  </label>
                  {im.needsReference && (
                    <>
                      {im.referenceNote && <span className="text-slate-500 italic">AI: {im.referenceNote}</span>}
                      <label className="inline-flex items-center gap-1 font-bold text-violet-700 cursor-pointer px-2 py-1 rounded-lg border border-violet-200 bg-white hover:bg-violet-50">
                        <Upload size={11} /> Thêm ảnh
                        <input type="file" accept="image/*" multiple hidden onChange={(e) => { addReference(im.slotId, e.target.files); e.currentTarget.value = ''; }} />
                      </label>
                      <div className="flex items-center gap-1">
                        {refs.map((r, i) => (
                          <span key={i} className="relative">
                            <img src={r} alt="" className="w-8 h-8 object-cover rounded border border-slate-200" />
                            <button onClick={() => removeReference(im.slotId, i)} className="absolute -top-1 -right-1 bg-white border border-slate-300 rounded-full p-0.5" aria-label="Xóa ảnh tham chiếu">
                              <X size={8} />
                            </button>
                          </span>
                        ))}
                        {refs.length === 0 && <span className="text-amber-600 font-semibold flex items-center gap-1"><ImageIcon size={11} /> chưa có ảnh</span>}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {missingRef.length > 0 && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2">
          {missingRef.length} ảnh cần ảnh tham chiếu nhưng chưa có: các ảnh này sẽ chờ ở trạng thái “Cần ảnh tham chiếu” cho tới khi bạn bổ sung trong hàng đợi.
        </p>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        <span className="text-[11px] text-slate-400">Duyệt → dựng đề → tạo {included.length} ảnh lần lượt qua extension → lưu Supabase → tự gắn vào đúng ô.</span>
        <button
          onClick={onApprove}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold shadow-sm"
        >
          <CheckCircle2 size={14} /> Duyệt kế hoạch &amp; dựng đề
        </button>
      </div>
    </section>
  );
};
