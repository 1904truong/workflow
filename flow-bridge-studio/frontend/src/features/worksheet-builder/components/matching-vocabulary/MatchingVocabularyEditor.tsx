import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AiRewriteBox } from '../shared/AiRewriteBox';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, Check, Copy, Eye, FileDown, GripVertical, Maximize2, Minimize, Minus, Plus, Printer, X,
  MoreHorizontal, RotateCcw, RotateCw, Save, Trash2, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, HelpCircle, Sparkles,
} from 'lucide-react';
import { PageZoomOverlay } from '../shared/PageZoomOverlay';
import type { Exercise, LessonFolder, Worksheet } from '../../types';
import { analyzeWorksheetWithAI } from '../../services/ai/aiAnalyzer';
import { askExtension } from '../../services/ai/extensionBridge';
import type { AiImagePlan } from '../../services/ai/imagePlanSchema';
import {
  autoParseVocabulary, decideVocabLayout, bumpVocabSize, createMatchingVocabulary, definitionLabel, moveVocabItem, newVocabId, parseVocabularyPairs,
  parseVocabularyText, setVocabStyle, shuffleItems, validateVocabulary,
  type MatchingVocabularyData, type VocabItem, type VocabStyleKey,
} from '../../services/matching-vocabulary/matchingVocabularyCore';
import { MatchingVocabularyRenderer } from './MatchingVocabularyRenderer';
import { MatchingVocabularyToolbar, type VocabMoreKey } from './MatchingVocabularyToolbar';
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

/** Ô nhập nhiều dòng tự cao vừa đủ nội dung */
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

const smallBtn = 'px-2.5 h-7 rounded-lg border border-blue-200 bg-white text-[11px] font-semibold text-blue-700 hover:bg-blue-50 flex items-center gap-1';

type ModalMode = 'ai' | 'smart' | 'pairs' | 'words' | 'definitions';
const MODAL_INFO: Record<ModalMode, { title: string; hint: string; placeholder: string }> = {
  ai: {
    title: 'Smart AI – tự phân tích bài',
    hint: 'Dán văn bản ở bất kỳ dạng nào: “1. từ … a. định nghĩa …” hoặc từng dòng “từ – định nghĩa”. Hệ thống tự nhận dạng, tách hai cột, rồi nhờ AI gợi ý để chọn layout phù hợp.',
    placeholder: 'MATCH EACH WORD WITH ITS DEFINITION\n\n1. Residents\n2. Crowded\n\na. the people who live in a particular place\nb. containing a lot of people or things',
  },
  smart: {
    title: 'Smart Paste – dán cả bài',
    hint: 'Dán văn bản có các từ đánh số 1., 2. … và các định nghĩa a., b. … Hệ thống tự tách vào hai cột.',
    placeholder: 'MATCH EACH WORD WITH ITS DEFINITION\n\n1. Residents\n2. Crowded\n\na. the people who rule a country or state\nb. containing a lot of people or things',
  },
  pairs: {
    title: 'Import – cặp “từ – định nghĩa”',
    hint: 'Mỗi dòng một cặp, phân tách bằng Tab, “ - ”, “:” hoặc “=”. Có thể xáo trộn định nghĩa để thứ tự a, b, c không trùng thứ tự từ.',
    placeholder: 'Residents - the people who live in a particular place\nCrowded - containing a lot of people or things\nNarrow - a small distance from side to side',
  },
  words: {
    title: 'Import – danh sách từ',
    hint: 'Mỗi dòng một từ (số thứ tự đầu dòng sẽ được bỏ).',
    placeholder: 'Residents\nCrowded\nNarrow',
  },
  definitions: {
    title: 'Import – danh sách định nghĩa',
    hint: 'Mỗi dòng một định nghĩa (chữ a., b. đầu dòng sẽ được bỏ).',
    placeholder: 'the people who live in a particular place\ncontaining a lot of people or things',
  },
};

const linesOf = (raw: string): string[] =>
  raw.replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/^\s*(?:\d{1,3}\s*[.)]|[a-zA-Z]\s*[.)]|[•*-])\s*/, '').trim()).filter(Boolean);

export const MatchingVocabularyEditor: React.FC<Props> = ({ folder, editingExercise, onSaveExercise, onCancel, onDeleteExercise }) => {
  const [data, setDataRaw] = useState<MatchingVocabularyData>(() =>
    editingExercise?.matchingVocabulary
      ? createMatchingVocabulary(editingExercise.matchingVocabulary)
      : createMatchingVocabulary({ exerciseTitle: editingExercise?.title || undefined, instruction: editingExercise?.instructions || undefined }),
  );
  const exerciseIdRef = useRef(editingExercise?.id || `ex_matching_vocabulary_${Date.now()}`);
  const savedIdx = folder.exercises.findIndex((e) => e.id === exerciseIdRef.current);
  const exerciseNumber = savedIdx >= 0 ? savedIdx + 1 : folder.exercises.length + 1;
  const brand = resolveBranding(folder.printSettings.branding);

  // ── Undo / Redo (gộp các thay đổi liên tiếp trong 500ms)
  const dataRef = useRef(data);
  const pastRef = useRef<MatchingVocabularyData[]>([]);
  const futureRef = useRef<MatchingVocabularyData[]>([]);
  const lastPushRef = useRef(0);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const setData = (next: React.SetStateAction<MatchingVocabularyData>) => {
    const prev = dataRef.current;
    const val = typeof next === 'function' ? (next as (p: MatchingVocabularyData) => MatchingVocabularyData)(prev) : next;
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
  const jump = (from: MatchingVocabularyData[], to: MatchingVocabularyData[]) => {
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

  const update = (patch: Partial<MatchingVocabularyData>) => setData((p) => ({ ...p, ...patch }));
  const updateSettings = (patch: Partial<MatchingVocabularyData['settings']>) => setData((p) => ({ ...p, settings: { ...p.settings, ...patch } }));

  // ── Giao diện: header, hai cột kéo được, xem trước vừa khung
  const slot = useAppHeaderSlot();
  const { mainRef, leftPct, isDragging, handlers: splitHandlers } = useSplitPane('matching-vocabulary-editor-left-pct');
  const [activeTab, setActiveTab] = useState<'preview' | 'edit_mode'>('edit_mode');
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pageFull, setPageFull] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [selKey, setSelKey] = useState<VocabStyleKey>('title');
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

  // ── Danh sách Word / Definition
  type ListKey = 'words' | 'definitions';
  const addItem = (key: ListKey) => update({ [key]: [...data[key], { id: newVocabId(key === 'words' ? 'w' : 'd'), text: '' }] } as Partial<MatchingVocabularyData>);
  const editItem = (key: ListKey, id: string, text: string) =>
    update({ [key]: data[key].map((it) => (it.id === id ? { ...it, text } : it)) } as Partial<MatchingVocabularyData>);
  const removeItem = (key: ListKey, id: string) => update({ [key]: data[key].filter((it) => it.id !== id) } as Partial<MatchingVocabularyData>);
  const duplicateItem = (key: ListKey, id: string) => {
    const i = data[key].findIndex((it) => it.id === id);
    if (i < 0) return;
    const list = [...data[key]];
    list.splice(i + 1, 0, { ...list[i], id: newVocabId(key === 'words' ? 'w' : 'd') });
    update({ [key]: list } as Partial<MatchingVocabularyData>);
  };
  const moveItem = (key: ListKey, from: number, to: number) => update({ [key]: moveVocabItem(data[key], from, to) } as Partial<MatchingVocabularyData>);
  const dragRef = useRef<{ key: ListKey; index: number } | null>(null);

  // ── Smart Paste / Import
  const [modal, setModal] = useState<ModalMode | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [shuffleOnImport, setShuffleOnImport] = useState(true);
  const [modalMsg, setModalMsg] = useState('');
  const openModal = (m: ModalMode) => { setModal(m); setPasteText(''); setModalMsg(''); };
  const hasContent = data.words.length > 0 || data.definitions.length > 0;
  // ── Smart AI: nhận dạng → tách hai cột → AI gợi ý → tự chọn layout
  type AutoState = { phase: 'idle' | 'analyzing' | 'done'; method: string; layoutReason: string; notes: string[] };
  const IDLE_AUTO: AutoState = { phase: 'idle', method: '', layoutReason: '', notes: [] };
  const [auto, setAuto] = useState<AutoState>(IDLE_AUTO);
  const runSmartAI = async (text: string) => {
    const parsed = autoParseVocabulary(text);
    if (!parsed.ok) { setModalMsg(parsed.warnings[0] || 'Không nhận ra từ và định nghĩa trong văn bản này.'); return false; }
    if (hasContent && !window.confirm('Thay toàn bộ từ và định nghĩa hiện có bằng nội dung vừa phân tích? (Có thể Hoàn tác)')) return false;
    const mk = (prefix: string, texts: string[]): VocabItem[] => texts.map((t) => ({ id: newVocabId(prefix), text: t }));
    update({ words: mk('w', parsed.words), definitions: mk('d', parsed.definitions), ...(parsed.title ? { exerciseTitle: parsed.title } : {}) });
    setModal(null);
    const method = parsed.method === 'numbered' ? 'Nhận dạng kiểu đánh số 1. / a.' : 'Nhận dạng từng dòng “từ – định nghĩa” (đã xáo trộn định nghĩa)';
    setAuto({ phase: 'analyzing', method, layoutReason: '', notes: parsed.warnings });
    let plan: AiImagePlan | null = null;
    const notes: string[] = [...parsed.warnings];
    try {
      await askExtension('GET_FLOW_STATUS', {}, 5000);
      const out = await Promise.race([analyzeWorksheetWithAI(text), new Promise<null>((r) => setTimeout(() => r(null), 60000))]);
      if (out && out.ok && out.plan) plan = out.plan;
      else notes.push(`AI chưa dùng được${out?.errorCode ? ` (${out.errorCode})` : ''}: layout được chọn theo nội dung bài.`);
    } catch {
      notes.push('Chưa kết nối extension Flow Bridge: layout được chọn theo nội dung bài. Bật extension rồi bấm F5 để dùng AI.');
    }
    const dec = decideVocabLayout(plan, dataRef.current.settings.layout);
    if (dec.layout !== dataRef.current.settings.layout) updateSettings({ layout: dec.layout });
    setAuto({ phase: 'done', method, layoutReason: dec.reason, notes });
    return true;
  };

  const applyModal = () => {
    if (!modal) return;
    if (modal === 'ai') { void runSmartAI(pasteText); return; }
    const mk = (prefix: string, texts: string[]): VocabItem[] => texts.map((text) => ({ id: newVocabId(prefix), text }));
    if (modal === 'words' || modal === 'definitions') {
      const list = linesOf(pasteText);
      if (list.length === 0) { setModalMsg('Chưa có dòng nào để nhập.'); return; }
      const key: ListKey = modal;
      if (data[key].length > 0 && !window.confirm(`Thay toàn bộ danh sách ${key === 'words' ? 'từ' : 'định nghĩa'} hiện có?`)) return;
      update({ [key]: mk(key === 'words' ? 'w' : 'd', list) } as Partial<MatchingVocabularyData>);
    } else {
      const parsed = modal === 'smart' ? parseVocabularyText(pasteText) : parseVocabularyPairs(pasteText, shuffleOnImport);
      if (!parsed.ok) { setModalMsg(parsed.warnings[0] || 'Không nhận ra nội dung. Kiểm tra lại định dạng.'); return; }
      if (hasContent && !window.confirm('Thay toàn bộ từ và định nghĩa hiện có bằng nội dung vừa dán? (Có thể Hoàn tác)')) return;
      update({
        words: mk('w', parsed.words),
        definitions: mk('d', parsed.definitions),
        ...(parsed.title ? { exerciseTitle: parsed.title } : {}),
      });
    }
    setModal(null);
  };

  // ── Định dạng chữ theo thành phần
  const STYLE_DEFAULTS: Record<VocabStyleKey, { bold: boolean; italic: boolean; size: number }> = {
    title: { bold: true, italic: false, size: data.settings.headingFontSizePt },
    instruction: { bold: false, italic: true, size: 10 },
    words: { bold: false, italic: false, size: data.settings.fontSizePt },
    definitions: { bold: false, italic: false, size: data.settings.fontSizePt },
  };
  const curStyle = data.textStyles?.[selKey];
  const isBold = curStyle?.bold ?? STYLE_DEFAULTS[selKey].bold;
  const isItalic = curStyle?.italic ?? STYLE_DEFAULTS[selKey].italic;
  const applyFlag = (flag: 'bold' | 'italic' | 'underline' | 'strike') => {
    const current = flag === 'bold' ? isBold : flag === 'italic' ? isItalic : !!curStyle?.[flag];
    update({ textStyles: setVocabStyle(data.textStyles, selKey, { [flag]: !current }) });
  };
  const clearStyle = () => {
    const next = { ...(data.textStyles || {}) };
    delete next[selKey];
    update({ textStyles: next });
  };

  // ── Lưu / xuất
  const buildExercise = (): Exercise => ({
    id: exerciseIdRef.current,
    type: 'matching_vocabulary',
    layoutType: 'template_a',
    title: data.exerciseTitle,
    instructions: data.instruction,
    pointsTotal: data.words.length,
    order: editingExercise?.order || folder.exercises.length + 1,
    imageSlots: [],
    questions: data.words.map((w, i) => ({ id: w.id, number: i + 1, text: w.text, points: 1 })),
    pageBreakBefore: data.settings.pageBreakBefore || undefined,
    matchingVocabulary: { ...data, exerciseNumber },
  });

  const handleSave = (next: 'return' | 'add_another' | 'stay' = 'return') => {
    const v = validateVocabulary(data);
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
  const renderMoreSection = (key: VocabMoreKey): React.ReactNode => {
    const s = data.settings;
    const row = 'flex items-center justify-between gap-3 text-[11.5px] text-slate-700';
    if (key === 'typography') {
      return (
        <div className="space-y-2.5">
          <label className={row}>Cỡ chữ nội dung
            <select value={s.fontSizePt} onChange={(e) => updateSettings({ fontSizePt: Number(e.target.value) })} className={`${fieldCls} !w-24 !py-1`}>
              {[10, 11, 12, 13, 14].map((n) => <option key={n} value={n}>{n} pt</option>)}
            </select>
          </label>
          <label className={row}>Cỡ chữ tiêu đề
            <select value={s.headingFontSizePt} onChange={(e) => updateSettings({ headingFontSizePt: Number(e.target.value) })} className={`${fieldCls} !w-24 !py-1`}>
              {[12, 13, 14, 16, 18].map((n) => <option key={n} value={n}>{n} pt</option>)}
            </select>
          </label>
          <label className={row}>Kích thước ô trả lời
            <span className="flex items-center gap-2"><input type="range" min={6} max={12} step={0.5} value={s.answerBoxSizeMm} onChange={(e) => updateSettings({ answerBoxSizeMm: Number(e.target.value) })} className="accent-blue-600" /><span className="font-mono w-12 text-right">{s.answerBoxSizeMm} mm</span></span>
          </label>
        </div>
      );
    }
    return (
      <div className="space-y-2 text-[11.5px] text-slate-700">
        {([['showExerciseTitle', 'Hiện tiêu đề bài'], ['showInstruction', 'Hiện hướng dẫn'], ['pageBreakBefore', 'Ngắt trang trước bài này']] as const).map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={s[k]} onChange={(e) => updateSettings({ [k]: e.target.checked } as Partial<MatchingVocabularyData['settings']>)} className="rounded text-blue-600 focus:ring-0" />
            {label}
          </label>
        ))}
      </div>
    );
  };

  // ── Hàng trong danh sách
  const renderRow = (key: ListKey, index: number) => {
    const list = data[key];
    const item = list[index];
    const label = key === 'words' ? String(index + 1) : `${definitionLabel(index)}.`;
    return (
      <div
        key={item.id}
        className="group flex items-start gap-1.5"
        onDragOver={(e) => { if (dragRef.current?.key === key) e.preventDefault(); }}
        onDrop={(e) => {
          const d = dragRef.current;
          if (!d || d.key !== key) return;
          e.preventDefault();
          moveItem(key, d.index, index);
          dragRef.current = null;
        }}
      >
        <span
          draggable
          onDragStart={(e) => { dragRef.current = { key, index }; e.dataTransfer.effectAllowed = 'move'; }}
          onDragEnd={() => { dragRef.current = null; }}
          className="pt-2 text-slate-300 hover:text-slate-600 cursor-grab active:cursor-grabbing shrink-0"
          title="Kéo để đổi vị trí"
        >
          <GripVertical size={14} />
        </span>
        <span className="min-w-6 h-7 mt-0.5 px-1.5 rounded-md bg-slate-100 text-[11px] font-bold text-slate-600 flex items-center justify-center shrink-0">{label}</span>
        <AutoTextarea
          value={item.text}
          onChange={(e) => editItem(key, item.id, e.target.value)}
          placeholder={key === 'words' ? 'Word…' : 'Definition…'}
          className={`${fieldCls} block flex-1 min-w-0 resize-none min-h-[34px]`}
        />
        <span className="flex items-center shrink-0 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-opacity">
          <button type="button" className={iconBtn} title="Lên" disabled={index === 0} onClick={() => moveItem(key, index, index - 1)}><ArrowUp size={13} /></button>
          <button type="button" className={iconBtn} title="Xuống" disabled={index === list.length - 1} onClick={() => moveItem(key, index, index + 1)}><ArrowDown size={13} /></button>
          <button type="button" className={iconBtn} title="Nhân bản" onClick={() => duplicateItem(key, item.id)}><Copy size={13} /></button>
          <button type="button" className={`${iconBtn} hover:!text-rose-600`} title="Xóa" onClick={() => removeItem(key, item.id)}><Trash2 size={13} /></button>
        </span>
      </div>
    );
  };

  const renderA4 = (scale: number, editable: boolean) => (
    <div className="bg-white text-[#111] shadow-xl mx-auto" style={{ width: '210mm', minHeight: '297mm', padding: '15mm', zoom: scale, display: 'flex', flexDirection: 'column' }}>
      {brand.enabled && <BrandHeader b={brand} />}
      <div className="mt-[4mm]">
        <MatchingVocabularyRenderer
          data={{ ...data, exerciseNumber }}
          exerciseIndex={exerciseNumber}
          editable={editable ? {
            onTitle: (v) => update({ exerciseTitle: v }),
            onInstruction: (v) => update({ instruction: v }),
            onWord: (id, v) => editItem('words', id, v),
            onDefinition: (id, v) => editItem('definitions', id, v),
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
                {folder.name || 'Unit 2 - London'} <span className="text-slate-300 mx-0.5">|</span> Worksheet: {folder.printSettings?.branding?.worksheetNo || 'WS-Vocab-2-1-1'}
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

      <MatchingVocabularyToolbar
        data={data}
        selKey={selKey}
        onSelKey={setSelKey}
        curStyle={curStyle}
        defaults={STYLE_DEFAULTS[selKey]}
        onFlag={applyFlag}
        onSizeDelta={(d) => update({ textStyles: bumpVocabSize(data.textStyles, selKey, STYLE_DEFAULTS[selKey].size, d) })}
        onPatchStyle={(patch) => update({ textStyles: setVocabStyle(data.textStyles, selKey, patch) })}
        onClearStyle={clearStyle}
        onSettings={updateSettings}
        onAddWord={() => addItem('words')}
        onAddDefinition={() => addItem('definitions')}
        onImport={() => openModal('pairs')}
        onSmartPaste={() => openModal('smart')}
        onSmartAI={() => openModal('ai')}
        onShuffleDefinitions={() => update({ definitions: shuffleItems(data.definitions) })}
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
          {auto.phase !== 'idle' && (
            <section className="shrink-0 bg-white border border-blue-200 rounded-2xl px-4 py-3 shadow-xs space-y-1.5" aria-live="polite">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-blue-600" />
                <h3 className="text-[13px] font-bold text-slate-900">{auto.phase === 'analyzing' ? 'Đang phân tích bài…' : 'Smart AI đã phân tích xong'}</h3>
                {auto.phase === 'done' && <button type="button" onClick={() => setAuto(IDLE_AUTO)} className="ml-auto p-1 text-slate-400 hover:text-slate-700 rounded-md" aria-label="Ẩn"><X size={13} /></button>}
              </div>
              {auto.method && <p className="text-[11.5px] text-slate-600">{auto.method}</p>}
              {auto.layoutReason && <p className="text-[11.5px] text-slate-600">Layout: {auto.layoutReason}</p>}
              {auto.notes.map((n, i) => <p key={i} className="text-[11.5px] text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1">{n}</p>)}
            </section>
          )}

          <section className="shrink-0 bg-white/60 border border-slate-100 rounded-2xl p-4 shadow-xs space-y-3">
            <SectionHead n={1} title="Exercise Content" help="Tiêu đề và hướng dẫn in trên phiếu." right={<><button type="button" onClick={() => openModal('ai')} className="px-2.5 h-7 rounded-lg bg-blue-600 text-white text-[11px] font-bold hover:bg-blue-700 flex items-center gap-1" title="Dán văn bản bất kỳ, tự tách hai cột và chọn layout"><Sparkles size={12} /> Smart AI</button><span className="px-2.5 py-0.5 rounded-full bg-white border border-blue-200 text-[11px] font-bold text-blue-700">Exercise {exerciseNumber}</span></>} />
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Exercise Title</label>
              <input value={data.exerciseTitle} onChange={(e) => update({ exerciseTitle: e.target.value })} className={`${fieldCls} font-semibold`} />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Instruction <span className="font-normal text-slate-400">(optional)</span></label>
              <AutoTextarea value={data.instruction} onChange={(e) => update({ instruction: e.target.value })} className={`${fieldCls} resize-none min-h-[34px]`} />
            </div>
          </section>

          <section className="shrink-0 bg-white/60 border border-slate-100 rounded-2xl p-4 shadow-xs space-y-2.5">
            <SectionHead n={2} title="Word List (Left Side)" right={<>
              <button type="button" onClick={() => addItem('words')} className={smallBtn}><Plus size={12} /> Add Word</button>
              <button type="button" onClick={() => openModal('words')} className={smallBtn}>Import</button>
              <button type="button" onClick={() => openModal('smart')} className={smallBtn}>Smart Paste</button>
            </>} />
            {data.words.length === 0 && <p className="text-xs text-slate-400 py-2 text-center">Chưa có từ nào. Bấm Add Word, Import hoặc Smart Paste.</p>}
            <div className="space-y-2">{data.words.map((_, i) => renderRow('words', i))}</div>
          </section>

          <section className="shrink-0 bg-white/60 border border-slate-100 rounded-2xl p-4 shadow-xs space-y-2.5">
            <SectionHead n={3} title="Definition List (Right Side)" right={<>
              <button type="button" onClick={() => addItem('definitions')} className={smallBtn}><Plus size={12} /> Add Definition</button>
              <button type="button" onClick={() => openModal('definitions')} className={smallBtn}>Import</button>
              <button type="button" onClick={() => openModal('smart')} className={smallBtn}>Smart Paste</button>
            </>} />
            {data.definitions.length === 0 && <p className="text-xs text-slate-400 py-2 text-center">Chưa có định nghĩa nào. Bấm Add Definition, Import hoặc Smart Paste.</p>}
            <div className="space-y-2">{data.definitions.map((_, i) => renderRow('definitions', i))}</div>
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
            <AiRewriteBox kind="Matching Vocabulary" hint={MODAL_INFO[modal].hint} example={MODAL_INFO[modal].placeholder} text={pasteText} onText={(v) => { setPasteText(v); setModalMsg(''); }} />
            {modal === 'pairs' && (
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input type="checkbox" checked={shuffleOnImport} onChange={(e) => setShuffleOnImport(e.target.checked)} className="rounded text-blue-600 focus:ring-0" />
                Xáo trộn định nghĩa (để thứ tự a, b, c không trùng thứ tự từ)
              </label>
            )}
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
