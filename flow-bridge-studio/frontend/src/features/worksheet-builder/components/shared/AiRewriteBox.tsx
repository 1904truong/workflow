// Nút "Viết lại bằng AI" dùng chung cho mọi hộp Smart Paste: đặt ngay dưới ô dán.
// AI chỉ sắp xếp lại đúng chữ đã có theo định dạng của dạng bài (không thêm đáp án, không bịa nội dung); kết quả đổ lại vào ô dán để xem và sửa trước khi Áp dụng.

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { peekAiUsage, rewriteForExercise, type AiUsage } from '../../services/ai/aiRewrite';

interface Props {
  /** Tên dạng bài, gửi cho AI (ví dụ "Gap Filling") */
  kind: string;
  /** Mô tả định dạng (câu hướng dẫn của hộp Smart Paste) */
  hint: string;
  /** Ví dụ đúng định dạng (nội dung gợi ý của ô dán) */
  example: string;
  /** Nội dung đang có trong ô dán */
  text: string;
  /** Đổi nội dung ô dán */
  onText: (value: string) => void;
}

export const AiRewriteBox: React.FC<Props> = ({ kind, hint, example, text, onText }) => {
  const [busy, setBusy] = useState(false);
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [before, setBefore] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    void peekAiUsage().then((u) => { if (alive.current && u) setUsage(u); });
    return () => { alive.current = false; };
  }, []);

  const full = !!usage && usage.used >= usage.limit;

  const run = async () => {
    if (busy || !text.trim()) return;
    setBusy(true);
    setError('');
    setNotes([]);
    const original = text;
    const out = await rewriteForExercise({ text: original, kind, hint, example });
    if (!alive.current) return;
    setBusy(false);
    if (out.usage) setUsage(out.usage);
    if (!out.ok) { setError(out.errorMessage || 'Viết lại bằng AI thất bại.'); return; }
    setBefore(original);
    setNotes(out.notes);
    onText(out.text || original);
  };

  const undo = () => {
    if (before === null) return;
    onText(before);
    setBefore(null);
    setNotes([]);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void run()}
          disabled={busy || !text.trim() || full}
          title={full ? 'Đã hết lượt AI hôm nay' : 'AI sắp xếp lại đoạn vừa dán cho đúng định dạng của dạng bài này (không thêm hay sửa nội dung)'}
          className="h-8 px-3 rounded-lg border border-violet-200 bg-violet-50 text-violet-700 text-[11px] font-bold hover:bg-violet-100 disabled:opacity-40 flex items-center gap-1.5"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          {busy ? 'AI đang viết lại…' : 'Viết lại bằng AI'}
          {usage && !busy && <span className="font-semibold text-violet-500">· {usage.used}/{usage.limit}</span>}
        </button>
        {before !== null && (
          <button type="button" onClick={undo} className="h-8 px-2.5 rounded-lg text-[11px] font-semibold text-slate-600 hover:bg-slate-100 flex items-center gap-1.5">
            <RotateCcw size={12} /> Hoàn tác về bản gốc
          </button>
        )}
        <span className="text-[10.5px] text-slate-400">AI chỉ xếp lại cho đúng định dạng, không thêm đáp án.</span>
      </div>
      {error && <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</p>}
      {notes.length > 0 && (
        <ul className="text-[11px] text-violet-900 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2 list-disc list-inside space-y-0.5">
          {notes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      )}
      {before !== null && notes.length === 0 && (
        <p className="text-[11px] text-violet-900 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">Đã viết lại. Hãy xem lại nội dung rồi bấm Áp dụng.</p>
      )}
    </div>
  );
};
