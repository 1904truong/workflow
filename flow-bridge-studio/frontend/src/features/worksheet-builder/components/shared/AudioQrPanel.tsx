// Khối Audio & QR dùng chung cho các bài nghe: một hàng gọn (Upload / Phát / Liên kết / QR / Xóa),
// mở rộng ô dán link và khung QR khi cần. Mã QR tạo từ đường dẫn audio công khai.

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Headphones, Link2, Pause, Play, QrCode, Trash2, Upload } from 'lucide-react';
import type { ListeningAudio } from '../../services/listening/listeningGapFillCore';
import { formatAudioDuration, getAudioQrCodeUrl, normalizeAudioLink } from '../../services/listening/listeningGapFillCore';
import { TtsAudioButton } from './TtsAudioButton';
import { publicAudioUrl, type StoredAudio } from '../../services/tts/audioStorage';

interface Props {
  audio: ListeningAudio;
  showQr: boolean;
  onAudioChange: (next: ListeningAudio) => void;
  onShowQrChange: (show: boolean) => void;
}

const iconBtn = 'w-9 h-9 flex items-center justify-center rounded-lg border transition-colors';
const idle = 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200';
const on = 'bg-blue-100 border-blue-200 text-blue-700';

const readDuration = (url: string, done: (sec: number) => void) => {
  const probe = new Audio();
  probe.preload = 'metadata';
  probe.onloadedmetadata = () => done(probe.duration);
  probe.onerror = () => done(0);
  probe.src = url;
};

export const AudioQrPanel: React.FC<Props> = ({ audio, showQr, onAudioChange, onShowQrChange }) => {
  const [linkOpen, setLinkOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(true);
  const [linkInput, setLinkInput] = useState(audio.shareUrl || '');
  const [linkError, setLinkError] = useState('');
  const [copied, setCopied] = useState(false);
  const [playing, setPlaying] = useState(false);
  const player = useRef<HTMLAudioElement | null>(null);
  const audioRef = useRef(audio);
  audioRef.current = audio;

  useEffect(() => () => { player.current?.pause(); }, []);

  // Audio lưu trên Supabase: dựng lại link theo cấu hình hiện tại (đổi sang Supabase khác thì link tự theo)
  useEffect(() => {
    if (!audio.storagePath) return;
    const url = publicAudioUrl(audio.storagePath);
    if (url && (audio.audioUrl !== url || audio.shareUrl !== url)) onAudioChange({ ...audio, audioUrl: url, shareUrl: url, sourceType: 'link' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio.storagePath]);

  const handleStored = (stored: StoredAudio, file: File) => {
    stop();
    setLinkInput(stored.publicUrl);
    const base: ListeningAudio = { filename: file.name, sizeMb: `${(file.size / (1024 * 1024)).toFixed(1)} MB`, durationStr: '00:00', audioUrl: stored.publicUrl, shareUrl: stored.publicUrl, storagePath: stored.storagePath, sourceType: 'link' };
    withDuration(stored.publicUrl, base);
    onShowQrChange(true);
    setQrOpen(true);
  };

  const stop = () => { player.current?.pause(); player.current = null; setPlaying(false); };

  const withDuration = (url: string, base: ListeningAudio) => {
    onAudioChange(base);
    readDuration(url, (sec) => onAudioChange({ ...audioRef.current, durationStr: formatAudioDuration(sec), durationSeconds: sec || undefined }));
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) applyFile(file);
  };

  const applyFile = (file: File) => {
    stop();
    const url = URL.createObjectURL(file);
    withDuration(url, {
      filename: file.name,
      sizeMb: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      durationStr: '00:00',
      audioUrl: url,
      sourceType: 'file',
      shareUrl: undefined,
    });
  };

  const applyLink = () => {
    const url = normalizeAudioLink(linkInput);
    if (!url) { setLinkError('Đường dẫn không hợp lệ. Hãy dán link bắt đầu bằng http:// hoặc https://'); return; }
    setLinkError('');
    setLinkInput(url);
    stop();
    let name = url;
    try { const u = new URL(url); name = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || u.hostname); } catch { /* giữ nguyên */ }
    withDuration(url, { filename: name, sizeMb: 'Online link', durationStr: '00:00', audioUrl: url, shareUrl: url, sourceType: 'link' });
    onShowQrChange(true);
    setLinkOpen(false);
    setQrOpen(true);
  };

  const togglePlay = () => {
    if (!audio.audioUrl) return;
    if (!player.current) {
      player.current = new Audio(audio.audioUrl);
      player.current.onended = () => setPlaying(false);
    }
    if (playing) { player.current.pause(); setPlaying(false); }
    else { player.current.play().catch(() => {}); setPlaying(true); }
  };

  const remove = () => {
    if (!window.confirm('Xóa audio và mã QR này?')) return;
    stop();
    setLinkInput('');
    onAudioChange({ filename: 'No audio attached', sizeMb: '0 MB', durationStr: '00:00', audioUrl: undefined, shareUrl: undefined, sourceType: undefined });
  };

  const copy = async () => {
    if (!audio.shareUrl) return;
    try { await navigator.clipboard.writeText(audio.shareUrl); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }
    catch { window.prompt('Sao chép đường dẫn:', audio.shareUrl); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 p-2.5 bg-white border border-slate-200 rounded-xl">
        <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center shrink-0"><Headphones size={20} strokeWidth={1.75} /></div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900 truncate" title={audio.filename}>{audio.filename || 'No audio attached'}</p>
          <p className="text-xs text-slate-400 truncate">{audio.durationStr} · {audio.sizeMb}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <label className="h-9 px-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg cursor-pointer transition-colors" title="Tải file audio từ máy / thư viện">
            <Upload size={16} strokeWidth={1.75} /> Upload
            <input type="file" accept="audio/*" hidden onChange={handleFile} />
          </label>
          <TtsAudioButton onFile={applyFile} onStored={handleStored} />
          <button type="button" onClick={togglePlay} disabled={!audio.audioUrl} className="w-9 h-9 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-colors" title={audio.audioUrl ? (playing ? 'Tạm dừng' : 'Phát audio') : 'Chưa có audio để phát'}>
            {playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" className="ml-0.5" />}
          </button>
          <button type="button" onClick={() => setLinkOpen((v) => !v)} aria-expanded={linkOpen} className={`${iconBtn} ${linkOpen ? on : idle}`} title="Dán đường dẫn audio"><Link2 size={16} strokeWidth={1.75} /></button>
          <button type="button" onClick={() => setQrOpen((v) => !v)} aria-expanded={qrOpen} className={`relative ${iconBtn} ${qrOpen ? on : idle}`} title={audio.shareUrl ? 'Mã QR của audio' : 'Mã QR – cần dán đường dẫn audio'}>
            <QrCode size={16} strokeWidth={1.75} />
            {showQr && audio.shareUrl && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500" />}
          </button>
          <button type="button" onClick={remove} className={`${iconBtn} text-rose-500 bg-rose-50 hover:bg-rose-100 border-rose-100`} title="Xóa audio và mã QR"><Trash2 size={16} strokeWidth={1.75} /></button>
        </div>
      </div>

      {linkOpen && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <input
              type="url"
              autoFocus
              value={linkInput}
              onChange={(e) => { setLinkInput(e.target.value); setLinkError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') applyLink(); }}
              placeholder="https://… (link audio công khai)"
              className="flex-1 min-w-0 h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            <button type="button" onClick={applyLink} disabled={!linkInput.trim()} className="h-9 px-3 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-lg">Áp dụng</button>
          </div>
          {linkError && <p className="text-[11px] text-rose-600">{linkError}</p>}
        </div>
      )}

      {qrOpen && (
        <div className="p-3 border border-slate-200 rounded-xl bg-white space-y-2.5">
          <label className="flex items-center gap-2 text-[13px] font-semibold text-slate-800 cursor-pointer">
            <input type="checkbox" checked={showQr} onChange={(e) => onShowQrChange(e.target.checked)} className="rounded text-blue-600 focus:ring-0" />
            Hiện mã QR trên worksheet
          </label>
          {audio.shareUrl ? (
            <div className="flex items-start gap-3">
              <img src={getAudioQrCodeUrl(audio.shareUrl)} alt="QR audio" className="w-20 h-20 rounded-md border border-slate-200 p-1 shrink-0" />
              <div className="min-w-0 flex-1 space-y-1.5 text-xs">
                <p className="text-slate-500 break-all line-clamp-2" title={audio.shareUrl}>{audio.shareUrl}</p>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={copy} className="px-2.5 py-1 font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md">{copied ? 'Đã sao chép' : 'Sao chép link'}</button>
                  <a href={getAudioQrCodeUrl(audio.shareUrl)} target="_blank" rel="noreferrer" className="px-2.5 py-1 font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md">Mở ảnh QR</a>
                </div>
              </div>
            </div>
          ) : (
            <p className="flex items-start gap-2 text-xs leading-relaxed text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <AlertCircle size={16} strokeWidth={1.75} className="shrink-0 mt-px" />
              <span>
                {audio.sourceType === 'file'
                  ? 'File từ máy chỉ nghe thử trong editor. Hãy đưa lên nơi lưu trữ công khai rồi dán đường dẫn (nút liên kết) để tạo QR cho học sinh.'
                  : 'Chưa có đường dẫn audio. Bấm nút liên kết để dán link công khai.'}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
};
