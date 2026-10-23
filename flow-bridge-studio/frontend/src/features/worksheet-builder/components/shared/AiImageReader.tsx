// Nút "Đọc từ ảnh bằng AI" dùng chung cho các hộp Smart Paste có nhiều layout: teacher đưa ảnh đề (chọn file, kéo thả hoặc Ctrl+V),
// AI chọn layout khớp nhất trong danh sách layout của dạng bài và chép đề thành văn bản đúng định dạng của layout đó.
// Kết quả đổ vào ô dán để xem và sửa trước khi Áp dụng.

import React, { useEffect, useRef, useState } from 'react';
import { ImageUp, Loader2 } from 'lucide-react';
import { fileToSmallDataUrl } from '../../types/branding';
import { readWorksheetImage, type ImageLayoutChoice, type ReadImageOutcome } from '../../services/ai/aiRewrite';

interface Props {
  /** Tên dạng bài, gửi cho AI (ví dụ "Sentence Completion – Grammar Practice") */
  kind: string;
  /** Các layout AI được chọn: mô tả + định dạng + ví dụ của từng layout */
  layouts: ImageLayoutChoice[];
  /** Tên layout hiển thị cho teacher (id -> nhãn) */
  layoutLabel: (id: string) => string;
  /** Văn bản đã dán sẵn trong ô (nếu có), để AI đối chiếu chữ khó đọc */
  currentText?: string;
  /** Có kết quả: đổi layout và nội dung ô dán */
  onResult: (r: { layout: string; text: string; notes: string[] }) => void;
}

export const AiImageReader: React.FC<Props> = ({ kind, layouts, layoutLabel, currentText, onResult }) => {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  const busyRef = useRef(false);

  const run = async (file: File) => {
    if (busyRef.current) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) { setError('Chỉ nhận ảnh PNG, JPEG hoặc WebP.'); return; }
    busyRef.current = true;
    setBusy(true);
    setError('');
    setInfo('');
    try {
      // Ảnh gửi đi thu nhỏ còn tối đa 1600px: đủ rõ để đọc chữ, nhẹ để gửi
      const dataUrl = await fileToSmallDataUrl(file, 1600, 'image/jpeg');
      if (alive.current) setPreview(dataUrl);
      const out: ReadImageOutcome = await readWorksheetImage({ dataUrl, kind, layouts, text: currentText });
      if (!alive.current) return;
      if (!out.ok || !out.layout || !out.text) { setError(out.errorMessage || 'AI không đọc được ảnh này.'); return; }
      const pct = out.confidence != null ? ` (độ chắc chắn ${Math.round(out.confidence * 100)}%)` : '';
      setInfo(`AI chọn layout: ${layoutLabel(out.layout)}${pct}. Hãy xem lại nội dung rồi bấm Áp dụng.`);
      onResult({ layout: out.layout, text: out.text, notes: out.notes });
      if (out.notes.length) setInfo((s) => `${s}\n• ${out.notes.join('\n• ')}`);
    } catch {
      if (alive.current) setError('Không đọc được ảnh này.');
    } finally {
      busyRef.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    alive.current = true;
    // Ctrl+V ảnh (chụp màn hình) khi hộp đang mở
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items || []).find((i) => i.kind === 'file' && i.type.startsWith('image/'));
      const file = item?.getAsFile();
      if (!file) return;
      e.preventDefault();
      void runRef.current(file);
    };
    window.addEventListener('paste', onPaste);
    return () => { alive.current = false; window.removeEventListener('paste', onPaste); };
  }, []);

  return (
    <div
      className={`rounded-xl border border-dashed px-3 py-2 space-y-1.5 transition-colors ${drag ? 'border-violet-500 bg-violet-50' : 'border-violet-200 bg-violet-50/40'}`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) void run(f); }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          title="AI nhìn ảnh đề, tự chọn layout phù hợp và chép đề đúng định dạng"
          className="h-8 px-3 rounded-lg bg-violet-600 text-white text-[11px] font-bold hover:bg-violet-700 disabled:opacity-50 flex items-center gap-1.5"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <ImageUp size={13} />}
          {busy ? 'AI đang đọc ảnh…' : 'Đọc từ ảnh bằng AI'}
        </button>
        <span className="text-[10.5px] text-slate-500">Chọn ảnh, kéo thả vào đây hoặc nhấn Ctrl+V để dán ảnh chụp màn hình.</span>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void run(f); }} />
      </div>
      {preview && <img src={preview} alt="Ảnh đề" className="max-h-24 rounded-md border border-slate-200 bg-white object-contain" />}
      {error && <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</p>}
      {info && <p className="text-[11px] text-violet-900 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2 whitespace-pre-line">{info}</p>}
    </div>
  );
};
