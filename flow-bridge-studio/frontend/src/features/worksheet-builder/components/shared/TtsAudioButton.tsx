// Nút "Tạo audio": mở hộp nhập văn bản, đọc thành file mp3 rồi đưa vào bài như một file audio vừa tải lên.
// Hội thoại: mỗi dòng "A: ..." / "B: ..." dùng giọng của người đó; dòng không có tên dùng giọng người trước.

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, X } from 'lucide-react';
import { FALLBACK_VOICES, generateSpeech, listVoices, type TtsVoice } from '../../services/tts/ttsClient';
import { uploadAudioFile, type StoredAudio } from '../../services/tts/audioStorage';

interface Props {
  /** Nhận file vừa tạo (nghe thử trong editor). Nếu tải lên Supabase được thì onStored được gọi ngay sau đó. */
  onFile: (file: File) => void;
  /** File đã lưu trên Supabase: dùng storagePath + publicUrl để lưu lâu dài và tạo QR */
  onStored?: (stored: StoredAudio, file: File) => void;
  className?: string;
}

const SPEEDS: [string, string][] = [['-20%', 'Chậm (-20%)'], ['-10%', 'Hơi chậm (-10%)'], ['+0%', 'Bình thường'], ['+10%', 'Hơi nhanh (+10%)']];

export const TtsAudioButton: React.FC<Props> = ({ onFile, onStored, className }) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [voices, setVoices] = useState<TtsVoice[]>(FALLBACK_VOICES);
  const [voiceA, setVoiceA] = useState('en-US-JennyNeural');
  const [voiceB, setVoiceB] = useState('en-US-GuyNeural');
  const [rate, setRate] = useState('+0%');
  // dialogue: mỗi dòng A:/B: một giọng; monologue: một người đọc cả bài (nếu có A:/B: thì chỉ bỏ nhãn, vẫn một giọng)
  const [mode, setMode] = useState<'dialogue' | 'monologue'>('dialogue');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{ url: string; file: File } | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (!open || loaded.current) return;
    loaded.current = true;
    void listVoices().then(setVoices);
  }, [open]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  const close = () => { if (!busy) setOpen(false); };

  const run = async () => {
    if (!text.trim()) { setError('Hãy nhập nội dung cần đọc.'); return; }
    setBusy(true);
    setError('');
    setSaveFailed(false);
    setPreview(null);
    try {
      const blob = await generateSpeech({ text, voices: { _default: voiceA, A: voiceA, B: mode === 'monologue' ? voiceA : voiceB }, rate });
      const file = new File([blob], `tts_${Date.now()}.mp3`, { type: 'audio/mpeg' });
      setPreview({ url: URL.createObjectURL(blob), file });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tạo audio thất bại');
    } finally {
      setBusy(false);
    }
  };

  const use = async (saveToCloud: boolean) => {
    if (!preview) return;
    if (!saveToCloud) { onFile(preview.file); setOpen(false); return; }
    setBusy(true);
    setError('');
    try {
      const stored = await uploadAudioFile(preview.file);
      onFile(preview.file);
      onStored?.(stored, preview.file);
      setOpen(false);
    } catch (e) {
      setError(`${e instanceof Error ? e.message : 'Không lưu được audio'} — bạn vẫn có thể dùng tạm (không lưu, không có QR).`);
      setSaveFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const select = 'h-9 w-full px-2 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 outline-none focus:border-blue-500';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Tạo audio từ văn bản (giọng đọc AI)"
        className={className || 'h-9 px-3 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-lg transition-colors'}
      >
        <Mic size={16} strokeWidth={1.75} /> Tạo audio
      </button>
      {open && (
        <div className="fixed inset-0 z-[120] bg-black/50 flex items-center justify-center p-4" onClick={close}>
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Tạo audio từ văn bản</h3>
              <button type="button" onClick={close} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500"><X size={18} /></button>
            </div>

            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold">
              {([['dialogue', 'Hội thoại (2 người)'], ['monologue', 'Độc thoại (1 người)']] as const).map(([k, label]) => (
                <button key={k} type="button" onClick={() => setMode(k)} className={`px-3 h-8 rounded-lg transition-colors ${mode === k ? 'bg-white text-blue-700 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'}`}>{label}</button>
              ))}
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-bold text-slate-800">Nội dung <span className="font-normal text-slate-400">{mode === 'dialogue' ? '(mỗi dòng bắt đầu bằng A: hoặc B:)' : '(một người đọc toàn bộ, không cần ghi A:)'}</span></div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
                maxLength={20000}
                placeholder={mode === 'dialogue' ? 'A: Hi Tom, how do you go to school?\nB: I usually go by bike.' : 'My name is Linda and I am twelve years old. I live in a small town near the sea.'}
                className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500"
              />
              <div className="text-right text-[11px] text-slate-400">{text.length}/20000</div>
            </div>

            <div className={`grid gap-2 ${mode === 'dialogue' ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <label className="space-y-1"><span className="text-xs font-bold text-slate-800">{mode === 'dialogue' ? 'Giọng A' : 'Giọng đọc'}</span>
                <select value={voiceA} onChange={(e) => setVoiceA(e.target.value)} className={select}>{voices.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}</select></label>
              {mode === 'dialogue' && (
                <label className="space-y-1"><span className="text-xs font-bold text-slate-800">Giọng B</span>
                  <select value={voiceB} onChange={(e) => setVoiceB(e.target.value)} className={select}>{voices.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}</select></label>
              )}
              <label className="space-y-1"><span className="text-xs font-bold text-slate-800">Tốc độ</span>
                <select value={rate} onChange={(e) => setRate(e.target.value)} className={select}>{SPEEDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            </div>

            {error && <p className="text-[12px] rounded-md px-2.5 py-1.5 border text-rose-700 bg-rose-50 border-rose-100">{error}</p>}

            {preview && (
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-slate-800">Nghe thử</div>
                <audio src={preview.url} controls className="w-full h-9" />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={close} disabled={busy} className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-slate-800 text-xs font-bold hover:bg-slate-50 disabled:opacity-40">Hủy</button>
              <button type="button" onClick={() => { void run(); }} disabled={busy || !text.trim()} className="h-9 px-4 rounded-lg bg-slate-800 text-white text-xs font-bold hover:bg-slate-900 disabled:opacity-40 flex items-center gap-1.5">
                {busy && <Loader2 size={14} className="animate-spin" />} {busy ? 'Đang tạo…' : preview ? 'Tạo lại' : 'Tạo audio'}
              </button>
              {saveFailed && <button type="button" onClick={() => { void use(false); }} disabled={busy} className="h-9 px-4 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-bold hover:bg-slate-50 disabled:opacity-40">Dùng tạm</button>}
              <button type="button" onClick={() => { void use(true); }} disabled={!preview || busy} className="h-9 px-4 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-40">{saveFailed ? 'Thử lưu lại' : 'Dùng audio này'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
