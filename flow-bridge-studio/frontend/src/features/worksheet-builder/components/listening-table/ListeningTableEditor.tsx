import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, Check, Copy, Eye, FileDown, GripVertical, Maximize2, Minimize, Minus, Plus, Printer, X, MoreHorizontal,
  RotateCcw, RotateCw, Save, Trash2, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, HelpCircle, Sparkles, ImagePlus,
} from 'lucide-react';
import { PageZoomOverlay } from '../shared/PageZoomOverlay';
import type { Exercise, LessonFolder, Worksheet } from '../../types';
import {
  bumpTableSize, buildTableImagePrompt, createListeningTable, deleteColumn, deleteRow, imagePromptFromPlan, insertColumn, insertRow,
  moveListItem, newTableId, parseTableText, setCell, setHeader, setTableStyle, validateListeningTable, MAP_STYLE,
  type ListeningTableData, type TableStyleKey,
} from '../../services/listening-table/listeningTableCore';
import { ListeningTableRenderer } from './ListeningTableRenderer';
import { ListeningTableToolbar, type TableMoreKey } from './ListeningTableToolbar';
import { AudioQrPanel } from '../shared/AudioQrPanel';
import { WorksheetRenderer } from '../preview/WorksheetRenderer';
import { BrandHeader } from '../preview/BrandHeader';
import { BrandFooter } from '../preview/BrandFooter';
import { resolveBranding, fileToSmallDataUrl } from '../../types/branding';
import { exportWorksheetToDocx } from '../../services/docxExportService';
import { useAppHeaderSlot } from '../shared/hooks/useAppHeaderSlot';
import { useSplitPane } from '../shared/hooks/useSplitPane';
import { analyzeWorksheetWithAI } from '../../services/ai/aiAnalyzer';
import { askExtension, generateImageViaExtension } from '../../services/ai/extensionBridge';
import { buildFinalPrompt } from '../../services/ai/imagePlanCompare';
import type { AiImagePlan } from '../../services/ai/imagePlanSchema';
import { friendlyExtensionError } from '../../services/matching/autoMatching';

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

type ModalMode = 'ai' | 'smart';
const MODAL_INFO: Record<ModalMode, { title: string; hint: string }> = {
  ai: { title: 'Smart AI – tự phân tích bài', hint: 'Dán toàn bộ đề: tiêu đề, bảng (các ô phân tách bằng Tab hoặc dấu |, dòng đầu là tiêu đề cột), rồi các câu hỏi 1., 2., … Hệ thống tách bảng và câu hỏi, nhờ AI gợi ý ảnh / bản đồ và tự tạo ảnh nếu bài cần.' },
  smart: { title: 'Smart Paste – dán đề', hint: 'Dán tiêu đề, bảng (Tab hoặc |) và các câu hỏi đánh số. Trong ô, “ -chữ” bắt đầu một gạch đầu dòng mới; “(1) ______” là chỗ trống.' },
};
const PLACEHOLDER = 'LISTEN AND FILL IN THE TABLE. THEN ANSWER THE QUESTIONS BELOW.\nPlace\tAdvantages\tDisadvantages\nTown centre\t-Near good (1) ______\t-Buildings are (2) ______ and (3) ______ -Cold in winter\nPark\t-Quiet\t-Far from the (4) ______\n1. Are the windows going to be big or small?\n2. Which place is chosen?';

export const ListeningTableEditor: React.FC<Props> = ({ folder, editingExercise, onSaveExercise, onCancel, onDeleteExercise }) => {
  const [data, setDataRaw] = useState<ListeningTableData>(() =>
    editingExercise?.listeningTable
      ? createListeningTable(editingExercise.listeningTable)
      : createListeningTable({ ...(editingExercise?.title ? { exerciseTitle: editingExercise.title } : {}) }),
  );
  const exerciseIdRef = useRef(editingExercise?.id || `ex_listening_table_${Date.now()}`);
  const savedIdx = folder.exercises.findIndex((e) => e.id === exerciseIdRef.current);
  const exerciseNumber = savedIdx >= 0 ? savedIdx + 1 : folder.exercises.length + 1;
  const brand = resolveBranding(folder.printSettings.branding);

  // ── Undo / Redo
  const dataRef = useRef(data);
  const pastRef = useRef<ListeningTableData[]>([]);
  const futureRef = useRef<ListeningTableData[]>([]);
  const lastPushRef = useRef(0);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const setData = (next: React.SetStateAction<ListeningTableData>) => {
    const prev = dataRef.current;
    const val = typeof next === 'function' ? (next as (p: ListeningTableData) => ListeningTableData)(prev) : next;
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
  const jump = (from: ListeningTableData[], to: ListeningTableData[]) => {
    const target = from.pop();
    if (!target) return;
    to.push(dataRef.current);
    dataRef.current = target;
    lastPushRef.current = 0;
    setDataRaw(target);
  };
  const canUndo = pastRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;
  const update = (patch: Partial<ListeningTableData>) => setData((p) => ({ ...p, ...patch }));
  const updateSettings = (patch: Partial<ListeningTableData['settings']>) => setData((p) => ({ ...p, settings: { ...p.settings, ...patch } }));

  // ── Giao diện
  const slot = useAppHeaderSlot();
  const { mainRef, leftPct, isDragging, handlers: splitHandlers } = useSplitPane('listening-table-editor-left-pct');
  const [activeTab, setActiveTab] = useState<'preview' | 'edit_mode'>('edit_mode');
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pageFull, setPageFull] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [selKey, setSelKey] = useState<TableStyleKey>('title');
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

  // ── Bảng: ô đang chọn để chèn / xóa hàng cột
  const [cell, setCell_] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const rowCount = data.table.rows.length;
  const colCount = data.table.columns.length;
  const curRow = Math.min(cell.r, rowCount - 1);
  const curCol = Math.min(cell.c, colCount - 1);
  const setTable = (table: ListeningTableData['table']) => update({ table });

  // ── Câu hỏi
  const addQuestion = () => update({ questions: [...data.questions, { id: newTableId('q'), text: '' }] });
  const editQuestion = (id: string, text: string) => update({ questions: data.questions.map((q) => (q.id === id ? { ...q, text } : q)) });
  const removeQuestion = (id: string) => update({ questions: data.questions.filter((q) => q.id !== id) });
  const duplicateQuestion = (id: string) => {
    const i = data.questions.findIndex((q) => q.id === id);
    if (i < 0) return;
    const list = [...data.questions];
    list.splice(i + 1, 0, { ...list[i], id: newTableId('q') });
    update({ questions: list });
  };
  const moveQuestion = (from: number, to: number) => update({ questions: moveListItem(data.questions, from, to) });
  const dragRef = useRef<number | null>(null);

  // ── Ảnh / bản đồ
  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const url = await fileToSmallDataUrl(file, 1200, 'image/jpeg');
      const ratio = await new Promise<number>((resolve) => {
        const im = new Image();
        im.onload = () => resolve(im.naturalWidth && im.naturalHeight ? Math.round((im.naturalWidth / im.naturalHeight) * 100) / 100 : 16 / 10);
        im.onerror = () => resolve(16 / 10);
        im.src = url;
      });
      update({ image: { ...data.image, url, ratio } });
      updateSettings({ showImage: true });
    } catch {
      window.alert('Không đọc được ảnh này.');
    }
  };

  const handleExtraImage = async (idx: number, ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    try {
      const url = await fileToSmallDataUrl(file, 1200, 'image/jpeg');
      const ratio = await new Promise<number>((resolve) => {
        const im = new Image();
        im.onload = () => resolve(im.naturalWidth && im.naturalHeight ? Math.round((im.naturalWidth / im.naturalHeight) * 100) / 100 : 16 / 9);
        im.onerror = () => resolve(16 / 9);
        im.src = url;
      });
      const extra = [...(dataRef.current.image.extra || [])];
      extra[idx - 1] = { url, ratio };
      update({ image: { ...dataRef.current.image, extra } });
    } catch {
      window.alert('Không đọc được ảnh này.');
    }
  };
  const imageCount = Math.min(4, Math.max(1, data.settings.imageCount ?? 1));

  const [gen, setGen] = useState<{ busy: boolean; msg: string }>({ busy: false, msg: '' });
  const probeExtension = async (): Promise<{ present: boolean; ready: boolean; note: string }> => {
    try {
      const res = await askExtension<{ status?: string; message?: string }>('GET_FLOW_STATUS', {}, 5000);
      const st = res.payload?.status;
      if (st === 'CONNECTED' || st === 'FLOW_TAB_NOT_FOUND' || st === 'PROJECT_NOT_OPEN') return { present: true, ready: true, note: '' };
      return { present: true, ready: false, note: friendlyExtensionError(res.payload?.message || res.error?.message || 'Extension chưa sẵn sàng tạo ảnh.') };
    } catch {
      return { present: false, ready: false, note: 'Không kết nối được extension Flow Bridge. Hãy bật extension rồi tải lại trang (F5).' };
    }
  };
  const generateImage = async (prompt?: string) => {
    const p = (prompt || dataRef.current.image.prompt || buildTableImagePrompt(dataRef.current)).trim();
    setGen({ busy: true, msg: 'Đang tạo ảnh…' });
    const probe = await probeExtension();
    if (!probe.ready) { setGen({ busy: false, msg: probe.note }); setData((d) => ({ ...d, image: { ...d.image, prompt: p } })); return; }
    try {
      const res = await generateImageViaExtension({ prompt: buildFinalPrompt(p, MAP_STYLE), aspectRatio: '16:9' });
      setData((d) => ({ ...d, image: { ...d.image, url: res.imageUrl, ratio: 16 / 9, prompt: p }, settings: { ...d.settings, showImage: true } }));
      setGen({ busy: false, msg: 'Đã tạo và gắn ảnh vào bài.' });
    } catch (e) {
      setGen({ busy: false, msg: friendlyExtensionError(e instanceof Error ? e.message : 'Không tạo được ảnh') });
    }
  };

  // ── Smart AI / Smart Paste
  const [modal, setModal] = useState<ModalMode | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [modalMsg, setModalMsg] = useState('');
  type AutoState = { phase: 'idle' | 'analyzing' | 'done'; notes: string[]; summary: string };
  const IDLE: AutoState = { phase: 'idle', notes: [], summary: '' };
  const [auto, setAuto] = useState<AutoState>(IDLE);
  const hasContent = data.table.rows.some((r) => r.cells.some((c) => c.trim())) || data.questions.length > 0;
  const openModal = (m: ModalMode) => { setModal(m); setPasteText(''); setModalMsg(''); };

  const applyParsed = (text: string): { ok: boolean; summary: string } => {
    const parsed = parseTableText(text);
    if (!parsed.ok || !parsed.table) { setModalMsg(parsed.warnings[0] || 'Không nhận ra bảng trong văn bản này.'); return { ok: false, summary: '' }; }
    if (hasContent && !window.confirm('Thay bảng và các câu hỏi hiện có bằng nội dung vừa dán? (Có thể Hoàn tác)')) return { ok: false, summary: '' };
    update({
      table: parsed.table,
      questions: parsed.questions.map((t) => ({ id: newTableId('q'), text: t })),
      ...(parsed.title ? { exerciseTitle: parsed.title } : {}),
    });
    return { ok: true, summary: `Đã tách bảng ${parsed.table.rows.length} hàng × ${parsed.table.columns.length} cột và ${parsed.questions.length} câu hỏi.` };
  };

  const runSmartAI = async (text: string) => {
    const applied = applyParsed(text);
    if (!applied.ok) return;
    setModal(null);
    const notes: string[] = [];
    setAuto({ phase: 'analyzing', notes, summary: applied.summary });
    const probe = await probeExtension();
    let plan: AiImagePlan | null = null;
    if (probe.present) {
      const out = await Promise.race([analyzeWorksheetWithAI(text), new Promise<null>((r) => setTimeout(() => r(null), 60000))]);
      if (out && out.ok && out.plan) plan = out.plan;
      else notes.push(`AI chưa dùng được${out?.errorCode ? ` (${out.errorCode})` : ''}: prompt ảnh được tạo từ nội dung bài.`);
    } else notes.push(probe.note);
    const aiPrompt = imagePromptFromPlan(plan);
    const prompt = aiPrompt || buildTableImagePrompt(dataRef.current);
    setData((d) => ({ ...d, image: { ...d.image, prompt } }));
    if (plan && !aiPrompt) { setAuto({ phase: 'done', notes, summary: `${applied.summary} AI: bài này không cần ảnh minh họa.` }); return; }
    if (aiPrompt && probe.ready) {
      setAuto({ phase: 'analyzing', notes, summary: `${applied.summary} AI gợi ý bài có ảnh – đang tạo ảnh…` });
      await generateImage(prompt);
      setAuto({ phase: 'done', notes, summary: `${applied.summary} Đã soạn prompt và tạo ảnh minh họa.` });
      return;
    }
    if (!probe.ready && probe.present) notes.push(probe.note);
    setAuto({ phase: 'done', notes, summary: `${applied.summary} Đã soạn sẵn prompt ảnh – bấm “Tạo ảnh” khi extension sẵn sàng.` });
  };

  const applyModal = () => {
    if (!modal) return;
    if (modal === 'ai') { void runSmartAI(pasteText); return; }
    if (applyParsed(pasteText).ok) setModal(null);
  };

  // ── Định dạng chữ theo thành phần
  const STYLE_DEFAULTS: Record<TableStyleKey, { bold: boolean; italic: boolean; size: number }> = {
    title: { bold: true, italic: false, size: data.settings.headingFontSizePt },
    instruction: { bold: false, italic: true, size: 10 },
    table: { bold: false, italic: false, size: data.settings.fontSizePt },
    questions: { bold: false, italic: false, size: data.settings.fontSizePt },
  };
  const curStyle = data.textStyles?.[selKey];
  const applyFlag = (flag: 'bold' | 'italic' | 'underline' | 'strike') => {
    const current = flag === 'bold' ? (curStyle?.bold ?? STYLE_DEFAULTS[selKey].bold) : flag === 'italic' ? (curStyle?.italic ?? STYLE_DEFAULTS[selKey].italic) : !!curStyle?.[flag];
    update({ textStyles: setTableStyle(data.textStyles, selKey, { [flag]: !current }) });
  };
  const clearStyle = () => {
    const next = { ...(data.textStyles || {}) };
    delete next[selKey];
    update({ textStyles: next });
  };

  // ── Lưu / xuất
  const buildExercise = (): Exercise => ({
    id: exerciseIdRef.current,
    type: 'listening_table_completion',
    layoutType: 'template_a',
    title: data.exerciseTitle,
    instructions: data.instruction,
    pointsTotal: data.questions.length,
    order: editingExercise?.order || folder.exercises.length + 1,
    imageSlots: [],
    questions: data.questions.map((q, i) => ({ id: q.id, number: i + 1, text: q.text, points: 1 })),
    pageBreakBefore: data.settings.pageBreakBefore || undefined,
    listeningTable: { ...data, exerciseNumber },
  });

  const handleSave = (next: 'return' | 'add_another' | 'stay' = 'return') => {
    const v = validateListeningTable(data);
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
  const renderMoreSection = (key: TableMoreKey): React.ReactNode => {
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
          <label className={row}>Chiều rộng ảnh
            <span className="flex items-center gap-2"><input type="range" min={40} max={100} step={5} value={s.imageWidthPercent} onChange={(e) => updateSettings({ imageWidthPercent: Number(e.target.value) })} className="accent-blue-600" /><span className="font-mono w-10 text-right">{s.imageWidthPercent}%</span></span>
          </label>
          <label className={row}>Độ dài chỗ trống trong bảng
            <span className="flex items-center gap-2"><input type="range" min={14} max={40} step={2} value={s.blankWidthMm} onChange={(e) => updateSettings({ blankWidthMm: Number(e.target.value) })} className="accent-blue-600" /><span className="font-mono w-12 text-right">{s.blankWidthMm} mm</span></span>
          </label>
          <label className={row}>Màu viền bảng
            <input type="color" value={s.tableBorderColor} onChange={(e) => updateSettings({ tableBorderColor: e.target.value })} className="h-7 w-10 rounded border border-slate-200" />
          </label>
        </div>
      );
    }
    return (
      <div className="space-y-2 text-[11.5px] text-slate-700">
        {([['showExerciseTitle', 'Hiện tiêu đề bài'], ['headerBold', 'In đậm hàng tiêu đề cột'], ['firstColumnBold', 'In đậm cột đầu (tên hàng)'], ['pageBreakBefore', 'Ngắt trang trước bài này']] as const).map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={s[k]} onChange={(e) => updateSettings({ [k]: e.target.checked } as Partial<ListeningTableData['settings']>)} className="rounded text-blue-600 focus:ring-0" />
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
        <ListeningTableRenderer
          data={{ ...data, exerciseNumber }}
          exerciseIndex={exerciseNumber}
          editable={editable ? {
            onTitle: (v) => update({ exerciseTitle: v }),
            onInstruction: (v) => update({ instruction: v }),
            onQuestion: (id, v) => editQuestion(id, v),
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
              <div className="text-[11.5px] text-slate-500">{folder.name || 'Unit 2 - London'} <span className="text-slate-300 mx-0.5">|</span> Worksheet: {folder.printSettings?.branding?.worksheetNo || 'WS-Map-1-1-1'}</div>
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

      <ListeningTableToolbar
        data={data}
        selKey={selKey}
        onSelKey={setSelKey}
        curStyle={curStyle}
        defaults={STYLE_DEFAULTS[selKey]}
        onFlag={applyFlag}
        onSizeDelta={(d) => update({ textStyles: bumpTableSize(data.textStyles, selKey, STYLE_DEFAULTS[selKey].size, d) })}
        onPatchStyle={(patch) => update({ textStyles: setTableStyle(data.textStyles, selKey, patch) })}
        onClearStyle={clearStyle}
        onSettings={updateSettings}
        canDeleteRow={rowCount > 1}
        canDeleteColumn={colCount > 2}
        onInsertRow={() => setTable(insertRow(data.table, curRow))}
        onInsertColumn={() => setTable(insertColumn(data.table, curCol))}
        onDeleteRow={() => setTable(deleteRow(data.table, curRow))}
        onDeleteColumn={() => setTable(deleteColumn(data.table, curCol))}
        onAddQuestion={addQuestion}
        onSmartAI={() => openModal('ai')}
        onSmartPaste={() => openModal('smart')}
        onInsertExercise={() => handleSave('return')}
        onImageFile={(e) => { void handleImageFile(e); }}
        onGenerateImage={() => { void generateImage(); }}
        generating={gen.busy}
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
          {auto.phase !== 'idle' && (
            <section className="shrink-0 bg-white border border-blue-200 rounded-2xl px-4 py-3 shadow-xs space-y-1.5" aria-live="polite">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-blue-600" />
                <h3 className="text-[13px] font-bold text-slate-900">{auto.phase === 'analyzing' ? 'Đang xử lý…' : 'Smart AI đã xong'}</h3>
                {auto.phase === 'done' && <button type="button" onClick={() => setAuto(IDLE)} className="ml-auto p-1 text-slate-400 hover:text-slate-700 rounded-md" aria-label="Ẩn"><X size={13} /></button>}
              </div>
              {auto.summary && <p className="text-[11.5px] text-slate-600">{auto.summary}</p>}
              {auto.notes.map((n, i) => <p key={i} className="text-[11.5px] text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1">{n}</p>)}
            </section>
          )}

          <section className="shrink-0 bg-white/60 border border-slate-100 rounded-2xl p-4 shadow-xs space-y-3">
            <SectionHead n={1} title="Exercise Content" help="Tiêu đề và hướng dẫn in trên phiếu." right={<>
              <button type="button" onClick={() => openModal('ai')} className="px-2.5 h-7 rounded-lg bg-blue-600 text-white text-[11px] font-bold hover:bg-blue-700 flex items-center gap-1" title="Dán đề, tự tách bảng và gợi ý ảnh"><Sparkles size={12} /> Smart AI</button>
              <span className="px-2.5 py-0.5 rounded-full bg-white border border-blue-200 text-[11px] font-bold text-blue-700">Exercise {exerciseNumber}</span>
            </>} />
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Exercise Title</label>
              <AutoTextarea value={data.exerciseTitle} onChange={(e) => update({ exerciseTitle: e.target.value })} className={`${fieldCls} resize-none min-h-[34px] font-semibold`} />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Instruction <span className="font-normal text-slate-400">(optional)</span></label>
              <AutoTextarea value={data.instruction} onChange={(e) => update({ instruction: e.target.value })} className={`${fieldCls} resize-none min-h-[34px]`} />
            </div>
          </section>

          <section className="shrink-0 bg-white/60 border border-slate-100 rounded-2xl p-4 shadow-xs space-y-2.5">
            <SectionHead n={2} title="Audio & QR Code" help="Tải file nghe hoặc dán đường dẫn; mã QR tạo từ đường dẫn công khai để học sinh quét và nghe." />
            <AudioQrPanel audio={data.audio} showQr={data.settings.showQrCode} onAudioChange={(audio) => update({ audio })} onShowQrChange={(v) => updateSettings({ showQrCode: v })} />
          </section>

          <section className="shrink-0 bg-white/60 border border-slate-100 rounded-2xl p-4 shadow-xs space-y-2.5">
            <SectionHead n={3} title="Image Manager" help="Ảnh / bản đồ phía trên bảng. Có thể tải ảnh hoặc tạo bằng AI qua extension từ prompt bên dưới." right={
              <button type="button" onClick={() => { void generateImage(); }} disabled={gen.busy} className={smallBtn}><ImagePlus size={12} /> {data.image.url ? 'Tạo lại ảnh' : 'Tạo ảnh AI'}</button>
            } />
            <div className="flex items-center gap-3">
              {data.image.url ? (
                <img src={data.image.url} alt="" className="w-28 h-[70px] object-cover rounded-lg border border-slate-200" />
              ) : (
                <div className="w-28 h-[70px] rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-400 text-[11px] flex items-center justify-center">Chưa có ảnh</div>
              )}
              <div className="flex flex-col gap-1.5">
                <label className={`${smallBtn} cursor-pointer`}><ImagePlus size={12} /> Tải ảnh từ máy<input type="file" accept="image/*" hidden onChange={(e) => { void handleImageFile(e); }} /></label>
                {data.image.url && <button type="button" onClick={() => update({ image: { ...data.image, url: undefined, ratio: undefined } })} className="text-[11px] font-semibold text-rose-600 hover:underline text-left">Xóa ảnh</button>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">Số ảnh
                <select value={imageCount} onChange={(ev) => updateSettings({ imageCount: Number(ev.target.value) })} className={`${fieldCls} !w-16 !py-1`}>
                  {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              {Array.from({ length: imageCount - 1 }).map((_, k) => {
                const slot = data.image.extra?.[k];
                return (
                  <span key={k} className="flex items-center gap-1.5">
                    {slot?.url ? <img src={slot.url} alt="" className="w-14 h-[40px] object-cover rounded-md border border-slate-200" /> : <span className="w-14 h-[40px] rounded-md border border-dashed border-slate-300 bg-slate-50 text-[10px] text-slate-400 flex items-center justify-center">Ảnh {k + 2}</span>}
                    <label className={`${smallBtn} cursor-pointer`}>Ảnh {k + 2}<input type="file" accept="image/*" hidden onChange={(ev) => { void handleExtraImage(k + 1, ev); }} /></label>
                  </span>
                );
              })}
            </div>
            <AutoTextarea value={data.image.prompt || ''} onChange={(e) => update({ image: { ...data.image, prompt: e.target.value } })} placeholder="Prompt tạo ảnh (tự sinh từ nội dung, có thể sửa)" className={`${fieldCls} resize-none min-h-[34px] text-[11px]`} />
            {gen.msg && <p className={`text-[11.5px] rounded-md px-2 py-1 border ${gen.busy ? 'text-blue-700 bg-blue-50 border-blue-100' : 'text-amber-700 bg-amber-50 border-amber-100'}`}>{gen.msg}</p>}
          </section>

          <section className="shrink-0 bg-white/60 border border-slate-100 rounded-2xl p-4 shadow-xs space-y-2.5">
            <SectionHead n={4} title="Table Content" help="Bấm vào một ô rồi dùng Insert/Delete Row/Column trên thanh công cụ. Trong ô: “ -chữ” hoặc xuống dòng để có gạch đầu dòng; “(1) ______” là chỗ trống." />
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    {data.table.columns.map((c, ci) => (
                      <th key={ci} className="border border-slate-200 bg-slate-50 p-1">
                        <input value={c} onFocus={() => setCell_({ r: 0, c: ci })} onChange={(e) => setTable(setHeader(data.table, ci, e.target.value))} className={`w-full px-2 py-1 bg-transparent font-bold text-center focus:outline-none ${curCol === ci ? 'text-blue-700' : ''}`} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.table.rows.map((r, ri) => (
                    <tr key={r.id}>
                      {r.cells.map((c, ci) => (
                        <td key={ci} className={`border p-1 align-top ${curRow === ri && curCol === ci ? 'border-blue-400 bg-blue-50/40' : 'border-slate-200'}`}>
                          <AutoTextarea
                            value={c}
                            onFocus={() => setCell_({ r: ri, c: ci })}
                            onChange={(e) => setTable(setCell(data.table, ri, ci, e.target.value))}
                            className={`w-full px-1.5 py-1 bg-transparent resize-none focus:outline-none text-[11.5px] ${ci === 0 ? 'font-bold' : ''}`}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10.5px] text-slate-400">Ô đang chọn: hàng {curRow + 1}, cột {curCol + 1}</p>
          </section>

          <section className="shrink-0 bg-white/60 border border-slate-100 rounded-2xl p-4 shadow-xs space-y-2.5">
            <SectionHead n={5} title={`Question List (${data.questions.length})`} right={<>
              <button type="button" onClick={addQuestion} className={smallBtn}><Plus size={12} /> Add Question</button>
              <button type="button" onClick={() => openModal('smart')} className={smallBtn}>Smart Paste</button>
            </>} />
            {data.questions.length === 0 && <p className="text-xs text-slate-400 py-2 text-center">Chưa có câu hỏi nào. Bấm Add Question hoặc Smart Paste.</p>}
            <div className="space-y-2">
              {data.questions.map((q, i) => (
                <div
                  key={q.id}
                  className="group flex items-start gap-1.5"
                  onDragOver={(e) => { if (dragRef.current !== null) e.preventDefault(); }}
                  onDrop={(e) => { if (dragRef.current === null) return; e.preventDefault(); moveQuestion(dragRef.current, i); dragRef.current = null; }}
                >
                  <span draggable onDragStart={(e) => { dragRef.current = i; e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => { dragRef.current = null; }} className="pt-2 text-slate-300 hover:text-slate-600 cursor-grab active:cursor-grabbing shrink-0" title="Kéo để đổi vị trí"><GripVertical size={14} /></span>
                  <span className="min-w-6 h-7 mt-0.5 px-1.5 rounded-md bg-slate-100 text-[11px] font-bold text-slate-600 flex items-center justify-center shrink-0">{i + 1}</span>
                  <AutoTextarea value={q.text} onChange={(e) => editQuestion(q.id, e.target.value)} placeholder="Question…" className={`${fieldCls} block flex-1 min-w-0 resize-none min-h-[34px]`} />
                  <span className="flex items-center shrink-0 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-opacity">
                    <button type="button" className={iconBtn} title="Lên" disabled={i === 0} onClick={() => moveQuestion(i, i - 1)}><ArrowUp size={13} /></button>
                    <button type="button" className={iconBtn} title="Xuống" disabled={i === data.questions.length - 1} onClick={() => moveQuestion(i, i + 1)}><ArrowDown size={13} /></button>
                    <button type="button" className={iconBtn} title="Nhân bản" onClick={() => duplicateQuestion(q.id)}><Copy size={13} /></button>
                    <button type="button" className={`${iconBtn} hover:!text-rose-600`} title="Xóa" onClick={() => removeQuestion(q.id)}><Trash2 size={13} /></button>
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
        <div className="fixed inset-0 z-[80] bg-slate-900/40 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 flex flex-col gap-3" style={{ width: 'min(36rem, 95vw)', minWidth: '20rem', maxWidth: '95vw', maxHeight: '92vh', resize: 'both', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-slate-900">{MODAL_INFO[modal].title}</h3><button type="button" onClick={() => setModal(null)} className="p-1 text-slate-400 hover:text-slate-700"><X size={16} /></button></div>
            <p className="text-xs text-slate-500">{MODAL_INFO[modal].hint}</p>
            <textarea rows={11} style={{ flex: '1 1 auto', minHeight: '14rem', resize: 'none' }} value={pasteText} onChange={(e) => { setPasteText(e.target.value); setModalMsg(''); }} placeholder={PLACEHOLDER} className={`${fieldCls} font-mono`} />
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
