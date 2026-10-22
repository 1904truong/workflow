import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, Check, Copy, Eye, FileDown, GripVertical, Maximize2, Minimize, Minus, Plus, Printer, X, MoreHorizontal,
  RotateCcw, RotateCw, Save, Trash2, ChevronLeft, ChevronRight, ChevronUp, ArrowUp, ArrowDown, HelpCircle,
} from 'lucide-react';
import type { Exercise, LessonFolder, Worksheet } from '../../types';
import {
  moveMcq, newMcqId, newQuestion, optionLabel,
  shuffleOptionsOf, MCQ_LAYOUTS,
  type McqQuestion,
} from '../../services/grammar-mcq/grammarMcqCore';
import { bumpReadingSize as bumpMcqSize, createReadingMcq, parseReadingFull, setReadingStyle as setMcqStyle, splitParagraphs, validateReadingMcq, type ReadingMcqData, type ReadingStyleKey as McqStyleKey } from '../../services/reading-mcq/readingMcqCore';
import { useAiImage } from '../../services/ai/useAiImage';
import { ImageManagerBody } from '../shared/ImageManagerBody';
import { PHOTO_STYLE } from '../../services/matching/autoMatching';
import { fileToSmallDataUrl } from '../../types/branding';
import { ReadingMcqRenderer } from './ReadingMcqRenderer';
import { ReadingMcqToolbar, type McqMoreKey } from './ReadingMcqToolbar';
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
  /** Dạng Reading Short Answer: không có lựa chọn, mỗi câu một dòng kẻ trả lời */
  shortAnswer?: boolean;
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

const SectionHead: React.FC<{ n: number; title: string; right?: React.ReactNode; help?: string; collapsed?: boolean; onToggle?: () => void }> = ({ n, title, right, help, collapsed, onToggle }) => (
  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-blue-50/70 border border-blue-100 min-w-0">
    <span className="w-5 h-5 rounded-md bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">{n}</span>
    <h3 className="text-[13px] font-bold text-slate-900 truncate">{title}</h3>
    {help && <span className="text-blue-400 cursor-help shrink-0" title={help}><HelpCircle size={13} /></span>}
    <div className="ml-auto flex items-center gap-1.5 shrink-0">
      {right}
      {onToggle && (
        <button type="button" onClick={onToggle} title={collapsed ? 'Mở rộng' : 'Thu nhỏ'} className="w-6 h-6 rounded-md flex items-center justify-center text-slate-500 hover:bg-white hover:text-slate-900">
          <ChevronUp size={15} className={`transition-transform ${collapsed ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  </div>
);

type ModalMode = 'smart' | 'import' | 'passage';
const MODAL_INFO: Record<ModalMode, { title: string; hint: string; placeholder: string }> = {
  smart: {
    title: 'Smart Paste – dán cả đề',
    hint: 'Dán cả bài đọc lẫn câu hỏi. Phần trước câu "1." là bài đọc (tiêu đề, tác giả, các đoạn), từ câu "1." trở đi là câu hỏi A, B, C – tự tách thành hai khu vực.',
    placeholder: 'READ THE TEXT AND CHOOSE THE CORRECT ANSWER\nGOBY, THE AMAZING BEACH FISH\nby Tim Barnet, student\n\nAs part of a recent school project…\n\n1. The first paragraph says that\nA. plastic is more useful now than it was in the past.\nB. there is too much plastic everywhere.\nC. plastic is now killing some people.',
  },
  passage: {
    title: 'Smart Paste – dán cả đề',
    hint: 'Dán cả bài đọc lẫn câu hỏi. Phần trước câu "1." là bài đọc (tiêu đề, tác giả, các đoạn), từ câu "1." trở đi là câu hỏi A, B, C – tự tách thành hai khu vực.',
    placeholder: 'GOBY, THE AMAZING BEACH FISH\nby Tim Barnet, student\n\nAs part of a recent school project, I read many articles…\n\nIf you walk on a beach you can see that this is true…',
  },
  import: {
    title: 'Import – danh sách câu',
    hint: 'Mỗi dòng một câu (số thứ tự đầu dòng sẽ được bỏ). Lựa chọn sẽ nhập sau ở mục Option Editor.',
    placeholder: 'When I got home I found that water ________ down the kitchen walls.\nAfter he ________ his English course, he went to England.',
  },
};

export const ReadingMcqEditor: React.FC<Props> = ({ folder, editingExercise, onSaveExercise, onCancel, onDeleteExercise, shortAnswer: saProp }) => {
  const sa = !!saProp || editingExercise?.readingMcq?.shortAnswer === true || editingExercise?.type === 'reading_short_answer';
  const [data, setDataRaw] = useState<ReadingMcqData>(() =>
    editingExercise?.readingMcq
      ? createReadingMcq(editingExercise?.readingMcq)
      : createReadingMcq({
          ...(sa ? { shortAnswer: true, exerciseTitle: 'READ THE PASSAGE THEN ANSWER THE QUESTIONS', instruction: 'Read the passage then answer the questions.', settings: { showPassageImage: false, questionGapMm: 4.5 } as never } : {}),
          ...(editingExercise?.title ? { exerciseTitle: editingExercise.title } : {}),
          ...(editingExercise?.instructions ? { instruction: editingExercise.instructions } : {}),
          ...(editingExercise?.passage ? { passage: editingExercise.passage } : {}),
          // Bài cũ chưa có dữ liệu riêng: lấy câu hỏi và lựa chọn đã có
          ...(editingExercise?.questions?.length
            ? {
                questions: editingExercise.questions.map((q) => ({
                  id: q.id || newMcqId('q'),
                  text: q.text || '',
                  options: sa ? [] : (q.options || []).map((o) => ({ id: o.id || newMcqId('o'), text: o.text || '' })),
                })),
              }
            : {}),
        }),
  );
  const exerciseIdRef = useRef(editingExercise?.id || `ex_reading_mcq_${Date.now()}`);
  const savedIdx = folder.exercises.findIndex((e) => e.id === exerciseIdRef.current);
  const exerciseNumber = savedIdx >= 0 ? savedIdx + 1 : folder.exercises.length + 1;
  const brand = resolveBranding(folder.printSettings.branding);

  // ── Undo / Redo
  const dataRef = useRef(data);
  const pastRef = useRef<ReadingMcqData[]>([]);
  const futureRef = useRef<ReadingMcqData[]>([]);
  const lastPushRef = useRef(0);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const setData = (next: React.SetStateAction<ReadingMcqData>) => {
    const prev = dataRef.current;
    const val = typeof next === 'function' ? (next as (p: ReadingMcqData) => ReadingMcqData)(prev) : next;
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
  const jump = (from: ReadingMcqData[], to: ReadingMcqData[]) => {
    const target = from.pop();
    if (!target) return;
    to.push(dataRef.current);
    dataRef.current = target;
    lastPushRef.current = 0;
    setDataRaw(target);
  };
  const canUndo = pastRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;
  const update = (patch: Partial<ReadingMcqData>) => setData((p) => ({ ...p, ...patch }));
  const updateSettings = (patch: Partial<ReadingMcqData['settings']>) => setData((p) => ({ ...p, settings: { ...p.settings, ...patch } }));

  const [col, setCol] = useState<Record<number, boolean>>({});
  const toggleCol = (k: number) => setCol((c) => ({ ...c, [k]: !c[k] }));

  // ── Giao diện
  const slot = useAppHeaderSlot();
  const { mainRef, leftPct, isDragging, handlers: splitHandlers } = useSplitPane('reading-mcq-editor-left-pct');
  const [activeTab, setActiveTab] = useState<'preview' | 'edit_mode'>('edit_mode');
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Phóng to riêng trang đang soạn (không phải cả worksheet)
  const [pageFull, setPageFull] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [selKey, setSelKey] = useState<McqStyleKey>('title');
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
  const [selectedQid, setSelectedQid] = useState<string | null>(null);
  const selectedQ: McqQuestion | undefined = data.questions.find((q) => q.id === selectedQid) || data.questions[0];
  const patchQuestion = (id: string, fn: (q: McqQuestion) => McqQuestion) => update({ questions: data.questions.map((q) => (q.id === id ? fn(q) : q)) });
  const addQuestion = () => {
    const q = newQuestion();
    update({ questions: [...data.questions, q] });
    setSelectedQid(q.id);
  };
  const removeQuestion = (id: string) => update({ questions: data.questions.filter((q) => q.id !== id) });
  const duplicateQuestion = (id: string) => {
    const i = data.questions.findIndex((q) => q.id === id);
    if (i < 0) return;
    const src = data.questions[i];
    const copy: McqQuestion = { ...src, id: newMcqId('q'), options: src.options.map((o) => ({ ...o, id: newMcqId('o') })) };
    const list = [...data.questions];
    list.splice(i + 1, 0, copy);
    update({ questions: list });
    setSelectedQid(copy.id);
  };
  const moveQuestion = (from: number, to: number) => update({ questions: moveMcq(data.questions, from, to) });
  const dragRef = useRef<number | null>(null);
  const editQuestionText = (id: string, text: string) => patchQuestion(id, (q) => ({ ...q, text }));
  // ── Bài đọc và ảnh bài báo
  const editParagraph = (index: number, text: string) => {
    const paras = splitParagraphs(dataRef.current.passage);
    if (text.trim()) paras[index] = text; else paras.splice(index, 1);
    update({ passage: paras.join('\n\n') });
  };
  const [aiPrompt, setAiPrompt] = useState('');
  const defaultAiPrompt = () => {
    const d = dataRef.current;
    const first = splitParagraphs(d.passage)[0] || '';
    return `Realistic documentary photo to illustrate a reading article titled "${d.passageTitle || d.exerciseTitle}". ${first.slice(0, 220)}`.trim();
  };
  const { gen, generate: generateArticleImage } = useAiImage({
    getPrompt: () => aiPrompt.trim() || defaultAiPrompt(),
    style: PHOTO_STYLE,
    aspectRatio: '4:3',
    onPrompt: (p) => setAiPrompt(p),
    onImage: (url, p) => {
      setAiPrompt(p);
      update({ imageUrl: url, settings: { ...dataRef.current.settings, showPassageImage: true } });
    },
  });
  const uploadArticleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try { update({ imageUrl: await fileToSmallDataUrl(file, 900, 'image/jpeg') }); } catch { window.alert('Không đọc được file ảnh.'); }
  };
  // Khối Image Manager dùng chung: khung 0 = ảnh chính, khung 1.. = ảnh phụ (extraImages, '' = khung còn trống)
  const handleImageSlot = async (idx: number, file: File) => {
    try {
      const url = await fileToSmallDataUrl(file, 900, 'image/jpeg');
      if (idx === 0) { update({ imageUrl: url }); return; }
      const extra = [...(dataRef.current.extraImages || [])];
      extra[idx - 1] = url;
      update({ extraImages: extra });
    } catch { window.alert('Không đọc được file ảnh.'); }
  };
  const removeImageSlot = (idx: number) => {
    if (idx === 0) update({ imageUrl: undefined });
    else update({ extraImages: (data.extraImages || []).map((x, k) => (k === idx - 1 ? '' : x)) });
  };
  const setImageCount = (n: number) => {
    const extra = [...(data.extraImages || [])].slice(0, n - 1);
    while (extra.length < n - 1) extra.push('');
    update({ extraImages: extra });
  };

  const editOptionText = (qid: string, oid: string, text: string) => patchQuestion(qid, (q) => ({ ...q, options: q.options.map((o) => (o.id === oid ? { ...o, text } : o)) }));
  const addOption = () => selectedQ && patchQuestion(selectedQ.id, (q) => ({ ...q, options: [...q.options, { id: newMcqId('o'), text: '' }] }));
  const removeOption = (qid: string, oid: string) => patchQuestion(qid, (q) => ({ ...q, options: q.options.filter((o) => o.id !== oid) }));

  // ── Smart Paste / Import
  const [modal, setModal] = useState<ModalMode | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [modalMsg, setModalMsg] = useState('');
  const openModal = (m: ModalMode) => { setModal(m); setPasteText(''); setModalMsg(''); };
  const applyModal = () => {
    if (!modal) return;
    if (modal === 'passage' || modal === 'smart') {
      const r = parseReadingFull(pasteText);
      if (!r.passage && r.questions.length === 0) { setModalMsg('Không nhận ra bài đọc hay câu hỏi nào. Câu hỏi cần bắt đầu bằng "1.".'); return; }
      if (r.questions.length > 0 && data.questions.length > 0 && !window.confirm('Thay toàn bộ câu hỏi hiện có bằng nội dung vừa dán? (Có thể Hoàn tác)')) return;
      const questions: McqQuestion[] = r.questions.map((pq) => {
        const opts = pq.options.map((t) => ({ id: newMcqId('o'), text: t }));
        while (!sa && opts.length < 3) opts.push({ id: newMcqId('o'), text: '' });
        return { ...newQuestion(pq.text), options: opts };
      });
      update({
        ...(r.passage ? { passage: r.passage } : {}),
        ...(r.passageTitle ? { passageTitle: r.passageTitle } : {}),
        ...(r.author ? { passageAuthor: r.author } : {}),
        ...(r.exerciseTitle ? { exerciseTitle: r.exerciseTitle } : {}),
        ...(questions.length ? { questions } : {}),
      });
      if (questions.length) setSelectedQid(questions[0].id);
    } else {
      const lines = pasteText.replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/^\s*(?:\d{1,3}\s*[.)]|[•*-])\s*/, '').trim()).filter(Boolean);
      if (lines.length === 0) { setModalMsg('Chưa có dòng nào để nhập.'); return; }
      update({ questions: [...data.questions, ...lines.map((t) => newQuestion(t))] });
    }
    setModal(null);
  };

  // ── Định dạng chữ theo thành phần
  const STYLE_DEFAULTS: Record<McqStyleKey, { bold: boolean; italic: boolean; size: number }> = {
    title: { bold: true, italic: false, size: data.settings.headingFontSizePt },
    passageTitle: { bold: true, italic: false, size: data.settings.fontSizePt },
    passageAuthor: { bold: true, italic: true, size: data.settings.fontSizePt },
    passage: { bold: false, italic: false, size: data.settings.fontSizePt },
    instruction: { bold: false, italic: true, size: 10 },
    questions: { bold: false, italic: false, size: data.settings.fontSizePt },
    options: { bold: false, italic: false, size: data.settings.fontSizePt },
  };
  const curStyle = data.textStyles?.[selKey];
  const applyFlag = (flag: 'bold' | 'italic' | 'underline' | 'strike') => {
    const current = flag === 'bold' ? (curStyle?.bold ?? STYLE_DEFAULTS[selKey].bold) : flag === 'italic' ? (curStyle?.italic ?? STYLE_DEFAULTS[selKey].italic) : !!curStyle?.[flag];
    update({ textStyles: setMcqStyle(data.textStyles, selKey, { [flag]: !current }) });
  };
  const clearStyle = () => {
    const next = { ...(data.textStyles || {}) };
    delete next[selKey];
    update({ textStyles: next });
  };

  // ── Lưu / xuất
  const buildExercise = (): Exercise => ({
    id: exerciseIdRef.current,
    type: sa ? 'reading_short_answer' : 'reading_multiple_choice',
    layoutType: 'template_a',
    title: data.exerciseTitle,
    instructions: data.instruction,
    pointsTotal: data.questions.length,
    order: editingExercise?.order || folder.exercises.length + 1,
    imageSlots: [],
    questions: data.questions.map((q, i) => ({
      id: q.id,
      number: i + 1,
      text: q.text,
      options: q.options.map((o, oi) => ({ id: o.id, label: optionLabel(oi, 'uppercase'), text: o.text })),
      points: 1,
    })),
    pageBreakBefore: data.settings.pageBreakBefore || undefined,
    passage: data.passage,
    readingMcq: { ...data, exerciseNumber },
  });

  const handleSave = (next: 'return' | 'add_another' | 'stay' = 'return') => {
    const v = validateReadingMcq(data);
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
  const pageWorksheet = useMemo(() => (pageFull ? buildWorksheet(true) : null), [pageFull, data]); // eslint-disable-line react-hooks/exhaustive-deps
  const previewWorksheet = useMemo(() => (isFullscreen ? buildWorksheet() : null), [isFullscreen, data]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cài đặt chi tiết trong menu More
  const renderMoreSection = (key: McqMoreKey): React.ReactNode => {
    const s = data.settings;
    const row = 'flex items-center justify-between gap-3 text-[11.5px] text-slate-700';
    if (key === 'typography') {
      return (
        <div className="space-y-2.5">
          <label className={row}>Cỡ chữ nội dung
            <select value={s.fontSizePt} onChange={(e) => updateSettings({ fontSizePt: Number(e.target.value) })} className={`${fieldCls} !w-24 !py-1`}>
              {[9.5, 10, 10.5, 11, 12, 13].map((n) => <option key={n} value={n}>{n} pt</option>)}
            </select>
          </label>
          <label className={row}>Cỡ chữ tiêu đề
            <select value={s.headingFontSizePt} onChange={(e) => updateSettings({ headingFontSizePt: Number(e.target.value) })} className={`${fieldCls} !w-24 !py-1`}>
              {[11, 12, 12.5, 13, 14, 16].map((n) => <option key={n} value={n}>{n} pt</option>)}
            </select>
          </label>
        </div>
      );
    }
    return (
      <div className="space-y-2 text-[11.5px] text-slate-700">
        {([['showExerciseTitle', 'Hiện tiêu đề bài'], ['showInstruction', 'Hiện hướng dẫn'], ['pageBreakBefore', 'Ngắt trang trước bài này']] as const).map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={s[k]} onChange={(e) => updateSettings({ [k]: e.target.checked } as Partial<ReadingMcqData['settings']>)} className="rounded text-blue-600 focus:ring-0" />
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
        <ReadingMcqRenderer
          data={{ ...data, exerciseNumber }}
          exerciseIndex={exerciseNumber}
          editable={editable ? {
            onTitle: (v) => update({ exerciseTitle: v }),
            onPassageTitle: (v) => update({ passageTitle: v }),
            onPassageAuthor: (v) => update({ passageAuthor: v }),
            onParagraph: editParagraph,
            onPickImage: (ev) => { void uploadArticleImage(ev); },
            onInstruction: (v) => update({ instruction: v }),
            onQuestion: editQuestionText,
            onOption: editOptionText,
            selectedKey: selKey,
            onSelectKey: setSelKey,
            selectedQuestionId: selectedQ?.id ?? null,
            onSelectQuestion: setSelectedQid,
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
              <div className="text-[11.5px] text-slate-500">{folder.name || 'Unit 2 - London'} <span className="text-slate-300 mx-0.5">|</span> Worksheet: {folder.printSettings?.branding?.worksheetNo || 'WS-Grammar-1-1-1'}</div>
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

      <ReadingMcqToolbar
        data={data}
        selKey={selKey}
        onSelKey={setSelKey}
        curStyle={curStyle}
        defaults={STYLE_DEFAULTS[selKey]}
        onFlag={applyFlag}
        onSizeDelta={(d) => update({ textStyles: bumpMcqSize(data.textStyles, selKey, STYLE_DEFAULTS[selKey].size, d) })}
        onPatchStyle={(patch) => update({ textStyles: setMcqStyle(data.textStyles, selKey, patch) })}
        onClearStyle={clearStyle}
        onSettings={updateSettings}
        hasSelectedQuestion={!!selectedQ}
        onAddQuestion={addQuestion}
        onAddOption={addOption}
        onImport={() => openModal('import')}
        onSmartPaste={() => openModal('smart')}
        onShuffleOptions={() => selectedQ && patchQuestion(selectedQ.id, (q) => shuffleOptionsOf(q))}
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
          <section className={`shrink-0 bg-white/60 border border-slate-100 rounded-2xl p-4 shadow-xs space-y-3${col[1] ? ' [&>*:not(:first-child)]:hidden' : ''}`}>
            <SectionHead n={1} collapsed={!!col[1]} onToggle={() => toggleCol(1)} title="Exercise Content" help="Tiêu đề và hướng dẫn in trên phiếu." right={<span className="px-2.5 py-0.5 rounded-full bg-white border border-blue-200 text-[11px] font-bold text-blue-700">Exercise {exerciseNumber}</span>} />
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Exercise Title</label>
              <AutoTextarea value={data.exerciseTitle} onChange={(e) => update({ exerciseTitle: e.target.value })} className={`${fieldCls} resize-none min-h-[34px] font-semibold`} />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Instruction <span className="font-normal text-slate-400">(optional)</span></label>
              <AutoTextarea value={data.instruction} onChange={(e) => update({ instruction: e.target.value })} placeholder="e.g. Read the sentences and choose the best answer." className={`${fieldCls} resize-none min-h-[34px]`} />
            </div>
          </section>

          <section className={`shrink-0 bg-white/60 border border-slate-100 rounded-2xl p-4 shadow-xs space-y-2.5${col[2] ? ' [&>*:not(:first-child)]:hidden' : ''}`}>
            <SectionHead n={2} collapsed={!!col[2]} onToggle={() => toggleCol(2)} title="Reading Passage" help="Mỗi đoạn cách nhau một dòng trống. Ảnh bài báo nằm góc phải, chữ chạy quanh." right={
              <button type="button" onClick={() => openModal('passage')} className={smallBtn}>Smart Paste</button>
            } />
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Passage Title</label>
              <AutoTextarea value={data.passageTitle} onChange={(e) => update({ passageTitle: e.target.value })} placeholder="GOBY, THE AMAZING BEACH FISH" className={`${fieldCls} resize-none min-h-[34px] font-semibold`} />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Author <span className="font-normal text-slate-400">(optional)</span></label>
              <AutoTextarea value={data.passageAuthor} onChange={(e) => update({ passageAuthor: e.target.value })} placeholder="by Tim Barnet, student" className={`${fieldCls} resize-none min-h-[34px]`} />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Text <span className="font-normal text-slate-400">(chỉ bài đọc, câu hỏi nhập ở mục 4)</span></label>
              <textarea rows={9} value={data.passage} onChange={(e) => update({ passage: e.target.value })} placeholder="Dán hoặc gõ bài đọc. Cách một dòng trống giữa các đoạn." className={`${fieldCls} leading-relaxed`} />
            </div>
          </section>

          <section className={`shrink-0 bg-white/60 border border-slate-100 rounded-2xl p-4 shadow-xs space-y-2.5${col[3] ? ' [&>*:not(:first-child)]:hidden' : ''}`}>
            <SectionHead n={3} collapsed={!!col[3]} onToggle={() => toggleCol(3)} title="Image Manager" help="Ảnh bài báo nằm góc phải trên bài đọc. Tải từ máy hoặc nhờ AI tạo tự động." />
            <ImageManagerBody
              slots={Array.from({ length: 1 + (data.extraImages || []).length }, (_, k) => ({ url: k === 0 ? data.imageUrl : (data.extraImages || [])[k - 1] || undefined }))}
              maxImages={4}
              previewRatio={4 / 3}
              onCountChange={setImageCount}
              onFile={(idx, f) => { void handleImageSlot(idx, f); }}
              onRemove={removeImageSlot}
              onGenerate={() => { void generateArticleImage(); }}
              generating={gen.busy}
              prompt={aiPrompt}
              onPromptChange={setAiPrompt}
              defaultPrompt={defaultAiPrompt}
              message={gen.msg}
            />
            <label className="flex items-center gap-1.5 text-[11px] text-slate-600">Rộng
              <input type="range" min={40} max={90} value={data.settings.imageWidthMm} onChange={(e) => updateSettings({ imageWidthMm: Number(e.target.value) })} />
              <span className="w-9 text-right">{data.settings.imageWidthMm}mm</span>
            </label>
            {data.shortAnswer && (
              <label className="flex items-center gap-1.5 text-[11px] text-slate-600">Dòng kẻ trả lời
                <input type="range" min={0} max={90} step={2} value={data.settings.answerLineWidthMm ?? 68} onChange={(ev) => updateSettings({ answerLineWidthMm: Number(ev.target.value) })} />
                <span className="w-9 text-right">{data.settings.answerLineWidthMm === 0 ? 'ẩn' : `${data.settings.answerLineWidthMm ?? 68}mm`}</span>
              </label>
            )}
          </section>

          <section className={`shrink-0 bg-white/60 border border-slate-100 rounded-2xl p-4 shadow-xs space-y-2.5${col[4] ? ' [&>*:not(:first-child)]:hidden' : ''}`}>
            <SectionHead n={4} collapsed={!!col[4]} onToggle={() => toggleCol(4)} title={`Question Editor (${data.questions.length})`} right={<>
              <button type="button" onClick={addQuestion} className="px-2.5 h-7 rounded-lg bg-blue-600 text-white text-[11px] font-bold hover:bg-blue-700 flex items-center gap-1"><Plus size={12} /> Add Question</button>
              <button type="button" onClick={() => openModal('import')} className={smallBtn}>Import</button>
              <button type="button" onClick={() => openModal('smart')} className={smallBtn}>Smart Paste</button>
            </>} />
            {data.questions.length === 0 && <p className="text-xs text-slate-400 py-2 text-center">Chưa có câu nào. Bấm Add Question, Import hoặc Smart Paste.</p>}
            <div className="space-y-1.5">
              {data.questions.map((q, i) => (
                <div
                  key={q.id}
                  className={`group flex flex-wrap items-start gap-1.5 rounded-xl p-1 ${selectedQ?.id === q.id ? 'bg-blue-50/70 ring-1 ring-blue-200' : ''}`}
                  onClick={() => setSelectedQid(q.id)}
                  onDragOver={(e) => { if (dragRef.current !== null) e.preventDefault(); }}
                  onDrop={(e) => { if (dragRef.current === null) return; e.preventDefault(); moveQuestion(dragRef.current, i); dragRef.current = null; }}
                >
                  <span draggable onDragStart={(e) => { dragRef.current = i; e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => { dragRef.current = null; }} className="pt-2 text-slate-300 hover:text-slate-600 cursor-grab active:cursor-grabbing shrink-0" title="Kéo để đổi vị trí"><GripVertical size={14} /></span>
                  <span className="min-w-6 h-7 mt-0.5 px-1.5 rounded-md bg-slate-100 text-[11px] font-bold text-slate-600 flex items-center justify-center shrink-0">{i + 1}</span>
                  <AutoTextarea value={q.text} onFocus={() => setSelectedQid(q.id)} onChange={(e) => editQuestionText(q.id, e.target.value)} placeholder="Question… (dùng ________ cho chỗ trống)" className={`${fieldCls} block flex-1 min-w-0 resize-none min-h-[34px]`} />
                  <span className="flex items-center shrink-0 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-opacity">
                    <button type="button" className={iconBtn} title="Lên" disabled={i === 0} onClick={() => moveQuestion(i, i - 1)}><ArrowUp size={13} /></button>
                    <button type="button" className={iconBtn} title="Xuống" disabled={i === data.questions.length - 1} onClick={() => moveQuestion(i, i + 1)}><ArrowDown size={13} /></button>
                    <button type="button" className={iconBtn} title="Nhân bản" onClick={() => duplicateQuestion(q.id)}><Copy size={13} /></button>
                    <button type="button" className={`${iconBtn} hover:!text-rose-600`} title="Xóa" onClick={() => removeQuestion(q.id)}><Trash2 size={13} /></button>
                  </span>
                  {!sa && <div className="basis-full pl-9 pr-1 pb-1 space-y-1">
                    {q.options.map((o, oi) => (
                      <div key={o.id} className="group/opt flex items-center gap-1.5">
                        <span className="w-5 text-[11.5px] font-bold text-slate-500 text-center shrink-0">{optionLabel(oi, data.settings.optionLabelStyle)}</span>
                        <input value={o.text} onFocus={() => setSelectedQid(q.id)} onChange={(e) => editOptionText(q.id, o.id, e.target.value)} placeholder="Option…" className={`${fieldCls} flex-1 min-w-0 !py-1.5`} />
                        <button type="button" onClick={() => removeOption(q.id, o.id)} className={`${iconBtn} !p-1 hover:!text-rose-600 opacity-0 group-hover/opt:opacity-100 focus:opacity-100`} title="Xóa lựa chọn"><Trash2 size={12} /></button>
                      </div>
                    ))}
                    <button type="button" onClick={() => patchQuestion(q.id, (qq) => ({ ...qq, options: [...qq.options, { id: newMcqId('o'), text: '' }] }))} className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 pl-6">+ Add option</button>
                  </div>}
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
        <div className="fixed inset-0 z-[80] bg-slate-900/40 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 flex flex-col gap-3" style={{ width: 'min(36rem, 95vw)', minWidth: '20rem', maxWidth: '95vw', maxHeight: '92vh', resize: 'both', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-slate-900">{MODAL_INFO[modal].title}</h3><button type="button" onClick={() => setModal(null)} className="p-1 text-slate-400 hover:text-slate-700"><X size={16} /></button></div>
            <p className="text-xs text-slate-500">{MODAL_INFO[modal].hint}</p>
            <textarea rows={11} style={{ flex: '1 1 auto', minHeight: '14rem', resize: 'none' }} value={pasteText} onChange={(e) => { setPasteText(e.target.value); setModalMsg(''); }} placeholder={MODAL_INFO[modal].placeholder} className={`${fieldCls} font-mono`} />
            {modalMsg && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">{modalMsg}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModal(null)} className="h-9 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Hủy</button>
              <button type="button" onClick={applyModal} disabled={!pasteText.trim()} className="h-9 px-4 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-lg">Áp dụng</button>
            </div>
          </div>
        </div>
      )}

      {pageFull && pageWorksheet && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 md:p-8" onClick={() => setPageFull(false)}>
          <div className="bg-white rounded-3xl w-full max-w-6xl h-[94vh] flex flex-col shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="h-12 px-5 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
              <span className="text-sm font-bold text-slate-900">Trang đang soạn · A4</span>
              <button type="button" onClick={() => setPageFull(false)} title="Thu nhỏ về 100%" className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"><Minimize size={16} /></button>
            </div>
            <div className="flex-1 overflow-auto bg-slate-200/70 p-6 flex justify-center"><div style={{ zoom: 1.25 }}><WorksheetRenderer worksheet={pageWorksheet} /></div></div>
          </div>
        </div>
      )}

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

// Danh sách layout để các nơi khác (nếu cần) dùng lại
export const GRAMMAR_MCQ_LAYOUTS = MCQ_LAYOUTS;
