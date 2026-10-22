import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, Check, Copy, Eye, FileDown, GripVertical, Maximize2, Minimize, Minus, Plus, Printer, X,
  MoreHorizontal, RotateCcw, RotateCw, Save, Trash2, ChevronLeft, ChevronRight, ChevronDown, HelpCircle, FileUp,
} from 'lucide-react';
import { PageZoomOverlay } from '../shared/PageZoomOverlay';
import type { Exercise, LessonFolder, Worksheet } from '../../types';
import {
  bumpSentenceSize, createSentenceCompletion, moveSentenceItem, newSentenceId, parseSentenceCompletionText,
  setSentenceStyle, validateSentenceCompletion, SENTENCE_LAYOUTS,
  type SentenceCompletionData, type SentenceItem, type SentenceStyleKey,
} from '../../services/sentence-completion/sentenceCompletionCore';
import { parseWordLines } from '../../services/gap-filling/gapFillingCore';
import { SentenceCompletionRenderer } from './SentenceCompletionRenderer';
import { SentenceCompletionToolbar, type SentenceMoreKey } from './SentenceCompletionToolbar';
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
const smallBtn = 'px-2.5 h-7 rounded-lg border border-blue-200 bg-white text-[11px] font-semibold text-blue-700 hover:bg-blue-50 flex items-center gap-1';

const SectionHead: React.FC<{ n: number; title: string; right?: React.ReactNode; help?: string; open?: boolean; onToggle?: () => void }> = ({ n, title, right, help, open, onToggle }) => (
  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-blue-50/70 border border-blue-100 min-w-0">
    <span className="w-5 h-5 rounded-md bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">{n}</span>
    <h3 className="text-[13px] font-bold text-slate-900 truncate">{title}</h3>
    {help && <span className="text-blue-400 cursor-help shrink-0" title={help}><HelpCircle size={13} /></span>}
    {right && <div className="ml-auto flex items-center gap-1.5 shrink-0">{right}</div>}
    {onToggle && (
      <button type="button" onClick={onToggle} aria-expanded={open} title={open ? 'Thu nhỏ' : 'Mở rộng'} className={`p-1 text-slate-500 hover:text-slate-800 rounded-md hover:bg-blue-100/60 shrink-0 ${right ? '' : 'ml-auto'}`}>
        <ChevronDown size={16} className={`transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
      </button>
    )}
  </div>
);

const Switch: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label?: string }> = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${checked ? 'bg-blue-600' : 'bg-slate-300'}`}
  >
    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
  </button>
);

type ModalMode = 'smart' | 'sentences' | 'words';
const MODAL_INFO: Record<ModalMode, { title: string; hint: string; placeholder: string }> = {
  smart: {
    title: 'Smart Paste – dán cả bài',
    hint: 'Dán tiêu đề (viết hoa), dòng khung từ (nếu có) rồi các câu 1., 2., … Hệ thống tự chọn layout: có khung từ → Khung từ; gợi ý (…) ở cuối câu → Từ trong ngoặc; gợi ý (…) ở đầu câu → Viết lại; còn lại → Hai cột gọn.',
    placeholder: 'COMPLETE THE SENTENCES. USE ENOUGH WITH THESE WORDS\nbig   eat   loud   milk   old   practise   space   time   tired\n\n1. \'Is there ______ in your coffee?\'\n2. Can you hear the radio? Is it ______ for you?',
  },
  sentences: {
    title: 'Import – các câu',
    hint: 'Mỗi dòng một câu (số 1., 2. đầu dòng sẽ được bỏ). Gợi ý đặt trong ngoặc ở cuối: We haven’t got ______ a new car. (money/buy)',
    placeholder: 'We haven’t got ______ a new car. (money/buy)\nThis knife isn’t ______ tomatoes. (sharp/cut)',
  },
  words: {
    title: 'Import – khung từ',
    hint: 'Mỗi dòng một từ / cụm từ, hoặc cả danh sách trên một dòng (cách nhau bằng dấu phẩy, “/” hoặc 2 dấu cách).',
    placeholder: 'big\neat\nloud\nmilk',
  },
};

export const SentenceCompletionEditor: React.FC<Props> = ({ folder, editingExercise, onSaveExercise, onCancel, onDeleteExercise }) => {
  const [data, setDataRaw] = useState<SentenceCompletionData>(() =>
    editingExercise?.sentenceCompletion
      ? createSentenceCompletion(editingExercise.sentenceCompletion)
      : createSentenceCompletion({ ...(editingExercise?.title ? { exerciseTitle: editingExercise.title } : {}) }),
  );
  const exerciseIdRef = useRef(editingExercise?.id || `ex_sentence_completion_${Date.now()}`);
  const savedIdx = folder.exercises.findIndex((e) => e.id === exerciseIdRef.current);
  const exerciseNumber = savedIdx >= 0 ? savedIdx + 1 : folder.exercises.length + 1;
  const brand = resolveBranding(folder.printSettings.branding);

  // ── Undo / Redo (gộp các thay đổi liên tiếp trong 500ms)
  const dataRef = useRef(data);
  const pastRef = useRef<SentenceCompletionData[]>([]);
  const futureRef = useRef<SentenceCompletionData[]>([]);
  const lastPushRef = useRef(0);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const setData = (next: React.SetStateAction<SentenceCompletionData>) => {
    const prev = dataRef.current;
    const val = typeof next === 'function' ? (next as (p: SentenceCompletionData) => SentenceCompletionData)(prev) : next;
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
  const jump = (from: SentenceCompletionData[], to: SentenceCompletionData[]) => {
    const target = from.pop();
    if (!target) return;
    to.push(dataRef.current);
    dataRef.current = target;
    lastPushRef.current = 0;
    setDataRaw(target);
  };
  const handleUndo = () => jump(pastRef.current, futureRef.current);
  const handleRedo = () => jump(futureRef.current, pastRef.current);
  const canUndo = pastRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  const update = (patch: Partial<SentenceCompletionData>) => setData((p) => ({ ...p, ...patch }));
  const updateSettings = (patch: Partial<SentenceCompletionData['settings']>) => setData((p) => ({ ...p, settings: { ...p.settings, ...patch } }));

  // ── Giao diện: header, hai cột kéo được, xem trước vừa khung
  const slot = useAppHeaderSlot();
  const { mainRef, leftPct, isDragging, handlers: splitHandlers } = useSplitPane('sentence-completion-editor-left-pct');
  const [activeTab, setActiveTab] = useState<'preview' | 'edit_mode'>('edit_mode');
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pageFull, setPageFull] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [selKey, setSelKey] = useState<SentenceStyleKey>('title');
  const leftColRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (leftColRef.current) (leftColRef.current as HTMLDivElement & { inert: boolean }).inert = activeTab === 'preview';
  }, [activeTab]);

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

  // ── Thu nhỏ / mở rộng các khu bên trái
  const [open, setOpen] = useState<Record<number, boolean>>({ 1: true, 2: true, 3: true, 4: true });
  const toggle = (n: number) => setOpen((o) => ({ ...o, [n]: !o[n] }));

  // ── Khung từ
  const addWord = () => update({ words: [...data.words, { id: newSentenceId(), text: '' }] });
  const editWord = (id: string, text: string) => update({ words: data.words.map((w) => (w.id === id ? { ...w, text } : w)) });
  const removeWord = (id: string) => update({ words: data.words.filter((w) => w.id !== id) });
  const moveWord = (from: number, to: number) => update({ words: moveSentenceItem(data.words, from, to) });
  const wordDrag = useRef<number | null>(null);

  // ── Câu
  const addSentence = () => update({ sentences: [...data.sentences, { id: newSentenceId(), text: '' }] });
  const patchSentence = (id: string, patch: Partial<SentenceItem>) => update({ sentences: data.sentences.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const removeSentence = (id: string) => update({ sentences: data.sentences.filter((s) => s.id !== id) });
  const duplicateSentence = (id: string) => {
    const i = data.sentences.findIndex((s) => s.id === id);
    if (i < 0) return;
    const list = [...data.sentences];
    list.splice(i + 1, 0, { ...list[i], id: newSentenceId(), example: undefined });
    update({ sentences: list });
  };
  const moveSentence = (from: number, to: number) => update({ sentences: moveSentenceItem(data.sentences, from, to) });
  const sentDrag = useRef<number | null>(null);

  // ── Smart Paste / Import
  const [modal, setModal] = useState<ModalMode | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [modalMsg, setModalMsg] = useState('');
  const openModal = (m: ModalMode) => { setModal(m); setPasteText(''); setModalMsg(''); };
  const hasContent = data.sentences.length > 0 || data.words.length > 0;
  const applyModal = () => {
    if (!modal) return;
    if (modal === 'words') {
      const list = parseWordLines(pasteText);
      if (list.length === 0) { setModalMsg('Chưa có từ nào để nhập.'); return; }
      if (data.words.length > 0 && !window.confirm('Thay toàn bộ khung từ hiện có?')) return;
      update({ words: list.map((text) => ({ id: newSentenceId(), text })) });
    } else if (modal === 'sentences') {
      const lines = pasteText.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim().replace(/^\d{1,3}\s*[.)]\s*/, '')).filter(Boolean);
      if (lines.length === 0) { setModalMsg('Chưa có câu nào để nhập.'); return; }
      if (data.sentences.length > 0 && !window.confirm('Thay toàn bộ các câu hiện có?')) return;
      const list: SentenceItem[] = lines.map((line) => {
        const m = /\s*\(([^()]{2,60})\)\s*$/.exec(line);
        return m && m.index > 0 ? { id: newSentenceId(), text: line.slice(0, m.index).trim(), hint: m[1].trim() } : { id: newSentenceId(), text: line };
      });
      update({ sentences: list });
    } else {
      const parsed = parseSentenceCompletionText(pasteText);
      if (!parsed.ok) { setModalMsg(parsed.warnings[0] || 'Không nhận ra câu nào.'); return; }
      if (hasContent && !window.confirm('Thay toàn bộ tiêu đề, khung từ và các câu hiện có bằng nội dung vừa dán? (Có thể Hoàn tác)')) return;
      setData((p) => ({
        ...p,
        exerciseTitle: parsed.title || p.exerciseTitle,
        targetWord: parsed.targetWord || p.targetWord,
        words: parsed.words.map((text) => ({ id: newSentenceId(), text })),
        sentences: parsed.sentences.map((s): SentenceItem => ({ id: newSentenceId(), text: s.text, ...(s.hint ? { hint: s.hint } : {}), ...(s.starter ? { starter: s.starter } : {}) })),
        settings: { ...p.settings, layout: parsed.layout, showWordBank: parsed.words.length > 0 },
      }));
    }
    setModal(null);
  };

  // ── Định dạng chữ theo thành phần
  const STYLE_DEFAULTS: Record<SentenceStyleKey, { bold: boolean; italic: boolean; size: number }> = {
    title: { bold: true, italic: false, size: data.settings.headingFontSizePt },
    instruction: { bold: false, italic: true, size: 10 },
    wordBank: { bold: true, italic: false, size: data.settings.fontSizePt },
    sentences: { bold: false, italic: false, size: data.settings.fontSizePt },
    hints: { bold: true, italic: true, size: data.settings.fontSizePt },
  };
  const curStyle = data.textStyles?.[selKey];
  const applyFlag = (flag: 'bold' | 'italic' | 'underline' | 'strike') => {
    const current = flag === 'bold' ? (curStyle?.bold ?? STYLE_DEFAULTS[selKey].bold) : flag === 'italic' ? (curStyle?.italic ?? STYLE_DEFAULTS[selKey].italic) : !!curStyle?.[flag];
    update({ textStyles: setSentenceStyle(data.textStyles, selKey, { [flag]: !current }) });
  };
  const clearStyle = () => {
    const next = { ...(data.textStyles || {}) };
    delete next[selKey];
    update({ textStyles: next });
  };

  // ── Lưu / xuất
  const buildExercise = (): Exercise => ({
    id: exerciseIdRef.current,
    type: 'sentence_completion',
    layoutType: 'template_a',
    title: data.exerciseTitle,
    instructions: '',
    pointsTotal: data.sentences.length,
    order: editingExercise?.order || folder.exercises.length + 1,
    imageSlots: [],
    questions: data.sentences.map((s, i) => ({ id: s.id, number: i + 1, text: s.text, points: 1 })),
    pageBreakBefore: data.settings.pageBreakBefore || undefined,
    sentenceCompletion: { ...data, exerciseNumber },
  });

  const handleSave = (next: 'return' | 'add_another' | 'stay' = 'return') => {
    const v = validateSentenceCompletion(data);
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
      title: onlyCurrent ? data.exerciseTitle || 'DAILY WORKSHEET' : folder.name || 'DAILY WORKSHEET',
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
  const renderMoreSection = (key: SentenceMoreKey): React.ReactNode => {
    const s = data.settings;
    const row = 'flex items-center justify-between gap-3 text-[11.5px] text-slate-700';
    if (key === 'typography') {
      return (
        <div className="space-y-2.5">
          <label className={row}>Cỡ chữ các câu
            <select value={s.fontSizePt} onChange={(e) => updateSettings({ fontSizePt: Number(e.target.value) })} className={`${fieldCls} !w-24 !py-1`}>
              {[9.5, 10, 10.5, 11, 12, 13].map((n) => <option key={n} value={n}>{n} pt</option>)}
            </select>
          </label>
          <label className={row}>Cỡ chữ tiêu đề
            <select value={s.headingFontSizePt} onChange={(e) => updateSettings({ headingFontSizePt: Number(e.target.value) })} className={`${fieldCls} !w-24 !py-1`}>
              {[11, 12, 12.5, 13, 14, 16].map((n) => <option key={n} value={n}>{n} pt</option>)}
            </select>
          </label>
          <label className={row}>Độ dài chỗ trống
            <span className="flex items-center gap-2"><input type="range" min={16} max={50} step={2} value={s.blankWidthMm} onChange={(e) => updateSettings({ blankWidthMm: Number(e.target.value) })} className="accent-blue-600" /><span className="font-mono w-12 text-right">{s.blankWidthMm} mm</span></span>
          </label>
        </div>
      );
    }
    return (
      <div className="space-y-2 text-[11.5px] text-slate-700">
        {([['showExerciseTitle', 'Hiện tiêu đề bài'], ['showWordBank', 'Hiện khung từ'], ['showExample', 'Hiện câu ví dụ'], ['showQrCode', 'Hiện mã QR audio'], ['pageBreakBefore', 'Ngắt trang trước bài này']] as const).map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={s[k]} onChange={(e) => updateSettings({ [k]: e.target.checked } as Partial<SentenceCompletionData['settings']>)} className="rounded text-blue-600 focus:ring-0" />
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
        <SentenceCompletionRenderer
          data={{ ...data, exerciseNumber }}
          exerciseIndex={exerciseNumber}
          editable={editable ? {
            onTitle: (v) => update({ exerciseTitle: v }),
            onWord: (id, v) => editWord(id, v),
            onSentence: (id, v) => patchSentence(id, { text: v }),
            onHint: (id, v) => patchSentence(id, { hint: v.replace(/^\(|\)$/g, '') }),
            onStarter: (id, v) => patchSentence(id, { starter: v || undefined }),
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
  const locked = activeTab === 'preview';
  const layoutMeta = SENTENCE_LAYOUTS.find((l) => l.id === data.settings.layout);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-100 select-text">
      {slot && createPortal(
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-4 mr-3">
            <button type="button" onClick={onCancel} className="flex items-center gap-2 text-[13px] font-semibold text-slate-800 px-3.5 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
              <ArrowLeft size={16} /> Back to Lesson
            </button>
            <div className="leading-tight">
              <div className="text-[17px] font-bold text-[#16295f]">Edit Worksheet</div>
              <div className="text-[11.5px] text-slate-500">
                {folder.name || 'Unit 2 - London'} <span className="text-slate-300 mx-0.5">|</span> Worksheet: {folder.printSettings?.branding?.worksheetNo || 'WS-Grammar-7-1-1'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
              <Check size={13} strokeWidth={2.5} /> {saveStatus === 'saving' ? 'Saving...' : 'Saved a few seconds ago'}
            </div>
            <div className="relative">
              <button type="button" onClick={() => setShowExportMenu((v) => !v)} className="w-9 h-9 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center justify-center" title="Tùy chọn xuất file">
                <MoreHorizontal size={16} />
              </button>
              {showExportMenu && (
                <div className="absolute right-0 top-full mt-1.5 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 z-50">
                  <button type="button" onClick={() => { exportWorksheetToDocx(buildWorksheet(true), 'student'); setShowExportMenu(false); }} className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"><FileDown size={14} className="text-blue-600" /> Xuất Word (.docx)</button>
                  <div className="h-px bg-slate-100 my-1" />
                  <button type="button" onClick={() => { setShowExportMenu(false); window.print(); }} className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"><Printer size={14} /> In / Xuất PDF (Chuẩn A4)</button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={handleUndo} disabled={!canUndo} title="Hoàn tác" className="w-9 h-9 flex items-center justify-center text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg disabled:opacity-35 disabled:cursor-not-allowed"><RotateCcw size={16} /></button>
              <button type="button" onClick={handleRedo} disabled={!canRedo} title="Làm lại" className="w-9 h-9 flex items-center justify-center text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg disabled:opacity-35 disabled:cursor-not-allowed"><RotateCw size={16} /></button>
            </div>
            <button type="button" onClick={() => setIsFullscreen(true)} className="px-5 h-9 text-[13px] font-semibold text-[#16295f] bg-white border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center gap-2"><Eye size={16} /> Preview</button>
            <button type="button" onClick={() => handleSave('return')} className="px-7 h-9 text-[13px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2 shadow-sm transition-all"><Save size={16} /> Save</button>
          </div>
        </div>,
        slot,
      )}

      <SentenceCompletionToolbar
        data={data}
        selKey={selKey}
        onSelKey={setSelKey}
        curStyle={curStyle}
        defaults={STYLE_DEFAULTS[selKey]}
        onFlag={applyFlag}
        onSizeDelta={(d) => update({ textStyles: bumpSentenceSize(data.textStyles, selKey, STYLE_DEFAULTS[selKey].size, d) })}
        onPatchStyle={(patch) => update({ textStyles: setSentenceStyle(data.textStyles, selKey, patch) })}
        onClearStyle={clearStyle}
        onSettings={updateSettings}
        onAddWord={addWord}
        onAddSentence={addSentence}
        onImportSentences={() => openModal('sentences')}
        onSmartPaste={() => openModal('smart')}
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
        {/* ═══ CỘT TRÁI: NỘI DUNG ═══ */}
        <div
          ref={leftColRef}
          className={`min-w-0 w-full xl:w-[var(--left-w)] xl:shrink-0 flex flex-col gap-3 xl:h-full xl:overflow-y-auto rounded-2xl border border-slate-200 bg-white/30 p-3 transition-opacity ${locked ? 'opacity-60 select-none' : ''}`}
          style={{ ['--left-w' as string]: `${leftPct}%` }}
        >
          <section className="shrink-0 bg-white/60 border border-slate-100 rounded-2xl p-4 shadow-xs space-y-3">
            <SectionHead n={1} title="Exercise Settings" help="Tiêu đề, từ trọng tâm và kiểu bài." right={<span className="px-2.5 py-0.5 rounded-full bg-white border border-blue-200 text-[11px] font-bold text-blue-700">Exercise {exerciseNumber}</span>} open={open[1]} onToggle={() => toggle(1)} />
            {open[1] && (<>
              <div className="grid grid-cols-[1fr_auto] gap-3 items-start">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Exercise Title</label>
                  <input value={data.exerciseTitle} onChange={(e) => update({ exerciseTitle: e.target.value })} className={`${fieldCls} font-semibold`} />
                </div>
                <div className="w-40">
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1" title="Từ hoặc cấu trúc ngữ pháp trọng tâm; tự in nghiêng đậm đỏ trong tiêu đề">Target Grammar / Word</label>
                  <input value={data.targetWord} onChange={(e) => update({ targetWord: e.target.value })} placeholder="enough, too, at/on/in…" className={fieldCls} />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Instruction <span className="font-normal text-slate-400">(optional, không in)</span></label>
                <input value={data.instruction} onChange={(e) => update({ instruction: e.target.value })} className={fieldCls} />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Exercise Type</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {SENTENCE_LAYOUTS.map((l) => {
                    const on = data.settings.layout === l.id;
                    return (
                      <button key={l.id} type="button" title={l.desc} onClick={() => updateSettings({ layout: l.id, ...(l.id === 'word_bank' ? { showWordBank: true } : {}) })} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[11.5px] font-semibold text-left ${on ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                        <span className={`w-3 h-3 rounded-full border shrink-0 ${on ? 'border-blue-600 bg-blue-600 ring-2 ring-white ring-inset' : 'border-slate-400'}`} />
                        {l.typeLabel}
                      </button>
                    );
                  })}
                </div>
                {layoutMeta && <p className="mt-1 text-[10.5px] text-slate-400">{layoutMeta.desc}</p>}
              </div>
              <div className="flex items-center justify-between gap-6 text-[11.5px] text-slate-700">
                <label className="flex items-center gap-2">Show Word Bank <Switch checked={data.settings.showWordBank} onChange={(v) => updateSettings({ showWordBank: v })} label="Show Word Bank" /></label>
                <label className="flex items-center gap-2">Show Example (optional) <Switch checked={data.settings.showExample} onChange={(v) => updateSettings({ showExample: v })} label="Show Example" /></label>
              </div>
            </>)}
          </section>

          {(data.settings.showWordBank || data.words.length > 0) && (
            <section className="shrink-0 bg-white/60 border border-slate-100 rounded-2xl p-4 shadow-xs space-y-2.5">
              <SectionHead n={2} title={`Word Bank (${data.words.length})`} right={<>
                <button type="button" onClick={addWord} className={smallBtn}><Plus size={12} /> Add Word</button>
                <button type="button" onClick={() => openModal('words')} className={smallBtn}><FileUp size={12} /> Import</button>
                <button type="button" onClick={() => openModal('smart')} className={smallBtn}>Smart Paste</button>
              </>} open={open[2]} onToggle={() => toggle(2)} />
              {open[2] && (<>
                {data.words.length === 0 && <p className="text-xs text-slate-400 py-2 text-center">Chưa có từ nào. Bấm Add Word, Import hoặc Smart Paste.</p>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5">
                  {data.words.map((w, i) => (
                    <div
                      key={w.id}
                      className="group flex items-center gap-1.5"
                      onDragOver={(e) => { if (wordDrag.current !== null) e.preventDefault(); }}
                      onDrop={(e) => { if (wordDrag.current === null) return; e.preventDefault(); moveWord(wordDrag.current, i); wordDrag.current = null; }}
                    >
                      <span draggable onDragStart={(e) => { wordDrag.current = i; e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => { wordDrag.current = null; }} className="text-slate-300 hover:text-slate-600 cursor-grab shrink-0" title="Kéo để đổi vị trí"><GripVertical size={14} /></span>
                      <span className="min-w-5 h-7 px-1 rounded-md bg-slate-100 text-[11px] font-bold text-slate-600 flex items-center justify-center shrink-0">{i + 1}</span>
                      <input value={w.text} onChange={(e) => editWord(w.id, e.target.value)} placeholder="Word…" className={`${fieldCls} flex-1 min-w-0`} />
                      <button type="button" className={`${iconBtn} hover:!text-rose-600`} title="Xóa" onClick={() => removeWord(w.id)}><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              </>)}
            </section>
          )}

          <section className="shrink-0 bg-white/60 border border-slate-100 rounded-2xl p-4 shadow-xs space-y-2.5">
            <SectionHead n={3} title={`Sentences (${data.sentences.length})`} right={<>
              <button type="button" onClick={addSentence} className={smallBtn}><Plus size={12} /> Add Sentence</button>
              <button type="button" onClick={() => openModal('sentences')} className={smallBtn}><FileUp size={12} /> Import</button>
              <button type="button" onClick={() => openModal('smart')} className={smallBtn}>Smart Paste</button>
            </>} open={open[3]} onToggle={() => toggle(3)} />
            {open[3] && (<>
              <p className="text-[10.5px] text-slate-400">Chỗ trống viết <code className="px-1 rounded bg-slate-100">______</code>.{data.settings.layout === 'brackets' ? ' Gợi ý hiện bên phải: (money/buy).' : data.settings.layout === 'transform' ? ' Gợi ý hiện bên trái, ô câu là phần đầu câu trả lời: It’s ______.' : data.settings.layout === 'error_correction' ? ' Nhập câu có lỗi sai, không cần chỗ trống; bên phải tự có đường kẻ để học sinh viết câu đã sửa.' : ''}</p>
              {data.sentences.length === 0 && <p className="text-xs text-slate-400 py-2 text-center">Chưa có câu nào. Bấm Add Sentence, Import hoặc Smart Paste.</p>}
              <div className="space-y-2">
                {data.sentences.map((s, i) => (
                  <div
                    key={s.id}
                    className="group flex items-start gap-1.5"
                    onDragOver={(e) => { if (sentDrag.current !== null) e.preventDefault(); }}
                    onDrop={(e) => { if (sentDrag.current === null) return; e.preventDefault(); moveSentence(sentDrag.current, i); sentDrag.current = null; }}
                  >
                    <span draggable onDragStart={(e) => { sentDrag.current = i; e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => { sentDrag.current = null; }} className="pt-2 text-slate-300 hover:text-slate-600 cursor-grab shrink-0" title="Kéo để đổi vị trí"><GripVertical size={14} /></span>
                    <span className="min-w-6 h-7 mt-0.5 px-1.5 rounded-md bg-slate-100 text-[11px] font-bold text-slate-600 flex items-center justify-center shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0 space-y-1">
                      <input value={s.text} onChange={(e) => patchSentence(s.id, { text: e.target.value })} placeholder="Câu có chỗ trống ______" className={fieldCls} />
                      {(data.settings.layout === 'brackets' || data.settings.layout === 'transform' || s.hint) && (
                        <input value={s.hint || ''} onChange={(e) => patchSentence(s.id, { hint: e.target.value })} placeholder={data.settings.layout === 'transform' ? "Gợi ý bên trái: I'm not going out / cold" : 'Gợi ý trong ngoặc: money/buy'} className={`${fieldCls} !py-1.5 italic`} />
                      )}
                      {data.settings.layout === 'rewrite' && (
                        <input value={s.starter || ''} onChange={(e) => patchSentence(s.id, { starter: e.target.value || undefined })} placeholder="Phần mở đầu cho sẵn: I prefer (để trống nếu chỉ cần đường kẻ)" className={`${fieldCls} !py-1.5 italic`} />
                      )}
                      {data.settings.showExample && (
                        <input value={s.example || ''} onChange={(e) => patchSentence(s.id, { example: e.target.value || undefined })} placeholder="Đáp án mẫu (chỉ dùng cho câu ví dụ – để trống nếu không phải ví dụ)" className={`${fieldCls} !py-1.5 !border-red-200 text-red-700`} />
                      )}
                    </div>
                    <span className="flex items-center shrink-0 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-opacity">
                      <button type="button" className={iconBtn} title="Nhân bản" onClick={() => duplicateSentence(s.id)}><Copy size={13} /></button>
                      <button type="button" className={`${iconBtn} hover:!text-rose-600`} title="Xóa" onClick={() => removeSentence(s.id)}><Trash2 size={13} /></button>
                    </span>
                  </div>
                ))}
              </div>
            </>)}
          </section>

          <section className="shrink-0 bg-white/60 border border-slate-100 rounded-2xl p-4 shadow-xs space-y-2.5">
            <SectionHead n={4} title="Audio & QR Code" help="Chỉ dùng khi bài có nghe: tải file hoặc dán đường dẫn công khai, mã QR tạo từ đường dẫn." open={open[4]} onToggle={() => toggle(4)} />
            {open[4] && (
              <AudioQrPanel audio={data.audio} showQr={data.settings.showQrCode} onAudioChange={(audio) => update({ audio })} onShowQrChange={(v) => updateSettings({ showQrCode: v })} />
            )}
          </section>
        </div>

        {/* ── Thanh kéo chia 2 cột ── */}
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

        {/* ═══ CỘT PHẢI: XEM TRƯỚC A4 ═══ */}
        <div className="flex-1 min-w-0 flex flex-col gap-3 xl:h-full rounded-2xl border border-slate-200 bg-white/30 p-3">
          <div className="bg-white/60 border border-slate-200 rounded-xl p-1.5 flex flex-wrap items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-1">
              {([['preview', 'Preview'], ['edit_mode', 'Edit Mode']] as const).map(([id, label]) => (
                <button key={id} type="button" onClick={() => setActiveTab(id)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${activeTab === id ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>{label}</button>
              ))}
              {locked && <span className="hidden 2xl:inline ml-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1">Chỉ xem – chọn Edit Mode để chỉnh sửa</span>}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-700 shrink-0 [&_button]:!w-7 [&_button]:!h-7">
              <div className={`${box} px-0.5`}>
                <button type="button" className={btn} title="Trang trước"><ChevronLeft size={15} /></button>
                <span className="px-2 whitespace-nowrap">Page 1 / 1</span>
                <button type="button" className={btn} title="Trang sau"><ChevronRight size={15} /></button>
              </div>
              <div className={`${box} px-0.5`}>
                <button type="button" onClick={() => setZoom((z) => Math.max(50, z - 10))} className={btn} title="Thu nhỏ"><Minus size={14} /></button>
                <span className="w-11 text-center">{zoom}%</span>
                <button type="button" onClick={() => setZoom((z) => Math.min(150, z + 10))} className={btn} title="Phóng to"><Plus size={14} /></button>
              </div>
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

      {/* ──────── SMART PASTE / IMPORT ──────── */}
      {modal && (
        <div className="fixed inset-0 z-[80] bg-slate-900/40 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 flex flex-col gap-3" style={{ width: 'min(36rem, 95vw)', minWidth: '20rem', maxWidth: '95vw', maxHeight: '92vh', resize: 'both', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">{MODAL_INFO[modal].title}</h3>
              <button type="button" onClick={() => setModal(null)} className="p-1 text-slate-400 hover:text-slate-700"><X size={16} /></button>
            </div>
            <p className="text-xs text-slate-500">{MODAL_INFO[modal].hint}</p>
            <textarea rows={10} style={{ flex: '1 1 auto', minHeight: '14rem', resize: 'none' }} value={pasteText} onChange={(e) => { setPasteText(e.target.value); setModalMsg(''); }} placeholder={MODAL_INFO[modal].placeholder} className={`${fieldCls} font-mono`} />
            {modalMsg && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">{modalMsg}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModal(null)} className="h-9 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Hủy</button>
              <button type="button" onClick={applyModal} disabled={!pasteText.trim()} className="h-9 px-4 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-lg">Áp dụng</button>
            </div>
          </div>
        </div>
      )}

      {/* ──────── PREVIEW TOÀN BỘ WORKSHEET ──────── */}
      {pageFull && <PageZoomOverlay worksheet={buildWorksheet(true)} onClose={() => setPageFull(false)} />}

      {isFullscreen && previewWorksheet && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 md:p-8" onClick={() => setIsFullscreen(false)}>
          <div className="bg-white rounded-3xl w-full max-w-5xl h-[92vh] flex flex-col shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="h-14 px-6 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-slate-900">Preview toàn bộ worksheet</span>
                <span className="text-xs text-slate-500">{previewWorksheet.exercises.length} bài · A4</span>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => window.print()} className="px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl flex items-center gap-1.5"><Printer size={13} /> In / Xuất PDF</button>
                <button type="button" onClick={() => setIsFullscreen(false)} className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100"><X size={18} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-slate-200/70 p-8 flex justify-center">
              <WorksheetRenderer worksheet={previewWorksheet} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
