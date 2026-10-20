import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, Check, Copy, Eye, FileDown, GripVertical, Maximize2, Minimize, Minus, Plus, Printer, X, MoreHorizontal,
  RotateCcw, RotateCw, Save, Trash2, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, HelpCircle,
} from 'lucide-react';
import { PageZoomOverlay } from '../shared/PageZoomOverlay';
import type { Exercise, LessonFolder, Worksheet } from '../../types';
import {
  bumpLmSize, createListeningMatching, moveLmItem, newLmId, optionLabel, parseListeningMatchingText, setLmStyle,
  validateListeningMatching, LM_STYLE_LABELS,
  type ListeningMatchingData, type LmItem, type LmStyleKey,
} from '../../services/listening-matching/listeningMatchingCore';
import { ListeningMatchingRenderer } from './ListeningMatchingRenderer';
import { ListeningMatchingToolbar, type LmMoreKey } from './ListeningMatchingToolbar';
import { AudioQrPanel } from '../shared/AudioQrPanel';
import { WorksheetRenderer } from '../preview/WorksheetRenderer';
import { BrandHeader } from '../preview/BrandHeader';
import { BrandFooter } from '../preview/BrandFooter';
import { resolveBranding } from '../../types/branding';
import { exportWorksheetToDocx } from '../../services/docxExportService';
import { useAppHeaderSlot } from '../shared/hooks/useAppHeaderSlot';
import { useSplitPane } from '../shared/hooks/useSplitPane';

interface Props {
  folder: LessonFolder;
  editingExercise?: Exercise | null;
  onSaveExercise: (exercise: Exercise, nextAction: 'return' | 'add_another' | 'stay') => void;
  onCancel: () => void;
  onDeleteExercise?: (exerciseId: string) => void;
}

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

const PLACEHOLDER = '2 LISTEN AGAIN. MATCH THE REASONS (A–E) TO THE QUESTIONS (1–5)\n\n1. Why is colour important?\n2. Why do many restaurants in Mexico have orange walls?\n\na. Because this is the colour of fire and good things.\nb. Because it changes the way people think and feel.';

export const ListeningMatchingEditor: React.FC<Props> = ({ folder, editingExercise, onSaveExercise, onCancel, onDeleteExercise }) => {
  const [data, setDataRaw] = useState<ListeningMatchingData>(() =>
    editingExercise?.listeningMatching
      ? createListeningMatching(editingExercise.listeningMatching)
      : createListeningMatching({ ...(editingExercise?.title ? { exerciseTitle: editingExercise.title } : {}) }),
  );
  const exerciseIdRef = useRef(editingExercise?.id || `ex_listening_matching_${Date.now()}`);
  const savedIdx = folder.exercises.findIndex((e) => e.id === exerciseIdRef.current);
  const exerciseNumber = savedIdx >= 0 ? savedIdx + 1 : folder.exercises.length + 1;
  const brand = resolveBranding(folder.printSettings.branding);

  // ── Undo / Redo
  const dataRef = useRef(data);
  const pastRef = useRef<ListeningMatchingData[]>([]);
  const futureRef = useRef<ListeningMatchingData[]>([]);
  const lastPushRef = useRef(0);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const setData = (next: React.SetStateAction<ListeningMatchingData>) => {
    const prev = dataRef.current;
    const val = typeof next === 'function' ? (next as (p: ListeningMatchingData) => ListeningMatchingData)(prev) : next;
    if (val === prev) return;
    const now = Date.now();
    if (now - lastPushRef.current > 500) {
      pastRef.current.push(prev);
      if (pastRef.current.length > 100) pastRef.current.shift();
    }
    lastPushRef.current = now;
    futureRef.current = [];
    dataRef.current = val;
    setDataRaw(val);
    setSaveStatus('saving');
    window.setTimeout(() => setSaveStatus('saved'), 600);
  };
  const jump = (from: ListeningMatchingData[], to: ListeningMatchingData[]) => {
    const target = from.pop();
    if (!target) return;
    to.push(dataRef.current);
    dataRef.current = target;
    lastPushRef.current = 0;
    setDataRaw(target);
  };
  const canUndo = pastRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;
  const update = (patch: Partial<ListeningMatchingData>) => setData((p) => ({ ...p, ...patch }));
  const updateSettings = (patch: Partial<ListeningMatchingData['settings']>) => setData((p) => ({ ...p, settings: { ...p.settings, ...patch } }));

  // ── Giao diện
  const slot = useAppHeaderSlot();
  const { mainRef, leftPct, isDragging, handlers: splitHandlers } = useSplitPane('listening-matching-editor-left-pct');
  const [activeTab, setActiveTab] = useState<'preview' | 'edit_mode'>('edit_mode');
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pageFull, setPageFull] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [selKey, setSelKey] = useState<LmStyleKey>('title');
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

  // ── Câu hỏi và lựa chọn
  type ListKey = 'problems' | 'options';
  const addItem = (k: ListKey) => update({ [k]: [...data[k], { id: newLmId(), text: '' }] } as Partial<ListeningMatchingData>);
  const editItem = (k: ListKey, id: string, text: string) => update({ [k]: data[k].map((s) => (s.id === id ? { ...s, text } : s)) } as Partial<ListeningMatchingData>);
  const removeItem = (k: ListKey, id: string) => update({ [k]: data[k].filter((s) => s.id !== id) } as Partial<ListeningMatchingData>);
  const duplicateItem = (k: ListKey, id: string) => {
    const i = data[k].findIndex((s) => s.id === id);
    if (i < 0) return;
    const list = [...data[k]];
    list.splice(i + 1, 0, { ...list[i], id: newLmId() });
    update({ [k]: list } as Partial<ListeningMatchingData>);
  };
  const moveItem = (k: ListKey, from: number, to: number) => update({ [k]: moveLmItem(data[k], from, to) } as Partial<ListeningMatchingData>);
  const dragRef = useRef<{ k: ListKey; i: number } | null>(null);

  // ── Smart Paste
  const [modal, setModal] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [modalMsg, setModalMsg] = useState('');
  const hasContent = data.problems.length > 0 || data.options.length > 0;
  const openModal = () => { setModal(true); setPasteText(''); setModalMsg(''); };
  const applyModal = () => {
    const parsed = parseListeningMatchingText(pasteText);
    if (!parsed.ok) { setModalMsg(parsed.warnings[0] || 'Không nhận ra câu nào dạng "1. …".'); return; }
    if (hasContent && !window.confirm('Thay toàn bộ tiêu đề, câu hỏi và lựa chọn hiện có bằng nội dung vừa dán? (Có thể Hoàn tác)')) return;
    update({
      problems: parsed.problems.map((t): LmItem => ({ id: newLmId(), text: t })),
      options: parsed.options.map((t): LmItem => ({ id: newLmId(), text: t })),
      ...(parsed.title ? { exerciseTitle: parsed.title } : {}),
      ...(parsed.instruction ? { instruction: parsed.instruction } : {}),
      ...(parsed.problemsHeading ? { problemsHeading: parsed.problemsHeading } : {}),
      ...(parsed.optionsHeading ? { optionsHeading: parsed.optionsHeading } : {}),
      ...(parsed.problemsHeading || parsed.optionsHeading ? { settings: { ...data.settings, layout: 'columns_boxes' as const } } : {}),
    });
    setModal(false);
  };

  // ── Định dạng chữ theo thành phần
  const STYLE_DEFAULTS: Record<LmStyleKey, { bold: boolean; italic: boolean; size: number }> = {
    title: { bold: true, italic: false, size: data.settings.headingFontSizePt },
    instruction: { bold: false, italic: true, size: 10 },
    problems: { bold: false, italic: false, size: data.settings.fontSizePt },
    options: { bold: false, italic: false, size: data.settings.fontSizePt },
  };
  const curStyle = data.textStyles?.[selKey];
  const applyFlag = (flag: 'bold' | 'italic' | 'underline' | 'strike') => {
    const current = flag === 'bold' ? (curStyle?.bold ?? STYLE_DEFAULTS[selKey].bold) : flag === 'italic' ? (curStyle?.italic ?? STYLE_DEFAULTS[selKey].italic) : !!curStyle?.[flag];
    update({ textStyles: setLmStyle(data.textStyles, selKey, { [flag]: !current }) });
  };
  const clearStyle = () => {
    const next = { ...(data.textStyles || {}) };
    delete next[selKey];
    update({ textStyles: next });
  };

  // ── Lưu / xuất
  const buildExercise = (): Exercise => ({
    id: exerciseIdRef.current,
    type: 'listening_matching',
    layoutType: 'template_a',
    title: data.exerciseTitle.replace(/\[\[|\]\]/g, ''),
    instructions: data.instruction,
    pointsTotal: data.problems.length,
    order: editingExercise?.order || folder.exercises.length + 1,
    imageSlots: [],
    questions: data.problems.map((s, i) => ({ id: s.id, number: i + 1, text: s.text, points: 1 })),
    pageBreakBefore: data.settings.pageBreakBefore || undefined,
    listeningMatching: { ...data, exerciseNumber },
  });

  const handleSave = (next: 'return' | 'add_another' | 'stay' = 'return') => {
    const v = validateListeningMatching(data);
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
  const previewWorksheet = useMemo(() => (isFullscreen ? buildWorksheet() : null), [isFullscreen, data]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cài đặt chi tiết trong menu More
  const renderMoreSection = (key: LmMoreKey): React.ReactNode => {
    const s = data.settings;
    const row = 'flex items-center justify-between gap-3 text-[11.5px] text-slate-700';
    if (key === 'typography') {
      return (
        <div className="space-y-2.5">
          <label className={row}>Cỡ chữ nội dung
            <select value={s.fontSizePt} onChange={(e) => updateSettings({ fontSizePt: Number(e.target.value) })} className={`${fieldCls} !w-24 !py-1`}>
              {[10, 10.5, 11, 12, 13, 14].map((n) => <option key={n} value={n}>{n} pt</option>)}
            </select>
          </label>
          <label className={row}>Cỡ chữ tiêu đề
            <select value={s.headingFontSizePt} onChange={(e) => updateSettings({ headingFontSizePt: Number(e.target.value) })} className={`${fieldCls} !w-24 !py-1`}>
              {[11, 12, 12.5, 13, 14, 16].map((n) => <option key={n} value={n}>{n} pt</option>)}
            </select>
          </label>
          <label className={row}>Độ rộng hộp đáp án
            <span className="flex items-center gap-2"><input type="range" min={24} max={60} step={2} value={s.answerBoxWidthMm} onChange={(e) => updateSettings({ answerBoxWidthMm: Number(e.target.value) })} className="accent-blue-600" /><span className="font-mono w-12 text-right">{s.answerBoxWidthMm} mm</span></span>
          </label>
        </div>
      );
    }
    return (
      <div className="space-y-2 text-[11.5px] text-slate-700">
        {([['showExerciseTitle', 'Hiện tiêu đề bài'], ['pageBreakBefore', 'Ngắt trang trước bài này']] as const).map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={s[k]} onChange={(e) => updateSettings({ [k]: e.target.checked } as Partial<ListeningMatchingData['settings']>)} className="rounded text-blue-600 focus:ring-0" />
            {label}
          </label>
        ))}
      </div>
    );
  };

  const renderA4 = (scale: number, editable: boolean) => (
    <div className="bg-white text-[#111] shadow-xl mx-auto" style={{ width: '210mm', minHeight: '297mm', padding: '15mm', zoom: scale, display: 'flex', flexDirection: 'column' }}>
      {brand.enabled && <BrandHeader b={brand} />}
      <div className="mt-[4mm]">
        <ListeningMatchingRenderer
          data={{ ...data, exerciseNumber }}
          exerciseIndex={exerciseNumber}
          editable={editable ? {
            onTitle: (v) => update({ exerciseTitle: v }),
            onInstruction: (v) => update({ instruction: v }),
            onProblem: (id, v) => editItem('problems', id, v),
            onOption: (id, v) => editItem('options', id, v),
            selectedKey: selKey,
            onSelectKey: setSelKey,
          } : undefined}
        />
      </div>
      {brand.enabled && <div className="mt-auto pt-[8mm]"><BrandFooter b={brand} pageNumber={1} totalPages={1} /></div>}
    </div>
  );

  const box = 'inline-flex items-center bg-white border border-slate-200 rounded-lg shadow-xs';
  const btn = 'w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-50 rounded-lg';

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-100 select-text">
      {slot && createPortal(
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-4 mr-3">
            <button type="button" onClick={onCancel} className="flex items-center gap-2 text-[13px] font-semibold text-slate-800 px-3.5 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors"><ArrowLeft size={16} /> Back to Lesson</button>
            <div className="leading-tight">
              <div className="text-[17px] font-bold text-[#16295f]">Edit Worksheet</div>
              <div className="text-[11.5px] text-slate-500">{folder.name || 'Unit 2 - London'} <span className="text-slate-300 mx-0.5">|</span> Worksheet: {folder.printSettings?.branding?.worksheetNo || 'WS-Listen-3-3'}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100"><Check size={13} strokeWidth={2.5} /> {saveStatus === 'saving' ? 'Saving...' : 'Saved a few seconds ago'}</div>
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

      <ListeningMatchingToolbar
        data={data}
        selKey={selKey}
        onSelKey={setSelKey}
        curStyle={curStyle}
        defaults={STYLE_DEFAULTS[selKey]}
        onFlag={applyFlag}
        onSizeDelta={(d) => update({ textStyles: bumpLmSize(data.textStyles, selKey, STYLE_DEFAULTS[selKey].size, d) })}
        onPatchStyle={(patch) => update({ textStyles: setLmStyle(data.textStyles, selKey, patch) })}
        onClearStyle={clearStyle}
        onSettings={updateSettings}
        onAddProblem={() => addItem('problems')}
        onAddOption={() => addItem('options')}
        onSmartPaste={openModal}
        onInsertExercise={() => handleSave('return')}
        onDuplicate={() => handleSave('add_another')}
        onDelete={onDeleteExercise && editingExercise ? () => {
          if (window.confirm('Xóa toàn bộ bài tập này?')) { onDeleteExercise(editingExercise.id); onCancel(); }
        } : undefined}
        renderMoreSection={renderMoreSection}
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
            <SectionHead n={1} title="Exercise Content" help="Tiêu đề in trên phiếu. [[chữ]] = tô đỏ, **chữ** = in đậm." right={<>
              <button type="button" onClick={openModal} className="px-2.5 h-7 rounded-lg bg-blue-600 text-white text-[11px] font-bold hover:bg-blue-700 flex items-center gap-1" title="Dán đề: tự tách tiêu đề, câu hỏi và lựa chọn">Smart Paste</button>
              <span className="px-2.5 py-0.5 rounded-full bg-white border border-blue-200 text-[11px] font-bold text-blue-700">Exercise {exerciseNumber}</span>
            </>} />
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Exercise Title <span className="font-normal text-slate-400">([[chữ]] = đỏ, **chữ** = đậm)</span></label>
              <AutoTextarea value={data.exerciseTitle} onChange={(e) => update({ exerciseTitle: e.target.value })} className={`${fieldCls} resize-none min-h-[34px] font-semibold`} />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Note under title <span className="font-normal text-slate-400">(optional)</span></label>
              <AutoTextarea value={data.instruction} onChange={(e) => update({ instruction: e.target.value })} className={`${fieldCls} resize-none min-h-[34px]`} />
            </div>
            {data.settings.layout === 'columns_boxes' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Tiêu đề cột trái <span className="font-normal text-slate-400">(PLACES)</span></label>
                  <input value={data.problemsHeading || ''} onChange={(e) => update({ problemsHeading: e.target.value })} className={fieldCls} />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Tiêu đề cột phải <span className="font-normal text-slate-400">(PROBLEMS)</span></label>
                  <input value={data.optionsHeading || ''} onChange={(e) => update({ optionsHeading: e.target.value })} className={fieldCls} />
                </div>
              </div>
            )}
          </section>

          <section className="shrink-0 bg-white/60 border border-slate-100 rounded-2xl p-4 shadow-xs space-y-2.5">
            <SectionHead n={2} title="Audio & QR Code" help="Tải file nghe hoặc dán đường dẫn; mã QR tạo từ đường dẫn công khai để học sinh quét và nghe." />
            <AudioQrPanel audio={data.audio} showQr={data.settings.showQrCode} onAudioChange={(audio) => update({ audio })} onShowQrChange={(v) => updateSettings({ showQrCode: v })} />
          </section>

          <section className="shrink-0 bg-white/60 border border-slate-100 rounded-2xl p-4 shadow-xs space-y-2.5">
            <SectionHead n={3} title={`Questions (${data.problems.length})`} right={<>
              <button type="button" onClick={() => addItem('problems')} className={smallBtn}><Plus size={12} /> Add</button>
            </>} />
            {data.problems.length === 0 && <p className="text-xs text-slate-400 py-2 text-center">Chưa có dòng nào. Bấm Add hoặc Smart Paste.</p>}
            <div className="space-y-2">
              {data.problems.map((s, i) => (
                <div
                  key={s.id}
                  className="group flex items-start gap-1.5"
                  onDragOver={(e) => { if (dragRef.current?.k === 'problems') e.preventDefault(); }}
                  onDrop={(e) => { if (dragRef.current?.k !== 'problems') return; e.preventDefault(); moveItem('problems', dragRef.current.i, i); dragRef.current = null; }}
                >
                  <span draggable onDragStart={(e) => { dragRef.current = { k: 'problems', i }; e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => { dragRef.current = null; }} className="pt-2 text-slate-300 hover:text-slate-600 cursor-grab active:cursor-grabbing shrink-0" title="Kéo để đổi vị trí"><GripVertical size={14} /></span>
                  <span className="min-w-6 h-7 mt-0.5 px-1.5 rounded-md bg-slate-100 text-[11px] font-bold text-slate-600 flex items-center justify-center shrink-0">{i + 1}</span>
                  <AutoTextarea value={s.text} onChange={(e) => editItem('problems', s.id, e.target.value)} placeholder="Question…" className={`${fieldCls} block flex-1 min-w-0 resize-none min-h-[34px]`} />
                  <span className="flex items-center shrink-0 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-opacity">
                    <button type="button" className={iconBtn} title="Lên" disabled={i === 0} onClick={() => moveItem('problems', i, i - 1)}><ArrowUp size={13} /></button>
                    <button type="button" className={iconBtn} title="Xuống" disabled={i === data.problems.length - 1} onClick={() => moveItem('problems', i, i + 1)}><ArrowDown size={13} /></button>
                    <button type="button" className={iconBtn} title="Nhân bản" onClick={() => duplicateItem('problems', s.id)}><Copy size={13} /></button>
                    <button type="button" className={`${iconBtn} hover:!text-rose-600`} title="Xóa" onClick={() => removeItem('problems', s.id)}><Trash2 size={13} /></button>
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="shrink-0 bg-white/60 border border-slate-100 rounded-2xl p-4 shadow-xs space-y-2.5">
            <SectionHead n={4} title={`Options (a–e) (${data.options.length})`} right={<>
              <button type="button" onClick={() => addItem('options')} className={smallBtn}><Plus size={12} /> Add</button>
            </>} />
            {data.options.length === 0 && <p className="text-xs text-slate-400 py-2 text-center">Chưa có dòng nào. Bấm Add hoặc Smart Paste.</p>}
            <div className="space-y-2">
              {data.options.map((s, i) => (
                <div
                  key={s.id}
                  className="group flex items-start gap-1.5"
                  onDragOver={(e) => { if (dragRef.current?.k === 'options') e.preventDefault(); }}
                  onDrop={(e) => { if (dragRef.current?.k !== 'options') return; e.preventDefault(); moveItem('options', dragRef.current.i, i); dragRef.current = null; }}
                >
                  <span draggable onDragStart={(e) => { dragRef.current = { k: 'options', i }; e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => { dragRef.current = null; }} className="pt-2 text-slate-300 hover:text-slate-600 cursor-grab active:cursor-grabbing shrink-0" title="Kéo để đổi vị trí"><GripVertical size={14} /></span>
                  <span className="min-w-6 h-7 mt-0.5 px-1.5 rounded-md bg-slate-100 text-[11px] font-bold text-slate-600 flex items-center justify-center shrink-0">{optionLabel(i)}</span>
                  <AutoTextarea value={s.text} onChange={(e) => editItem('options', s.id, e.target.value)} placeholder="Option…" className={`${fieldCls} block flex-1 min-w-0 resize-none min-h-[34px]`} />
                  <span className="flex items-center shrink-0 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-opacity">
                    <button type="button" className={iconBtn} title="Lên" disabled={i === 0} onClick={() => moveItem('options', i, i - 1)}><ArrowUp size={13} /></button>
                    <button type="button" className={iconBtn} title="Xuống" disabled={i === data.options.length - 1} onClick={() => moveItem('options', i, i + 1)}><ArrowDown size={13} /></button>
                    <button type="button" className={iconBtn} title="Nhân bản" onClick={() => duplicateItem('options', s.id)}><Copy size={13} /></button>
                    <button type="button" className={`${iconBtn} hover:!text-rose-600`} title="Xóa" onClick={() => removeItem('options', s.id)}><Trash2 size={13} /></button>
                  </span>
                </div>
              ))}
            </div>
          </section>
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
              <div className={`${box} px-0.5`}><button type="button" className={btn} title="Trang trước"><ChevronLeft size={15} /></button><span className="px-2 whitespace-nowrap">Page 1 / 1</span><button type="button" className={btn} title="Trang sau"><ChevronRight size={15} /></button></div>
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
            <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-slate-900">Smart Paste – dán đề</h3><button type="button" onClick={() => setModal(false)} className="p-1 text-slate-400 hover:text-slate-700"><X size={16} /></button></div>
            <p className="text-xs text-slate-500">Dán tiêu đề, các câu hỏi đánh số 1., 2., … và các lựa chọn a., b., … Hộp đáp án "1. ____" in ở cuối sẽ tự được bỏ.</p>
            <textarea rows={10} style={{ flex: '1 1 auto', minHeight: '14rem', resize: 'none' }} value={pasteText} onChange={(e) => { setPasteText(e.target.value); setModalMsg(''); }} placeholder={PLACEHOLDER} className={`${fieldCls} font-mono`} />
            {modalMsg && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">{modalMsg}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModal(false)} className="h-9 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Hủy</button>
              <button type="button" onClick={applyModal} disabled={!pasteText.trim()} className="h-9 px-4 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-lg">Áp dụng</button>
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

// Giữ tên nhãn thành phần để các nơi khác (nếu cần) dùng lại
export const LM_ELEMENT_LABELS = LM_STYLE_LABELS;
