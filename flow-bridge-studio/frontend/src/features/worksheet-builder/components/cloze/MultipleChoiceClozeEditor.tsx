import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, Check, Plus, Trash2, Copy, ImagePlus, X, ClipboardPaste, GripVertical,
  Maximize2, Minimize, Minus, Eye, Save, Printer, ChevronLeft, ChevronRight,
  MoreHorizontal, FileDown, Undo2, Redo2, AlertTriangle, Sparkles,
} from 'lucide-react';
import type { LessonFolder, Exercise, Worksheet } from '../../types';
import type { ClozeData, ClozeLayoutId, ClozeQuestion } from '../../services/cloze/clozeCore';
import {
  createCloze, createSampleCloze, insertBlank, removeQuestion, duplicateQuestion, reorderQuestions,
  parseClozeSmartPaste, orphanQuestionIds, syncBlanks, addOption, removeOption,
  shuffleOptionOrder, toggleWrap, toggleListPrefix, DEFAULT_CLOZE_SETTINGS,
} from '../../services/cloze/clozeCore';
import type { ClozeParseResult } from '../../services/cloze/clozeCore';
import { ClozeRenderer } from './ClozeRenderer';
import { askExtension, generateImageViaExtension } from '../../services/ai/extensionBridge';
import { buildFinalPrompt } from '../../services/ai/imagePlanCompare';
import { PHOTO_STYLE, friendlyExtensionError } from '../../services/matching/autoMatching';
import { ClozeToolbar, type ClozeMoreKey } from './ClozeToolbar';
import { useAppHeaderSlot } from '../shared/hooks/useAppHeaderSlot';
import { useSplitPane } from '../shared/hooks/useSplitPane';
import { BrandHeader } from '../preview/BrandHeader';
import { BrandFooter } from '../preview/BrandFooter';
import { resolveBranding, fileToSmallDataUrl } from '../../types/branding';
import { exportWorksheetToDocx } from '../../services/docxExportService';

interface Props {
  folder: LessonFolder;
  editingExercise?: Exercise | null;
  onSaveExercise: (exercise: Exercise, nextAction: 'return' | 'add_another' | 'stay') => void;
  onCancel: () => void;
  /** Xóa bài đang sửa (chỉ có khi sửa bài đã lưu) */
  onDeleteExercise?: (exerciseId: string) => void;
}

// ── Mini SVG / CSS Thumbnail Component for 6 Layouts ──
const LayoutThumbnail: React.FC<{ layout: ClozeLayoutId; className?: string }> = ({
  layout,
  className = 'w-10 h-8',
}) => {
  switch (layout) {
    case 'original':
      return (
        <div className={`${className} bg-slate-50 border border-slate-300 rounded p-1 flex flex-col justify-between shrink-0 shadow-2xs`}>
          <div className="space-y-0.5">
            <div className="h-0.5 bg-slate-400 rounded w-full" />
            <div className="h-0.5 bg-slate-300 rounded w-4/5" />
          </div>
          <div className="grid grid-cols-3 gap-0.5 pt-0.5 border-t border-slate-200">
            <div className="h-0.5 bg-blue-500 rounded" />
            <div className="h-0.5 bg-blue-500 rounded" />
            <div className="h-0.5 bg-blue-500 rounded" />
          </div>
        </div>
      );
    case 'inline':
      return (
        <div className={`${className} bg-slate-50 border border-slate-300 rounded p-1 flex flex-col gap-0.5 shrink-0 shadow-2xs`}>
          <div className="h-0.5 bg-slate-400 rounded w-full" />
          <div className="h-0.5 bg-blue-500 rounded w-3/4" />
          <div className="h-0.5 bg-slate-400 rounded w-full" />
          <div className="h-0.5 bg-blue-500 rounded w-3/4" />
        </div>
      );
    case 'two_columns':
      return (
        <div className={`${className} bg-slate-50 border border-slate-300 rounded p-1 grid grid-cols-2 gap-1 shrink-0 shadow-2xs`}>
          <div className="space-y-0.5 border-r border-slate-200 pr-0.5">
            <div className="h-0.5 bg-slate-400 rounded w-full" />
            <div className="h-0.5 bg-slate-300 rounded w-full" />
            <div className="h-0.5 bg-slate-300 rounded w-2/3" />
          </div>
          <div className="space-y-0.5">
            <div className="h-0.5 bg-blue-500 rounded w-full" />
            <div className="h-0.5 bg-blue-500 rounded w-full" />
            <div className="h-0.5 bg-blue-500 rounded w-4/5" />
          </div>
        </div>
      );
    case 'answer_grid':
      return (
        <div className={`${className} bg-slate-50 border border-slate-300 rounded p-1 flex flex-col justify-between shrink-0 shadow-2xs`}>
          <div className="space-y-0.5">
            <div className="h-0.5 bg-slate-400 rounded w-full" />
            <div className="h-0.5 bg-slate-300 rounded w-3/4" />
          </div>
          <div className="border border-slate-300 rounded grid grid-cols-4 gap-0.5 p-0.5 bg-white">
            <div className="h-0.5 bg-blue-500 rounded" />
            <div className="h-0.5 bg-blue-500 rounded" />
            <div className="h-0.5 bg-blue-500 rounded" />
            <div className="h-0.5 bg-blue-500 rounded" />
          </div>
        </div>
      );
    case 'answer_boxes':
      return (
        <div className={`${className} bg-slate-50 border border-slate-300 rounded p-1 flex flex-col justify-between shrink-0 shadow-2xs`}>
          <div className="space-y-0.5">
            <div className="h-0.5 bg-slate-400 rounded w-full" />
            <div className="h-0.5 bg-slate-300 rounded w-4/5" />
          </div>
          <div className="flex gap-0.5 justify-center">
            <div className="w-2 h-2 border border-blue-400 rounded-xs text-[5px] flex items-center justify-center font-bold text-blue-600">A</div>
            <div className="w-2 h-2 border border-blue-400 rounded-xs text-[5px] flex items-center justify-center font-bold text-blue-600">B</div>
            <div className="w-2 h-2 border border-blue-400 rounded-xs text-[5px] flex items-center justify-center font-bold text-blue-600">C</div>
          </div>
        </div>
      );
    case 'compact':
      return (
        <div className={`${className} bg-slate-50 border border-slate-300 rounded p-1 flex flex-col justify-between shrink-0 shadow-2xs`}>
          <div className="h-0.5 bg-slate-400 rounded w-full" />
          <div className="grid grid-cols-4 gap-0.5">
            <div className="h-0.5 bg-blue-500 rounded" />
            <div className="h-0.5 bg-blue-500 rounded" />
            <div className="h-0.5 bg-blue-500 rounded" />
            <div className="h-0.5 bg-blue-500 rounded" />
          </div>
          <div className="grid grid-cols-4 gap-0.5">
            <div className="h-0.5 bg-blue-500 rounded" />
            <div className="h-0.5 bg-blue-500 rounded" />
            <div className="h-0.5 bg-blue-500 rounded" />
            <div className="h-0.5 bg-blue-500 rounded" />
          </div>
        </div>
      );
    default:
      return null;
  }
};

const inputCls = 'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';
const labelCls = 'block text-[11px] font-semibold text-slate-600 mb-1';

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

const legacyToCloze = (ex: Exercise): ClozeData =>
  createCloze({
    exerciseTitle: ex.title || undefined,
    passage: ex.passage || '',
    questions: (ex.questions || []).map((q, i) => ({
      id: q.id || `cq_${i + 1}`,
      number: q.number || i + 1,
      blankId: `blank_${i + 1}`,
      options: (q.options || []).map((o, oi) => ({ id: o.id || `co_${i + 1}_${oi}`, label: (o.label || 'a').toLowerCase(), text: o.text || '' })),
    })),
  });

const A4_PX = 1124; // 297mm ở 96dpi

export const MultipleChoiceClozeEditor: React.FC<Props> = ({
  folder, editingExercise, onSaveExercise, onCancel, onDeleteExercise,
}) => {
  const exerciseId = useRef(editingExercise?.id || `ex_${Date.now()}`).current; // id ổn định cho mọi lần lưu
  const [data, setData] = useState<ClozeData>(() =>
    editingExercise?.cloze ? createCloze(editingExercise.cloze)
    : editingExercise && editingExercise.questions?.length ? legacyToCloze(editingExercise)
    : createCloze());

  // ── Lịch sử Undo / Redo (gộp các lần gõ liên tiếp) ──
  const [past, setPast] = useState<ClozeData[]>([]);
  const [future, setFuture] = useState<ClozeData[]>([]);
  const lastCommit = useRef<{ key: string; at: number }>({ key: '', at: 0 });
  const dataRef = useRef(data);
  dataRef.current = data;
  const [dirty, setDirty] = useState(false);

  const commit = useCallback((next: ClozeData, key = '') => {
    const now = Date.now();
    const coalesce = key !== '' && lastCommit.current.key === key && now - lastCommit.current.at < 900;
    lastCommit.current = { key, at: now };
    if (!coalesce) setPast((p) => [...p.slice(-59), dataRef.current]);
    setFuture([]);
    setData(next);
    setDirty(true);
  }, []);

  const undo = useCallback(() => {
    setPast((p) => {
      if (!p.length) return p;
      setFuture((f) => [dataRef.current, ...f]);
      setData(p[p.length - 1]);
      setDirty(true);
      lastCommit.current = { key: '', at: 0 };
      return p.slice(0, -1);
    });
  }, []);
  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f;
      setPast((p) => [...p, dataRef.current]);
      setData(f[0]);
      setDirty(true);
      return f.slice(1);
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  // ── UI state ──
  const [activeTab, setActiveTab] = useState<'preview' | 'edit'>('edit');
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSmartPaste, setShowSmartPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [parsed, setParsed] = useState<ClozeParseResult | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [fitting, setFitting] = useState(false);
  const [fitMsg, setFitMsg] = useState<string | null>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const dragIdx = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const menuRef = useRef<HTMLDivElement>(null);
  const slot = useAppHeaderSlot();
  const { mainRef, leftPct, isDragging, handlers: splitHandlers } = useSplitPane('cloze-editor-left-pct');
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

  const brand = resolveBranding(folder.printSettings.branding);
  const savedIdx = folder.exercises.findIndex((e) => e.id === exerciseId);
  const exerciseNumber = savedIdx >= 0 ? savedIdx + 1 : folder.exercises.length + 1;
  const orphans = useMemo(() => orphanQuestionIds(data), [data]);
  const emptyOptions = useMemo(() => data.questions.reduce((n, q) => n + q.options.filter((o) => !o.text.trim()).length, 0), [data]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  const setSettings = (patch: Partial<ClozeData['settings']>) => commit({ ...data, settings: { ...data.settings, ...patch } });
  const patchQuestion = (id: string, fn: (q: ClozeQuestion) => ClozeQuestion, key = '') =>
    commit({ ...data, questions: data.questions.map((q) => (q.id === id ? fn(q) : q)) }, key);

  // ── Đoạn văn: thanh định dạng ──
  const applyEdit = (fn: (text: string, s: number, e: number) => { text: string; selStart: number; selEnd: number }) => {
    const el = textareaRef.current;
    if (!el) return;
    const r = fn(data.passage, el.selectionStart, el.selectionEnd);
    commit({ ...data, passage: r.text });
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(r.selStart, r.selEnd); });
  };

  const handleInsertBlank = () => {
    const el = textareaRef.current;
    commit(insertBlank(data, el ? el.selectionStart : undefined));
    requestAnimationFrame(() => el?.focus());
  };

  const attachOrphans = () => {
    const extra = orphans.map((id) => data.questions.find((q) => q.id === id)!).map((q) => ` (${q.number}) ________`).join('');
    commit(syncBlanks({ ...data, passage: `${data.passage}${extra}` }));
  };

  // ── Ảnh ──
  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !f.type.startsWith('image/')) return;
    try {
      const url = await fileToSmallDataUrl(f, 900, 'image/jpeg');
      commit({ ...data, settings: { ...data.settings, imageUrl: url, imagePosition: data.settings.imagePosition === 'none' ? 'right' : data.settings.imagePosition } });
    } catch {
      window.alert('Không đọc được ảnh này.');
    }
  };

  // ── Ảnh tạo bằng AI (extension Flow Bridge) ──
  const [imgPrompt, setImgPrompt] = useState('');
  const [imgGen, setImgGen] = useState<{ busy: boolean; msg: string }>({ busy: false, msg: '' });
  const buildImagePrompt = (): string => {
    const d = dataRef.current;
    const title = d.passageTitle.trim();
    const first = d.passage.replace(/\(\d+\)\s*_{2,}/g, '').replace(/[*+]{1,2}/g, '').replace(/\s+/g, ' ').trim().slice(0, 260);
    return `Photo illustrating a reading passage${title ? ` titled "${title}"` : ''}. ${first ? `Scene based on: ${first}` : ''}`.trim();
  };
  const generateImage = async () => {
    const prompt = (imgPrompt.trim() || buildImagePrompt()).trim();
    setImgPrompt(prompt);
    setImgGen({ busy: true, msg: 'Đang tạo ảnh…' });
    let probeNote = '';
    try {
      const res = await askExtension<{ status?: string; message?: string }>('GET_FLOW_STATUS', {}, 5000);
      const st = res.payload?.status;
      if (!(st === 'CONNECTED' || st === 'FLOW_TAB_NOT_FOUND' || st === 'PROJECT_NOT_OPEN')) probeNote = friendlyExtensionError(res.payload?.message || res.error?.message || 'Extension chưa sẵn sàng tạo ảnh.');
    } catch {
      probeNote = 'Không kết nối được extension Flow Bridge. Hãy bật extension rồi tải lại trang (F5).';
    }
    if (probeNote) { setImgGen({ busy: false, msg: probeNote }); return; }
    try {
      const res = await generateImageViaExtension({ prompt: buildFinalPrompt(prompt, PHOTO_STYLE), aspectRatio: '4:3' });
      const d = dataRef.current;
      commit({ ...d, settings: { ...d.settings, imageUrl: res.imageUrl, imagePosition: d.settings.imagePosition === 'none' ? 'right' : d.settings.imagePosition } });
      setImgGen({ busy: false, msg: 'Đã tạo và gắn ảnh vào bài.' });
    } catch (err) {
      setImgGen({ busy: false, msg: friendlyExtensionError(err instanceof Error ? err.message : 'Không tạo được ảnh') });
    }
  };

  // ── Smart Paste ──
  const runParse = () => setParsed(parseClozeSmartPaste(pasteText));
  const applyParsed = () => {
    if (!parsed) return;
    if ((data.passage.trim() || data.questions.length) && !window.confirm('Thay toàn bộ đoạn văn và câu hỏi hiện có bằng nội dung vừa dán? (Có thể Undo)')) return;
    commit({ ...parsed.data, settings: { ...data.settings } });
    setShowSmartPaste(false);
    setPasteText('');
    setParsed(null);
  };
  const loadSample = () => {
    if ((data.passage.trim() || data.questions.length) && !window.confirm('Thay nội dung hiện có bằng bài mẫu Wall Street? (Có thể Undo)')) return;
    commit(createSampleCloze(data));
  };

  const toggleShuffle = (on: boolean) => {
    if (on) {
      if (!window.confirm('Trộn ngẫu nhiên thứ tự các lựa chọn trong mọi câu? Việc này làm một lần, dùng Undo để quay lại.')) return;
      commit({ ...shuffleOptionOrder(data), settings: { ...data.settings, shuffleOptions: true } });
    } else {
      setSettings({ shuffleOptions: false });
    }
  };

  // ── Lưu / xuất ──
  const buildExercise = (id = exerciseId, titleSuffix = ''): Exercise => ({
    id,
    type: 'grammar_vocab_cloze',
    layoutType: 'template_a',
    title: `${data.exerciseTitle}${titleSuffix}`,
    instructions: '',
    passage: data.passage,
    questions: data.questions.map((q) => ({
      id: q.id,
      number: q.number,
      text: `(${q.number})`,
      options: q.options.map((o) => ({ id: o.id, label: o.label.toUpperCase(), text: o.text })),
      points: 1,
    })),
    imageSlots: [],
    pointsTotal: data.points || data.questions.length,
    pageBreakBefore: data.settings.pageBreakBefore || undefined,
    order: editingExercise?.order || folder.exercises.length + 1,
    cloze: data,
  });

  const confirmProblems = () => {
    const issues: string[] = [];
    if (!data.passage.trim()) issues.push('Chưa có đoạn văn.');
    if (!data.questions.length) issues.push('Chưa có câu hỏi nào.');
    if (emptyOptions) issues.push(`${emptyOptions} lựa chọn đang để trống.`);
    if (orphans.length) issues.push(`${orphans.length} câu hỏi chưa có chỗ trống trong đoạn văn.`);
    return issues.length === 0 || window.confirm(`Còn vấn đề:\n• ${issues.join('\n• ')}\n\nVẫn lưu?`);
  };

  const handleSave = (next: 'return' | 'add_another' | 'stay' = 'return') => {
    if (!confirmProblems()) return;
    onSaveExercise(buildExercise(), next);
    setDirty(false);
    setMenuOpen(false);
  };

  const handleSaveCopy = () => {
    if (!confirmProblems()) return;
    onSaveExercise(buildExercise(`ex_${Date.now()}`, ' (copy)'), 'return');
  };

  const handleDelete = () => {
    if (!editingExercise || !onDeleteExercise) return;
    if (window.confirm(`Xóa bài "${editingExercise.title}"? Không thể hoàn tác.`)) {
      onDeleteExercise(editingExercise.id);
      onCancel();
    }
  };

  const handleBack = () => {
    if (dirty && !window.confirm('Bạn có thay đổi chưa lưu. Rời đi và bỏ các thay đổi này?')) return;
    onCancel();
  };

  const handleExportDocx = () => {
    const ws: Worksheet = {
      id: folder.id,
      title: data.exerciseTitle || 'WORKSHEET',
      unit: folder.unitTopic || 'Unit 1',
      lesson: folder.lessonTitle || 'Lesson 1',
      gradeLevel: folder.gradeLevel || 'Level 1',
      subject: folder.subject || 'English',
      schoolName: folder.schoolName || '',
      teacherName: folder.teacherName || '',
      totalPoints: data.questions.length,
      status: 'ready',
      printSettings: folder.printSettings,
      exercises: [buildExercise()],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    exportWorksheetToDocx(ws, 'student');
    setMenuOpen(false);
  };

  const resetFormatting = () => {
    const d = DEFAULT_CLOZE_SETTINGS;
    setSettings({
      fontFamily: d.fontFamily, passageFontSizePt: d.passageFontSizePt, answerFontSizePt: d.answerFontSizePt,
      lineHeight: d.lineHeight, paragraphSpacing: d.paragraphSpacing, passageAlign: d.passageAlign,
      optionLabelStyle: d.optionLabelStyle, answerColumns: d.answerColumns,
    });
  };

  // Auto fit to A4: giảm dần cỡ chữ / chiều cao dòng cho tới khi vừa một trang
  useEffect(() => {
    if (!fitting) return;
    const el = measureRef.current;
    if (!el) { setFitting(false); return; }
    const s = dataRef.current.settings;
    if (el.scrollHeight <= A4_PX) { setFitting(false); setFitMsg('Đã vừa một trang A4.'); return; }
    if (s.passageFontSizePt <= 9 && s.answerFontSizePt <= 9 && s.lineHeight <= 1.2) {
      setFitting(false);
      setFitMsg('Đã thu nhỏ hết mức nhưng nội dung vẫn dài hơn một trang A4 (sẽ tự sang trang 2 khi in).');
      return;
    }
    commit({
      ...dataRef.current,
      settings: {
        ...s,
        passageFontSizePt: Math.max(9, s.passageFontSizePt - 0.5),
        answerFontSizePt: Math.max(9, s.answerFontSizePt - 0.5),
        lineHeight: Math.max(1.2, Math.round((s.lineHeight - 0.05) * 100) / 100),
      },
    }, 'fit');
  }, [fitting, data, commit]);
  const startFit = () => { setFitMsg(null); setFitting(true); };

  const selectQuestion = (qId: string) => {
    setSelectedQuestionId(qId);
    questionRefs.current[qId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const renderA4 = (scale: number, editable?: boolean) => (
    <div className="bg-white text-[#111] shadow-xl mx-auto" style={{ width: '210mm', minHeight: '297mm', padding: '15mm', zoom: scale, display: 'flex', flexDirection: 'column' }}>
      {brand.enabled && <BrandHeader b={brand} />}
      <ClozeRenderer
        data={data}
        exerciseIndex={exerciseNumber}
        onSelectQuestion={selectQuestion}
        editablePassage={editable ? { onChange: (t) => commit({ ...data, passage: t }, 'passage') } : undefined}
      />
      {brand.enabled && (
        <div className="mt-auto pt-[8mm]"><BrandFooter b={brand} pageNumber={1} totalPages={1} /></div>
      )}
    </div>
  );

  const box = 'inline-flex items-center bg-white border border-slate-200 rounded-lg shadow-xs';
  const btn = 'w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-50 rounded-lg';
  const locked = activeTab === 'preview';

  const renderMoreSection = (key: ClozeMoreKey): React.ReactNode => {
    const s = data.settings;
    const row = 'flex items-center justify-between gap-3 text-[11.5px] text-slate-700';
    if (key === 'typography') {
      return (
        <div className="space-y-2.5">
          <label className={row}>Cỡ chữ đoạn văn
            <select value={s.passageFontSizePt} onChange={(e) => setSettings({ passageFontSizePt: Number(e.target.value) })} className={`${inputCls} !w-24 !py-1`}>
              {[...new Set([9, 9.5, 10, 10.5, 11, 12, 13, 14, s.passageFontSizePt])].sort((a, b) => a - b).map((n) => <option key={n} value={n}>{n} pt</option>)}
            </select>
          </label>
          <label className={row}>Cỡ chữ lựa chọn
            <select value={s.answerFontSizePt} onChange={(e) => setSettings({ answerFontSizePt: Number(e.target.value) })} className={`${inputCls} !w-24 !py-1`}>
              {[...new Set([9, 9.5, 10, 10.5, 11, 12, 13, 14, s.answerFontSizePt])].sort((a, b) => a - b).map((n) => <option key={n} value={n}>{n} pt</option>)}
            </select>
          </label>
          <label className={row}>Cỡ tiêu đề đoạn văn
            <select value={data.passageTitleTag} onChange={(e) => commit({ ...data, passageTitleTag: e.target.value as ClozeData['passageTitleTag'] })} className={`${inputCls} !w-24 !py-1`}>
              <option value="H1">H1</option><option value="H2">H2</option><option value="H3">H3</option>
            </select>
          </label>
        </div>
      );
    }
    if (key === 'image') {
      return (
        <div className="space-y-2.5">
          <label className={row}><span>Maintain aspect ratio</span><Switch checked={s.maintainAspect} onChange={(v) => setSettings({ maintainAspect: v })} label="Maintain aspect ratio" /></label>
          <label className={row}><span>Wrap text around image</span><Switch checked={s.wrapText} onChange={(v) => setSettings({ wrapText: v })} label="Wrap text around image" /></label>
          <label className={row}>Độ rộng ảnh
            <span className="flex items-center gap-2"><input type="range" min={15} max={50} step={5} value={s.imageWidthPercent} onChange={(e) => setSettings({ imageWidthPercent: Number(e.target.value) })} className="accent-blue-600" /><span className="font-mono w-10 text-right">{s.imageWidthPercent}%</span></span>
          </label>
        </div>
      );
    }
    return (
      <div className="space-y-2 text-[11.5px] text-slate-700">
        {([
          ['showExerciseTitle', 'Show exercise title'],
          ['showPassageTitle', 'Show passage title'],
          ['keepTogether', 'Keep questions together'],
          ['pageBreakBefore', 'Page break before exercise'],
          ['showPoints', 'Show points'],
        ] as const).map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={s[k]} onChange={(e) => setSettings({ [k]: e.target.checked } as Partial<ClozeData['settings']>)} className="rounded text-blue-600 focus:ring-0" />
            {label}
          </label>
        ))}
        {s.showPoints && (
          <label className={row}>Tổng điểm
            <input type="number" min={0} value={data.points ?? ''} placeholder="vd. 10" onChange={(e) => commit({ ...data, points: e.target.value === '' ? undefined : Number(e.target.value) }, 'points')} className={`${inputCls} !w-20 !py-1`} />
          </label>
        )}
        {fitMsg && <p className="text-[11px] text-slate-500">{fitMsg}</p>}
      </div>
    );
  };

  const secHead = (n: number, title: string, right?: React.ReactNode) => (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-blue-50/70 border border-blue-100 min-w-0">
      <span className="w-5 h-5 rounded-md bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">{n}</span>
      <h3 className="text-[13px] font-bold text-slate-900 truncate">{title}</h3>
      {right && <div className="ml-auto flex items-center gap-1.5 shrink-0">{right}</div>}
    </div>
  );
  const smallBtn = 'px-2.5 h-7 rounded-lg border border-blue-200 bg-white text-[11px] font-semibold text-blue-700 hover:bg-blue-50 flex items-center gap-1';

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-100 select-text">
      {slot && createPortal(
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-4 mr-3">
            <button type="button" onClick={handleBack} className="flex items-center gap-2 text-[13px] font-semibold text-slate-800 px-3.5 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
              <ArrowLeft size={16} /> Back to Lesson
            </button>
            <div className="leading-tight">
              <div className="text-[17px] font-bold text-[#16295f]">Edit Worksheet</div>
              <div className="text-[11.5px] text-slate-500">
                {folder.name || 'Unit 2 - London'} <span className="text-slate-300 mx-0.5">|</span> Worksheet: {folder.printSettings?.branding?.worksheetNo || 'WS-Cloze-4-1-1'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border ${dirty ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-emerald-700 bg-emerald-50 border-emerald-100'}`}>
              {dirty ? <AlertTriangle size={13} /> : <Check size={13} strokeWidth={2.5} />} {dirty ? 'Chưa lưu' : 'Saved'}
            </div>
            <div className="relative" ref={menuRef}>
              <button type="button" onClick={() => setMenuOpen((v) => !v)} className="w-9 h-9 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center justify-center" title="Tùy chọn xuất file">
                <MoreHorizontal size={16} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-60 bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 z-50 text-xs font-semibold text-slate-700">
                  <button type="button" onClick={handleExportDocx} className="w-full text-left px-3.5 py-2 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"><FileDown size={14} className="text-blue-600" /> Xuất Word (.doc)</button>
                  <button type="button" onClick={() => { setMenuOpen(false); window.print(); }} className="w-full text-left px-3.5 py-2 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"><Printer size={14} /> In / Xuất PDF (Chuẩn A4)</button>
                  <div className="h-px bg-slate-100 my-1" />
                  <button type="button" onClick={() => handleSave('stay')} className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2"><Check size={14} className="text-emerald-600" /> Lưu và ở lại</button>
                  <button type="button" onClick={() => handleSave('add_another')} className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2"><Plus size={14} className="text-blue-600" /> Lưu và thêm bài khác</button>
                  <button type="button" onClick={handleSaveCopy} className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2"><Copy size={14} className="text-slate-500" /> Lưu thành bản sao mới</button>
                  {editingExercise && onDeleteExercise && (
                    <>
                      <div className="h-px bg-slate-100 my-1" />
                      <button type="button" onClick={handleDelete} className="w-full text-left px-3.5 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2"><Trash2 size={14} /> Xóa bài này</button>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={undo} disabled={!past.length} title="Hoàn tác" className="w-9 h-9 flex items-center justify-center text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg disabled:opacity-35 disabled:cursor-not-allowed"><Undo2 size={16} /></button>
              <button type="button" onClick={redo} disabled={!future.length} title="Làm lại" className="w-9 h-9 flex items-center justify-center text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg disabled:opacity-35 disabled:cursor-not-allowed"><Redo2 size={16} /></button>
            </div>
            <button type="button" onClick={() => setIsFullscreen(true)} className="px-5 h-9 text-[13px] font-semibold text-[#16295f] bg-white border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center gap-2"><Eye size={16} /> Preview</button>
            <button type="button" onClick={() => handleSave('return')} className="px-7 h-9 text-[13px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2 shadow-sm transition-all"><Save size={16} /> Save</button>
          </div>
        </div>,
        slot,
      )}

      <ClozeToolbar
        data={data}
        onSettings={setSettings}
        onWrap={(marker) => applyEdit((t, s, e) => toggleWrap(t, s, e, marker))}
        onList={(kind) => applyEdit((t, s, e) => toggleListPrefix(t, s, e, kind))}
        onPassageSize={(d) => setSettings({ passageFontSizePt: Math.min(16, Math.max(8, Math.round((data.settings.passageFontSizePt + d) * 2) / 2)) })}
        onInsertBlank={handleInsertBlank}
        onAddQuestion={() => commit(insertBlank(data))}
        onSmartPaste={() => setShowSmartPaste(true)}
        onShuffle={() => toggleShuffle(true)}
        onAutoFit={startFit}
        fitting={fitting}
        onImageFile={(e) => { void onPickImage(e); }}
        onRemoveImage={() => setSettings({ imageUrl: undefined, imagePosition: 'none' })}
        onGenerateImage={() => { void generateImage(); }}
        generatingImage={imgGen.busy}
        onResetFormatting={resetFormatting}
        onInsertExercise={() => handleSave('return')}
        onDuplicate={handleSaveCopy}
        onDelete={onDeleteExercise && editingExercise ? handleDelete : undefined}
        layoutThumb={(id) => <LayoutThumbnail layout={id} className="w-full h-14" />}
        renderMoreSection={renderMoreSection}
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
            {secHead(1, 'Exercise Content', <span className="px-2.5 py-0.5 rounded-full bg-white border border-blue-200 text-[11px] font-bold text-blue-700">Exercise {exerciseNumber}</span>)}
            <div>
              <label className={labelCls}>Tiêu đề bài tập</label>
              <input type="text" value={data.exerciseTitle} onChange={(e) => commit({ ...data, exerciseTitle: e.target.value }, 'etitle')} className={`${inputCls} font-semibold`} />
            </div>
            <div>
              <label className={labelCls}>Tiêu đề đoạn văn (nếu có)</label>
              <input type="text" value={data.passageTitle} onChange={(e) => commit({ ...data, passageTitle: e.target.value }, 'ptitle')} placeholder="Ví dụ: WALL STREET" className={`${inputCls} font-semibold`} />
            </div>
          </section>

          <section className="shrink-0 bg-white/60 border border-slate-100 rounded-2xl p-4 shadow-xs space-y-2.5">
            {secHead(2, 'Passage Editor', (
              <>
                <button type="button" onClick={handleInsertBlank} className={smallBtn}><Plus size={12} /> Add Blank</button>
                <button type="button" onClick={() => setShowSmartPaste(true)} className={smallBtn}><ClipboardPaste size={12} /> Smart Paste</button>
              </>
            ))}
            <div className="flex gap-3">
              <textarea
                ref={textareaRef}
                rows={9}
                value={data.passage}
                onChange={(e) => commit({ ...data, passage: e.target.value }, 'passage')}
                placeholder={"Nhập hoặc dán đoạn văn. Bấm 'Add Blank' để tạo (1) ________, (2) ________..."}
                className="flex-1 min-w-0 p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-y"
              />
              <div className="w-28 shrink-0 space-y-2">
                <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={onPickImage} />
                {data.settings.imageUrl && data.settings.imagePosition !== 'none' ? (
                  <>
                    <img src={data.settings.imageUrl} alt="" className="w-full h-20 object-cover rounded-lg border border-slate-200 bg-white" />
                    <button type="button" onClick={() => imageInputRef.current?.click()} className="w-full py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg">Change Image</button>
                    <button type="button" onClick={() => setSettings({ imageUrl: undefined, imagePosition: 'none' })} className="w-full py-1 text-[11px] font-bold text-rose-600 border border-rose-200 hover:bg-rose-50 rounded-lg">Remove</button>
                  </>
                ) : (
                  <button type="button" onClick={() => imageInputRef.current?.click()} className="w-full h-20 border-2 border-dashed border-slate-300 rounded-lg text-[11px] font-semibold text-slate-500 hover:border-blue-400 hover:text-blue-600 flex flex-col items-center justify-center gap-1">
                    <ImagePlus size={16} /> Thêm ảnh
                  </button>
                )}
                <button type="button" onClick={() => { void generateImage(); }} disabled={imgGen.busy} className="w-full py-1 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-lg flex items-center justify-center gap-1"><Sparkles size={11} /> {data.settings.imageUrl ? 'Tạo lại AI' : 'Tạo ảnh AI'}</button>
              </div>
            </div>
            <textarea
              rows={2}
              value={imgPrompt}
              onChange={(e) => setImgPrompt(e.target.value)}
              placeholder="Prompt tạo ảnh AI (để trống: tự sinh từ tiêu đề và nội dung đoạn văn)"
              className="w-full p-2 border border-slate-200 rounded-lg text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            {imgGen.msg && <p className={`text-[11.5px] rounded-md px-2 py-1 border ${imgGen.busy ? 'text-blue-700 bg-blue-50 border-blue-100' : 'text-amber-700 bg-amber-50 border-amber-100'}`}>{imgGen.msg}</p>}
            <p className="text-[10.5px] text-slate-400">Chọn chữ rồi bấm B / I / U trên thanh công cụ để định dạng. Dấu được lưu dạng **đậm**, *nghiêng*, ++gạch chân++.</p>
            {orphans.length > 0 && (
              <div className="flex items-start gap-2 p-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                <span className="flex-1">{orphans.length} câu hỏi chưa có chỗ trống trong đoạn văn.</span>
                <button type="button" onClick={attachOrphans} className="font-bold underline">Gắn vào cuối đoạn</button>
              </div>
            )}
          </section>

          <section className="shrink-0 bg-white/60 border border-slate-100 rounded-2xl p-4 shadow-xs space-y-2.5">
            {secHead(3, `Questions & Options (${data.questions.length})`, (
              <>
                <label className="flex items-center gap-1.5 text-[11px] text-slate-600">Tự đánh số
                  <Switch checked={data.settings.autoNumberQuestions} onChange={(v) => setSettings({ autoNumberQuestions: v })} label="Tự động đánh số" />
                </label>
                <button type="button" onClick={() => commit(insertBlank(data))} className={smallBtn}><Plus size={12} /> Add Question</button>
              </>
            ))}
            {data.questions.length === 0 && (
              <div className="text-center py-4 text-xs text-slate-400 space-y-2">
                <p>Chưa có câu hỏi. Chèn chỗ trống vào đoạn văn, bấm “Add Question”, hoặc dùng Smart Paste.</p>
                <button type="button" onClick={loadSample} className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50">Nạp bài mẫu Wall Street</button>
              </div>
            )}
            <div className="space-y-2">
              {data.questions.map((q, qIdx) => (
                <div
                  key={q.id}
                  ref={(el) => { questionRefs.current[q.id] = el; }}
                  onDragOver={(e) => { if (dragIdx.current !== null) e.preventDefault(); }}
                  onDrop={() => { if (dragIdx.current !== null) { commit(reorderQuestions(data, dragIdx.current, qIdx)); dragIdx.current = null; } }}
                  className={`p-1.5 rounded-2xl flex items-center gap-1.5 border transition-colors ${selectedQuestionId === q.id ? 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-500/20' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                >
                  <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-800 font-extrabold text-sm flex items-center justify-center shrink-0">{q.number}</span>
                  <span
                    draggable
                    onDragStart={() => { dragIdx.current = qIdx; }}
                    onDragEnd={() => { dragIdx.current = null; }}
                    className="text-slate-300 hover:text-slate-600 cursor-grab shrink-0"
                    title="Kéo để đổi thứ tự (bộ lựa chọn chuyển sang chỗ trống có số tương ứng)"
                  >
                    <GripVertical size={14} />
                  </span>

                  <div className="flex-1 flex items-stretch min-w-0 border border-slate-200 rounded-xl overflow-hidden divide-x divide-slate-200 bg-white">
                    {q.options.map((opt, oi) => (
                      <div key={opt.id} className="group/opt flex-1 min-w-0 flex items-center gap-1 px-2 py-1.5 text-xs focus-within:bg-blue-50/50">
                        <span className="text-slate-400 font-semibold shrink-0">{opt.label}.</span>
                        <input
                          type="text"
                          value={opt.text}
                          onChange={(e) => patchQuestion(q.id, (qq) => ({ ...qq, options: qq.options.map((o, i) => (i === oi ? { ...o, text: e.target.value } : o)) }), `opt_${q.id}_${oi}`)}
                          placeholder="..."
                          className="w-full min-w-0 bg-transparent text-xs font-medium text-slate-800 focus:outline-none"
                        />
                        {q.options.length > 2 && (
                          <button type="button" onClick={() => patchQuestion(q.id, (qq) => removeOption(qq, oi))} className="hidden group-hover/opt:flex text-slate-300 hover:text-rose-500 p-0.5" title="Xóa lựa chọn này"><X size={10} /></button>
                        )}
                      </div>
                    ))}
                    {q.options.length < 4 && (
                      <button type="button" onClick={() => patchQuestion(q.id, addOption)} className="px-2 text-[11px] font-bold text-blue-600 hover:bg-blue-50" title="Thêm lựa chọn">
                        + {['a', 'b', 'c', 'd'][q.options.length]}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center shrink-0">
                    <button type="button" onClick={() => commit(duplicateQuestion(data, q.id))} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg" title="Nhân bản câu hỏi (thêm chỗ trống ở cuối đoạn văn)"><Copy size={14} /></button>
                    <button type="button" onClick={() => { if (window.confirm('Xóa câu hỏi này và chỗ trống tương ứng trong đoạn văn?')) commit(removeQuestion(data, q.id)); }} className="p-1.5 text-rose-400 hover:text-rose-600 rounded-lg" title="Xóa câu hỏi và chỗ trống"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
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
              {([['preview', 'Preview'], ['edit', 'Edit Mode']] as const).map(([id, label]) => (
                <button key={id} type="button" onClick={() => setActiveTab(id)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${activeTab === id ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>{label}</button>
              ))}
              {activeTab === 'edit' && <span className="hidden 2xl:inline ml-1 text-[11px] text-violet-700 bg-violet-50 border border-violet-100 rounded-md px-2 py-1">Sửa trực tiếp chữ đoạn văn trên trang A4 – giữ nguyên các chỗ trống (1) ________</span>}
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
              <button type="button" onClick={() => setIsFullscreen(true)} className={`${box} ${btn}`} title="Phóng to trang đang soạn"><Maximize2 size={14} /></button>
              <button type="button" onClick={() => { setZoom(100); setIsFullscreen(false); }} className={`${box} ${btn}`} title="Thu nhỏ về 100%"><Minimize size={14} /></button>
              <button type="button" onClick={() => window.print()} className={`${box} ${btn}`} title="In trang A4"><Printer size={15} /></button>
            </div>
          </div>
          <div ref={paneRef} className="flex-1 min-h-0 overflow-auto bg-slate-200/60 p-3 rounded-2xl shadow-inner">
            {renderA4(fitScale * (zoom / 100), activeTab === 'edit')}
          </div>
        </div>
      </main>

      {/* Bản đo ẩn để Auto fit to A4 */}
      {fitting && (
        <div ref={measureRef} aria-hidden="true" style={{ position: 'fixed', left: -99999, top: 0, width: '210mm', visibility: 'hidden', pointerEvents: 'none' }}>
          {renderA4(1)}
        </div>
      )}

      {/* ──────── XEM TRƯỚC PHÓNG TO ──────── */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 md:p-8" onClick={() => setIsFullscreen(false)}>
          <div className="bg-white rounded-3xl w-full max-w-5xl h-[92vh] flex flex-col shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="h-14 px-6 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3"><span className="text-sm font-bold text-slate-900">Xem trước A4</span><span className="text-xs text-slate-500">210 × 297 mm</span></div>
              <button type="button" onClick={() => setIsFullscreen(false)} className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100" aria-label="Đóng"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-auto bg-slate-200/70 p-6">{renderA4(1)}</div>
          </div>
        </div>
      )}

      {/* ──────── SMART PASTE ──────── */}
      {showSmartPaste && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={() => setShowSmartPaste(false)}>
          <div className="bg-white rounded-3xl w-full max-w-2xl p-6 shadow-2xl space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><ClipboardPaste size={16} className="text-blue-600" /> Smart Paste: nhập bài Cloze Test (không cần AI)</h3>
              <button type="button" onClick={() => setShowSmartPaste(false)} className="p-1 text-slate-400 hover:text-slate-700" aria-label="Đóng"><X size={16} /></button>
            </div>
            <p className="text-xs text-slate-500">Dán cả bài: tiêu đề, đoạn văn có chỗ trống (1) ________ và danh sách lựa chọn. Hệ thống tách sẵn để bạn kiểm tra trước khi áp dụng.</p>
            <textarea
              rows={11}
              value={pasteText}
              onChange={(e) => { setPasteText(e.target.value); setParsed(null); }}
              placeholder={`CIRCLE THE CORRECT WORDS TO COMPLETE THE TEXT.\n\nWALL STREET\nWall Street is a street (1) ________ New York City's financial district...\n\n1. a. at b. in c. on\n2. a. its b. it's c. their`}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            {parsed && (
              <div className={`rounded-xl border p-3 text-xs space-y-1 ${parsed.warnings.length ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
                <div className="font-bold">Nhận diện: {parsed.blankCount} chỗ trống · {parsed.questionCount} câu hỏi{parsed.data.passageTitle ? ` · Tiêu đề đoạn: “${parsed.data.passageTitle}”` : ''}</div>
                {parsed.warnings.map((w, i) => <div key={i} className="flex gap-1.5"><AlertTriangle size={12} className="mt-0.5 shrink-0" />{w}</div>)}
              </div>
            )}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-400">Hỗ trợ “1. a. … b. … c. …” hoặc mỗi lựa chọn một dòng.</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setShowSmartPaste(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">Hủy</button>
                <button type="button" onClick={runParse} disabled={!pasteText.trim()} className="px-4 py-2 text-xs font-bold text-white bg-slate-900 disabled:opacity-40 rounded-xl">Phân tích</button>
                <button type="button" onClick={applyParsed} disabled={!parsed || (!parsed.data.passage && !parsed.questionCount)} className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-xl">Áp dụng</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
