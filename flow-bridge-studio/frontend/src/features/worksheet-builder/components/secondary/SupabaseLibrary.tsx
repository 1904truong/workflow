import React, { useCallback, useEffect, useState } from 'react';
import { Cloud, RefreshCw, Search, Copy, Check, AlertTriangle } from 'lucide-react';

// Ảnh đã lưu trên Supabase (qua extension Flow Bridge): web hỏi extension bằng postMessage,
// extension đọc thư viện cloud của tài khoản đang đăng nhập và trả về danh sách + link xem có chữ ký.
interface CloudImage {
  id: string;
  prompt: string;
  model: string | null;
  aspectRatio: string | null;
  createdAt: string;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  storagePath: string;
  url: string | null;
}

function askExtension<T = any>(type: string, payload: unknown, timeoutMs = 20000): Promise<{ payload: T; error?: { code: string; message: string } }> {
  return new Promise((resolve, reject) => {
    const id = `${type.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const timer = setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new Error('EXTENSION_UNAVAILABLE'));
    }, timeoutMs);
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.id !== id || data.source !== 'extension') return;
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      resolve({ payload: data.payload, error: data.error });
    };
    window.addEventListener('message', onMessage);
    window.postMessage({ id, type, source: 'web', timestamp: Date.now(), payload }, window.location.origin);
  });
}

// storage_path dạng  ChatGPT/2026-10-13/ten_anh.png  hoặc  <uid>/Flow/2026-10-13/...
function describePath(path: string) {
  const parts = path.split('/').filter(Boolean);
  const platform = parts.find((p) => /^(ChatGPT|Flow|Gemini|Grok)$/i.test(p)) || 'Khác';
  const day = parts.find((p) => /^\d{4}-\d{2}-\d{2}$/.test(p)) || '';
  return { platform, day };
}

export const SupabaseLibrary: React.FC = () => {
  const [images, setImages] = useState<CloudImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await askExtension<{ images: CloudImage[] }>('LIST_CLOUD_IMAGES', { search: q, limit: 60 });
      if (res.error) {
        setImages([]);
        setError(res.error.message);
      } else {
        setImages(res.payload?.images || []);
      }
    } catch {
      setImages([]);
      setError('Không kết nối được Extension. Hãy bật extension Flow Bridge, bấm Reload ở chrome://extensions rồi F5 lại trang này.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load('');
  }, [load]);

  const copyLink = async (img: CloudImage) => {
    if (!img.url) return;
    try {
      await navigator.clipboard.writeText(img.url);
      setCopiedId(img.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* clipboard bị chặn: bỏ qua */
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Cloud size={18} className="text-emerald-600" />
            Thư viện Supabase
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              {images.length} ảnh
            </span>
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Ảnh tạo từ ChatGPT / Google Flow được extension lưu lên Supabase. Danh sách này lấy trực tiếp từ cloud.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load(search.trim())}
              placeholder="Tìm theo prompt..."
              className="pl-7 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-blue-400 w-44"
            />
          </div>
          <button
            onClick={() => load(search.trim())}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {!error && !loading && images.length === 0 && (
        <p className="text-xs text-slate-400 text-center py-8">
          Chưa có ảnh nào trên Supabase. Bấm “Tạo với Flow” ở AI Image Studio hoặc tạo ảnh bằng ChatGPT qua extension để ảnh xuất hiện ở đây.
        </p>
      )}

      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {images.map((img) => {
            const { platform, day } = describePath(img.storagePath);
            return (
              <div key={img.id} className="border border-slate-200 rounded-2xl overflow-hidden bg-white flex flex-col">
                <div className="h-36 bg-slate-50 flex items-center justify-center p-2 relative">
                  {img.url ? (
                    <a href={img.url} target="_blank" rel="noreferrer" className="w-full h-full block" title="Mở ảnh gốc">
                      <img src={img.url} alt={img.prompt} className="w-full h-full object-contain" loading="lazy" />
                    </a>
                  ) : (
                    <span className="text-[10px] text-slate-400">Không tạo được link xem</span>
                  )}
                  <span className="absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white">
                    ☁ {platform}
                  </span>
                </div>
                <div className="p-3 border-t border-slate-100 space-y-1.5 flex-1 flex flex-col justify-between">
                  <p className="text-[11px] font-semibold text-slate-800 line-clamp-2" title={img.prompt}>
                    {img.prompt}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>
                      {day || img.createdAt?.slice(0, 10)}
                      {img.width && img.height ? ` · ${img.width}×${img.height}` : ''}
                    </span>
                    <button
                      onClick={() => copyLink(img)}
                      disabled={!img.url}
                      className="flex items-center gap-1 font-bold text-blue-600 hover:text-blue-700 disabled:opacity-40"
                      title="Sao chép link ảnh (hiệu lực 24 giờ)"
                    >
                      {copiedId === img.id ? <Check size={11} /> : <Copy size={11} />}
                      {copiedId === img.id ? 'Đã chép' : 'Link'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
