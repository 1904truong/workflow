import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp, ArrowDown, Copy, Trash2, Plus, Minus, ImagePlus, X, Check, ClipboardPaste, AlertTriangle, GripVertical,
  ChevronUp, ChevronDown, Maximize2, FileText, LayoutGrid, Printer, Eye, ArrowDownUp, Sparkles, RefreshCw,
} from 'lucide-react';
import type { MatchingData, MatchingLayoutId, MatchingSettings } from '../../services/matching/matchingCore';
import {
  MATCHING_LAYOUTS, newId, solutionLabel, parseMatchingText, matchingFromParsed, removeProblem, removeSolution,
  moveItem, duplicateProblem, duplicateSolution, validateMatching, newReadingBlock, stripLatex,
} from '../../services/matching/matchingCore';
import type { ParsedMatching } from '../../services/matching/matchingCore';
import { fileToSmallDataUrl } from '../../types/branding';
import { MatchingRenderer } from './MatchingRenderer';
import { analyzeWorksheetWithAI } from '../../services/ai/aiAnalyzer';
import { generateImageViaExtension } from '../../services/ai/extensionBridge';
import { probeExtension } from '../../services/ai/useAiImage';
import type { AiImagePlan } from '../../services/ai/imagePlanSchema';
import { decideLayout, planTargets, runAutoImages, withPrompts, type AutoImageItem } from '../../services/matching/autoMatching';

interface Props {
  value: MatchingData;
  onChange: (next: MatchingData) => void;
  /** Smart Paste tìm thấy tiêu đề -> gợi ý cho trình soạn đặt tên bài */
  onTitleDetected?: (title: string) => void;
  title: string;
  setTitle: (v: string) => void;
  instructions: string;
  setInstructions: (v: string) => void;
}

const inputCls = 'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';
const iconBtn = 'p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent';

/** Hình thu nhỏ minh họa từng layout */
const Thumb = ({ id }: { id: MatchingLayoutId }) => {
  const line = <span className="block h-[3px] bg-slate-300 rounded w-full" />;
  const col = (n: number, dot?: 'l' | 'r') => (
    <div className="flex flex-col gap-[5px] flex-1">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex items-center gap-1">
          {dot === 'r' && <span className="w-1 h-1 rounded-full bg-slate-700 order-2" />}
          {dot === 'l' && <span className="w-1 h-1 rounded-full bg-slate-700" />}
          {line}
        </div>
      ))}
    </div>
  );
  switch (id) {
    case 'two_columns':
      return <div className="flex gap-1.5 w-full">{col(3)}<span className="w-px bg-slate-300" />{col(5)}</div>;
    case 'connect_lines':
      return <div className="flex gap-3 w-full">{col(3, 'r')}{col(5, 'l')}</div>;
    case 'answer_table':
      return (
        <div className="w-full space-y-1">
          <div className="border border-slate-300 rounded-sm divide-y divide-slate-300">
            {[0, 1, 2].map((i) => <div key={i} className="flex h-2 divide-x divide-slate-300"><span className="w-2" /><span className="flex-1" /><span className="w-4" /></div>)}
          </div>
          <div className="flex gap-1">{col(2)}{col(2)}</div>
        </div>
      );
    case 'inline_answer':
      return (
        <div className="flex gap-1.5 w-full">
          <div className="flex flex-col gap-[5px] flex-1">
            {[0, 1, 2].map((i) => <div key={i} className="flex items-center gap-1">{line}<span className="w-2.5 h-2.5 border border-slate-500 rounded-sm shrink-0" /></div>)}
          </div>
          <span className="w-px bg-slate-300" />{col(5)}
        </div>
      );
    case 'cut_paste':
      return (
        <div className="flex gap-1.5 w-full">
          <div className="flex flex-col gap-1 flex-1">
            {[0, 1, 2].map((i) => <span key={i} className="block h-3 border border-slate-600 rounded-sm" />)}
          </div>
          <div className="flex flex-col gap-1 flex-1">
            {[0, 1, 2, 3].map((i) => <span key={i} className="block h-2 border border-dashed border-slate-600 rounded-sm" />)}
          </div>
        </div>
      );
    case 'reading_images':
      return (
        <div className="flex flex-col gap-1 w-full">
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-1">
              <div className="flex flex-col gap-[3px] flex-1">{line}{line}{line}</div>
              <span className="w-5 h-4 bg-slate-300 rounded-sm shrink-0" />
            </div>
          ))}
          <div className="flex gap-1">{col(2)}<span className="w-5 h-3 border border-slate-400 rounded-sm shrink-0" /></div>
        </div>
      );
    case 'image_matching':
      return (
        <div className="flex gap-1.5 w-full">
          <div className="flex flex-col gap-1 flex-1">
            {[0, 1, 2].map((i) => <div key={i} className="flex items-center gap-1"><span className="w-4 h-3 bg-slate-300 rounded-sm" /><span className="w-2.5 h-2.5 border border-slate-500 rounded-sm" /></div>)}
          </div>
          <span className="w-px bg-slate-300" />{col(4)}
        </div>
      );
  }
};

/** Ô nhập nhiều dòng tự cao vừa đủ nội dung (không để dư dòng trống) */
const AutoTextarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [props.value]);
  return <textarea ref={ref} rows={1} {...props} />;
};

export const MatchingEditor: React.FC<Props> = ({ value, onChange, onTitleDetected, title, setTitle, instructions, setInstructions }) => {
  const [pasteText, setPasteText] = useState('');
  const [parsed, setParsed] = useState<ParsedMatching | null>(null);
  const [showPaste, setShowPaste] = useState(false);
  const [zoom, setZoom] = useState(70);
  const [imgError, setImgError] = useState<string | null>(null);
  const [tab, setTab] = useState<'content' | 'layout' | 'print' | 'preview'>('content');
  const [qaOpen, setQaOpen] = useState(true);
  const [readingOpen, setReadingOpen] = useState(true);
  const [collapsedBlocks, setCollapsedBlocks] = useState<Record<string, boolean>>({});
  const toggleBlockCollapse = (id: string) => {
    setCollapsedBlocks((prev) => ({ ...prev, [id]: !prev[id] }));
  };
  const [previewOpen, setPreviewOpen] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const dragRef = useRef<{ kind: 'problems' | 'solutions'; index: number } | null>(null);

  // ── Tự động hóa: chọn layout theo gợi ý AI + tự tạo ảnh qua extension
  type AutoState = { phase: 'idle' | 'analyzing' | 'generating' | 'done'; layoutReason: string; notes: string[]; items: AutoImageItem[] };
  const IDLE_AUTO: AutoState = { phase: 'idle', layoutReason: '', notes: [], items: [] };
  const [auto, setAuto] = useState<AutoState>(IDLE_AUTO);
  const [autoImages, setAutoImages] = useState(true);
  const latest = useRef<MatchingData>(value);
  latest.current = value;
  const cancelRef = useRef(false);
  const applyLatest = (next: MatchingData) => { latest.current = next; onChange(next); };


  const generateTargets = async (plan: AiImagePlan | null, force?: string) => {
    let data = latest.current;
    if (force) data = { ...data, reading: (data.reading || []).map((b) => (b.id === force ? { ...b, imageUrl: undefined } : b)) };
    const targets = planTargets(data, plan).filter((t) => !force || t.id === force);
    if (targets.length === 0) return [] as AutoImageItem[];
    applyLatest(withPrompts(latest.current, targets));
    setAuto((s) => ({ ...s, phase: 'generating', items: targets.map((t) => ({ ...t, status: 'queued' as const })) }));
    return runAutoImages({
      targets,
      getValue: () => latest.current,
      apply: applyLatest,
      generate: (o) => generateImageViaExtension({ prompt: o.prompt, aspectRatio: o.aspectRatio }),
      onProgress: (items) => setAuto((s) => ({ ...s, phase: 'generating', items })),
      isCancelled: () => cancelRef.current,
    });
  };

  const runAutomation = async (text: string, p: ParsedMatching) => {
    cancelRef.current = false;
    setAuto({ phase: 'analyzing', layoutReason: '', notes: [], items: [] });
    const notes: string[] = [];
    const probe = await probeExtension();
    const hasExt = probe.present;
    let plan: AiImagePlan | null = null;
    if (hasExt) {
      const out = await Promise.race([
        analyzeWorksheetWithAI(text),
        new Promise<null>((res) => setTimeout(() => res(null), 60000)),
      ]);
      if (out && out.ok && out.plan) plan = out.plan;
      else notes.push(`AI phân tích chưa dùng được${out?.errorCode ? ` (${out.errorCode})` : ''}: layout và prompt ảnh được tạo từ nội dung bài.`);
    }
    if (!probe.ready) {
      notes.push(`${probe.note} Đã chọn layout và soạn sẵn prompt; khi sẵn sàng, bấm “Tạo ảnh còn thiếu”.`);
    }
    const dec = decideLayout(p, plan, latest.current.layout);
    if (dec.layout !== latest.current.layout) applyLatest({ ...latest.current, layout: dec.layout });
    setAuto((s) => ({ ...s, layoutReason: dec.reason, notes }));
    if (!autoImagesRef.current) { setAuto((s) => ({ ...s, phase: 'done' })); return; }
    if (!probe.ready) {
      const pre = planTargets(latest.current, plan);
      if (pre.length) applyLatest(withPrompts(latest.current, pre));
      setAuto((s) => ({ ...s, phase: 'done' }));
      return;
    }
    await generateTargets(plan);
    setAuto((s) => ({ ...s, phase: 'done' }));
  };
  const autoImagesRef = useRef(true);
  autoImagesRef.current = autoImages;

  const retryMissingImages = async () => {
    cancelRef.current = false;
    const probe = await probeExtension();
    if (!probe.ready) {
      setAuto((s) => ({ ...s, phase: 'done', notes: [probe.note] }));
      return;
    }
    setAuto((s) => ({ ...s, phase: 'generating', notes: [] }));
    await generateTargets(null);
    setAuto((s) => ({ ...s, phase: 'done' }));
  };

  const regenerateBlockImage = async (blockId: string) => {
    cancelRef.current = false;
    const probe = await probeExtension();
    if (!probe.ready) {
      setAuto({ ...IDLE_AUTO, phase: 'done', notes: [probe.note] });
      return;
    }
    setAuto({ ...IDLE_AUTO, phase: 'generating' });
    await generateTargets(null, blockId);
    setAuto((s) => ({ ...s, phase: 'done' }));
  };
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tab !== 'layout' && tab !== 'print') return;
    const onDown = (e: MouseEvent) => { if (!tabsRef.current?.contains(e.target as Node)) setTab('content'); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setTab('content'); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [tab]);

  const validation = useMemo(() => validateMatching(value), [value]);
  const set = (patch: Partial<MatchingData>) => onChange({ ...value, ...patch });
  const setSettings = (patch: Partial<MatchingSettings>) => onChange({ ...value, settings: { ...value.settings, ...patch } });

  const goTab = (t: typeof tab) => {
    if (tab === t) return;
    setTab(t);
    if (t === 'preview') { setExpanded(true); }
  };

  // ── Bài đọc có ảnh (layout Reading + Images)
  const readingBlocks = value.reading || [];
  const setBlocks = (list: NonNullable<MatchingData['reading']>) => set({ reading: list });
  const patchBlock = (id: string, patch: Partial<NonNullable<MatchingData['reading']>[number]>) =>
    setBlocks(readingBlocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const pickBlockImage = async (id: string, files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    try {
      const url = await fileToSmallDataUrl(f, 900, 'image/jpeg');
      // Khung ảnh tự đổi theo tỉ lệ thật của ảnh để ảnh vừa khít, không bị cắt
      const ratio = await new Promise<number>((resolve) => {
        const im = new Image();
        im.onload = () => resolve(im.naturalWidth && im.naturalHeight ? Math.round((im.naturalWidth / im.naturalHeight) * 100) / 100 : 4 / 3);
        im.onerror = () => resolve(4 / 3);
        im.src = url;
      });
      patchBlock(id, { imageUrl: url, imageRatio: ratio });
      setImgError(null);
    } catch {
      setImgError('Không đọc được ảnh này.');
    }
  };

  // Bài dán trước khi có bộ dọn LaTeX còn các ký hiệu như \(\Box \): tự làm sạch một lần
  useEffect(() => {
    const dirty = (s?: string) => !!s && /\\[()[\]]|\\Box/.test(s);
    const needs =
      value.problems.some((i) => dirty(i.text)) || value.solutions.some((i) => dirty(i.text)) ||
      (value.reading || []).some((b) => dirty(b.text) || dirty(b.title)) || dirty(value.readingIntro);
    if (!needs) return;
    const clean = (s: string) => stripLatex(s).replace(/[ \t]+$/gm, '').trim();
    onChange({
      ...value,
      problems: value.problems.map((i) => ({ ...i, text: clean(i.text) })),
      solutions: value.solutions.map((i) => ({ ...i, text: clean(i.text) })),
      reading: (value.reading || []).map((b) => ({ ...b, text: clean(b.text), title: b.title ? clean(b.title) : b.title })),
      readingIntro: value.readingIntro ? clean(value.readingIntro) : value.readingIntro,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.problems, value.solutions, value.reading, value.readingIntro]);

  // ── Smart paste
  const runParse = () => setParsed(parseMatchingText(pasteText));
  const applyParsed = () => {
    if (!parsed || !parsed.ok) return;
    const hasContent = value.problems.length > 0 || value.solutions.length > 0;
    if (hasContent && !window.confirm('Thay toàn bộ problems/solutions hiện có (và đáp án đã chọn) bằng nội dung vừa dán?')) return;
    const nextData = matchingFromParsed(parsed, value);
    applyLatest(nextData);
    if (parsed.title) onTitleDetected?.(parsed.title);
    void runAutomation(pasteText, parsed);
    setParsed(null);
    setPasteText('');
    setShowPaste(false);
  };

  // ── Ảnh
  const pickImage = async (kind: 'problems' | 'solutions', id: string, files: FileList | null) => {
    const f = files?.[0];
    if (!f || !f.type.startsWith('image/')) return;
    try {
      const url = await fileToSmallDataUrl(f, 700, 'image/jpeg');
      set({ [kind]: value[kind].map((it) => (it.id === id ? { ...it, imageUrl: url } : it)) } as Partial<MatchingData>);
      setImgError(null);
    } catch {
      setImgError('Không đọc được ảnh này.');
    }
  };
  const clearImage = (kind: 'problems' | 'solutions', id: string) =>
    set({ [kind]: value[kind].map((it) => (it.id === id ? { ...it, imageUrl: undefined } : it)) } as Partial<MatchingData>);
  const editText = (kind: 'problems' | 'solutions', id: string, text: string) =>
    set({ [kind]: value[kind].map((it) => (it.id === id ? { ...it, text } : it)) } as Partial<MatchingData>);
  const confirmDelete = (what: string, fn: () => void) => { if (window.confirm(`Xóa ${what}?`)) fn(); };

  const renderRow = (kind: 'problems' | 'solutions', index: number) => {
    const list = value[kind];
    const item = list[index];
    const label = kind === 'problems' ? `${index + 1}.` : `${solutionLabel(index)}.`;
    return (
      <div
        className="group flex items-start gap-1.5 rounded-xl"
        onDragOver={(e) => { if (dragRef.current?.kind === kind) e.preventDefault(); }}
        onDrop={(e) => {
          const d = dragRef.current;
          if (!d || d.kind !== kind) return;
          e.preventDefault();
          set({ [kind]: moveItem(list, d.index, index) } as Partial<MatchingData>);
          dragRef.current = null;
        }}
      >
        <span className="w-5 pt-2 text-[11px] font-bold text-slate-500 shrink-0 text-right">{label}</span>
        <span
          draggable
          onDragStart={(e) => { dragRef.current = { kind, index }; e.dataTransfer.effectAllowed = 'move'; }}
          onDragEnd={() => { dragRef.current = null; }}
          className="pt-2 text-slate-300 hover:text-slate-600 cursor-grab active:cursor-grabbing shrink-0"
          title="Kéo để đổi vị trí"
        >
          <GripVertical size={14} />
        </span>
        <div className="flex-1 min-w-0 space-y-1">
          <AutoTextarea
            value={item.text}
            onChange={(e) => editText(kind, item.id, e.target.value)}
            className={`${inputCls} block w-full resize-none min-h-[34px]`}
            placeholder={kind === 'problems' ? 'Problem text...' : 'Solution text...'}
          />
          {item.imageUrl && (
            <div className="flex items-center gap-2">
              <img src={item.imageUrl} alt="" className="w-12 h-9 object-contain border border-slate-200 rounded bg-white" />
              <button type="button" onClick={() => clearImage(kind, item.id)} className="text-[11px] font-bold text-rose-600 flex items-center gap-1"><X size={11} /> Xóa ảnh</button>
            </div>
          )}
        </div>
        <div className="relative flex items-start shrink-0 pt-0.5">
          <label className={`${iconBtn} cursor-pointer`} title="Thêm / đổi ảnh minh họa">
            <ImagePlus size={15} />
            <input type="file" accept="image/*" hidden onChange={(e) => { void pickImage(kind, item.id, e.target.files); e.currentTarget.value = ''; }} />
          </label>
          <span className="absolute right-0 -top-1 hidden group-hover:flex group-focus-within:flex items-center bg-white border border-slate-200 rounded-lg shadow-md z-10">
            <button type="button" className={iconBtn} title="Lên" disabled={index === 0} onClick={() => set({ [kind]: moveItem(list, index, index - 1) } as Partial<MatchingData>)}><ArrowUp size={14} /></button>
            <button type="button" className={iconBtn} title="Xuống" disabled={index === list.length - 1} onClick={() => set({ [kind]: moveItem(list, index, index + 1) } as Partial<MatchingData>)}><ArrowDown size={14} /></button>
            <button type="button" className={iconBtn} title="Nhân bản" onClick={() => onChange(kind === 'problems' ? duplicateProblem(value, item.id) : duplicateSolution(value, item.id))}><Copy size={14} /></button>
            <button
              type="button"
              className={`${iconBtn} hover:!text-rose-600`}
              title="Xóa"
              onClick={() => confirmDelete(kind === 'problems' ? `problem ${index + 1}` : `solution ${solutionLabel(index)}`, () =>
                onChange(kind === 'problems' ? removeProblem(value, item.id) : removeSolution(value, item.id)))}
            >
              <Trash2 size={14} />
            </button>
          </span>
        </div>
      </div>
    );
  };

  const A4Preview = ({ scale }: { scale: number }) => (
    <div className="bg-white shadow mx-auto text-[#111]" style={{ width: '210mm', minHeight: '297mm', padding: '15mm', zoom: scale }}>
      <h2 className="font-bold uppercase" style={{ fontSize: '12pt' }}>{title || 'Exercise'}</h2>
      {instructions && <p className="italic mb-[3mm]" style={{ fontSize: '10.5pt' }}>{instructions}</p>}
      <MatchingRenderer data={value} />
    </div>
  );

  const StepNum = ({ n }: { n: number }) => (
    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">{n}</span>
  );

  const TABS: { id: typeof tab; label: string; icon: React.ReactNode }[] = [
    { id: 'content', label: 'Content', icon: <FileText size={15} /> },
    { id: 'layout', label: 'Layout', icon: <LayoutGrid size={15} /> },
    { id: 'print', label: 'Print Settings', icon: <Printer size={15} /> },
    { id: 'preview', label: 'Preview', icon: <Eye size={15} /> },
  ];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,1fr)] gap-6 items-start">
      {/* ───────── CỘT TRÁI: nội dung ───────── */}
      <div className="space-y-5 min-w-0">
        <div ref={tabsRef} className="relative">
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-2xl p-1.5 shadow-xs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => goTab(t.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors ${tab === t.id ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              {t.icon}{t.label}
            </button>
          ))}
          <span className="ml-auto px-3 py-1.5 rounded-lg bg-slate-100 text-[11px] font-medium text-slate-600">Type: Matching Information</span>
        </div>

        {tab === 'layout' && (
          <div className="absolute left-0 top-full mt-2 z-40 w-full bg-white border border-slate-200 rounded-2xl shadow-xl p-4 space-y-3">
            <div className="flex items-center">
              <span className="text-sm font-bold text-slate-900">Layout Style</span>
              <span className="ml-2 text-[11px] text-slate-400">Bấm để đổi, bảng bên phải cập nhật ngay</span>
              <button type="button" onClick={() => setTab('content')} className="ml-auto p-1 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100" aria-label="Đóng"><X size={15} /></button>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {MATCHING_LAYOUTS.map((l) => {
                const on = value.layout === l.id;
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => set({ layout: l.id })}
                    aria-pressed={on}
                    className={`relative rounded-xl border p-2 text-center transition-all ${on ? 'border-blue-500 ring-2 ring-blue-500/15 bg-blue-50/50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                  >
                    {on && <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center"><Check size={10} strokeWidth={3} /></span>}
                    <div className="h-11 flex items-center mb-1.5 px-0.5"><Thumb id={l.id} /></div>
                    <div className="text-[10px] font-semibold text-slate-700 leading-tight">{l.label}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {tab === 'print' && (
          <div className="absolute left-0 top-full mt-2 z-40 w-full bg-white border border-slate-200 rounded-2xl shadow-xl p-4 space-y-3">
            <div className="flex items-center">
              <span className="text-sm font-bold text-slate-900">Print Settings</span>
              <button type="button" onClick={() => setTab('content')} className="ml-auto p-1 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100" aria-label="Đóng"><X size={15} /></button>
            </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <label className="space-y-1"><span className="font-medium text-slate-600">Font size: {value.settings.fontSizePt}pt</span>
                  <input type="range" min={10} max={16} step={0.5} value={value.settings.fontSizePt} onChange={(e) => setSettings({ fontSizePt: Number(e.target.value) })} className="w-full" /></label>
                <label className="space-y-1"><span className="font-medium text-slate-600">Line spacing</span>
                  <select value={value.settings.lineSpacing} onChange={(e) => setSettings({ lineSpacing: e.target.value as MatchingSettings['lineSpacing'] })} className={inputCls}>
                    <option value="compact">Compact</option><option value="normal">Normal</option><option value="spacious">Spacious</option>
                  </select></label>
                <label className="space-y-1"><span className="font-medium text-slate-600">Column gap: {value.settings.columnGapMm}mm</span>
                  <input type="range" min={4} max={30} value={value.settings.columnGapMm} onChange={(e) => setSettings({ columnGapMm: Number(e.target.value) })} className="w-full" /></label>
              </div>
              {value.layout === 'cut_paste' && (
                <label className="block text-xs space-y-1"><span className="font-medium text-slate-600">Cut &amp; Paste mode</span>
                  <select value={value.settings.cutMode} onChange={(e) => setSettings({ cutMode: e.target.value as MatchingSettings['cutMode'] })} className={inputCls}>
                    <option value="cut">Cắt và dán thẻ</option><option value="write">Viết chữ cái</option>
                  </select></label>
              )}
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-700">
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={value.settings.showNumbering} onChange={(e) => setSettings({ showNumbering: e.target.checked })} /> Hiện số / chữ cái</label>
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={value.settings.showAnswerBoxes} onChange={(e) => setSettings({ showAnswerBoxes: e.target.checked })} /> Hiện ô trả lời</label>
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={value.settings.grayscale} onChange={(e) => setSettings({ grayscale: e.target.checked })} /> In trắng đen (ảnh)</label>
              </div>
              <p className="text-[11px] text-slate-400">Khổ giấy, hướng giấy và lề áp dụng cho cả đề.</p>
          </div>
        )}
        </div>

        <div className={`flex flex-col gap-5 ${value.layout === 'reading_images' ? '' : 'h-[min(721px,calc(100vh-15rem))] min-h-0'}`}>
        {/* 1. Exercise details */}
        <section className="shrink-0 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-xs space-y-2">
          <div className="flex items-center gap-2.5"><StepNum n={1} /><h3 className="text-[13px] font-bold text-slate-900">Exercise Details</h3></div>
          <div>
            <label className="block text-[10.5px] font-semibold text-slate-600 mb-0.5">Exercise Title <span className="text-rose-500">*</span></label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={`${inputCls} !py-1.5 !text-[11.5px]`} />
          </div>
          <div>
            <label className="block text-[10.5px] font-semibold text-slate-600 mb-0.5">Student Instructions <span className="text-rose-500">*</span></label>
            <textarea rows={1} value={instructions} onChange={(e) => setInstructions(e.target.value)} className={`${inputCls} !py-1.5 !text-[11.5px] italic resize-y [field-sizing:content] min-h-[32px]`} />
          </div>
        </section>

        {/* Tiến trình tự động: layout + ảnh */}
        {auto.phase !== 'idle' && (
          <section className="shrink-0 bg-white border border-blue-200 rounded-2xl px-4 py-3 shadow-xs space-y-2" aria-live="polite">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-blue-600" />
              <h3 className="text-[13px] font-bold text-slate-900">
                {auto.phase === 'analyzing' ? 'Đang phân tích bài…' : auto.phase === 'generating' ? 'Đang tạo ảnh…' : 'Hoàn tất tự động'}
              </h3>
              <span className="ml-auto flex items-center gap-1">
                {auto.phase !== 'done' && (
                  <button type="button" onClick={() => { cancelRef.current = true; setAuto((s) => ({ ...s, phase: 'done' })); }} className="px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 rounded-md">Dừng</button>
                )}
                {auto.phase === 'done' && (
                  <>
                    <button type="button" onClick={() => void retryMissingImages()} className="px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 rounded-md flex items-center gap-1"><RefreshCw size={11} /> Tạo ảnh còn thiếu</button>
                    <button type="button" onClick={() => setAuto(IDLE_AUTO)} className="p-1 text-slate-400 hover:text-slate-700 rounded-md" aria-label="Ẩn"><X size={13} /></button>
                  </>
                )}
              </span>
            </div>
            {auto.layoutReason && <p className="text-[11.5px] text-slate-600">Layout: {auto.layoutReason}</p>}
            {auto.notes.map((n, i) => <p key={i} className="text-[11.5px] text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1">{n}</p>)}
            {auto.items.length > 0 && (
              <ul className="space-y-1">
                {auto.items.map((it) => (
                  <li key={`${it.kind}_${it.id}`} className="flex items-center gap-2 text-[11.5px]">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${it.status === 'done' ? 'bg-emerald-500' : it.status === 'failed' ? 'bg-rose-500' : it.status === 'running' ? 'bg-blue-500 animate-pulse' : 'bg-slate-300'}`} />
                    <span className="font-semibold text-slate-800 truncate">{it.subject}</span>
                    <span className="text-slate-400 truncate">
                      {it.status === 'done' ? 'đã gắn ảnh' : it.status === 'failed' ? it.error : it.status === 'running' ? 'đang tạo…' : 'chờ'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Bài đọc có ảnh: chỉ hiện khi chọn layout Reading + Images */}
        {value.layout === 'reading_images' && (
          <section className="shrink-0 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={() => setReadingOpen((v) => !v)}
                className="flex items-center gap-2 text-left group cursor-pointer"
                aria-expanded={readingOpen}
              >
                <h3 className="text-[13px] font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                  Reading passage
                </h3>
                <span className="p-0.5 rounded-md text-slate-400 group-hover:text-slate-800 group-hover:bg-slate-100 transition-colors" title={readingOpen ? 'Thu gọn' : 'Mở rộng'}>
                  {readingOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </span>
              </button>
              {readingOpen ? (
                <span className="text-[10.5px] text-slate-400 truncate">
                  Dòng trống = đoạn mới · **chữ** = in đậm · ảnh có thể thêm sau
                </span>
              ) : (
                <span className="text-[11px] text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-md">
                  {value.readingHeading ? `${value.readingHeading} · ` : ''}{readingBlocks.length} khối
                </span>
              )}
            </div>

            {readingOpen && (
              <>
                <input
                  value={value.readingHeading || ''}
                  onChange={(e) => set({ readingHeading: e.target.value })}
                  placeholder="Tiêu đề bài đọc (vd. GHOST TOWNS:)"
                  className={`${inputCls} !py-1.5 !text-[11.5px] font-semibold`}
                />
                <textarea
                  rows={2}
                  value={value.readingIntro || ''}
                  onChange={(e) => set({ readingIntro: e.target.value })}
                  placeholder="Đoạn dẫn (tùy chọn)"
                  className={`${inputCls} !py-1.5 !text-[11.5px] italic resize-y`}
                />

                {readingBlocks.map((b, i) => {
                  const isBlockCollapsed = !!collapsedBlocks[b.id];
                  return (
                    <div key={b.id} className="border border-slate-200 rounded-xl p-2.5 space-y-1.5 bg-slate-50/50">
                      <div
                        className="flex items-center gap-1.5 cursor-pointer select-none"
                        onClick={() => toggleBlockCollapse(b.id)}
                      >
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleBlockCollapse(b.id); }}
                          className="p-0.5 text-slate-400 hover:text-slate-700 rounded transition-colors"
                          aria-label={isBlockCollapsed ? 'Mở rộng khối' : 'Thu gọn khối'}
                          title={isBlockCollapsed ? 'Mở rộng khối' : 'Thu gọn khối'}
                        >
                          {isBlockCollapsed ? <ChevronDown size={14} className="-rotate-90 transition-transform" /> : <ChevronDown size={14} className="transition-transform" />}
                        </button>
                        <span className="text-[11px] font-bold text-slate-700">Khối {i + 1}</span>
                        {isBlockCollapsed && (b.name || b.location) && (
                          <span className="text-[11px] text-slate-500 font-medium truncate max-w-[200px]">
                            — {[b.name, b.location].filter(Boolean).join(' · ')}
                          </span>
                        )}
                        {isBlockCollapsed && !b.name && !b.location && b.text && (
                          <span className="text-[11px] text-slate-400 font-normal truncate max-w-[200px]">
                            — {b.text.slice(0, 30)}...
                          </span>
                        )}
                        <span className="ml-auto flex items-center" onClick={(e) => e.stopPropagation()}>
                          <button type="button" className={iconBtn} disabled={i === 0} onClick={() => setBlocks(moveItem(readingBlocks, i, i - 1))} aria-label="Đưa lên" title="Đưa lên"><ArrowUp size={13} /></button>
                          <button type="button" className={iconBtn} disabled={i === readingBlocks.length - 1} onClick={() => setBlocks(moveItem(readingBlocks, i, i + 1))} aria-label="Đưa xuống" title="Đưa xuống"><ArrowDown size={13} /></button>
                          <button type="button" className={iconBtn} onClick={() => setBlocks(readingBlocks.filter((x) => x.id !== b.id))} aria-label="Xóa khối" title="Xóa khối"><Trash2 size={13} /></button>
                        </span>
                      </div>

                      {!isBlockCollapsed && (
                        <>
                          <div className="grid grid-cols-2 gap-1.5">
                            <input value={b.name || ''} onChange={(e) => patchBlock(b.id, { name: e.target.value })} placeholder="Name (vd. Craco)" className={`${inputCls} !py-1.5 !text-[11.5px] font-semibold`} />
                            <input value={b.location || ''} onChange={(e) => patchBlock(b.id, { location: e.target.value })} placeholder="Location (vd. Italy)" className={`${inputCls} !py-1.5 !text-[11.5px]`} />
                          </div>
                          <textarea rows={5} value={b.text} onChange={(e) => patchBlock(b.id, { text: e.target.value })} className={`${inputCls} !py-1.5 !text-[11.5px] resize-y`} />
                          <textarea
                            rows={2}
                            value={b.imagePrompt || ''}
                            onChange={(ev) => patchBlock(b.id, { imagePrompt: ev.target.value })}
                            placeholder="Prompt tạo ảnh (tự sinh từ nội dung, có thể sửa)"
                            className={`${inputCls} !py-1.5 !text-[11px] resize-y`}
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void regenerateBlockImage(b.id)}
                              disabled={auto.phase === 'analyzing' || auto.phase === 'generating'}
                              className="px-2.5 py-1.5 text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-lg flex items-center gap-1.5"
                              title="Tạo ảnh bằng extension Flow Bridge dựa trên prompt này"
                            >
                              <Sparkles size={12} /> {b.imageUrl ? 'Tạo lại ảnh' : 'Tạo ảnh'}
                            </button>
                            {b.imageUrl ? (
                              <>
                                <img src={b.imageUrl} alt="" className="w-14 h-10 object-cover rounded-md border border-slate-200" />
                                <button type="button" onClick={() => patchBlock(b.id, { imageUrl: undefined })} className="text-[11px] font-semibold text-rose-600 hover:underline">Xóa ảnh</button>
                              </>
                            ) : (
                              <label className="px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 bg-white border border-blue-300 hover:bg-blue-50 rounded-lg cursor-pointer flex items-center gap-1.5">
                                <ImagePlus size={13} /> Thêm ảnh bên phải
                                <input type="file" accept="image/*" hidden onChange={(e) => { void pickBlockImage(b.id, e.target.files); e.target.value = ''; }} />
                              </label>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}

                <button type="button" onClick={() => setBlocks([...readingBlocks, newReadingBlock()])} className="w-full py-1.5 text-[11.5px] font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center justify-center gap-1.5">
                  <Plus size={13} /> Thêm khối (Name / Location)
                </button>
              </>
            )}
          </section>
        )}

        {/* 2. Questions & answers */}
        <section className={`flex flex-col gap-4 bg-white border border-slate-200 rounded-3xl p-5 shadow-xs ${value.layout === 'reading_images' ? 'min-h-[360px]' : 'flex-1 min-h-0'}`}>
          <div className="flex flex-wrap items-center gap-2.5">
            <StepNum n={2} />
            <button
              type="button"
              onClick={() => setQaOpen((v) => !v)}
              className="flex items-center gap-2 text-left group cursor-pointer"
              aria-expanded={qaOpen}
            >
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                Questions &amp; Answers
              </h3>
              <span className="p-1 rounded-lg text-slate-400 group-hover:text-slate-800 group-hover:bg-slate-100 transition-colors" title={qaOpen ? 'Thu nhỏ' : 'Mở rộng'}>
                {qaOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </span>
            </button>
            {!qaOpen && (
              <span className="text-[11px] text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-md">
                {value.problems.length} problems · {value.solutions.length} solutions
              </span>
            )}
            {qaOpen && (
              <div className="ml-auto flex items-center gap-2">
                <button type="button" onClick={() => setShowPaste((v) => !v)} className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 ${showPaste ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-blue-700 hover:bg-slate-50'}`}>
                  <ClipboardPaste size={14} /> Smart Paste
                </button>
                <button type="button" onClick={() => set({ problems: [...value.problems, { id: newId('p'), text: '' }] })} className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-blue-700 hover:bg-slate-50 flex items-center gap-1.5"><Plus size={14} /> Add Problem</button>
                <button type="button" onClick={() => set({ solutions: [...value.solutions, { id: newId('s'), text: '' }] })} className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-blue-700 hover:bg-slate-50 flex items-center gap-1.5"><Plus size={14} /> Add Solution</button>
              </div>
            )}
          </div>

          {qaOpen && (<>
          {showPaste && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-3 space-y-2">
              <textarea
                rows={5}
                value={pasteText}
                onChange={(e) => { setPasteText(e.target.value); setParsed(null); }}
                placeholder={'MATCH THE PROBLEM TO ITS SOLUTIONS.\n\n1. Litter in streets\n2. Complain about the kids\n\na. Creating more things for the young to do\nb. Educating people quickly'}
                className={`${inputCls} font-mono bg-white`}
              />
              <div className="flex items-center gap-2">
                <button type="button" onClick={runParse} disabled={!pasteText.trim()} className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-900 text-white disabled:opacity-40">Phân tích</button>
                {parsed && parsed.ok && (<>
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 cursor-pointer" title="Tự chọn layout theo gợi ý AI và tự tạo ảnh bằng extension Flow Bridge">
                    <input type="checkbox" checked={autoImages} onChange={(ev) => setAutoImages(ev.target.checked)} className="rounded text-blue-600 focus:ring-0" />
                    Tự tạo ảnh bằng AI
                  </label>
                  <button type="button" onClick={applyParsed} className="px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 text-white flex items-center gap-1"><Check size={13} /> Dùng kết quả này</button>
                </>)}
                <span className="text-[11px] text-slate-500">Tự chọn layout và tạo ảnh (cần extension Flow Bridge). Đáp án đúng không được tự điền.</span>
              </div>
              {parsed && (
                <div className={`rounded-xl border p-3 text-xs space-y-1.5 ${parsed.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                  <div className="font-bold">
                    {parsed.ok
                      ? `Nhận diện: ${parsed.reading?.length ? `${parsed.reading.length} khối bài đọc, ` : ''}${parsed.problems.length} problems, ${parsed.solutions.length} solutions${parsed.title ? ` · Tiêu đề: “${parsed.title}”` : ''}`
                      : 'Chưa nhận diện đủ. Văn bản gốc vẫn còn trong ô trên, bạn sửa lại rồi bấm Phân tích.'}
                  </div>
                  {parsed.warnings.map((w, i) => <div key={i} className="flex gap-1.5"><AlertTriangle size={12} className="mt-0.5 shrink-0" />{w}</div>)}
                  {parsed.unparsedLines.length > 0 && (
                    <div className="text-[11px] opacity-80">Dòng chưa nhận ra: {parsed.unparsedLines.slice(0, 3).join(' | ')}{parsed.unparsedLines.length > 3 ? '...' : ''}</div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
            <div className="rounded-2xl border border-slate-200 overflow-hidden flex flex-col min-h-0">
              <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50/70 border-b border-slate-200">
                <span className="text-sm font-bold text-slate-900">Problems ({value.problems.length})</span>
                <span className="text-[11px] text-slate-400 flex items-center gap-1"><ArrowDownUp size={11} /> Drag to reorder</span>
              </div>
              <div className="p-3 space-y-2 flex-1 overflow-y-auto">
                {value.problems.length === 0 && <p className="text-xs text-slate-400 py-2 text-center">Chưa có mục nào. Bấm Add Problem hoặc Smart Paste.</p>}
                {value.problems.map((p, i) => <React.Fragment key={p.id}>{renderRow('problems', i)}</React.Fragment>)}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 overflow-hidden flex flex-col min-h-0">
              <div className="flex items-center justify-between px-4 py-2.5 bg-emerald-50/70 border-b border-slate-200">
                <span className="text-sm font-bold text-slate-900">Solutions ({value.solutions.length})</span>
                <span className="text-[11px] text-slate-400 flex items-center gap-1"><ArrowDownUp size={11} /> Drag to reorder</span>
              </div>
              <div className="p-3 space-y-2 flex-1 overflow-y-auto">
                {value.solutions.length === 0 && <p className="text-xs text-slate-400 py-2 text-center">Chưa có mục nào. Bấm Add Solution hoặc Smart Paste.</p>}
                {value.solutions.map((s, i) => <React.Fragment key={s.id}>{renderRow('solutions', i)}</React.Fragment>)}
              </div>
            </div>
          </div>
          {imgError && <p className="text-xs text-rose-600">{imgError}</p>}
          </>)}
        </section>

        {(validation.errors.length > 0 || validation.warnings.length > 0) && (
          <div className="shrink-0 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-1">
            {validation.errors.map((e, i) => <div key={`e${i}`} className="font-bold text-rose-700">✕ {e}</div>)}
            {validation.warnings.map((w, i) => <div key={`w${i}`}>⚠ {w}</div>)}
          </div>
        )}
        </div>
      </div>

      {/* ───────── CỘT PHẢI: bảng theo dõi (live) ───────── */}
      <div className="min-w-0 xl:sticky xl:top-0 self-start">
        <section className="bg-white border border-slate-200 rounded-3xl p-4 shadow-xs space-y-3">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setPreviewOpen((v) => !v)}
              className="flex items-center gap-2 text-left group cursor-pointer"
              aria-expanded={previewOpen}
            >
              <LayoutGrid size={18} className="text-blue-600 shrink-0" />
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                Live Preview (A4)
              </h3>
              <span
                className="p-1 rounded-lg text-slate-400 group-hover:text-slate-800 group-hover:bg-slate-100 transition-colors"
                title={previewOpen ? 'Thu nhỏ' : 'Mở rộng'}
              >
                {previewOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </span>
            </button>
            {!previewOpen && (
              <span className="text-[11px] text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-md">
                {zoom}%
              </span>
            )}
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100"
              title="Phóng to"
            >
              <Maximize2 size={15} />
            </button>
          </div>
          {previewOpen && (
            <>
              <div className="overflow-auto bg-slate-100 rounded-2xl p-3 h-[70vh]">
                <A4Preview scale={zoom / 100 * 0.62} />
              </div>
              <div className="flex items-center justify-center gap-3 text-xs text-slate-600">
                <button type="button" onClick={() => setZoom((z) => Math.max(40, z - 10))} className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50" aria-label="Thu nhỏ"><Minus size={13} /></button>
                <span className="font-mono w-10 text-center">{zoom}%</span>
                <button type="button" onClick={() => setZoom((z) => Math.min(150, z + 10))} className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50" aria-label="Phóng to"><Plus size={13} /></button>
              </div>
            </>
          )}
        </section>
      </div>

      {/* Xem trước phóng to */}
      {expanded && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-6" onClick={() => { setExpanded(false); setTab('content'); }}>
          <div className="bg-white rounded-3xl max-w-5xl w-full max-h-full flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">Preview (A4)</h3>
              <button type="button" onClick={() => { setExpanded(false); setTab('content'); }} className="ml-auto p-1.5 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Đóng"><X size={16} /></button>
            </div>
            <div className="overflow-auto bg-slate-100 p-5"><A4Preview scale={0.9} /></div>
          </div>
        </div>
      )}
    </div>
  );
};
