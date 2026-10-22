import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, Check, Copy, Eye, FileDown, GripVertical, Maximize2, Minimize, Minus, Plus, Printer, X, MoreHorizontal,
  RotateCcw, RotateCw, Save, Trash2, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, HelpCircle,
} from 'lucide-react';
import { PageZoomOverlay } from '../shared/PageZoomOverlay';
import type { Exercise, LessonFolder, Worksheet } from '../../types';
import {
  bumpMcqSize, moveMcq, newMcqId, newQuestion, optionLabel, parseMcqText, setMcqStyle,
  shuffleOptionsOf, MCQ_LAYOUTS,
  type McqQuestion, type McqStyleKey,
} from '../../services/grammar-mcq/grammarMcqCore';
import { createListeningMcq, validateListeningMcq, type ListeningMcqData } from '../../services/listening-mcq/listeningMcqCore';
import { AudioQrPanel } from '../shared/AudioQrPanel';
import { generateImageViaExtension } from '../../services/ai/extensionBridge';
import { probeExtension } from '../../services/ai/useAiImage';
import { buildFinalPrompt } from '../../services/ai/imagePlanCompare';
import { PHOTO_STYLE, friendlyExtensionError } from '../../services/matching/autoMatching';
import { fileToSmallDataUrl } from '../../types/branding';
import { ListeningMcqRenderer } from './ListeningMcqRenderer';
import { ListeningMcqToolbar, type McqMoreKey } from './ListeningMcqToolbar';
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

type ModalMode = 'smart' | 'import';
const MODAL_INFO: Record<ModalMode, { title: string; hint: string; placeholder: string }> = {
  smart: {
    title: 'Smart Paste – dán cả đề',
    hint: 'Dán tiêu đề và các câu đánh số 1., 2., … kèm lựa chọn a. b. c. d. (cùng một dòng hoặc mỗi lựa chọn một dòng). Chỗ trống viết bằng ________.',
    placeholder: 'CHOOSE THE CORRECT ANSWER.\n\n1. When I got home I found that water ________ down the kitchen walls.\na. ran  b. was running  c. has run  d. had been running\n2. After he ________ his English course, he went to England.\na. has finish\nb. had finished\nc. was finished\nd. would finish',
  },
  import: {
    title: 'Import – danh sách câu',
    hint: 'Mỗi dòng một câu (số thứ tự đầu dòng sẽ được bỏ). Lựa chọn sẽ nhập sau ở mục Option Editor.',
    placeholder: 'When I got home I found that water ________ down the kitchen walls.\nAfter he ________ his English course, he went to England.',
  },
};

export const ListeningMcqEditor: React.FC<Props> = ({ folder, editingExercise, onSaveExercise, onCancel, onDeleteExercise }) => {
  const [data, setDataRaw] = useState<ListeningMcqData>(() =>
    editingExercise?.listeningMcq
      ? createListeningMcq(editingExercise?.listeningMcq)
      : createListeningMcq({
          ...(editingExercise?.title ? { exerciseTitle: editingExercise.title } : {}),
          ...(editingExercise?.instructions ? { instruction: editingExercise.instructions } : {}),
          // Bài cũ chưa có dữ liệu riêng: lấy câu hỏi và lựa chọn đã có
          ...(editingExercise?.questions?.length
            ? {
                questions: editingExercise.questions.map((q) => ({
                  id: q.id || newMcqId('q'),
                  text: q.text || '',
                  options: (q.options || []).map((o) => ({ id: o.id || newMcqId('o'), text: o.text || '' })),
                })),
              }
            : {}),
        }),
  );
  const exerciseIdRef = useRef(editingExercise?.id || `ex_listening_mcq_${Date.now()}`);
  const savedIdx = folder.exercises.findIndex((e) => e.id === exerciseIdRef.current);
  const exerciseNumber = savedIdx >= 0 ? savedIdx + 1 : folder.exercises.length + 1;
  const brand = resolveBranding(folder.printSettings.branding);

  // ── Undo / Redo
  const dataRef = useRef(data);
  const pastRef = useRef<ListeningMcqData[]>([]);
  const futureRef = useRef<ListeningMcqData[]>([]);
  const lastPushRef = useRef(0);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const setData = (next: React.SetStateAction<ListeningMcqData>) => {
    const prev = dataRef.current;
    const val = typeof next === 'function' ? (next as (p: ListeningMcqData) => ListeningMcqData)(prev) : next;
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
  const jump = (from: ListeningMcqData[], to: ListeningMcqData[]) => {
    const target = from.pop();
    if (!target) return;
    to.push(dataRef.current);
    dataRef.current = target;
    lastPushRef.current = 0;
    setDataRaw(target);
  };
  const canUndo = pastRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;
  const update = (patch: Partial<ListeningMcqData>) => setData((p) => ({ ...p, ...patch }));
  const updateSettings = (patch: Partial<ListeningMcqData['settings']>) => setData((p) => {
    const next = { ...p, settings: { ...p.settings, ...patch } };
    if (patch.layout === 'pictures' && p.settings.layout !== 'pictures') {
      next.questions = p.questions.map((q) => (q.options.length === 4 && !q.options[3].text.trim() && !q.options[3].imageUrl ? { ...q, options: q.options.slice(0, 3) } : q));
    }
    return next;
  });

  // ── Giao diện
  const slot = useAppHeaderSlot();
  const { mainRef, leftPct, isDragging, handlers: splitHandlers } = useSplitPane('listening-mcq-editor-left-pct');
  const [activeTab, setActiveTab] = useState<'preview' | 'edit_mode'>('edit_mode');
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
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
  // ── Ảnh cho lựa chọn (layout Pictures A / B / C)
  const patchOption = (qid: string, oid: string, patch: { text?: string; imageUrl?: string | undefined }) =>
    patchQuestion(qid, (q) => ({ ...q, options: q.options.map((o) => (o.id === oid ? { ...o, ...patch } : o)) }));
  const [optGen, setOptGen] = useState<{ oid: string | null; msg: string }>({ oid: null, msg: '' });
  const uploadOptionImage = async (qid: string, oid: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try { patchOption(qid, oid, { imageUrl: await fileToSmallDataUrl(file, 700, 'image/jpeg') }); } catch { window.alert('Không đọc được file ảnh.'); }
  };
  const generateOptionImage = async (q: McqQuestion, o: { id: string; text: string }) => {
    const desc = o.text.trim();
    if (!desc) { setOptGen({ oid: null, msg: 'Nhập mô tả ảnh (ví dụ: bread and cheese) trước khi tạo ảnh.' }); return; }
    setOptGen({ oid: o.id, msg: 'Đang tạo ảnh…' });
    const probe = await probeExtension();
    if (!probe.ready) { setOptGen({ oid: null, msg: probe.note }); return; }
    try {
      const prompt = `Simple, clear photo for a listening exercise picture choice. Question: "${q.text}". Show: ${desc}.`;
      const res = await generateImageViaExtension({ prompt: buildFinalPrompt(prompt, PHOTO_STYLE), aspectRatio: '4:3' });
      patchOption(q.id, o.id, { imageUrl: res.imageUrl });
      setOptGen({ oid: null, msg: 'Đã tạo và gắn ảnh.' });
    } catch (err) {
      setOptGen({ oid: null, msg: friendlyExtensionError(err instanceof Error ? err.message : 'Không tạo được ảnh') });
    }
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
    if (modal === 'smart') {
      const parsed = parseMcqText(pasteText);
      if (!parsed.ok) { setModalMsg(parsed.warnings[0] || 'Không nhận ra câu nào dạng "1. …".'); return; }
      if (data.questions.length > 0 && !window.confirm('Thay toàn bộ câu hỏi hiện có bằng nội dung vừa dán? (Có thể Hoàn tác)')) return;
      const questions: McqQuestion[] = parsed.questions.map((pq) => {
        const base = newQuestion(pq.text);
        const opts = pq.options.length ? pq.options : [];
        const filled = opts.map((t) => ({ id: newMcqId('o'), text: t }));
        while (filled.length < 4) filled.push({ id: newMcqId('o'), text: '' });
        return { ...base, options: filled };
      });
      update({ questions, ...(parsed.title ? { exerciseTitle: parsed.title } : {}), ...(parsed.instruction ? { instruction: parsed.instruction, settings: { ...dataRef.current.settings, showInstruction: true } } : {}) });
      setSelectedQid(questions[0]?.id ?? null);
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
    type: 'listening_multiple_choice',
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
    listeningMcq: { ...data, exerciseNumber },
  });

  const handleSave = (next: 'return' | 'add_another' | 'stay' = 'return') => {
    const v = validateListeningMcq(data);
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
            <input type="checkbox" checked={s[k]} onChange={(e) => updateSettings({ [k]: e.target.checked } as Partial<ListeningMcqData['settings']>)} className="rounded text-blue-600 focus:ring-0" />
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
        <ListeningMcqRenderer
          data={{ ...data, exerciseNumber }}
          exerciseIndex={exerciseNumber}
          editable={editable ? {
            onTitle: (v) => update({ exerciseTitle: v }),
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

      <ListeningMcqToolbar
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
          <section className="shrink-0 bg-white/60 border border-slate-100 rounded-2xl p-4 shadow-xs space-y-3">
            <SectionHead n={1} title="Exercise Content" help="Tiêu đề và hướng dẫn in trên phiếu." right={<span className="px-2.5 py-0.5 rounded-full bg-white border border-blue-200 text-[11px] font-bold text-blue-700">Exercise {exerciseNumber}</span>} />
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Exercise Title</label>
              <AutoTextarea value={data.exerciseTitle} onChange={(e) => update({ exerciseTitle: e.target.value })} className={`${fieldCls} resize-none min-h-[34px] font-semibold`} />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Instruction <span className="font-normal text-slate-400">(optional)</span></label>
              <AutoTextarea value={data.instruction} onChange={(e) => update({ instruction: e.target.value })} placeholder="e.g. Read the sentences and choose the best answer." className={`${fieldCls} resize-none min-h-[34px]`} />
            </div>
          </section>

          <section className="shrink-0 bg-white/60 border border-slate-100 rounded-2xl p-4 shadow-xs space-y-2.5">
            <SectionHead n={2} title="Audio & QR Code" help="Tải file nghe hoặc dán đường dẫn công khai; mã QR tạo từ đường dẫn để học sinh quét và nghe." />
            <AudioQrPanel audio={data.audio} showQr={data.settings.showQrCode} onAudioChange={(audio) => update({ audio })} onShowQrChange={(v) => updateSettings({ showQrCode: v })} />
          </section>

          <section className="shrink-0 bg-white/60 border border-slate-100 rounded-2xl p-4 shadow-xs space-y-2.5">
            <SectionHead n={3} title={`Question List (${data.questions.length})`} right={<>
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
                  {data.settings.layout === 'pictures' && (
                    <div className="basis-full pl-8 pr-1 pb-1 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(1, Math.min(4, q.options.length + (q.options.length < 4 ? 1 : 0)))}, minmax(0, 1fr))` }}>
                      {q.options.map((o, oi) => (
                        <div key={o.id} className="min-w-0">
                          <div className="flex items-center gap-1 mb-1">
                            <span className="w-5 h-5 rounded bg-slate-100 text-[10.5px] font-bold text-slate-600 flex items-center justify-center shrink-0">{optionLabel(oi, 'uppercase')}</span>
                            <input value={o.text} onChange={(e) => editOptionText(q.id, o.id, e.target.value)} onFocus={() => setSelectedQid(q.id)} placeholder="Mô tả ảnh (không in)" className="flex-1 min-w-0 px-1.5 py-1 border border-slate-200 rounded-md text-[10.5px] focus:outline-none focus:ring-1 focus:ring-blue-400" />
                          </div>
                          <label className="block relative cursor-pointer group/slot" title="Bấm để tải / thay ảnh">
                            {o.imageUrl ? (
                              <img src={o.imageUrl} alt={o.text} className="w-full aspect-[4/3] object-cover rounded-lg border border-slate-200 bg-white" />
                            ) : (
                              <div className="w-full aspect-[4/3] rounded-lg border border-dashed border-slate-300 bg-slate-50 text-[11px] text-slate-400 flex items-center justify-center hover:border-blue-400 hover:text-blue-600">+ Ảnh</div>
                            )}
                            <input type="file" accept="image/*" hidden onChange={(ev) => { void uploadOptionImage(q.id, o.id, ev); }} />
                          </label>
                          <div className="flex items-center gap-1 mt-1">
                            <button type="button" disabled={optGen.oid === o.id} onClick={() => { void generateOptionImage(q, o); }} className="px-1.5 h-6 rounded-md bg-blue-600 text-white text-[10px] font-bold hover:bg-blue-700 disabled:opacity-40" title="Tạo ảnh bằng AI từ mô tả">{optGen.oid === o.id ? '…' : 'AI'}</button>
                            <button type="button" className={`${iconBtn} !p-1 hover:!text-rose-600`} title={o.imageUrl ? 'Xóa ảnh' : 'Xóa lựa chọn này'} onClick={() => (o.imageUrl ? patchOption(q.id, o.id, { imageUrl: undefined }) : removeOption(q.id, o.id))}><Trash2 size={12} /></button>
                          </div>
                        </div>
                      ))}
                      {q.options.length < 4 && (
                        <button type="button" onClick={() => patchQuestion(q.id, (qq) => ({ ...qq, options: [...qq.options, { id: newMcqId('o'), text: '' }] }))} className="self-center aspect-[4/3] rounded-lg border border-dashed border-slate-300 text-[11px] font-semibold text-slate-400 hover:border-blue-400 hover:text-blue-600">+ Thêm</button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {data.settings.layout === 'pictures' && optGen.msg && <p className="text-[11.5px] rounded-md px-2 py-1 border text-amber-700 bg-amber-50 border-amber-100">{optGen.msg}</p>}
          </section>

          {selectedQ && data.settings.layout !== 'pictures' && (
            <section className="shrink-0 bg-white/60 border border-slate-100 rounded-2xl p-4 shadow-xs space-y-2.5">
              <SectionHead n={4} title={`Option Editor (Question ${data.questions.findIndex((q) => q.id === selectedQ.id) + 1})`} right={
                <button type="button" onClick={addOption} className={smallBtn}><Plus size={12} /> Add Option</button>
              } />
              <div className="space-y-2">
                {selectedQ.options.map((o, oi) => (
                  <div key={o.id} className="flex items-center gap-2">
                    <span className="w-6 text-[12px] font-bold text-slate-600 text-center shrink-0">{optionLabel(oi, data.settings.optionLabelStyle)}.</span>
                    {data.settings.layout === 'pictures' && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {o.imageUrl ? <img src={o.imageUrl} alt="" className="w-14 h-10 object-cover rounded-md border border-slate-200" /> : <div className="w-14 h-10 rounded-md border border-dashed border-slate-300 bg-slate-50 text-[10px] text-slate-400 flex items-center justify-center">Ảnh</div>}
                        <label className="px-1.5 h-7 rounded-md border border-blue-200 bg-white text-[10.5px] font-semibold text-blue-700 hover:bg-blue-50 flex items-center cursor-pointer" title="Tải ảnh từ máy">Tải<input type="file" accept="image/*" hidden onChange={(ev) => { void uploadOptionImage(selectedQ.id, o.id, ev); }} /></label>
                        <button type="button" disabled={optGen.oid === o.id} onClick={() => { void generateOptionImage(selectedQ, o); }} className="px-1.5 h-7 rounded-md bg-blue-600 text-white text-[10.5px] font-bold hover:bg-blue-700 disabled:opacity-40" title="Tạo ảnh bằng AI từ mô tả bên cạnh">AI</button>
                      </div>
                    )}
                    <input value={o.text} onChange={(e) => editOptionText(selectedQ.id, o.id, e.target.value)} placeholder={data.settings.layout === 'pictures' ? 'Mô tả ảnh (không in): bread and cheese…' : 'Option…'} className={`${fieldCls} flex-1 min-w-0`} />
                    <button type="button" onClick={() => removeOption(selectedQ.id, o.id)} className={`${iconBtn} hover:!text-rose-600`} title="Xóa lựa chọn"><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
              {optGen.msg && <p className="text-[11.5px] rounded-md px-2 py-1 border text-amber-700 bg-amber-50 border-amber-100">{optGen.msg}</p>}
            </section>
          )}
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

// Danh sách layout để các nơi khác (nếu cần) dùng lại
export const GRAMMAR_MCQ_LAYOUTS = MCQ_LAYOUTS;
