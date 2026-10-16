import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Check, Search, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';
import type { LessonFolder } from '../../types';
import { askExtension } from '../../services/ai/extensionBridge';
import { fileToSmallDataUrl } from '../../types/branding';

interface CloudImage {
  id: string;
  url?: string;
  prompt?: string;
  path?: string;
}

interface PickedImage {
  imageUrl: string;
  caption?: string;
}

interface Props {
  folder: LessonFolder;
  onClose: () => void;
  /** Trả về các ảnh đã chọn (đã đổi sang dạng lưu được trong bài) */
  onPick: (images: PickedImage[]) => void;
}

/** Tải ảnh từ link (Supabase) rồi thu nhỏ thành data URL: link ký tên hết hạn sau vài ngày nên không lưu link. */
const urlToDataUrl = async (url: string): Promise<string> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const file = new File([blob], 'image', { type: blob.type || 'image/png' });
  return fileToSmallDataUrl(file, 900, 'image/jpeg');
};

export const MatchingPicturesGalleryPicker: React.FC<Props> = ({ folder, onClose, onPick }) => {
  const [tab, setTab] = useState<'folder' | 'cloud'>('folder');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [cloud, setCloud] = useState<CloudImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  // Ảnh đang dùng trong các bài của đề này
  const folderImages = useMemo(() => {
    const seen = new Set<string>();
    const out: { key: string; url: string; caption: string }[] = [];
    folder.exercises.forEach((ex) => {
      ex.imageSlots.forEach((s) => {
        if (s.assetUrl && !seen.has(s.assetUrl)) {
          seen.add(s.assetUrl);
          out.push({ key: `f_${s.slotId}`, url: s.assetUrl, caption: s.caption || s.label || ex.title });
        }
      });
      ex.matchingPictures?.images.forEach((im) => {
        if (im.imageUrl && !seen.has(im.imageUrl)) {
          seen.add(im.imageUrl);
          out.push({ key: `m_${im.id}`, url: im.imageUrl, caption: im.caption || `Image ${im.label}` });
        }
      });
    });
    return out;
  }, [folder.exercises]);

  const loadCloud = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await askExtension<{ images: CloudImage[] }>('LIST_CLOUD_IMAGES', { search: q, limit: 60 });
      if (res.error) {
        setCloud([]);
        setError(res.error.message);
      } else {
        setCloud(res.payload?.images || []);
      }
    } catch {
      setCloud([]);
      setError('Không kết nối được extension Flow Bridge. Bật extension, bấm Reload ở chrome://extensions rồi F5 trang này.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'cloud' && cloud.length === 0 && !error) void loadCloud('');
  }, [tab, cloud.length, error, loadCloud]);

  const count = Object.values(selected).filter(Boolean).length;
  const toggle = (k: string) => setSelected((s) => ({ ...s, [k]: !s[k] }));

  const confirm = async () => {
    setBusy(true);
    const picked: PickedImage[] = [];
    let failed = 0;
    for (const f of folderImages) {
      if (selected[f.key]) picked.push({ imageUrl: f.url, caption: f.caption });
    }
    for (const c of cloud) {
      if (!selected[`c_${c.id}`] || !c.url) continue;
      try {
        picked.push({ imageUrl: await urlToDataUrl(c.url), caption: (c.prompt || '').slice(0, 40) });
      } catch {
        failed += 1;
      }
    }
    setBusy(false);
    if (failed) window.alert(`${failed} ảnh trên Supabase không tải được (có thể link đã hết hạn hoặc bị chặn). Các ảnh còn lại vẫn được thêm.`);
    if (picked.length) onPick(picked);
    onClose();
  };

  const Tile: React.FC<{ k: string; url?: string; caption: string }> = ({ k, url, caption }) => {
    const on = !!selected[k];
    return (
      <button
        type="button"
        onClick={() => toggle(k)}
        aria-pressed={on}
        className={`relative rounded-xl overflow-hidden border text-left ${on ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-slate-200 hover:border-slate-300'}`}
      >
        {url ? <img src={url} alt={caption} className="w-full h-24 object-cover bg-slate-100" /> : <div className="w-full h-24 bg-slate-100" />}
        <div className="px-1.5 py-1 text-[10.5px] text-slate-600 truncate bg-white">{caption || '—'}</div>
        {on && <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center"><Check size={12} strokeWidth={3} /></span>}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Add from Gallery</h3>
          <div className="flex bg-slate-100 rounded-xl p-0.5 text-xs font-semibold ml-3">
            <button type="button" onClick={() => setTab('folder')} className={`px-3 py-1.5 rounded-lg ${tab === 'folder' ? 'bg-white shadow-xs text-blue-700' : 'text-slate-500'}`}>Ảnh trong đề ({folderImages.length})</button>
            <button type="button" onClick={() => setTab('cloud')} className={`px-3 py-1.5 rounded-lg ${tab === 'cloud' ? 'bg-white shadow-xs text-blue-700' : 'text-slate-500'}`}>Supabase</button>
          </div>
          <button type="button" onClick={onClose} className="ml-auto p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100" aria-label="Đóng"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {tab === 'folder' && (
            folderImages.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-10">Đề này chưa có ảnh nào ở các bài khác. Dùng tab Supabase hoặc Upload Images.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {folderImages.map((f) => <Tile key={f.key} k={f.key} url={f.url} caption={f.caption} />)}
              </div>
            )
          )}

          {tab === 'cloud' && (
            <>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadCloud(search.trim())}
                    placeholder="Tìm theo prompt..."
                    className="w-full pl-7 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-blue-400"
                  />
                </div>
                <button type="button" onClick={() => loadCloud(search.trim())} disabled={loading} className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 disabled:opacity-50">
                  <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Làm mới
                </button>
              </div>
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900"><AlertTriangle size={14} className="shrink-0 mt-0.5" /><span>{error}</span></div>
              )}
              {!error && !loading && cloud.length === 0 && <p className="text-xs text-slate-400 text-center py-10">Chưa có ảnh nào trên Supabase.</p>}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {cloud.map((c) => <Tile key={c.id} k={`c_${c.id}`} url={c.url} caption={c.prompt || c.path || ''} />)}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-100">
          <span className="text-xs text-slate-500">Đã chọn {count} ảnh. Ảnh Supabase được tải về và lưu trong bài (không phụ thuộc link hết hạn).</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">Hủy</button>
            <button type="button" onClick={confirm} disabled={count === 0 || busy} className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-xl flex items-center gap-1.5">
              {busy && <Loader2 size={13} className="animate-spin" />} Thêm {count || ''} ảnh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
