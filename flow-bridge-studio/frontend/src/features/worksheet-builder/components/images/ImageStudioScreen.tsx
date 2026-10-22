import React, { useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Wand2, Image as ImageIcon, Sparkles, Loader2, Settings2, Square,
  AlertTriangle, Eye, Pencil, X, Search, LayoutGrid, List, Plus, Layers, Trash2, Upload, Check, Maximize2, Minimize2,
} from 'lucide-react';
import type { LessonFolder, Exercise } from '../../types';
import { ImageJobQueuePanel } from './ImageJobQueuePanel';
import { ImageRunConfigDialog } from '../shared/ImageManagerBody';
import { adapterFor, analyzeImagePrompt, applyImageTarget, clearImageTarget, listImageTargets, type ImageTarget } from '../../services/ai/batchImages';
import { runAiImage } from '../../services/ai/useAiImage';
import { PROVIDER_SHORT, useImageSource } from '../../services/ai/imageSource';
import { fileToSmallDataUrl } from '../../types/branding';

interface ImageStudioScreenProps {
  folder: LessonFolder;
  onBackToFolder: () => void;
  onUpdateFolderExercises: (updatedExercises: Exercise[]) => void;
  onNavigateToPreview: () => void;
  extensionConnected?: boolean;
  flowStatus?: string;
  extensionDetected?: boolean;
}

type Step = 'queued' | 'analyzing' | 'generating' | 'done' | 'failed' | 'skipped';
type Filter = 'all' | 'empty' | 'generated';

const STEP_LABEL: Record<Step, string> = {
  queued: 'Đang chờ', analyzing: 'Đang phân tích prompt…', generating: 'Đang tạo ảnh…', done: 'Xong', failed: 'Lỗi', skipped: 'Bỏ qua',
};

const readDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

export const ImageStudioScreen: React.FC<ImageStudioScreenProps> = ({
  folder,
  onBackToFolder,
  onUpdateFolderExercises,
  onNavigateToPreview,
  extensionConnected = false,
  flowStatus = 'UNKNOWN',
  extensionDetected = false,
}) => {
  const source = useImageSource();
  const exercisesRef = useRef(folder.exercises);
  exercisesRef.current = folder.exercises;
  const stopRef = useRef(false);

  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [running, setRunning] = useState(false);
  const [cfgOpen, setCfgOpen] = useState(false);
  // Thẻ mặc định thu gọn cho đỡ tốn diện tích; bấm icon mở rộng để xem prompt, ảnh tham chiếu
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) => setExpanded((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const [zoomId, setZoomId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  // Prompt đã sửa / đã phân tích và ảnh tham chiếu riêng cho từng ô (chỉ trong phiên làm việc này)
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [refs, setRefs] = useState<Record<string, string[]>>({});
  const [steps, setSteps] = useState<Record<string, { step: Step; msg?: string }>>({});

  const targets = listImageTargets(folder.exercises);
  const needs = targets.filter((t) => !t.url);
  const promptOf = (t: ImageTarget) => prompts[t.id] ?? t.prompt;
  const patchStep = (id: string, step: Step, msg?: string) => setSteps((m) => ({ ...m, [id]: { step, msg } }));

  const q = search.trim().toLowerCase();
  const shown = targets.filter((t) => {
    if (filter === 'empty' && t.url) return false;
    if (filter === 'generated' && !t.url) return false;
    if (!q) return true;
    return `${t.title} ${t.label} ${t.kind} ${promptOf(t)} Exercise ${t.exNo}`.toLowerCase().includes(q);
  });

  const commit = (fn: (ex: Exercise) => Exercise, exerciseId: string) => {
    const list = exercisesRef.current;
    const idx = list.findIndex((e) => e.id === exerciseId);
    if (idx < 0) return;
    const next = [...list];
    next[idx] = fn(list[idx]);
    exercisesRef.current = next;
    onUpdateFolderExercises(next);
  };

  /** Tạo ảnh cho một ô: prompt đã sửa thì dùng thẳng, ô chưa có prompt riêng thì nhờ AI phân tích nội dung bài; ảnh gắn vào đúng ô */
  const runOne = async (t: ImageTarget): Promise<boolean> => {
    const ex = exercisesRef.current.find((e) => e.id === t.exerciseId);
    if (!ex) { patchStep(t.id, 'skipped'); return true; }
    let prompt = (prompts[t.id] ?? '').trim();
    if (!prompt) {
      if (t.analyze) {
        patchStep(t.id, 'analyzing');
        prompt = (await analyzeImagePrompt(adapterFor(ex)?.basePrompt(ex) || t.prompt)).prompt;
        setPrompts((m) => ({ ...m, [t.id]: prompt }));
        if (stopRef.current) { patchStep(t.id, 'skipped', 'Đã dừng'); return true; }
      } else {
        prompt = t.prompt;
      }
    }
    if (!prompt) { patchStep(t.id, 'failed', 'Ô này chưa có prompt. Bấm nút sửa để nhập mô tả.'); return false; }
    patchStep(t.id, 'generating');
    let lastMsg = '';
    const ok = await runAiImage(
      {
        getPrompt: () => prompt,
        style: t.style,
        aspectRatio: t.aspectRatio,
        refs: refs[t.id],
        onPrompt: () => undefined,
        onImage: (url, p) => commit((e) => applyImageTarget(e, t, url, p), t.exerciseId),
      },
      (st) => { lastMsg = st.msg; patchStep(t.id, 'generating', st.msg); },
      prompt,
      true,
    );
    patchStep(t.id, ok ? 'done' : 'failed', ok ? undefined : lastMsg);
    return ok;
  };

  const generateOne = async (t: ImageTarget) => {
    if (running) return;
    stopRef.current = false;
    setRunning(true);
    await runOne(t);
    setRunning(false);
  };

  const generateAll = async () => {
    const todo = listImageTargets(exercisesRef.current).filter((t) => !t.url);
    if (todo.length === 0 || running) return;
    stopRef.current = false;
    setRunning(true);
    setSteps((m) => ({ ...m, ...Object.fromEntries(todo.map((t) => [t.id, { step: 'queued' as Step }])) }));
    let failedInRow = 0;
    for (const t of todo) {
      if (stopRef.current) { patchStep(t.id, 'skipped', 'Đã dừng'); continue; }
      const ok = await runOne(t);
      failedInRow = ok ? 0 : failedInRow + 1;
      if (failedInRow >= 2) stopRef.current = true; // lỗi liên tiếp (thường do extension/Flow): dừng thay vì thử hết
    }
    setRunning(false);
  };

  const addRefs = async (id: string, files: FileList | null) => {
    if (!files) return;
    const urls: string[] = [];
    for (const f of Array.from(files)) if (f.type.startsWith('image/')) urls.push(await readDataUrl(f));
    if (urls.length) setRefs((m) => ({ ...m, [id]: [...(m[id] || []), ...urls].slice(0, 3) }));
  };

  const uploadOwn = async (t: ImageTarget, file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    const url = await fileToSmallDataUrl(file, 900, 'image/jpeg');
    commit((e) => {
      const withImg = applyImageTarget(e, t, url, '');
      return { ...withImg, imageSlots: withImg.imageSlots.map((s) => (`slot:${s.slotId}` === t.key ? { ...s, needsReview: false } : s)) };
    }, t.exerciseId);
  };

  const approve = (t: ImageTarget) =>
    commit((e) => ({ ...e, imageSlots: e.imageSlots.map((s) => (`slot:${s.slotId}` === t.key ? { ...s, needsReview: false } : s)) }), t.exerciseId);

  const zoomT = targets.find((t) => t.id === zoomId);
  const editT = targets.find((t) => t.id === editId);

  const renderThumb = (t: ImageTarget, cls: string) => {
    const st = steps[t.id];
    const busy = st?.step === 'analyzing' || st?.step === 'generating';
    return (
      <div className={`relative overflow-hidden bg-slate-50 flex items-center justify-center ${t.url ? '' : 'border-2 border-dashed border-slate-200'} ${cls}`}>
        {t.url ? (
          <button type="button" onClick={() => setZoomId(t.id)} className="w-full h-full block cursor-zoom-in" title="Phóng to">
            <img src={t.url} alt={t.label} className="w-full h-full object-cover" />
          </button>
        ) : (
          <ImageIcon size={22} className="text-slate-300" />
        )}
        {t.needsReview && t.url && (
          <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md bg-amber-500 text-white text-[9px] font-bold shadow">AI · chờ duyệt</span>
        )}
        {busy && (
          <div className="absolute inset-0 bg-white/75 flex flex-col items-center justify-center gap-1 text-[11px] font-bold text-violet-700 text-center px-2">
            <Loader2 size={18} className="animate-spin" />
            {STEP_LABEL[st.step]}
          </div>
        )}
        <span className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full border ${t.url ? 'bg-white/95 text-emerald-700 border-emerald-200' : 'bg-white/95 text-amber-700 border-amber-200'}`}>
          {t.url ? 'Generated' : 'Needs Image'}
        </span>
      </div>
    );
  };

  const renderActions = (t: ImageTarget) => {
    const busy = steps[t.id]?.step === 'analyzing' || steps[t.id]?.step === 'generating';
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void generateOne(t)}
          disabled={running}
          className="flex-1 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          {t.url ? 'Regenerate' : 'Generate'}
        </button>
        <button type="button" onClick={() => setZoomId(t.id)} disabled={!t.url} className="h-9 w-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center disabled:opacity-40" title="Phóng to ảnh">
          <Eye size={15} />
        </button>
        <button type="button" onClick={() => setEditId(t.id)} disabled={running} className="h-9 w-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center disabled:opacity-40" title="Sửa prompt, ảnh tham chiếu, tải ảnh lên">
          <Pencil size={15} />
        </button>
      </div>
    );
  };

  const renderRefs = (t: ImageTarget) => (
    <div className="flex items-center gap-1.5 flex-wrap">
      {(refs[t.id] || []).map((r, i) => (
        <span key={i} className="relative group">
          <img src={r} alt="" className="w-12 h-9 object-cover rounded-md border border-slate-200" />
          <button type="button" onClick={() => setRefs((m) => ({ ...m, [t.id]: (m[t.id] || []).filter((_, k) => k !== i) }))} className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white hidden group-hover:flex items-center justify-center"><X size={9} /></button>
        </span>
      ))}
      {(refs[t.id] || []).length < 3 && (
        <label className="w-12 h-9 rounded-md border border-dashed border-slate-300 text-slate-400 hover:text-blue-600 hover:border-blue-400 flex flex-col items-center justify-center cursor-pointer text-[9px] font-semibold" title="Thêm ảnh tham chiếu">
          <Plus size={11} /> Add
          <input type="file" accept="image/*" multiple hidden onChange={(e) => { void addRefs(t.id, e.target.files); e.currentTarget.value = ''; }} />
        </label>
      )}
    </div>
  );

  const renderCard = (t: ImageTarget) => {
    const st = steps[t.id];
    if (!expanded.has(t.id)) {
      const busy = st?.step === 'analyzing' || st?.step === 'generating';
      return (
        <div key={t.id} className={`bg-white rounded-2xl border shadow-xs p-2.5 flex items-center gap-3 ${t.url ? 'border-slate-200' : 'border-blue-200'}`}>
          <button type="button" onClick={() => t.url && setZoomId(t.id)} className={`relative w-16 h-12 rounded-lg overflow-hidden shrink-0 bg-slate-50 flex items-center justify-center ${t.url ? 'cursor-zoom-in' : 'border border-dashed border-slate-300'}`} title={t.url ? 'Phóng to' : 'Chưa có ảnh'}>
            {t.url ? <img src={t.url} alt={t.label} className="w-full h-full object-cover" /> : <ImageIcon size={16} className="text-slate-300" />}
            {busy && <span className="absolute inset-0 bg-white/75 flex items-center justify-center"><Loader2 size={14} className="animate-spin text-violet-700" /></span>}
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-slate-800 truncate" title={t.label}>{t.label}</div>
            <div className="text-[10.5px] text-slate-400 truncate">Exercise {t.exNo} · {t.kind}</div>
            {st?.msg && st.step === 'failed' && <div className="text-[10px] text-rose-600 truncate" title={st.msg}>{st.msg}</div>}
          </div>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${t.url ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-amber-700 border-amber-200 bg-amber-50'}`}>{t.url ? 'Generated' : 'Needs'}</span>
          <button type="button" onClick={() => void generateOne(t)} disabled={running} className="h-8 w-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center disabled:opacity-50 shrink-0" title={t.url ? 'Regenerate' : 'Generate'}><Sparkles size={13} /></button>
          <button type="button" onClick={() => toggleExpand(t.id)} className="h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center shrink-0" title="Mở rộng"><Maximize2 size={13} /></button>
        </div>
      );
    }
    return (
      <div key={t.id} className={`relative bg-white rounded-2xl border shadow-xs overflow-hidden flex flex-col ${t.url ? 'border-slate-200' : 'border-blue-200'}`}>
        {renderThumb(t, 'h-40 w-full')}
        <button type="button" onClick={() => toggleExpand(t.id)} className="absolute top-2 left-2 z-10 h-7 w-7 rounded-lg bg-white/95 border border-slate-200 text-slate-600 hover:text-blue-600 flex items-center justify-center shadow-xs" title="Thu nhỏ"><Minimize2 size={13} /></button>
        <div className="p-3 space-y-2 flex-1 flex flex-col">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold">Exercise {t.exNo}</span>
            <span className="text-[10px] text-slate-400 truncate">{t.kind}</span>
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-800 truncate" title={t.label}>{t.label}</div>
            <div className="text-[10.5px] text-slate-400 truncate" title={t.title}>{t.title}</div>
          </div>
          <textarea
            value={promptOf(t)}
            onChange={(e) => setPrompts((m) => ({ ...m, [t.id]: e.target.value }))}
            rows={3}
            placeholder={t.analyze ? 'Để trống: AI tự phân tích nội dung bài để viết prompt' : 'Mô tả ảnh cần tạo'}
            className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
          <div>
            <div className="text-[10px] font-semibold text-slate-400 mb-1">Reference image (optional)</div>
            {renderRefs(t)}
          </div>
          {st?.msg && st.step !== 'done' && <p className={`text-[10.5px] ${st.step === 'failed' ? 'text-rose-600' : 'text-slate-500'}`}>{st.msg}</p>}
          <div className="mt-auto pt-1">{renderActions(t)}</div>
        </div>
      </div>
    );
  };

  const renderRow = (t: ImageTarget) => {
    const st = steps[t.id];
    return (
      <div key={t.id} className="bg-white rounded-2xl border border-slate-200 p-3 flex flex-wrap md:flex-nowrap items-start gap-4">
        {renderThumb(t, 'w-36 h-24 rounded-xl shrink-0')}
        <div className="flex-1 min-w-[14rem] space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold">Exercise {t.exNo}</span>
            <span className="text-xs font-bold text-slate-800 truncate">{t.label}</span>
            <span className="text-[10px] text-slate-400 truncate">{t.kind}</span>
          </div>
          <textarea
            value={promptOf(t)}
            onChange={(e) => setPrompts((m) => ({ ...m, [t.id]: e.target.value }))}
            rows={2}
            placeholder={t.analyze ? 'Để trống: AI tự phân tích nội dung bài để viết prompt' : 'Mô tả ảnh cần tạo'}
            className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
          {st?.msg && st.step !== 'done' && <p className={`text-[10.5px] ${st.step === 'failed' ? 'text-rose-600' : 'text-slate-500'}`}>{st.msg}</p>}
        </div>
        <div className="space-y-2 w-full md:w-64 shrink-0">
          {renderRefs(t)}
          {renderActions(t)}
        </div>
      </div>
    );
  };

  const filterBtn = (id: Filter, label: string, n: number) => (
    <button
      key={id}
      onClick={() => setFilter(id)}
      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${filter === id ? 'bg-blue-600 text-white font-bold shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
    >
      {label} ({n})
    </button>
  );

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-50 p-6 md:p-8 select-text">
      <div className="max-w-6xl w-full mx-auto space-y-5">
        {/* Header Navigation */}
        <div className="flex items-center justify-between">
          <button onClick={onBackToFolder} className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1.5 transition-colors">
            <ArrowLeft size={14} /> Back to {folder.name}
          </button>
          <button onClick={onNavigateToPreview} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-blue-500/20 transition-all active:scale-95">
            <span>Preview Worksheet</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {/* Title & extension status */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center"><Wand2 size={18} /></div>
              <h1 className="text-lg font-bold text-slate-900">AI Image Studio</h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Manage illustrations and diagrams for all {targets.length} image placeholders in <strong>{folder.name}</strong>.
            </p>
          </div>
          <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
            {flowStatus === 'CONNECTED' ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="font-semibold text-emerald-800">Google Flow: Đã kết nối sẵn sàng</span>
              </>
            ) : flowStatus === 'FLOW_TAB_NOT_FOUND' ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                <div className="flex flex-col">
                  <span className="font-semibold text-amber-800">Chưa mở tab Google Flow</span>
                  <a href="https://flow.google.com/project/" target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 hover:underline font-bold mt-0.5">Mở flow.google.com/project ↗</a>
                </div>
              </>
            ) : flowStatus === 'PROJECT_NOT_OPEN' ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                <span className="font-semibold text-amber-800">Google Flow: Hãy mở vào 1 Project</span>
              </>
            ) : extensionDetected || extensionConnected ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
                <span className="font-semibold text-slate-700">Extension sẵn sàng · Đang quét tab Flow...</span>
              </>
            ) : (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300 shrink-0" />
                <span className="font-semibold text-slate-500">Extension chưa bật (chrome://extensions)</span>
              </>
            )}
          </div>
        </div>

        {/* Filters, search, view */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {filterBtn('all', 'All Slots', targets.length)}
            {filterBtn('empty', 'Needs Image', needs.length)}
            {filterBtn('generated', 'Generated', targets.length - needs.length)}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search image, exercise, prompt..." className="pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-blue-400 w-64" />
            </div>
            <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-white">
              <button onClick={() => setView('grid')} className={`px-2.5 py-2 ${view === 'grid' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`} title="Dạng lưới"><LayoutGrid size={14} /></button>
              <button onClick={() => setView('list')} className={`px-2.5 py-2 ${view === 'list' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`} title="Dạng danh sách"><List size={14} /></button>
            </div>
          </div>
        </div>

        {/* Generate All */}
        {(needs.length > 0 || running) && (
          <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center"><Layers size={22} /></div>
              <div>
                <div className="text-sm font-bold text-slate-900">{needs.length} images need to be generated</div>
                <div className="text-[11px] text-slate-500">
                  {running ? 'Đang tạo lần lượt từng ảnh, tự gắn vào đúng ô trong bài.' : `Tạo lần lượt bằng ${PROVIDER_SHORT[source.provider]}, prompt do AI phân tích tự động. Bạn vẫn sửa prompt từng ô được.`}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setCfgOpen(true)} disabled={running} className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40" title="Chỉnh nguồn ảnh, model, tỉ lệ, preset cho cả lượt gen">
                <Settings2 size={13} /> Edit
              </button>
              {running ? (
                <button type="button" onClick={() => { stopRef.current = true; }} className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700">
                  <Square size={12} /> Dừng
                </button>
              ) : (
                <button type="button" onClick={() => void generateAll()} className="flex items-center gap-1.5 text-xs font-bold px-5 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700">
                  <Sparkles size={13} /> Generate All ({needs.length})
                </button>
              )}
            </div>
          </div>
        )}

        <ImageJobQueuePanel worksheetId={folder.id} />

        {/* Slots */}
        {shown.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3"><ImageIcon size={20} /></div>
            <h3 className="text-sm font-bold text-slate-800">No Image Placeholders Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4">
              {targets.length === 0
                ? 'Các bài trong folder chưa có ô ảnh nào. Thêm ô ảnh trống ở Image Manager của bài (ví dụ Matching Pictures) hoặc bật ảnh trong bài đọc / nghe.'
                : 'Không có ô ảnh nào khớp bộ lọc hoặc từ khóa tìm kiếm.'}
            </p>
            <button onClick={onBackToFolder} className="px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold transition-colors">Return to Folder</button>
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{shown.map(renderCard)}</div>
        ) : (
          <div className="space-y-3">{shown.map(renderRow)}</div>
        )}
      </div>

      {/* Phóng to ảnh */}
      {zoomT?.url && (
        <div className="fixed inset-0 z-[80] bg-slate-900/70 flex items-center justify-center p-6" onClick={() => setZoomId(null)}>
          <div className="bg-white rounded-2xl p-4 max-w-4xl w-full space-y-3" onClick={(ev) => ev.stopPropagation()}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-slate-900 truncate">Exercise {zoomT.exNo} · {zoomT.label}</h3>
              <button type="button" onClick={() => setZoomId(null)} className="p-1 text-slate-400 hover:text-slate-800"><X size={18} /></button>
            </div>
            <img src={zoomT.url} alt={zoomT.label} className="w-full max-h-[70vh] object-contain rounded-xl bg-slate-50" />
            {promptOf(zoomT) && <p className="text-[11px] text-slate-500 leading-relaxed">{promptOf(zoomT)}</p>}
          </div>
        </div>
      )}

      {/* Sửa một ô ảnh */}
      {editT && (
        <div className="fixed inset-0 z-[80] bg-slate-900/60 flex items-center justify-center p-6" onClick={() => setEditId(null)}>
          <div className="bg-white rounded-2xl p-4 max-w-xl w-full space-y-3 max-h-[92vh] overflow-y-auto" onClick={(ev) => ev.stopPropagation()}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-slate-900 truncate">Edit · Exercise {editT.exNo} · {editT.label}</h3>
              <button type="button" onClick={() => setEditId(null)} className="p-1 text-slate-400 hover:text-slate-800"><X size={18} /></button>
            </div>
            {editT.url && <img src={editT.url} alt="" className="w-full max-h-48 object-contain rounded-xl bg-slate-50" />}
            <textarea
              value={promptOf(editT)}
              onChange={(ev) => setPrompts((m) => ({ ...m, [editT.id]: ev.target.value }))}
              rows={5}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            <div>
              <div className="text-[10px] font-semibold text-slate-400 mb-1">Reference image (optional)</div>
              {renderRefs(editT)}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="h-8 px-3 rounded-lg border border-blue-200 text-blue-700 text-[11px] font-bold hover:bg-blue-50 flex items-center gap-1.5 cursor-pointer">
                <Upload size={12} /> Tải ảnh lên
                <input type="file" accept="image/*" hidden onChange={(ev) => { void uploadOwn(editT, ev.target.files?.[0]); ev.currentTarget.value = ''; }} />
              </label>
              {editT.url && editT.needsReview && (
                <button type="button" onClick={() => approve(editT)} className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1.5"><Check size={12} /> Duyệt ảnh</button>
              )}
              {editT.url && (
                <button type="button" onClick={() => commit((e) => clearImageTarget(e, editT), editT.exerciseId)} className="h-8 px-3 rounded-lg border border-rose-200 text-rose-600 text-[11px] font-bold hover:bg-rose-50 flex items-center gap-1.5"><Trash2 size={12} /> Xóa ảnh</button>
              )}
            </div>
            <div className="flex justify-between gap-2 pt-1">
              <button type="button" onClick={() => { setEditId(null); setCfgOpen(true); }} className="h-9 px-3 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"><Settings2 size={12} /> Cấu hình</button>
              <button
                type="button"
                disabled={!promptOf(editT).trim() && !editT.analyze}
                onClick={() => { const t = editT; setEditId(null); void generateOne(t); }}
                className="h-9 px-4 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-40 flex items-center gap-1.5"
              >
                <Wand2 size={12} /> {editT.url ? 'Tạo lại ảnh này' : 'Tạo ảnh này'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cấu hình chung (nguồn ảnh, model, tỉ lệ, preset): bấm chạy trong bảng = Generate All */}
      <ImageRunConfigDialog
        open={cfgOpen}
        onClose={() => setCfgOpen(false)}
        generating={running}
        prompt=""
        onPromptChange={() => undefined}
        onRun={() => void generateAll()}
      />

      {!running && Object.values(steps).some((s) => s.step === 'failed') && (
        <div className="fixed bottom-4 right-4 z-[70] max-w-sm p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2 shadow-lg">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>Có ô tạo ảnh bị lỗi. Xem thông báo đỏ trên từng ô, sửa rồi bấm Generate lại.</span>
          <button type="button" onClick={() => setSteps((m) => Object.fromEntries(Object.entries(m).filter(([, s]) => s.step !== 'failed')))} className="text-rose-600 hover:text-rose-800"><X size={14} /></button>
        </div>
      )}
    </div>
  );
};
