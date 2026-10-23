// Trình soạn mới cho hai dạng bài dùng dữ liệu Matching: Matching Information và Draw Lines and Match.
// Cùng bố cục với các dạng bài khác: thanh công cụ ở trên; hai cột bên dưới (trái soạn nội dung, phải xem trước A4); Edit Mode / Preview, undo / redo, Save.
// Mỗi dạng có danh sách layout riêng (xem services/matching/matchingLayouts.ts).

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SaveStatusBadge, useSaveShortcut, type SaveStatus } from '../shared/SaveStatusBadge';
import { AiRewriteBox } from '../shared/AiRewriteBox';
import { SmartLayoutBar } from '../shared/SmartLayoutBar';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, Eye, FileDown, GripVertical, Maximize2, Minimize, Minus, Plus, Printer, X, MoreHorizontal,
  RotateCcw, RotateCw, Save, Trash2, ArrowUp, ArrowDown, HelpCircle, ImagePlus, Copy,
} from 'lucide-react';
import { PageZoomOverlay } from '../shared/PageZoomOverlay';
import type { Exercise, LessonFolder, Worksheet } from '../../types';
import {
  createMatching, matchingFromParsed, moveItem, newId, newReadingBlock, parseMatchingText, solutionLabel, validateMatching,
  type MatchingData, type MatchingLayoutId, type MatchingProblem, type MatchingSolution,
} from '../../services/matching/matchingCore';
import { defaultLayoutFor, layoutOptionsFor, pasteFormatFor, type MatchingVariant } from '../../services/matching/matchingLayouts';
import { MatchingRenderer } from './MatchingRenderer';
import { MatchingInfoToolbar, type MiMoreKey } from './MatchingInfoToolbar';
import { WorksheetRenderer } from '../preview/WorksheetRenderer';
import { BrandHeader } from '../preview/BrandHeader';
import { BrandFooter } from '../preview/BrandFooter';
import { resolveBranding, fileToSmallDataUrl } from '../../types/branding';
import { exportWorksheetToDocx } from '../../services/docxExportService';
import { useAppHeaderSlot } from '../shared/hooks/useAppHeaderSlot';
import { useSplitPane } from '../shared/hooks/useSplitPane';
import { RichEditable, RichMarksProvider } from '../shared/rich/RichEditable';
import type { RichMarks } from '../../services/richFields';

interface Props {
  variant: MatchingVariant;
  folder: LessonFolder;
  editingExercise?: Exercise | null;
  onSaveExercise: (exercise: Exercise, nextAction: 'return' | 'add_another' | 'stay') => void;
  onCancel: () => void;
  onDeleteExercise?: (exerciseId: string) => void;
}

/** Toàn bộ dữ liệu đang soạn: tiêu đề + hướng dẫn nằm cạnh dữ liệu Matching (cùng một lịch sử hoàn tác) */
interface State {
  title: string;
  instruction: string;
  matching: MatchingData;
  richMarks?: RichMarks;
}

const VARIANT_INFO: Record<MatchingVariant, { title: string; instruction: string; label: string }> = {
  matching_information: { title: 'MATCH THE INFORMATION.', instruction: '', label: 'Matching Information' },
  draw_lines_match: { title: 'DRAW LINES AND MATCH', instruction: 'Draw lines to match the questions with the correct answers.', label: 'Draw Lines and Match' },
};

const fieldCls =
  'w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';
const iconBtn = 'p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent';
const smallBtn = 'px-2.5 h-7 rounded-lg border border-blue-200 bg-white text-[11px] font-semibold text-blue-700 hover:bg-blue-50 flex items-center gap-1 disabled:opacity-40';

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

const SectionHead: React.FC<{ n: number; title: string; right?: React.ReactNode; help?: string }> = ({ n, title, right, help }) => (
  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-blue-50/70 border border-blue-100 min-w-0">
    <span className="w-5 h-5 rounded-md bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">{n}</span>
    <h3 className="text-[13px] font-bold text-slate-900 truncate">{title}</h3>
    {help && <span className="text-blue-400 cursor-help shrink-0" title={help}><HelpCircle size={13} /></span>}
    {right && <div className="ml-auto flex items-center gap-1.5 shrink-0">{right}</div>}
  </div>
);

export const MatchingInfoEditor: React.FC<Props> = ({ variant, folder, editingExercise, onSaveExercise, onCancel, onDeleteExercise }) => {
  const info = VARIANT_INFO[variant];
  const layouts = layoutOptionsFor(variant);
  const [state, setStateRaw] = useState<State>(() => {
    const base = editingExercise?.matching
      ? createMatching(editingExercise.matching)
      : createMatching({
          layout: defaultLayoutFor(variant),
          problems: (editingExercise?.questions || []).map((q) => ({ id: q.id, text: q.text })),
        });
    // layout cũ không thuộc dạng bài này (ví dụ bài Draw Lines cũ) thì dùng layout mặc định của dạng bài
    const layout = layouts.some((l) => l.id === base.layout) ? base.layout : defaultLayoutFor(variant);
    return {
      title: editingExercise?.title || info.title,
      instruction: editingExercise ? editingExercise.instructions || '' : info.instruction,
      matching: { ...base, layout },
    };
  });
  const data = state.matching;
  const exerciseIdRef = useRef(editingExercise?.id || `ex_${variant}_${Date.now()}`);
  const savedIdx = folder.exercises.findIndex((e) => e.id === exerciseIdRef.current);
  const exerciseNumber = savedIdx >= 0 ? savedIdx + 1 : folder.exercises.length + 1;
  const brand = resolveBranding(folder.printSettings.branding);
  const [pageBreakBefore, setPageBreakBefore] = useState(!!editingExercise?.pageBreakBefore);

  // ── Undo / Redo
  const stateRef = useRef(state);
  const pastRef = useRef<State[]>([]);
  const futureRef = useRef<State[]>([]);
  const lastPushRef = useRef(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const setState = (next: React.SetStateAction<State>) => {
    const prev = stateRef.current;
    const val = typeof next === 'function' ? (next as (p: State) => State)(prev) : next;
    if (val === prev) return;
    const now = Date.now();
    if (now - lastPushRef.current > 500) {
      pastRef.current.push(prev);
      if (pastRef.current.length > 100) pastRef.current.shift();
    }
    lastPushRef.current = now;
    futureRef.current = [];
    stateRef.current = val;
    setStateRaw(val);
    setSaveStatus('unsaved');
  };
  const jump = (from: State[], to: State[]) => {
    const target = from.pop();
    if (!target) return;
    to.push(stateRef.current);
    stateRef.current = target;
    lastPushRef.current = 0;
    setStateRaw(target);
    setSaveStatus('unsaved');
  };
  const canUndo = pastRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;
  const setMatching = (fn: (m: MatchingData) => MatchingData) => setState((p) => ({ ...p, matching: fn(p.matching) }));
  const patchMatching = (patch: Partial<MatchingData>) => setMatching((m) => ({ ...m, ...patch }));
  const updateSettings = (patch: Partial<MatchingData['settings']>) => setMatching((m) => ({ ...m, settings: { ...m.settings, ...patch } }));
  const setLayout = (id: MatchingLayoutId) => patchMatching({ layout: id });

  // ── Giao diện
  const slot = useAppHeaderSlot();
  const { mainRef, leftPct, isDragging, handlers: splitHandlers } = useSplitPane(`${variant}-editor-left-pct`);
  const [activeTab, setActiveTab] = useState<'preview' | 'edit_mode'>('edit_mode');
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pageFull, setPageFull] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const locked = activeTab === 'preview';
  const leftColRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (leftColRef.current) (leftColRef.current as HTMLDivElement & { inert: boolean }).inert = locked;
  }, [locked]);

  const paneRef = useRef<HTMLDivElement>(null);
  const [paneSize, setPaneSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    const measure = () => setPaneSize({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);
  const fitScale = paneSize.w > 0 && paneSize.h > 0
    ? Math.min(1.3, Math.max(0.3, Math.min((paneSize.w - 40) / 794, (paneSize.h - 40) / 1123)))
    : 0.7;

  // ── Hai danh sách
  type Side = 'problems' | 'solutions';
  const patchItem = (side: Side, id: string, patch: Partial<MatchingProblem & MatchingSolution>) =>
    setMatching((m) => ({ ...m, [side]: (m[side] as (MatchingProblem | MatchingSolution)[]).map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  const addItem = (side: Side) => setMatching((m) => ({ ...m, [side]: [...m[side], { id: newId(side === 'problems' ? 'p' : 's'), text: '' }] }));
  const removeItem = (side: Side, id: string) => setMatching((m) => ({ ...m, [side]: (m[side] as { id: string }[]).filter((x) => x.id !== id) }));
  const duplicateItem = (side: Side, id: string) => setMatching((m) => {
    const list = [...m[side]] as (MatchingProblem | MatchingSolution)[];
    const i = list.findIndex((x) => x.id === id);
    if (i < 0) return m;
    list.splice(i + 1, 0, { ...list[i], id: newId(side === 'problems' ? 'p' : 's') });
    return { ...m, [side]: list };
  });
  const reorder = (side: Side, from: number, to: number) => setMatching((m) => ({ ...m, [side]: moveItem(m[side] as unknown[], from, to) }));
  const setItemImage = async (side: Side, id: string, file: File) => {
    try {
      patchItem(side, id, { imageUrl: await fileToSmallDataUrl(file, 600, 'image/png') });
    } catch {
      window.alert('Không đọc được ảnh này.');
    }
  };
  const dragRef = useRef<{ side: Side; index: number } | null>(null);

  // ── Bài đọc có ảnh (layout Bài đọc + ảnh)
  const readingBlocks = data.reading || [];
  const setBlocks = (list: NonNullable<MatchingData['reading']>) => patchMatching({ reading: list });
  const patchBlock = (id: string, patch: Partial<NonNullable<MatchingData['reading']>[number]>) => setBlocks(readingBlocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const setBlockImage = async (id: string, file: File) => {
    try {
      const url = await fileToSmallDataUrl(file, 900, 'image/jpeg');
      const ratio = await new Promise<number>((resolve) => {
        const im = new Image();
        im.onload = () => resolve(im.naturalWidth && im.naturalHeight ? Math.round((im.naturalWidth / im.naturalHeight) * 100) / 100 : 4 / 3);
        im.onerror = () => resolve(4 / 3);
        im.src = url;
      });
      patchBlock(id, { imageUrl: url, imageRatio: ratio });
    } catch {
      window.alert('Không đọc được ảnh này.');
    }
  };

  // ── Smart Paste
  const [modal, setModal] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [modalMsg, setModalMsg] = useState('');
  const fmt = pasteFormatFor(data.layout);
  const hasContent = data.problems.length > 0 || data.solutions.length > 0;
  const openModal = () => { setModal(true); setPasteText(''); setModalMsg(''); };
  const applyPaste = () => {
    const parsed = parseMatchingText(pasteText);
    if (!parsed.ok) { setModalMsg(parsed.warnings[0] || 'Không nhận ra mục nào dạng "1. …" và "a. …".'); return; }
    if (hasContent && !window.confirm('Thay toàn bộ tiêu đề và hai danh sách hiện có bằng nội dung vừa dán? (Có thể Hoàn tác)')) return;
    setState((p) => {
      const next = matchingFromParsed(parsed, p.matching);
      // giữ layout đang chọn nếu nó thuộc dạng bài này (bộ đọc chỉ tự đổi sang Bài đọc + ảnh hoặc hai bảng khi đề có dấu hiệu rõ)
      const keep = parsed.reading?.length ? next.layout : layouts.some((l) => l.id === p.matching.layout) ? p.matching.layout : next.layout;
      return { ...p, ...(parsed.title ? { title: parsed.title } : {}), matching: { ...next, layout: layouts.some((l) => l.id === keep) ? keep : defaultLayoutFor(variant) } };
    });
    setModal(false);
  };

  // ── Lưu / xuất
  const buildExercise = (): Exercise => ({
    id: exerciseIdRef.current,
    type: variant,
    layoutType: 'template_a',
    title: state.title,
    instructions: state.instruction,
    pointsTotal: data.problems.length,
    order: editingExercise?.order || folder.exercises.length + 1,
    imageSlots: [],
    questions: data.problems.map((p, i) => ({ id: p.id, number: i + 1, text: p.text, points: 1 })),
    pageBreakBefore: pageBreakBefore || undefined,
    matching: data,
  });

  useSaveShortcut(() => handleSave('stay'));

  const handleSave = (next: 'return' | 'add_another' | 'stay' = 'return') => {
    const v = validateMatching(data);
    if (v.errors.length > 0 && next !== 'stay') {
      if (!window.confirm(`Bài còn thiếu:\n\n• ${v.errors.slice(0, 4).join('\n• ')}\n\nVẫn lưu?`)) return;
    }
    onSaveExercise(buildExercise(), next);
    setSaveStatus('saved');
  };

  const buildWorksheet = (onlyCurrent = false): Worksheet => {
    const current = buildExercise();
    let exercises: Exercise[];
    if (onlyCurrent) exercises = [current];
    else {
      const exists = folder.exercises.some((x) => x.id === current.id);
      exercises = exists ? folder.exercises.map((x) => (x.id === current.id ? current : x)) : [...folder.exercises, current];
      exercises = [...exercises].sort((a, b) => (a.order || 0) - (b.order || 0));
    }
    return {
      id: folder.id,
      title: onlyCurrent ? current.title || 'DAILY WORKSHEET' : folder.name || 'DAILY WORKSHEET',
      unit: folder.unitTopic || 'Unit 2 - London',
      lesson: folder.lessonTitle || 'Lesson 1',
      gradeLevel: folder.gradeLevel || 'Level 2',
      subject: folder.subject || 'English',
      schoolName: folder.schoolName || 'PINTA ENGLISH',
      teacherName: folder.teacherName || 'MAI LINH',
      totalPoints: exercises.reduce((n, x) => n + (x.questions?.length || 0), 0),
      status: 'ready',
      printSettings: folder.printSettings,
      exercises,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  };
  const previewWorksheet = useMemo(() => (isFullscreen ? buildWorksheet() : null), [isFullscreen, state]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cài đặt chi tiết trong menu More
  const renderMoreSection = (key: MiMoreKey): React.ReactNode => {
    const s = data.settings;
    const row = 'flex items-center justify-between gap-3 text-[11.5px] text-slate-700';
    if (key === 'typography') {
      return (
        <div className="space-y-2.5">
          <label className={row}>Cỡ chữ các mục
            <select value={s.fontSizePt} onChange={(e) => updateSettings({ fontSizePt: Number(e.target.value) })} className={`${fieldCls} !w-24 !py-1`}>
              {[10, 10.5, 11, 12, 13, 14, 16].map((n) => <option key={n} value={n}>{n} pt</option>)}
            </select>
          </label>
        </div>
      );
    }
    return (
      <div className="space-y-2.5 text-[11.5px] text-slate-700">
        <label className={row}>Khoảng cách hai cột
          <span className="flex items-center gap-2"><input type="range" min={6} max={40} step={1} value={s.columnGapMm} onChange={(e) => updateSettings({ columnGapMm: Number(e.target.value) })} className="accent-blue-600" /><span className="font-mono w-12 text-right">{s.columnGapMm} mm</span></span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={pageBreakBefore} onChange={(e) => { setPageBreakBefore(e.target.checked); setSaveStatus('unsaved'); }} className="rounded text-blue-600 focus:ring-0" />
          Ngắt trang trước bài này
        </label>
      </div>
    );
  };

  /** Tiêu đề + hướng dẫn cùng kiểu với tiêu đề bài của phiếu in (ExerciseBlock), sửa trực tiếp được ở Edit Mode */
  const renderHeading = (editable: boolean) => (
    <div style={{ marginBottom: '3mm' }}>
      <div className="flex items-center gap-[1.2mm] mb-[2.5mm]">
        <span className="shrink-0 flex items-center justify-center text-white font-bold" style={{ width: '5.2mm', height: '5.2mm', background: '#16295f', borderRadius: '0.9mm', fontSize: '10.5pt', fontFamily: '"Roboto Condensed", "Arial Narrow", Arial, sans-serif', lineHeight: 1 }}>{exerciseNumber}</span>
        <h2 className="font-bold uppercase leading-[1.2]" style={{ color: '#16295f', fontSize: '12.5pt', fontFamily: '"Roboto Condensed", "Arial Narrow", Arial, sans-serif', letterSpacing: '0.01em' }}>
          <RichEditable value={state.title} onCommit={editable ? (v) => setState((p) => ({ ...p, title: v })) : undefined} />
        </h2>
      </div>
      {state.instruction && (
        <p className="text-[10.5pt] italic text-[#333333] leading-[1.35]" style={{ paddingLeft: '6mm' }}>
          <RichEditable value={state.instruction} onCommit={editable ? (v) => setState((p) => ({ ...p, instruction: v })) : undefined} />
        </p>
      )}
    </div>
  );

  const renderA4 = (scale: number, editable: boolean) => (
    <div className="bg-white text-[#111] shadow-xl mx-auto" style={{ width: '210mm', minHeight: '297mm', padding: '15mm', zoom: scale, display: 'flex', flexDirection: 'column' }}>
      {brand.enabled && <BrandHeader b={brand} />}
      <div className="mt-[4mm]">
        <RichMarksProvider marks={state.richMarks} onChange={editable ? (fn) => setState((p) => ({ ...p, richMarks: fn(p.richMarks) })) : undefined}>
          {renderHeading(editable)}
          <div style={{ paddingLeft: '6mm' }}><MatchingRenderer data={data} /></div>
        </RichMarksProvider>
      </div>
      {brand.enabled && <div className="mt-auto pt-[8mm]"><BrandFooter b={brand} pageNumber={1} totalPages={1} /></div>}
    </div>
  );

  const box = 'inline-flex items-center bg-white border border-slate-200 rounded-lg shadow-xs';
  const btn = 'w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-50 rounded-lg';

  const renderList = (side: Side, n: number, title: string, help: string) => {
    const list = data[side] as (MatchingProblem | MatchingSolution)[];
    return (
      <section className="shrink-0 bg-white/60 border border-slate-100 rounded-2xl p-4 shadow-xs space-y-2.5">
        <SectionHead n={n} title={`${title} (${list.length})`} help={help} right={<>
          <button type="button" onClick={() => addItem(side)} className={smallBtn}><Plus size={12} /> Add</button>
          <button type="button" onClick={openModal} className={smallBtn}>Smart Paste</button>
        </>} />
        {list.length === 0 && <p className="text-xs text-slate-400 py-2 text-center">Chưa có mục nào. Bấm Add hoặc Smart Paste.</p>}
        <div className="space-y-2">
          {list.map((it, i) => (
            <div
              key={it.id}
              className="group flex items-start gap-1.5"
              onDragOver={(e) => { if (dragRef.current?.side === side) e.preventDefault(); }}
              onDrop={(e) => { if (dragRef.current?.side !== side) return; e.preventDefault(); reorder(side, dragRef.current.index, i); dragRef.current = null; }}
            >
              <span draggable onDragStart={(e) => { dragRef.current = { side, index: i }; e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => { dragRef.current = null; }} className="pt-2 text-slate-300 hover:text-slate-600 cursor-grab active:cursor-grabbing shrink-0" title="Kéo để đổi vị trí"><GripVertical size={14} /></span>
              <span className="min-w-6 h-7 mt-0.5 px-1.5 rounded-md bg-slate-100 text-[11px] font-bold text-slate-600 flex items-center justify-center shrink-0">{side === 'problems' ? i + 1 : solutionLabel(i)}</span>
              <div className="w-11 h-8 mt-0.5 shrink-0 rounded-md border border-slate-200 bg-white flex items-center justify-center overflow-hidden">
                {it.imageUrl ? <img src={it.imageUrl} alt="" className="max-w-full max-h-full object-contain" /> : <ImagePlus size={13} className="text-slate-300" />}
              </div>
              <label className={`${smallBtn} mt-0.5 cursor-pointer shrink-0`} title={it.imageUrl ? 'Đổi ảnh' : 'Tải ảnh cho mục này'}>
                {it.imageUrl ? 'Đổi' : 'Ảnh'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void setItemImage(side, it.id, f); }} />
              </label>
              <AutoTextarea value={it.text} onChange={(e) => patchItem(side, it.id, { text: e.target.value })} placeholder="Nội dung…" className={`${fieldCls} block flex-1 min-w-0 resize-none min-h-[34px]`} />
              <span className="flex items-center shrink-0 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-opacity">
                {it.imageUrl && <button type="button" className={iconBtn} title="Bỏ ảnh" onClick={() => patchItem(side, it.id, { imageUrl: undefined })}><X size={13} /></button>}
                <button type="button" className={iconBtn} title="Lên" disabled={i === 0} onClick={() => reorder(side, i, i - 1)}><ArrowUp size={13} /></button>
                <button type="button" className={iconBtn} title="Xuống" disabled={i === list.length - 1} onClick={() => reorder(side, i, i + 1)}><ArrowDown size={13} /></button>
                <button type="button" className={iconBtn} title="Nhân bản" onClick={() => duplicateItem(side, it.id)}><Copy size={13} /></button>
                <button type="button" className={`${iconBtn} hover:!text-rose-600`} title="Xóa" onClick={() => removeItem(side, it.id)}><Trash2 size={13} /></button>
              </span>
            </div>
          ))}
        </div>
      </section>
    );
  };

  const showReading = data.layout === 'reading_images';

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-100 select-text">
      {slot && createPortal(
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-4 mr-3">
            <button type="button" onClick={onCancel} className="flex items-center gap-2 text-[13px] font-semibold text-slate-800 px-3.5 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors"><ArrowLeft size={16} /> Back to Lesson</button>
            <div className="leading-tight">
              <div className="text-[17px] font-bold text-[#16295f]">Edit Worksheet</div>
              <div className="text-[11.5px] text-slate-500">{folder.name || 'Unit 2 - London'} <span className="text-slate-300 mx-0.5">|</span> Worksheet: {folder.printSettings?.branding?.worksheetNo || 'WS-Match-1'}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <SaveStatusBadge status={saveStatus} />
            <div className="relative">
              <button type="button" onClick={() => setShowExportMenu((v) => !v)} className="w-9 h-9 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center justify-center" title="Tùy chọn xuất file"><MoreHorizontal size={16} /></button>
              {showExportMenu && (
                <div className="absolute right-0 top-full mt-1.5 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 z-50">
                  <button type="button" onClick={() => { exportWorksheetToDocx(buildWorksheet(true), 'student'); setShowExportMenu(false); }} className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"><FileDown size={14} className="text-blue-600" /> Xuất Word (.docx)</button>
                  <div className="h-px bg-slate-100 my-1" />
                  <button type="button" onClick={() => { setShowExportMenu(false); window.print(); }} className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"><Printer size={14} /> In / Xuất PDF (Chuẩn A4)</button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => jump(pastRef.current, futureRef.current)} disabled={!canUndo} title="Hoàn tác" className="w-9 h-9 flex items-center justify-center text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg disabled:opacity-35 disabled:cursor-not-allowed"><RotateCcw size={16} /></button>
              <button type="button" onClick={() => jump(futureRef.current, pastRef.current)} disabled={!canRedo} title="Làm lại" className="w-9 h-9 flex items-center justify-center text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg disabled:opacity-35 disabled:cursor-not-allowed"><RotateCw size={16} /></button>
            </div>
            <button type="button" onClick={() => setIsFullscreen(true)} className="px-5 h-9 text-[13px] font-semibold text-[#16295f] bg-white border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center gap-2"><Eye size={16} /> Preview</button>
            <button type="button" onClick={() => handleSave('return')} className="px-7 h-9 text-[13px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2 shadow-sm transition-all"><Save size={16} /> Save</button>
          </div>
        </div>,
        slot,
      )}

      <MatchingInfoToolbar
        data={data}
        layouts={layouts}
        onSettings={updateSettings}
        onLayout={setLayout}
        pageBreakBefore={pageBreakBefore}
        onPageBreak={() => { setPageBreakBefore((v) => !v); setSaveStatus('unsaved'); }}
        onAddProblem={() => addItem('problems')}
        onAddSolution={() => addItem('solutions')}
        onAddReading={() => setBlocks([...readingBlocks, newReadingBlock()])}
        onSmartPaste={openModal}
        onInsertExercise={() => handleSave('return')}
        onDuplicate={() => handleSave('add_another')}
        onDelete={onDeleteExercise && editingExercise ? () => {
          if (window.confirm('Xóa toàn bộ bài tập này?')) { onDeleteExercise(editingExercise.id); onCancel(); }
        } : undefined}
        renderMoreSection={renderMoreSection}
        shell={{
          onSave: () => handleSave('stay'),
          onSaveAndReturn: () => handleSave('return'),
          onExportDocx: () => exportWorksheetToDocx(buildWorksheet(true), 'student'),
          onPrint: () => window.print(),
          onBack: onCancel,
          zoom,
          onZoom: setZoom,
          onFitPage: () => setPageFull(true),
          previewMode: activeTab === 'preview',
          onPreviewMode: (preview) => setActiveTab(preview ? 'preview' : 'edit_mode'),
          undo: { onUndo: () => jump(pastRef.current, futureRef.current), onRedo: () => jump(futureRef.current, pastRef.current), canUndo, canRedo },
        }}
        locked={locked}
      />

      <main ref={mainRef} className="flex-1 min-h-0 p-4 md:p-6 flex flex-col xl:flex-row gap-4 xl:gap-0 items-stretch overflow-y-auto xl:overflow-hidden">
        {/* ═══ CỘT TRÁI ═══ */}
        <div
          ref={leftColRef}
          className={`min-w-0 w-full xl:w-[var(--left-w)] xl:shrink-0 flex flex-col gap-3 xl:h-full xl:overflow-y-auto rounded-2xl border border-slate-200 bg-white/30 p-3 transition-opacity ${locked ? 'opacity-60 select-none' : ''}`}
          style={{ ['--left-w' as string]: `${leftPct}%` }}
        >
          <section className="shrink-0 bg-white/60 border border-slate-100 rounded-2xl p-4 shadow-xs space-y-3">
            <SectionHead n={1} title="Exercise Content" help="Tiêu đề và hướng dẫn in trên phiếu." right={<>
              <button type="button" onClick={openModal} className="px-2.5 h-7 rounded-lg bg-blue-600 text-white text-[11px] font-bold hover:bg-blue-700 flex items-center gap-1" title="Dán cả bài, chọn layout, đọc từ ảnh hoặc để AI viết lại đúng định dạng">Smart Paste</button>
              <span className="px-2.5 py-0.5 rounded-full bg-white border border-blue-200 text-[11px] font-bold text-blue-700">Exercise {exerciseNumber}</span>
            </>} />
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Exercise Title</label>
              <AutoTextarea value={state.title} onChange={(e) => setState((p) => ({ ...p, title: e.target.value }))} className={`${fieldCls} resize-none min-h-[34px] font-semibold`} />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Instruction <span className="font-normal text-slate-400">(optional)</span></label>
              <AutoTextarea value={state.instruction} onChange={(e) => setState((p) => ({ ...p, instruction: e.target.value }))} className={`${fieldCls} resize-none min-h-[34px]`} />
            </div>
          </section>

          {showReading && (
            <section className="shrink-0 bg-white/60 border border-slate-100 rounded-2xl p-4 shadow-xs space-y-2.5">
              <SectionHead n={2} title={`Reading passage (${readingBlocks.length})`} help="Bài đọc có ảnh minh họa bên phải: mỗi khối có tên, địa điểm, nội dung và ảnh." right={
                <button type="button" onClick={() => setBlocks([...readingBlocks, newReadingBlock()])} className={smallBtn}><Plus size={12} /> Add block</button>
              } />
              <input value={data.readingHeading || ''} onChange={(e) => patchMatching({ readingHeading: e.target.value })} placeholder="Tiêu đề bài đọc (ví dụ GHOST TOWNS:)" className={fieldCls} />
              <AutoTextarea value={data.readingIntro || ''} onChange={(e) => patchMatching({ readingIntro: e.target.value })} placeholder="Đoạn dẫn (tùy chọn)" className={`${fieldCls} resize-none min-h-[34px]`} />
              {readingBlocks.map((b, i) => (
                <div key={b.id} className="rounded-xl border border-slate-200 bg-white p-2.5 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="min-w-6 h-6 px-1.5 rounded-md bg-slate-100 text-[11px] font-bold text-slate-600 flex items-center justify-center">{i + 1}</span>
                    <input value={b.name || ''} onChange={(e) => patchBlock(b.id, { name: e.target.value })} placeholder="Name" className={`${fieldCls} !py-1.5 flex-1 min-w-0`} />
                    <input value={b.location || ''} onChange={(e) => patchBlock(b.id, { location: e.target.value })} placeholder="Location" className={`${fieldCls} !py-1.5 flex-1 min-w-0`} />
                    <button type="button" className={iconBtn} title="Lên" disabled={i === 0} onClick={() => setBlocks(moveItem(readingBlocks, i, i - 1))}><ArrowUp size={13} /></button>
                    <button type="button" className={iconBtn} title="Xuống" disabled={i === readingBlocks.length - 1} onClick={() => setBlocks(moveItem(readingBlocks, i, i + 1))}><ArrowDown size={13} /></button>
                    <button type="button" className={`${iconBtn} hover:!text-rose-600`} title="Xóa khối" onClick={() => setBlocks(readingBlocks.filter((x) => x.id !== b.id))}><Trash2 size={13} /></button>
                  </div>
                  <AutoTextarea value={b.text} onChange={(e) => patchBlock(b.id, { text: e.target.value })} placeholder="Nội dung (dòng trống = đoạn mới, **chữ** = in đậm)" className={`${fieldCls} resize-none min-h-[60px]`} />
                  <div className="flex items-center gap-2">
                    <div className="w-14 h-10 rounded-md border border-slate-200 bg-white flex items-center justify-center overflow-hidden shrink-0">
                      {b.imageUrl ? <img src={b.imageUrl} alt="" className="max-w-full max-h-full object-contain" /> : <ImagePlus size={14} className="text-slate-300" />}
                    </div>
                    <label className={`${smallBtn} cursor-pointer`}>{b.imageUrl ? 'Đổi ảnh' : 'Tải ảnh'}<input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void setBlockImage(b.id, f); }} /></label>
                    {b.imageUrl && <button type="button" className={smallBtn} onClick={() => patchBlock(b.id, { imageUrl: undefined, imageRatio: undefined })}>Bỏ ảnh</button>}
                  </div>
                </div>
              ))}
            </section>
          )}

          {renderList('problems', showReading ? 3 : 2, 'Problems – 1, 2, 3…', 'Cột trái: câu hỏi / ý cần nối. Mỗi mục có thể kèm ảnh.')}
          {renderList('solutions', showReading ? 4 : 3, 'Solutions – a, b, c…', 'Cột phải: các lựa chọn. Số mục hai cột có thể khác nhau.')}
        </div>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Kéo để đổi độ rộng hai cột"
          title="Kéo để đổi độ rộng · nhấp đúp để đặt lại"
          {...splitHandlers}
          className="hidden xl:flex shrink-0 self-stretch w-5 mx-0.5 items-center justify-center cursor-col-resize group touch-none select-none"
        >
          <div className={`w-1 h-full min-h-24 rounded-full transition-colors ${isDragging ? 'bg-blue-500' : 'bg-slate-200 group-hover:bg-blue-400'}`} />
        </div>

        {/* ═══ CỘT PHẢI: XEM TRƯỚC ═══ */}
        <div className="flex-1 min-w-0 flex flex-col gap-3 xl:h-full rounded-2xl border border-slate-200 bg-white/30 p-3">
          <div className="bg-white/60 border border-slate-200 rounded-xl p-1.5 flex flex-wrap items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-1">
              {([['preview', 'Preview'], ['edit_mode', 'Edit Mode']] as const).map(([id, label]) => (
                <button key={id} type="button" onClick={() => setActiveTab(id)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${activeTab === id ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>{label}</button>
              ))}
              {locked && <span className="hidden 2xl:inline ml-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1">Chỉ xem – chọn Edit Mode để chỉnh sửa</span>}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-700 shrink-0 [&_button]:!w-7 [&_button]:!h-7">
              <div className={`${box} px-0.5`}><button type="button" onClick={() => setZoom((z) => Math.max(50, z - 10))} className={btn} title="Thu nhỏ"><Minus size={14} /></button><span className="w-11 text-center">{zoom}%</span><button type="button" onClick={() => setZoom((z) => Math.min(150, z + 10))} className={btn} title="Phóng to"><Plus size={14} /></button></div>
              <button type="button" onClick={() => setPageFull(true)} className={`${box} ${btn}`} title="Phóng to trang đang soạn"><Maximize2 size={14} /></button>
              <button type="button" onClick={() => { setZoom(100); setPageFull(false); }} className={`${box} ${btn}`} title="Thu nhỏ về 100%"><Minimize size={14} /></button>
              <button type="button" onClick={() => window.print()} className={`${box} ${btn}`} title="In trang A4"><Printer size={15} /></button>
            </div>
          </div>
          <div ref={paneRef} className="flex-1 min-h-0 overflow-auto bg-slate-200/60 p-3 rounded-2xl shadow-inner">
            {renderA4(fitScale * (zoom / 100), activeTab === 'edit_mode')}
          </div>
        </div>
      </main>

      {modal && (
        <div className="fixed inset-0 z-[80] bg-slate-900/40 flex items-center justify-center p-4" onClick={() => setModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 flex flex-col gap-3" style={{ width: 'min(36rem, 95vw)', minWidth: '20rem', maxWidth: '95vw', maxHeight: '92vh', resize: 'both', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-slate-900">Smart Paste – dán cả bài</h3><button type="button" onClick={() => setModal(false)} className="p-1 text-slate-400 hover:text-slate-700"><X size={16} /></button></div>
            <p className="text-xs text-slate-500">{fmt.hint}</p>
            <textarea rows={10} style={{ flex: '1 1 auto', minHeight: '14rem', resize: 'none' }} value={pasteText} onChange={(e) => { setPasteText(e.target.value); setModalMsg(''); }} placeholder={fmt.example} className={`${fieldCls} font-mono`} />
            <SmartLayoutBar kind={info.label} layouts={layouts} current={data.layout} onLayout={(id) => setLayout(id as MatchingLayoutId)} hint={fmt.hint} example={fmt.example} text={pasteText} onText={(v) => { setPasteText(v); setModalMsg(''); }} />
            <AiRewriteBox kind={`${info.label} – ${layouts.find((l) => l.id === data.layout)?.label || ''}`} hint={fmt.hint} example={fmt.example} text={pasteText} onText={(v) => { setPasteText(v); setModalMsg(''); }} />
            {modalMsg && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">{modalMsg}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModal(false)} className="h-9 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Hủy</button>
              <button type="button" onClick={applyPaste} disabled={!pasteText.trim()} className="h-9 px-4 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-lg">Áp dụng</button>
            </div>
          </div>
        </div>
      )}

      {pageFull && <PageZoomOverlay worksheet={buildWorksheet(true)} onClose={() => setPageFull(false)} />}

      {isFullscreen && previewWorksheet && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 md:p-8" onClick={() => setIsFullscreen(false)}>
          <div className="bg-white rounded-3xl w-full max-w-5xl h-[92vh] flex flex-col shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="h-14 px-6 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-3"><span className="text-sm font-bold text-slate-900">Preview toàn bộ worksheet</span><span className="text-xs text-slate-500">{previewWorksheet.exercises.length} bài · A4</span></div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => window.print()} className="px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl flex items-center gap-1.5"><Printer size={13} /> In / Xuất PDF</button>
                <button type="button" onClick={() => setIsFullscreen(false)} className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100"><X size={18} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-slate-200/70 p-8 flex justify-center"><WorksheetRenderer worksheet={previewWorksheet} /></div>
          </div>
        </div>
      )}
    </div>
  );
};
