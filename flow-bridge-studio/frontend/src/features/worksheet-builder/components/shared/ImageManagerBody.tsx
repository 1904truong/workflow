// Phần thân khối "Image Manager" dùng chung cho mọi trình soạn: cùng tên nút, cùng bố cục, cùng chỗ báo trạng thái.
// Trình soạn giữ tiêu đề mục (SectionHead) của riêng mình và truyền dữ liệu / hàm xử lý vào đây.

import React, { useEffect, useRef, useState } from 'react';
import { Maximize2, ChevronDown, ChevronUp, FileText, ImagePlus, Layers, Mountain, Palette, Search, Sparkles, Upload, User, X, Image as ImageIcon, Ban, Building2, FileCode, FileImage, Moon, SignalHigh, SignalLow, SignalMedium, Trees, Waves, Wheat, House } from 'lucide-react';
import { allPresets, saveCustomPresets, loadCustomPresets } from '../../services/ai/stylePresets';
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

const PromptBox: React.FC<{ value: string; onChange: (v: string) => void; rows?: number }> = ({ value, onChange, rows = 1 }) => {
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
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Image prompt (generated from the exercise, editable)"
      className={`${fieldCls} resize-none min-h-[34px] ${rows > 1 ? 'text-xs' : 'text-[11px]'}`}
    />
  );
};

/** Logo nguồn ảnh vector sắc nét (file nằm trong public/platforms) */
const PROVIDER_ICON: Record<ImageProvider, string> = {
  flow: '/platforms/flow.svg',
  chatgpt: '/platforms/chatgpt.svg',
  magnific: '/platforms/magnific.svg',
  pexels: '/platforms/pexels.svg',
};
const COLOR_SWATCHES: { v: string; label: string; bg: string }[] = [
  { v: '', label: 'Auto', bg: '' },
  { v: 'black', label: 'Black', bg: 'rgb(29, 38, 45)' },
  { v: 'white', label: 'White', bg: 'rgb(255, 255, 255)' },
  { v: 'green', label: 'Green', bg: 'rgb(78, 220, 211)' },
  { v: 'cyan', label: 'Cyan', bg: 'rgb(146, 205, 250)' },
  { v: 'blue', label: 'Blue', bg: 'rgb(18, 115, 235)' },
  { v: 'purple', label: 'Purple', bg: 'rgb(128, 128, 241)' },
  { v: 'pink', label: 'Pink', bg: 'rgb(255, 192, 203)' },
  { v: 'red', label: 'Red', bg: 'rgb(251, 82, 82)' },
  { v: 'orange', label: 'Orange', bg: 'rgb(252, 161, 32)' },
  { v: 'yellow', label: 'Yellow', bg: 'rgb(252, 219, 126)' },
  { v: 'gray', label: 'Gray', bg: 'rgb(200, 200, 200)' },
];
const DUOTONES: { v: string; label: string; bg: string }[] = [
  { v: 'white-black', label: 'White & Black', bg: 'linear-gradient(135deg, white 50%, rgb(13, 13, 13) 50%)' },
  { v: 'gray-black', label: 'Gray & Black', bg: 'linear-gradient(135deg, rgb(200, 200, 200) 50%, rgb(13, 13, 13) 50%)' },
  { v: 'blue-green', label: 'Blue & Green', bg: 'linear-gradient(135deg, rgb(51, 106, 234) 50%, rgb(23, 209, 198) 50%)' },
  { v: 'red-blue', label: 'Red & Blue', bg: 'linear-gradient(135deg, rgb(235, 100, 76) 50%, rgb(31, 64, 140) 50%)' },
  { v: 'yellow-blue', label: 'Yellow & Blue', bg: 'linear-gradient(135deg, rgb(254, 182, 2) 50%, rgb(51, 106, 234) 50%)' },
  { v: 'green-yellow', label: 'Green & Yellow', bg: 'linear-gradient(135deg, rgb(23, 209, 198) 50%, rgb(254, 182, 2) 50%)' },
  { v: 'orange-red', label: 'Orange & Red', bg: 'linear-gradient(135deg, rgb(234, 126, 17) 50%, rgb(211, 72, 43) 50%)' },
  { v: 'yellow-red', label: 'Yellow & Red', bg: 'linear-gradient(135deg, rgb(254, 182, 2) 50%, rgb(211, 72, 43) 50%)' },
  { v: 'pink-blue', label: 'Pink & Blue', bg: 'linear-gradient(135deg, rgb(255, 216, 210) 50%, rgb(100, 142, 239) 50%)' },
  { v: 'pink-yellow', label: 'Pink & Yellow', bg: 'linear-gradient(135deg, rgb(255, 216, 210) 50%, rgb(254, 182, 2) 50%)' },
  { v: 'purple-blue', label: 'Purple & Blue', bg: 'linear-gradient(135deg, rgb(76, 80, 174) 50%, rgb(184, 203, 248) 50%)' },
  { v: 'gray-blue', label: 'Gray & Blue', bg: 'linear-gradient(135deg, rgb(200, 200, 200) 50%, rgb(100, 142, 239) 50%)' },
];
const AUTO_BG = 'conic-gradient(#ef4444 0deg 60deg,#f97316 60deg 120deg,#eab308 120deg 180deg,#22c55e 180deg 240deg,#3b82f6 240deg 300deg,#8b5cf6 300deg 360deg)';

/** Bảng chọn màu giống bảng màu của Magnific: màu đơn và Duotone */
const ColorPicker: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const cur = [...COLOR_SWATCHES, ...DUOTONES].find((c) => c.v === value) || COLOR_SWATCHES[0];
  const dot = (bg: string) => ({ background: bg || AUTO_BG });
  const Swatch = ({ c }: { c: { v: string; label: string; bg: string } }) => (
    <button
      type="button"
      title={c.label}
      onClick={() => { onChange(c.v); setOpen(false); }}
      className={`w-7 h-7 rounded-full border-2 ${value === c.v ? 'border-blue-600 ring-2 ring-blue-200' : 'border-slate-200 hover:border-slate-400'}`}
      style={dot(c.bg)}
    />
  );
  return (
    <div className="relative flex-1 min-w-0 h-full">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full h-full flex items-center gap-2 text-xs text-slate-900">
        <span className="w-4 h-4 rounded-full border border-slate-200 shrink-0" style={dot(cur.bg)} />
        <span className="flex-1 text-left truncate">{cur.label}</span>
        <ChevronDown size={14} className="text-slate-500" />
      </button>
      {open && (
        <div className="absolute left-0 top-9 z-20 w-64 rounded-xl bg-white border border-slate-200 shadow-xl p-3">
          <div className="flex flex-wrap gap-2">{COLOR_SWATCHES.map((c) => <Swatch key={c.v || 'auto'} c={c} />)}</div>
          <div className="text-xs text-slate-500 pt-3 pb-1.5">Duotone</div>
          <div className="flex flex-wrap gap-2">{DUOTONES.map((c) => <Swatch key={c.v} c={c} />)}</div>
        </div>
      )}
    </div>
  );
};

const RATIOS = ['', '1:1', '4:3', '3:4', '16:9', '9:16'];

/** Khung nhỏ có hình dạng đúng tỉ lệ (rộng : cao) */
const RatioIcon: React.FC<{ ratio: string }> = ({ ratio }) => {
  const [w, h] = ratio ? ratio.split(':').map(Number) : [1, 1];
  const k = 15 / Math.max(w, h);
  return <span className="inline-block rounded-[2px] border-2 border-current" style={{ width: Math.round(w * k), height: Math.round(h * k) }} />;
};

/** Danh sách chọn tỉ lệ, mỗi dòng có khung icon theo tỉ lệ */
const RatioPicker: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex-1 min-w-0 h-full">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full h-full flex items-center gap-2 text-xs text-slate-900">
        <span className="flex-1 text-left truncate">{value || 'Match exercise'}</span>
        <ChevronDown size={14} className="text-slate-500" />
      </button>
      {open && (
        <div className="absolute left-0 top-9 z-20 min-w-[9rem] rounded-xl bg-white border border-slate-200 shadow-xl py-1">
          {RATIOS.map((r) => (
            <button key={r || 'auto'} type="button" onClick={() => { onChange(r); setOpen(false); }} className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs hover:bg-slate-50 text-left ${value === r ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-800'}`}>
              <span className="w-5 flex justify-center"><RatioIcon ratio={r} /></span>{r || 'Match exercise'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

type IconOpt = { v: string; label: string; icon: React.ReactNode };
const ic = 15;
const AI_OPTS: IconOpt[] = [{ v: '', label: 'All', icon: <ImageIcon size={ic} /> }, { v: 'excluded', label: 'Exclude AI', icon: <Ban size={ic} /> }, { v: 'only', label: 'Only AI', icon: <Sparkles size={ic} /> }];
const COUNT_OPTS: IconOpt[] = ['1', '2', '3', '4'].map((n) => ({ v: n, label: n, icon: <Layers size={ic} /> }));
const DETAIL_OPTS: IconOpt[] = [{ v: 'high', label: 'High', icon: <SignalHigh size={ic} /> }, { v: 'medium', label: 'Medium', icon: <SignalMedium size={ic} /> }, { v: 'low', label: 'Low', icon: <SignalLow size={ic} /> }];
const FILE_OPTS: IconOpt[] = [{ v: '', label: 'All', icon: <FileText size={ic} /> }, { v: 'jpg', label: 'JPG', icon: <FileImage size={ic} /> }, { v: 'png', label: 'PNG', icon: <FileImage size={ic} /> }, { v: 'ai', label: 'AI', icon: <FileText size={ic} /> }, { v: 'eps', label: 'EPS', icon: <FileCode size={ic} /> }, { v: 'svg', label: 'SVG', icon: <FileCode size={ic} /> }, { v: 'psd', label: 'PSD', icon: <Layers size={ic} /> }];
const SCENERY_OPTS: IconOpt[] = [{ v: '', label: 'All', icon: <Mountain size={ic} /> }, { v: 'nature', label: 'Nature', icon: <Trees size={ic} /> }, { v: 'city', label: 'City', icon: <Building2 size={ic} /> }, { v: 'beach', label: 'Beach', icon: <Waves size={ic} /> }, { v: 'mountain', label: 'Mountain', icon: <Mountain size={ic} /> }, { v: 'countryside', label: 'Countryside', icon: <Wheat size={ic} /> }, { v: 'indoor', label: 'Indoor', icon: <House size={ic} /> }, { v: 'night', label: 'Night', icon: <Moon size={ic} /> }];

/** Danh sách chọn có khung icon cho từng giá trị */
const IconSelect: React.FC<{ value: string; options: IconOpt[]; onChange: (v: string) => void }> = ({ value, options, onChange }) => {
  const [open, setOpen] = useState(false);
  const cur = options.find((o) => o.v === value) || options[0];
  return (
    <div className="relative flex-1 min-w-0 h-full">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full h-full flex items-center gap-2 text-xs text-slate-900">
        <span className="shrink-0 text-slate-700">{cur.icon}</span>
        <span className="flex-1 text-left truncate">{cur.label}</span>
        <ChevronDown size={14} className="text-slate-500" />
      </button>
      {open && (
        <div className="absolute left-0 top-9 z-20 min-w-[10rem] max-h-56 overflow-y-auto rounded-xl bg-white border border-slate-200 shadow-xl py-1">
          {options.map((o) => (
            <button key={o.v || 'all'} type="button" onClick={() => { onChange(o.v); setOpen(false); }} className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs hover:bg-slate-50 text-left ${value === o.v ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-800'}`}>
              <span className="w-5 flex justify-center">{o.icon}</span>{o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/** Danh sách chọn style có ảnh nhỏ cạnh tên */
const PresetPicker: React.FC<{ value: string; presets: { id: string; name: string; thumb?: string }[]; onChange: (id: string) => void }> = ({ value, presets, onChange }) => {
  const [open, setOpen] = useState(false);
  const cur = presets.find((p) => p.id === value);
  const [zoom, setZoom] = useState<{ src: string; name: string } | null>(null);
  const Thumb = ({ src, name }: { src?: string; name?: string }) => src
    ? (
      <span
        role="button"
        title="Click to enlarge"
        onClick={(e) => { e.stopPropagation(); setZoom({ src, name: name || '' }); }}
        className="group relative w-9 h-9 min-w-[2.25rem] rounded-md overflow-hidden border border-slate-200 shrink-0 cursor-zoom-in flex-none"
      >
        <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <span className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white"><Maximize2 size={13} /></span>
      </span>
    )
    : <span className="w-9 h-9 min-w-[2.25rem] rounded-md bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center shrink-0 flex-none"><Sparkles size={14} /></span>;
  return (
    <div className="relative flex-1 min-w-0">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full h-11 px-2 rounded-lg bg-white border border-slate-200 flex items-center gap-2 text-xs text-slate-900">
        <Thumb src={cur?.thumb} name={cur?.name} />
        <span className="flex-1 text-left truncate">{cur ? cur.name : 'No style preset'}</span>
        <ChevronDown size={14} className="text-slate-500 shrink-0" />
      </button>
      {zoom && (
        <div className="fixed inset-0 z-[120] bg-black/70 flex items-center justify-center p-6" onClick={() => setZoom(null)}>
          <div className="relative max-w-[min(90vw,640px)]" onClick={(e) => e.stopPropagation()}>
            <img src={zoom.src} alt={zoom.name} className="max-h-[80vh] w-auto rounded-xl shadow-2xl" />
            <div className="mt-2 text-center text-sm font-semibold text-white">{zoom.name}</div>
            <button type="button" onClick={() => setZoom(null)} className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white text-slate-800 shadow flex items-center justify-center"><X size={16} /></button>
          </div>
        </div>
      )}
      {open && (
        <div className="absolute left-0 right-0 bottom-12 z-30 max-h-64 overflow-y-auto rounded-xl bg-white border border-slate-200 shadow-xl py-1">
          {[{ id: '', name: 'No style preset', thumb: undefined as string | undefined }, ...presets].map((p) => (
            <button key={p.id || 'none'} type="button" onClick={() => { onChange(p.id); setOpen(false); }} className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs hover:bg-slate-50 text-left ${value === p.id ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-800'}`}>
              <Thumb src={p.thumb} name={p.name} />
              <span className="flex-1 truncate">{p.name}</span>
              {value === p.id && <span>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const cfgSelect = 'flex-1 min-w-0 h-full bg-transparent text-xs text-slate-900 outline-none cursor-pointer';

/** Một ô cấu hình: nhãn phía trên, biểu tượng + điều khiển phía dưới; disabled = chưa nối với bộ lọc của trang tìm ảnh */
const CfgField: React.FC<{ label: string; icon: React.ReactNode; disabled?: boolean; children: React.ReactNode }> = ({ label, icon, disabled, children }) => (
  <div className={`rounded-lg border border-slate-200 p-2 space-y-1.5 ${disabled ? 'opacity-55' : 'bg-white'}`} title={disabled ? 'Not supported yet' : undefined}>
    <div className="text-xs font-bold text-slate-800">{label}</div>
    <div className={`h-8 px-2.5 rounded-md border border-slate-200 flex items-center gap-2 text-slate-700 ${disabled ? 'bg-slate-50 pointer-events-none' : 'bg-white'}`}>
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </div>
  </div>
);

export const ImageManagerBody: React.FC<Props> = ({
  slots, maxImages, onCountChange, onFile, onRemove, onGenerate, generating, prompt, onPromptChange, message, previewRatio = 16 / 10,
}) => {
  const main = slots[0];
  const { provider, keyword, filters, flowRatio, stockRatio, chatgptEffort, chatgptStyle, chatgptRefs, chatgptBg, chatgptStyleRef, chatgptPreset } = useImageSource();
  const [presets, setPresets] = useState(() => allPresets());
  const stock = provider === 'magnific' || provider === 'pexels';
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [refName, setRefName] = useState('');
  const PEOPLE_LABELS: Record<string, string> = { '4': '4+', 'young-adult': 'Young adult', 'south-asian': 'South Asian', 'middle-eastern': 'MENA', 'east-asian': 'East Asian', hispanic: 'Hispanic/Latino' };
  const cap = (v: string) => PEOPLE_LABELS[v] || v.charAt(0).toUpperCase() + v.slice(1);
  const peopleSummary =
    filters.people === 'exclude'
      ? 'No people'
      : filters.people === 'include'
        ? ['With people', filters.peopleRange && `${cap(filters.peopleRange)} person(s)`, filters.peopleGender && cap(filters.peopleGender), filters.peopleAge && cap(filters.peopleAge), filters.peopleEthnicity && cap(filters.peopleEthnicity)].filter(Boolean).join(' · ')
        : 'All';
  const [cfgOpen, setCfgOpen] = useState(false);
  const [ext, setExt] = useState<'checking' | 'ok' | 'no'>('checking');
  const [kw, setKw] = useState('');
  const [aiFilled, setAiFilled] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [manualKw, setManualKw] = useState(false);
  // Pexels chỉ có ô tìm kiếm: các lựa chọn được viết thẳng vào câu từ khóa
  const cap1 = (v: string) => v.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
  // Pexels chỉ hiểu từ khóa tự nhiên: chỉ ghi các lựa chọn đã đổi khỏi mặc định, mỗi lựa chọn là một vài từ tiếng Anh ngắn
  const peopleTxt = filters.people === 'exclude' ? 'no people'
    : filters.people === 'include' || filters.peopleGender || filters.peopleAge || filters.peopleEthnicity || filters.peopleRange
      ? [filters.peopleEthnicity && cap1(filters.peopleEthnicity), filters.peopleAge && cap1(filters.peopleAge), filters.peopleGender === 'male' ? 'man' : filters.peopleGender === 'female' ? 'woman' : 'people', filters.peopleRange && filters.peopleRange !== '1' ? `group of ${filters.peopleRange === '4' ? '4+' : filters.peopleRange}` : ''].filter(Boolean).join(' ').toLowerCase()
      : '';
  const orientTxt = ({ '1:1': 'square', '4:3': 'landscape', '16:9': 'landscape', '3:4': 'portrait', '9:16': 'portrait' } as Record<string, string>)[stockRatio] || '';
  const extras = provider === 'pexels' ? [
    filters.scenery,
    peopleTxt,
    filters.color ? filters.color.replace('-', ' ') : '',
    orientTxt,
  ].filter(Boolean).join(' ') : '';
  const kwWords = new Set(kw.toLowerCase().split(/\s+/));
  const extrasNew = extras.split(' ').filter((w) => !kwWords.has(w.toLowerCase())).join(' '); // không lặp từ đã có trong từ khóa
  const kwShown = !manualKw && extrasNew ? `${kw}${kw ? ' ' : ''}${extrasNew}` : kw;
  useEffect(() => { setManualKw(false); }, [filters, stockRatio, provider, cfgOpen]);
  const setOpenChip = (_: string | null) => undefined;
  const runAiKeyword = async () => {
    setAiBusy(true);
    const r = await suggestStockKeyword(prompt);
    setAiBusy(false);
    if (r.keyword) { setKw(r.keyword); setAiFilled(r.byAi); }
  };
  useEffect(() => {
    if (!cfgOpen) return;
    let alive = true;
    setExt('checking');
    void probeExtension().then((p) => { if (alive) setExt(p.present ? 'ok' : 'no'); });
    return () => { alive = false; };
  }, [cfgOpen]);

  // Mở bảng cho Magnific/Pexels: từ khóa trống thì nhờ AI đọc bài và điền sẵn (vẫn sửa tay được)
  useEffect(() => {
    if (!cfgOpen || !stock) return;
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
  }, [cfgOpen, provider, stock]);
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
          <div className="w-28 rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-400 text-[11px] flex items-center justify-center" style={{ aspectRatio: String(previewRatio) }}>No image</div>
        )}
        <div className="flex flex-col gap-1.5 items-start">
          <label className={`${smallBtn} cursor-pointer`}><ImagePlus size={12} /> Upload image<input type="file" accept="image/*" hidden onChange={pick(0)} /></label>
          <button type="button" onClick={() => setCfgOpen(true)} disabled={generating} className="px-2.5 h-7 rounded-lg bg-blue-600 text-white text-[11px] font-bold hover:bg-blue-700 disabled:opacity-40 flex items-center gap-1">
            {stock ? <Search size={12} /> : <ImagePlus size={12} />}
            {generating ? (stock ? 'Waiting for your pick…' : 'Generating…') : stock ? `Find image on ${PROVIDER_SHORT[provider]}` : main?.url ? 'Regenerate AI image' : 'Generate AI image'}
          </button>
          {main?.url && <button type="button" onClick={() => onRemove(0)} className="text-[11px] font-semibold text-rose-600 hover:underline">Remove image</button>}
        </div>
      </div>

      {maxImages && maxImages > 1 && onCountChange && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">Images
            <select value={slots.length} onChange={(e) => onCountChange(Number(e.target.value))} className={`${fieldCls} !w-16 !py-1`}>
              {Array.from({ length: maxImages }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          {slots.slice(1).map((slot, k) => (
            <span key={k} className="flex items-center gap-1.5">
              {slot.url
                ? <img src={slot.url} alt="" className="w-14 h-[40px] object-cover rounded-md border border-slate-200" />
                : <span className="w-14 h-[40px] rounded-md border border-dashed border-slate-300 bg-slate-50 text-[10px] text-slate-400 flex items-center justify-center">Image {k + 2}</span>}
              <label className={`${smallBtn} cursor-pointer`}>Image {k + 2}<input type="file" accept="image/*" hidden onChange={pick(k + 1)} /></label>
              {slot.url && <button type="button" onClick={() => onRemove(k + 1)} className="text-[11px] font-semibold text-rose-600 hover:underline">Remove</button>}
            </span>
          ))}
        </div>
      )}

      {stock ? (
        <input
          value={keyword}
          onChange={(e) => setImageSource({ keyword: e.target.value })}
          placeholder="Search keywords (leave empty: AI analyzes the exercise and picks short keywords)"
          className={`${fieldCls} text-[11px]`}
        />
      ) : (
        <PromptBox value={prompt} onChange={onPromptChange} />
      )}
      {cfgOpen && (
        <div className="fixed inset-0 z-[90] bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center p-4" onClick={() => { setCfgOpen(false); setOpenChip(null); }}>
          <div className="w-[min(519px,96vw)] h-[min(669px,94vh)] flex flex-col overflow-hidden rounded-2xl bg-white border border-slate-200 text-slate-900 shadow-2xl" onClick={(e) => { e.stopPropagation(); setOpenChip(null); }}>
            <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
              <h3 className="text-base font-bold">Confirm run</h3>
              <button type="button" onClick={() => setCfgOpen(false)} className="p-1 text-slate-400 hover:text-slate-800"><X size={18} /></button>
            </div>

            <div className="px-4 pb-3 space-y-2.5 flex-1 min-h-0 overflow-y-auto">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-slate-700">Image source</span>
                <div className="flex rounded-xl bg-slate-50 border border-slate-200 p-0.5">
                  {(Object.keys(PROVIDER_SHORT) as ImageProvider[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setImageSource({ provider: k })}
                      className={`px-2.5 h-7 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 leading-none shrink-0 ${provider === k ? 'bg-blue-100 text-blue-700 shadow-xs' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100/60'}`}
                    >
                      <span className="w-4 h-4 shrink-0 flex items-center justify-center overflow-hidden rounded-[3px]">
                        <img src={PROVIDER_ICON[k]} alt="" className="w-full h-full object-contain block !m-0 !p-0" />
                      </span>
                      <span className="leading-none">{PROVIDER_SHORT[k]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg border border-slate-200/80 bg-white flex items-center justify-center shrink-0 shadow-xs overflow-hidden p-0.5">
                    <img src={PROVIDER_ICON[provider]} alt="" className="w-7 h-7 object-contain block !m-0" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{PROVIDER_SHORT[provider]}</span>
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-100 text-blue-700 text-[11px] font-semibold">{stock ? 'Pick image' : 'AI generated'}</span>
                    </div>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${ext === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : ext === 'no' ? 'bg-rose-50 text-rose-700 border border-rose-200/60' : 'bg-slate-100 text-slate-500'}`}>
                  {ext === 'ok' ? '✓ Ready' : ext === 'no' ? 'Extension not connected' : 'Checking…'}
                </span>
              </div>

              {provider === 'chatgpt' && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="text-xs font-bold text-slate-800">Prompt</div>
                    <PromptBox value={prompt} onChange={onPromptChange} rows={5} />
                    <div className="flex items-center gap-2">
                      <label className="h-8 px-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer">
                        <FileText size={14} /> Import from file
                        <input type="file" accept=".txt,text/plain" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void f.text().then((t) => onPromptChange(t.trim().slice(0, 3000))); }} />
                      </label>
                      <button type="button" onClick={() => onPromptChange('')} className="h-8 px-3 rounded-lg border border-blue-100 bg-blue-50 text-blue-700 text-xs font-semibold flex items-center gap-1.5 hover:bg-blue-100"><Sparkles size={14} /> From AI analysis</button>
                      <span className="ml-auto text-xs text-slate-400">{prompt.length}/3000</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-xs font-bold text-slate-800">Reference images <span className="font-normal text-slate-400">(optional, up to 3)</span></div>
                    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-slate-300 p-2.5">
                      {chatgptRefs.map((src, i) => (
                        <span key={i} className="relative">
                          <img src={src} alt="" className="w-14 h-14 object-cover rounded-lg border border-slate-200" />
                          <button type="button" onClick={() => setImageSource({ chatgptRefs: chatgptRefs.filter((_, k) => k !== i) })} className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] leading-none">×</button>
                        </span>
                      ))}
                      {chatgptRefs.length < 3 && (
                        <label className="flex-1 min-w-[10rem] h-14 text-xs text-slate-500 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 rounded-lg">
                          <Upload size={16} /> Upload reference image(s)
                          <span className="text-[10px] text-slate-400">JPG, PNG, WEBP (max 10MB each)</span>
                          <input type="file" accept="image/*" multiple hidden onChange={(e) => {
                            const files = Array.from(e.target.files || []).filter((f) => f.size <= 10 * 1024 * 1024).slice(0, 3 - chatgptRefs.length);
                            e.target.value = '';
                            void Promise.all(files.map((f) => new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f); }))).then((urls) => setImageSource({ chatgptRefs: [...chatgptRefs, ...urls] }));
                          }} />
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <CfgField label="Aspect ratio" icon={<RatioIcon ratio={flowRatio} />}><RatioPicker value={flowRatio} onChange={(v) => setImageSource({ flowRatio: v as typeof flowRatio })} /></CfgField>
                    <CfgField label="Background" icon={null}>
                      <IconSelect value={chatgptBg} onChange={(v) => setImageSource({ chatgptBg: v as typeof chatgptBg })} options={[{ v: 'auto', label: 'Auto (let ChatGPT decide)', icon: <Palette size={15} /> }, { v: 'transparent', label: 'Transparent', icon: <Layers size={15} /> }, { v: 'white', label: 'White', icon: <ImageIcon size={15} /> }, { v: 'black', label: 'Black', icon: <ImageIcon size={15} /> }]} />
                    </CfgField>
                    <div className="col-span-2">
                      <CfgField label="Reasoning effort" icon={<Sparkles size={15} />}>
                        <select value={chatgptEffort || 1} onChange={(e) => setImageSource({ chatgptEffort: Number(e.target.value) })} className={cfgSelect}>
                          <option value={1}>Instant (Level 1)</option>
                          <option value={2}>Medium (Level 2)</option>
                          <option value={3}>High (Level 3)</option>
                        </select>
                      </CfgField>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-xs font-bold text-slate-800">Style / Additional instructions <span className="font-normal text-slate-400">(optional)</span></div>
                    <div className="flex items-center gap-2">
                      <PresetPicker value={chatgptPreset} presets={presets} onChange={(id) => setImageSource({ chatgptPreset: id })} />
                      <button type="button" title="Save the text below as a new preset" onClick={() => {
                        const text = chatgptStyle.trim();
                        if (!text) { window.alert('Type the style text first, then save it as a preset.'); return; }
                        const name = window.prompt('Preset name?');
                        if (!name || !name.trim()) return;
                        const id = `custom-${Date.now().toString(36)}`;
                        saveCustomPresets([...loadCustomPresets(), { id, name: name.trim(), text }]);
                        setPresets(allPresets());
                        setImageSource({ chatgptPreset: id, chatgptStyle: '' });
                      }} className="h-9 px-3 rounded-lg border border-blue-100 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 shrink-0">Save preset</button>
                      {presets.find((p) => p.id === chatgptPreset)?.custom && (
                        <button type="button" title="Delete this preset" onClick={() => { saveCustomPresets(loadCustomPresets().filter((p) => p.id !== chatgptPreset)); setPresets(allPresets()); setImageSource({ chatgptPreset: '' }); }} className="h-9 px-2.5 rounded-lg border border-rose-100 bg-rose-50 text-rose-700 text-xs font-semibold shrink-0">Delete</button>
                      )}
                    </div>
                    <div className="flex items-start gap-2">
                      <textarea value={chatgptStyle} onChange={(e) => setImageSource({ chatgptStyle: e.target.value })} rows={2} placeholder="e.g. cartoon, realistic, watercolor, minimalist, keep the same character style, no text, bright colors…" className="flex-1 min-w-0 resize-none rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500" />
                      {chatgptStyleRef ? (
                        <span className="relative shrink-0" title="Style image: only its art style is copied">
                          <img src={chatgptStyleRef} alt="" className="w-10 h-10 object-cover rounded-lg border-2 border-violet-500" />
                          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 px-1 rounded bg-violet-600 text-white text-[8px] font-bold leading-3">STYLE</span>
                          <button type="button" onClick={() => setImageSource({ chatgptStyleRef: '' })} className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] leading-none">×</button>
                        </span>
                      ) : (
                        <label title="Upload style image (its art style will be copied)" className="shrink-0 w-10 h-10 rounded-lg border border-dashed border-violet-300 text-violet-700 flex items-center justify-center cursor-pointer hover:bg-violet-50">
                          <Upload size={15} />
                          <input type="file" accept="image/*" hidden onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = '';
                            if (!f || f.size > 10 * 1024 * 1024) return;
                            const r = new FileReader();
                            r.onload = () => setImageSource({ chatgptStyleRef: String(r.result) });
                            r.readAsDataURL(f);
                          }} />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {!stock && provider !== 'chatgpt' && (
                <div className="space-y-2.5">
                  <label className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-700">
                    <span>Aspect ratio</span>
                    <select
                      value={flowRatio}
                      onChange={(e) => setImageSource({ flowRatio: e.target.value as typeof flowRatio })}
                      className="h-9 min-w-[10rem] px-3 rounded-lg bg-white border border-slate-200 text-xs font-normal text-slate-900"
                    >
                      <option value="">Match exercise</option>
                      {['1:1', '4:3', '3:4', '16:9', '9:16'].map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </label>

                  

                  

                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-slate-800">Prompt</div>
                      <button type="button" onClick={() => onPromptChange('')} className="h-7 px-2.5 rounded-lg border border-blue-100 bg-blue-50 text-blue-700 text-[11px] font-semibold flex items-center gap-1 hover:bg-blue-100"><Sparkles size={13} /> Auto-write from exercise</button>
                    </div>
                    <PromptBox value={prompt} onChange={onPromptChange} />
                  </div>
                </div>
              )}

              {stock && (
                <>
                  {/* Mô tả / từ khóa */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-800">Description / Search keywords</div>
                    <div className="relative rounded-xl border border-slate-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
                      <textarea
                        value={kwShown}
                        maxLength={3000}
                        rows={2}
                        onChange={(e) => { const v = e.target.value; if (!manualKw && extrasNew && v.endsWith(` ${extrasNew}`)) setKw(v.slice(0, -(extrasNew.length + 1))); else if (!manualKw && extrasNew && v === extrasNew) setKw(''); else { setKw(v); if (extrasNew) setManualKw(true); } setAiFilled(false); }}
                        placeholder={aiBusy ? 'AI is analyzing the exercise for keywords…' : 'Enter a description or keywords to find images…\nExample: a girl and a teacher in classroom, cartoon, vector, children textbook'}
                        className="w-full resize-none rounded-xl bg-transparent px-3 py-2 pr-11 text-[13px] text-slate-900 placeholder:text-slate-400 outline-none"
                      />
                      <button type="button" title="Ask AI to analyze the exercise and suggest keywords" onClick={() => { void runAiKeyword(); }} disabled={aiBusy} className="absolute right-2 top-2 w-7 h-7 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center disabled:opacity-50"><Sparkles size={17} /></button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="h-8 px-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-2 cursor-pointer">
                        <FileText size={16} /> Import from file
                        <input type="file" accept=".txt,text/plain" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void f.text().then((t) => { setKw(t.replace(/\s+/g, ' ').trim().slice(0, 3000)); setAiFilled(false); }); }} />
                      </label>
                      <button type="button" onClick={() => { void runAiKeyword(); }} disabled={aiBusy} className="h-8 px-3 rounded-lg border border-blue-100 bg-blue-50 text-blue-700 text-xs font-semibold flex items-center gap-2 hover:bg-blue-100 disabled:opacity-60">
                        <Sparkles size={16} /> {aiBusy ? 'AI is analyzing…' : 'From AI analysis'}
                      </button>
                      {aiFilled && <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[11px] font-semibold">✦ Keywords filled by AI</span>}
                      <span className="ml-auto text-xs text-slate-400">{kw.length}/3000</span>
                    </div>
                  </div>

                  {/* Lưới cấu hình: ô sáng = đang dùng được; ô mờ = chưa nối với bộ lọc của trang tìm ảnh */}
                  <div className="grid grid-cols-3 gap-2">
                    {provider === 'magnific' && (
                      <CfgField label="Image type" icon={null}><IconSelect value={filters.ai} options={AI_OPTS} onChange={(v) => setImageSource({ filters: { ...filters, ai: v as typeof filters.ai } })} /></CfgField>
                    )}
                    <CfgField label="Aspect ratio" icon={<RatioIcon ratio={stockRatio} />}><RatioPicker value={stockRatio} onChange={(v) => setImageSource({ stockRatio: v as typeof stockRatio })} /></CfgField>
                    {stock && (
                      <>
                        {provider === 'magnific' && <CfgField label="Number of images" icon={null}><IconSelect value={filters.count} options={COUNT_OPTS} onChange={(v) => setImageSource({ filters: { ...filters, count: v as typeof filters.count } })} /></CfgField>}
                        <CfgField label="Color" icon={<Palette size={15} />}><ColorPicker value={filters.color} onChange={(v) => setImageSource({ filters: { ...filters, color: v } })} /></CfgField>
                        {provider === 'magnific' && <CfgField label="Detail level" icon={null}><IconSelect value={filters.detail} options={DETAIL_OPTS} onChange={(v) => setImageSource({ filters: { ...filters, detail: v as typeof filters.detail } })} /></CfgField>}
                        {provider === 'magnific' && <CfgField label="File type" icon={null}><IconSelect value={filters.fileType} options={FILE_OPTS} onChange={(v) => setImageSource({ filters: { ...filters, fileType: v as typeof filters.fileType } })} /></CfgField>}

                        {/* People: ô "mẹ" của Number of people / Gender / Age / Ethnicity; bấm mới xổ ra, có nút thu nhỏ lại */}
                        <div className={`col-span-3 rounded-lg border border-slate-200 bg-white p-2 space-y-1.5 ${provider === 'pexels' ? 'order-last' : ''}`}>
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-bold text-slate-800">People</div>
                            {peopleOpen && (
                              <button type="button" title="Collapse" onClick={() => setPeopleOpen(false)} className="w-6 h-6 rounded-md text-slate-500 hover:bg-slate-100 flex items-center justify-center"><ChevronUp size={15} /></button>
                            )}
                          </div>
                          {!peopleOpen ? (
                            <button type="button" onClick={() => setPeopleOpen(true)} className="w-full h-8 px-2.5 rounded-md border border-slate-200 bg-white flex items-center gap-2 text-xs text-slate-900 hover:bg-slate-50">
                              <User size={15} className="text-slate-700" />
                              <span className="flex-1 text-left">{peopleSummary}</span>
                              <ChevronDown size={15} className="text-slate-500" />
                            </button>
                          ) : (
                            <div className="space-y-2">
                              <div className="flex rounded-lg bg-slate-50 border border-slate-200 p-0.5 w-fit">
                                {([['', 'All'], ['exclude', 'No people'], ['include', 'With people']] as const).map(([v, t]) => (
                                  <button
                                    key={v}
                                    type="button"
                                    onClick={() => setImageSource({ filters: { ...filters, people: v, ...(v === 'include' ? {} : { peopleRange: '', peopleGender: '', peopleAge: '', peopleEthnicity: '' }) } })}
                                    className={`px-3 h-7 rounded-md text-xs font-semibold ${filters.people === v ? 'bg-blue-100 text-blue-700' : 'text-slate-700 hover:text-slate-900'}`}
                                  >
                                    {t}
                                  </button>
                                ))}
                              </div>
                              {filters.people === 'include' && (
                                <div className="grid grid-cols-2 gap-2">
                                  <CfgField label="Number of people" icon={<User size={15} />}>
                                    <select value={filters.peopleRange} onChange={(e) => setImageSource({ filters: { ...filters, peopleRange: e.target.value as typeof filters.peopleRange } })} className={cfgSelect}>
                                      <option value="">Any</option>
                                      <option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4+</option>
                                    </select>
                                  </CfgField>
                                  <CfgField label="Gender" icon={<User size={15} />}>
                                    <select value={filters.peopleGender} onChange={(e) => setImageSource({ filters: { ...filters, peopleGender: e.target.value as typeof filters.peopleGender } })} className={cfgSelect}>
                                      <option value="">Any</option>
                                      <option value="male">Male</option><option value="female">Female</option>
                                    </select>
                                  </CfgField>
                                  <CfgField label="Age" icon={<User size={15} />}>
                                    <select value={filters.peopleAge} onChange={(e) => setImageSource({ filters: { ...filters, peopleAge: e.target.value as typeof filters.peopleAge } })} className={cfgSelect}>
                                      <option value="">Any</option>
                                      <option value="infant">Infant</option><option value="child">Child</option><option value="teen">Teen</option>
                                      <option value="young-adult">Young adult</option><option value="adult">Adult</option><option value="senior">Senior</option><option value="elder">Elder</option>
                                    </select>
                                  </CfgField>
                                  <CfgField label="Ethnicity" icon={<User size={15} />}>
                                    <select value={filters.peopleEthnicity} onChange={(e) => setImageSource({ filters: { ...filters, peopleEthnicity: e.target.value as typeof filters.peopleEthnicity } })} className={cfgSelect}>
                                      <option value="">Any</option>
                                      <option value="south-asian">South Asian</option><option value="middle-eastern">MENA</option><option value="east-asian">East Asian</option>
                                      <option value="black">Black</option><option value="hispanic">Hispanic/Latino</option><option value="white">White</option><option value="multiracial">Multiracial</option>
                                    </select>
                                  </CfgField>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className={provider === 'pexels' ? 'contents' : 'col-span-3 grid grid-cols-2 gap-2'}>
                          <CfgField label="Scenery" icon={null}><IconSelect value={filters.scenery} options={SCENERY_OPTS} onChange={(v) => setImageSource({ filters: { ...filters, scenery: v as typeof filters.scenery } })} /></CfgField>
                          {provider === 'magnific' && <CfgField label="Reference image" icon={<Upload size={15} />}><label className="flex-1 min-w-0 truncate text-xs text-slate-500 cursor-pointer">{refName || 'Upload reference image'}<input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; setRefName(f ? f.name : ''); }} /></label></CfgField>}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-800 leading-relaxed">
                    The extension opens the image search page and applies the filters above. Pick an image and click Download — it goes into the exercise automatically.
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 px-4 pb-3 pt-1 border-t border-slate-100 shrink-0">
              <button type="button" onClick={() => setCfgOpen(false)} className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-slate-800 text-xs font-bold hover:bg-slate-50 mt-3">Cancel</button>
              <button
                type="button"
                onClick={() => { if (stock) setImageSource({ keyword: kwShown.trim() }); setCfgOpen(false); onGenerate(); }}
                className="h-9 px-4 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 flex items-center gap-1.5 mt-3"
              >
                ▷ {stock ? `Find on ${PROVIDER_SHORT[provider]}` : `Run with ${PROVIDER_SHORT[provider]}`}
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
