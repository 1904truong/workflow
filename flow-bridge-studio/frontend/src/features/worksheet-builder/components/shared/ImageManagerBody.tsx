// Phần thân khối "Image Manager" dùng chung cho mọi trình soạn: cùng tên nút, cùng bố cục, cùng chỗ báo trạng thái.
// Trình soạn giữ tiêu đề mục (SectionHead) của riêng mình và truyền dữ liệu / hàm xử lý vào đây.

import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Search, X } from 'lucide-react';
import { probeExtension, suggestStockKeyword } from '../../services/ai/useAiImage';
import { PROVIDER_SHORT, setImageSource, useImageSource, type ImageProvider } from '../../services/ai/imageSource';

export interface ImageSlotView {
  url?: string;
}

interface Props {
  /** Các khung ảnh hiện có (khung đầu là ảnh chính). Độ dài = số ảnh đang dùng */
  slots: ImageSlotView[];
  /** Cho phép chọn số ảnh 1..maxImages; bỏ trống = bài chỉ có một ảnh */
  maxImages?: number;
  onCountChange?: (n: number) => void;
  /** Tải ảnh từ máy cho khung idx (0 = ảnh chính) */
  onFile: (idx: number, file: File) => void;
  onRemove: (idx: number) => void;
  onGenerate: () => void;
  generating: boolean;
  prompt: string;
  onPromptChange: (v: string) => void;
  message?: string;
  /** Tỉ lệ khung xem trước (mặc định 16/10) */
  previewRatio?: number;
}

const fieldCls =
  'w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';
const smallBtn =
  'px-2.5 h-7 rounded-lg border border-blue-200 bg-white text-[11px] font-semibold text-blue-700 hover:bg-blue-50 flex items-center gap-1 disabled:opacity-40';

const PromptBox: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Prompt tạo ảnh (tự sinh từ nội dung bài, có thể sửa)"
      className={`${fieldCls} resize-none min-h-[34px] text-[11px]`}
    />
  );
};

const FilterChip: React.FC<{ label: string; summary: string; active: boolean; open: boolean; onToggle: () => void; children: React.ReactNode }> = ({ label, summary, active, open, onToggle, children }) => (
  <div className="relative">
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className={`h-10 px-3.5 rounded-xl border text-[13px] flex items-center gap-2 ${active && summary ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
    >
      {label}{summary ? <span className="font-semibold">: {summary}</span> : null}
      <span className="text-[10px] opacity-60">{open ? '▴' : '▾'}</span>
    </button>
    {open && (
      <div className="absolute left-0 top-11 z-10 min-w-[11rem] rounded-xl bg-white border border-slate-200 shadow-xl py-1.5" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    )}
  </div>
);

const CheckRow: React.FC<{ checked: boolean; text: string; onClick: () => void }> = ({ checked, text, onClick }) => (
  <button type="button" onClick={onClick} className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] hover:bg-slate-50 text-left">
    <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] leading-none ${checked ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'}`}>{checked ? '✓' : ''}</span>
    {text}
  </button>
);

export const ImageManagerBody: React.FC<Props> = ({
  slots, maxImages, onCountChange, onFile, onRemove, onGenerate, generating, prompt, onPromptChange, message, previewRatio = 16 / 10,
}) => {
  const main = slots[0];
  const { provider, keyword, filters, flowRatio } = useImageSource();
  const [cfgOpen, setCfgOpen] = useState(false);
  const [ext, setExt] = useState<'checking' | 'ok' | 'no'>('checking');
  const [kw, setKw] = useState('');
  const [aiFilled, setAiFilled] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [openChip, setOpenChip] = useState<string | null>(null);
  useEffect(() => {
    if (!cfgOpen) return;
    let alive = true;
    setExt('checking');
    void probeExtension().then((p) => { if (alive) setExt(p.present ? 'ok' : 'no'); });
    return () => { alive = false; };
  }, [cfgOpen]);

  // Mở bảng cho Magnific/Pexels: từ khóa trống thì nhờ AI đọc bài và điền sẵn (vẫn sửa tay được)
  useEffect(() => {
    if (!cfgOpen || provider === 'flow') return;
    setOpenChip(null);
    if (keyword.trim()) { setKw(keyword); setAiFilled(false); return; }
    setKw('');
    setAiFilled(false);
    let alive = true;
    setAiBusy(true);
    void suggestStockKeyword(prompt).then((r) => {
      if (!alive) return;
      setAiBusy(false);
      if (r.keyword) { setKw(r.keyword); setAiFilled(r.byAi); }
    });
    return () => { alive = false; setAiBusy(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfgOpen, provider]);
  const stock = provider !== 'flow';
  const pick = (idx: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) onFile(idx, f);
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-3">
        {main?.url ? (
          <img src={main.url} alt="" className="w-28 object-cover rounded-lg border border-slate-200" style={{ aspectRatio: String(previewRatio) }} />
        ) : (
          <div className="w-28 rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-400 text-[11px] flex items-center justify-center" style={{ aspectRatio: String(previewRatio) }}>Chưa có ảnh</div>
        )}
        <div className="flex flex-col gap-1.5 items-start">
          <label className={`${smallBtn} cursor-pointer`}><ImagePlus size={12} /> Tải ảnh từ máy<input type="file" accept="image/*" hidden onChange={pick(0)} /></label>
          <button type="button" onClick={() => setCfgOpen(true)} disabled={generating} className="px-2.5 h-7 rounded-lg bg-blue-600 text-white text-[11px] font-bold hover:bg-blue-700 disabled:opacity-40 flex items-center gap-1">
            {stock ? <Search size={12} /> : <ImagePlus size={12} />}
            {generating ? (stock ? 'Đang chờ chọn ảnh…' : 'Đang tạo…') : stock ? `Tìm ảnh trên ${PROVIDER_SHORT[provider]}` : main?.url ? 'Tạo lại ảnh AI' : 'Tạo ảnh AI'}
          </button>
          {main?.url && <button type="button" onClick={() => onRemove(0)} className="text-[11px] font-semibold text-rose-600 hover:underline">Xóa ảnh</button>}
        </div>
      </div>

      {maxImages && maxImages > 1 && onCountChange && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">Số ảnh
            <select value={slots.length} onChange={(e) => onCountChange(Number(e.target.value))} className={`${fieldCls} !w-16 !py-1`}>
              {Array.from({ length: maxImages }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          {slots.slice(1).map((slot, k) => (
            <span key={k} className="flex items-center gap-1.5">
              {slot.url
                ? <img src={slot.url} alt="" className="w-14 h-[40px] object-cover rounded-md border border-slate-200" />
                : <span className="w-14 h-[40px] rounded-md border border-dashed border-slate-300 bg-slate-50 text-[10px] text-slate-400 flex items-center justify-center">Ảnh {k + 2}</span>}
              <label className={`${smallBtn} cursor-pointer`}>Ảnh {k + 2}<input type="file" accept="image/*" hidden onChange={pick(k + 1)} /></label>
              {slot.url && <button type="button" onClick={() => onRemove(k + 1)} className="text-[11px] font-semibold text-rose-600 hover:underline">Xóa</button>}
            </span>
          ))}
        </div>
      )}

      {stock ? (
        <input
          value={keyword}
          onChange={(e) => setImageSource({ keyword: e.target.value })}
          placeholder="Từ khóa tìm ảnh (để trống: AI tự phân tích bài và rút từ khóa ngắn)"
          className={`${fieldCls} text-[11px]`}
        />
      ) : (
        <PromptBox value={prompt} onChange={onPromptChange} />
      )}
      {cfgOpen && (
        <div className="fixed inset-0 z-[90] bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center p-4" onClick={() => { setCfgOpen(false); setOpenChip(null); }}>
          <div className="w-[min(36rem,96vw)] max-h-[94vh] overflow-y-auto rounded-2xl bg-white border border-slate-200 text-slate-900 shadow-2xl" onClick={(e) => { e.stopPropagation(); setOpenChip(null); }}>
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <h3 className="text-lg font-bold">Xác nhận chạy</h3>
              <button type="button" onClick={() => setCfgOpen(false)} className="p-1 text-slate-400 hover:text-slate-800"><X size={18} /></button>
            </div>

            <div className="px-6 pb-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-700">Nguồn ảnh</span>
                <div className="flex rounded-xl bg-slate-50 border border-slate-200 p-0.5">
                  {(Object.keys(PROVIDER_SHORT) as ImageProvider[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setImageSource({ provider: k })}
                      className={`px-4 h-9 rounded-lg text-[13px] font-semibold transition-colors ${provider === k ? 'bg-blue-100 text-blue-700' : 'text-slate-700 hover:text-slate-900'}`}
                    >
                      {PROVIDER_SHORT[k]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500">{stock ? <Search size={18} /> : <ImagePlus size={18} />}</span>
                  <span className="font-bold text-[15px]">{PROVIDER_SHORT[provider]}</span>
                  <span className="px-3 py-1 rounded-lg bg-blue-50 border border-blue-100 text-blue-700 text-[13px] font-semibold">{stock ? 'Chọn ảnh' : 'Ảnh'}</span>
                </div>
                <span className={`px-3.5 py-1.5 rounded-full text-[13px] font-bold ${ext === 'ok' ? 'bg-emerald-50 text-emerald-700' : ext === 'no' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>
                  {ext === 'ok' ? '✓ Sẵn sàng' : ext === 'no' ? 'Chưa kết nối extension' : 'Đang kiểm tra…'}
                </span>
              </div>

              {!stock && (
                <label className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-700">Tỷ lệ
                  <select value={flowRatio} onChange={(e) => setImageSource({ flowRatio: e.target.value as typeof flowRatio })} className="h-10 min-w-[11rem] px-3 rounded-lg bg-white border border-slate-200 text-[13px] font-normal text-slate-900">
                    <option value="">Theo bài</option>
                    {['1:1', '4:3', '3:4', '16:9', '9:16'].map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </label>
              )}

              {stock && (
                <>
                  <div className="space-y-1.5">
                    <div className="text-sm font-semibold text-slate-700">Từ khóa tìm ảnh</div>
                    <div className="flex items-center gap-2 h-11 px-3.5 rounded-xl border border-slate-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
                      <input
                        value={kw}
                        onChange={(e) => { setKw(e.target.value); setAiFilled(false); }}
                        placeholder={aiBusy ? 'AI đang phân tích bài để rút từ khóa…' : 'Nhập từ khóa tìm ảnh'}
                        className="flex-1 min-w-0 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
                      />
                      {aiFilled && <span className="shrink-0 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-[12px] font-semibold">✦ AI đã điền từ khóa</span>}
                      {kw && <button type="button" onClick={() => { setKw(''); setAiFilled(false); }} className="shrink-0 text-slate-400 hover:text-slate-700"><X size={15} /></button>}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-start gap-2" onClick={(e) => e.stopPropagation()}>
                    {provider === 'magnific' && (
                      <FilterChip
                        label="AI-generated" active={!!filters.ai} open={openChip === 'ai'} onToggle={() => setOpenChip(openChip === 'ai' ? null : 'ai')}
                        summary={filters.ai === 'excluded' ? 'Exclude AI' : filters.ai === 'only' ? 'Only AI' : ''}
                      >
                        {([['excluded', 'Exclude AI'], ['only', 'Only AI']] as const).map(([v, t]) => (
                          <button key={v} type="button" onClick={() => setImageSource({ filters: { ...filters, ai: filters.ai === v ? '' : v } })} className="flex items-center justify-between gap-6 w-full px-3 py-2 text-[13px] hover:bg-slate-50">
                            {t}<span className={`w-4 h-4 rounded-full border-2 ${filters.ai === v ? 'border-blue-600 bg-blue-600 ring-2 ring-white ring-inset' : 'border-slate-300'}`} />
                          </button>
                        ))}
                      </FilterChip>
                    )}
                    <FilterChip
                      label="Orientation" active={filters.orientation !== 'auto'} open={openChip === 'orientation'} onToggle={() => setOpenChip(openChip === 'orientation' ? null : 'orientation')}
                      summary={({ landscape: 'Horizontal', portrait: 'Vertical', square: 'Square', panoramic: 'Panoramic', auto: '' } as const)[filters.orientation]}
                    >
                      {([['landscape', 'Horizontal'], ['portrait', 'Vertical'], ['square', 'Square'], ...(provider === 'magnific' ? [['panoramic', 'Panoramic']] : [])] as [typeof filters.orientation, string][]).map(([v, t]) => (
                        <CheckRow key={v} checked={filters.orientation === v} text={t} onClick={() => setImageSource({ filters: { ...filters, orientation: filters.orientation === v ? 'auto' : v } })} />
                      ))}
                      <div className="px-3 pt-1 pb-2 text-[11px] text-slate-400">Bỏ chọn = theo tỉ lệ của bài</div>
                    </FilterChip>
                    {provider === 'magnific' && (
                      <FilterChip
                        label="File type" active open={openChip === 'fileType'} onToggle={() => setOpenChip(openChip === 'fileType' ? null : 'fileType')}
                        summary={filters.fileType.toUpperCase()}
                      >
                        {(['jpg', 'png'] as const).map((v) => (
                          <CheckRow key={v} checked={filters.fileType === v} text={v.toUpperCase()} onClick={() => setImageSource({ filters: { ...filters, fileType: v } })} />
                        ))}
                        <div className="px-3 pt-1 pb-2 text-[11px] text-slate-400">Chỉ JPG/PNG vào được bài</div>
                      </FilterChip>
                    )}
                  </div>

                  <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-[13px] text-blue-800 leading-relaxed">
                    Extension sẽ mở trang tìm ảnh và tự chọn các bộ lọc trên. Bạn chọn ảnh rồi bấm Tải xuống, ảnh tự vào bài.
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 pb-5 pt-1 border-t border-slate-100 mt-1">
              <button type="button" onClick={() => setCfgOpen(false)} className="h-11 px-6 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-bold hover:bg-slate-50 mt-4">Hủy</button>
              <button
                type="button"
                onClick={() => { if (stock) setImageSource({ keyword: kw.trim() }); setCfgOpen(false); onGenerate(); }}
                className="h-11 px-6 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 flex items-center gap-2 mt-4"
              >
                ▷ {stock ? `Tìm trên ${PROVIDER_SHORT[provider]}` : 'Chạy'}
              </button>
            </div>
          </div>
        </div>
      )}
      {message && (
        <p className={`text-[11.5px] rounded-md px-2 py-1 border ${generating ? 'text-blue-700 bg-blue-50 border-blue-100' : 'text-amber-700 bg-amber-50 border-amber-100'}`}>{message}</p>
      )}
    </div>
  );
};
