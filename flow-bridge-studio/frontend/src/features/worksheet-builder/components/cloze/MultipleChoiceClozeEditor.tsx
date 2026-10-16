import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, Check, Plus, Trash2, Copy, ImagePlus, X, ClipboardPaste, GripVertical,
  Maximize2, Minus, Eye, Sliders, ChevronDown, ChevronUp, Upload, Image as ImageIcon, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Bold, Italic, Underline, List, ListOrdered, MoreHorizontal, FileDown, Undo2, Redo2, AlertTriangle,
} from 'lucide-react';
import type { LessonFolder, Exercise, Worksheet } from '../../types';
import type { ClozeData, ClozeLayoutId, ClozeQuestion } from '../../services/cloze/clozeCore';
import {
  createCloze, createSampleCloze, insertBlank, removeQuestion, duplicateQuestion, reorderQuestions,
  parseClozeSmartPaste, CLOZE_LAYOUTS, orphanQuestionIds, syncBlanks, addOption, removeOption,
  shuffleOptionOrder, toggleWrap, toggleListPrefix, DEFAULT_CLOZE_SETTINGS,
} from '../../services/cloze/clozeCore';
import type { ClozeParseResult } from '../../services/cloze/clozeCore';
import { ClozeRenderer } from './ClozeRenderer';
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

// ── Mini SVG Preview Diagram for Image Positions ──
const ImagePositionDiagram: React.FC<{ pos: 'right' | 'left' | 'top' | 'none'; selected?: boolean }> = ({ pos, selected }) => {
  const accent = selected ? 'bg-blue-600' : 'bg-slate-400';
  const border = selected ? 'border-blue-400' : 'border-slate-200';

  switch (pos) {
    case 'right':
      return (
        <div className={`w-8 h-6 border ${border} rounded bg-white p-0.5 flex gap-1 items-center justify-between mx-auto mb-1`}>
          <div className="flex-1 space-y-0.5">
            <div className="h-0.5 bg-slate-300 w-full rounded-xs" />
            <div className="h-0.5 bg-slate-300 w-full rounded-xs" />
            <div className="h-0.5 bg-slate-300 w-2/3 rounded-xs" />
          </div>
          <div className={`w-2.5 h-4 ${accent} rounded-xs shrink-0`} />
        </div>
      );
    case 'left':
      return (
        <div className={`w-8 h-6 border ${border} rounded bg-white p-0.5 flex gap-1 items-center justify-between mx-auto mb-1`}>
          <div className={`w-2.5 h-4 ${accent} rounded-xs shrink-0`} />
          <div className="flex-1 space-y-0.5">
            <div className="h-0.5 bg-slate-300 w-full rounded-xs" />
            <div className="h-0.5 bg-slate-300 w-full rounded-xs" />
            <div className="h-0.5 bg-slate-300 w-2/3 rounded-xs" />
          </div>
        </div>
      );
    case 'top':
      return (
        <div className={`w-8 h-6 border ${border} rounded bg-white p-0.5 flex flex-col justify-between mx-auto mb-1`}>
          <div className={`w-full h-2 ${accent} rounded-xs`} />
          <div className="space-y-0.5">
            <div className="h-0.5 bg-slate-300 w-full rounded-xs" />
            <div className="h-0.5 bg-slate-300 w-2/3 rounded-xs" />
          </div>
        </div>
      );
    case 'none':
      return (
        <div className={`w-8 h-6 border border-dashed ${border} rounded bg-white flex items-center justify-center mx-auto mb-1`}>
          <div className="w-3.5 h-0.5 bg-slate-300 -rotate-45" />
        </div>
      );
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

function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1.5">
      {options.map((o) => (
        <button
          key={String(o.id)}
          type="button"
          onClick={() => onChange(o.id)}
          className={`flex-1 py-1.5 rounded-lg border text-[11px] font-semibold ${value === o.id ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const StepHead: React.FC<{ n: number; title: string; open?: boolean; onToggle?: () => void }> = ({ n, title, open, onToggle }) => (
  <div className="flex items-center justify-between">
    <h4 className="text-[13px] font-bold text-slate-900"><span className="text-blue-600 mr-1">{n}.</span>{title}</h4>
    {onToggle && (
      <button type="button" onClick={onToggle} className="p-0.5 text-slate-400 hover:text-slate-700" aria-expanded={open} aria-label={open ? 'Thu gọn' : 'Mở rộng'}>
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
    )}
  </div>
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
  const [activeTab, setActiveTab] = useState<'preview' | 'edit'>('preview');
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSmartPaste, setShowSmartPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [parsed, setParsed] = useState<ClozeParseResult | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openSec, setOpenSec] = useState({ layout: true, image: true, answer: true, type: true, adv: true });
  const [fitting, setFitting] = useState(false);
  const [fitMsg, setFitMsg] = useState<string | null>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const dragIdx = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const menuRef = useRef<HTMLDivElement>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => { setSlot(document.getElementById('app-header-actions')); }, []);

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
    <div className="bg-white text-[#111] shadow-xl mx-auto" style={{ width: '210mm', minHeight: '297mm', padding: '15mm', zoom: scale }}>
      {brand.enabled && <BrandHeader b={brand} />}
      <ClozeRenderer
        data={data}
        exerciseIndex={exerciseNumber}
        onSelectQuestion={selectQuestion}
        editablePassage={editable ? { onChange: (t) => commit({ ...data, passage: t }, 'passage') } : undefined}
      />
      {brand.enabled && (
        <div className="mt-[8mm]"><BrandFooter b={brand} pageNumber={1} totalPages={1} /></div>
      )}
    </div>
  );

  const tbBtn = 'p-1.5 rounded-md hover:bg-slate-200 text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent';

  const actions = (
    <>
      <button type="button" onClick={handleBack} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg hover:bg-slate-100">
        <ArrowLeft size={15} /> Back
      </button>
      <div className="flex items-center gap-2">
        <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${dirty ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-emerald-600 bg-emerald-50 border-emerald-100'}`}>
          {dirty ? <AlertTriangle size={12} /> : <Check size={13} strokeWidth={2.5} />}
          {dirty ? 'Chưa lưu' : 'Đã lưu'}
        </div>

        <div className="relative" ref={menuRef}>
          <button type="button" onClick={() => setMenuOpen((v) => !v)} className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl" aria-label="Thêm tùy chọn">
            <MoreHorizontal size={16} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-60 bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 z-50 text-xs font-semibold text-slate-700">
              <button type="button" onClick={handleExportDocx} className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2"><FileDown size={14} className="text-blue-600" /> Xuất Word (.doc)</button>
              <button type="button" onClick={() => handleSave('stay')} className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2"><Check size={14} className="text-emerald-600" /> Lưu và ở lại</button>
              <button type="button" onClick={() => handleSave('add_another')} className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2"><Plus size={14} className="text-blue-600" /> Lưu và thêm bài khác</button>
              <button type="button" onClick={handleSaveCopy} className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2"><Copy size={14} className="text-slate-500" /> Lưu thành bản sao mới</button>
              {editingExercise && onDeleteExercise && (
                <>
                  <div className="h-px bg-slate-100 my-1" />
                  <button type="button" onClick={handleDelete} className="w-full text-left px-3.5 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2"><Trash2 size={14} /> Xóa bài này</button>
                </>
              )}
              <div className="px-3.5 pt-1.5 pb-1 text-[10.5px] font-normal text-slate-400">In / xuất PDF: lưu bài rồi mở Preview &amp; Export.</div>
            </div>
          )}
        </div>

        <button type="button" onClick={() => setIsFullscreen(true)} className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl flex items-center gap-1.5">
          <Eye size={14} /> Preview
        </button>
        <button type="button" onClick={() => handleSave('return')} className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center gap-1.5 shadow-sm">
          <Check size={14} strokeWidth={2.5} /> Save
        </button>
      </div>
    </>
  );

  return (
    <div className="flex flex-col min-h-screen bg-slate-100/70 select-text">
      {slot ? createPortal(<>{actions}</>, slot) : <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-end gap-2">{actions}</header>}

      <main className="flex-1 p-4 md:p-6 grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* ═══════ CỘT TRÁI: NỘI DUNG ═══════ */}
        <div className="xl:col-span-4 min-w-0 flex flex-col gap-4 xl:sticky xl:top-4 xl:h-[calc(100vh-5.5rem)] xl:overflow-y-auto xl:pr-1">
          <section className="shrink-0 bg-white border border-slate-200 rounded-3xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between -mx-1 px-3 py-2 rounded-2xl bg-blue-50/70 border border-blue-100">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center">1</span>
                <h3 className="text-sm font-bold text-slate-900">Bài tập: Multiple Choice Cloze Test</h3>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={handleSaveCopy} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg" title="Lưu thành bản sao mới"><Copy size={15} /></button>
                {editingExercise && onDeleteExercise && (
                  <button type="button" onClick={handleDelete} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg" title="Xóa bài này"><Trash2 size={15} /></button>
                )}
              </div>
            </div>

            <div>
              <label className={labelCls}>Tiêu đề bài tập</label>
              <input type="text" value={data.exerciseTitle} onChange={(e) => commit({ ...data, exerciseTitle: e.target.value }, 'etitle')} className={`${inputCls} font-semibold`} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-600">Tiêu đề đoạn văn (nếu có)</label>
                <select value={data.passageTitleTag} onChange={(e) => commit({ ...data, passageTitleTag: e.target.value as ClozeData['passageTitleTag'] })} className="px-2 py-0.5 text-[11px] font-bold bg-slate-100 border border-slate-200 rounded text-slate-700" title="Cỡ tiêu đề đoạn văn">
                  <option value="H1">H1</option><option value="H2">H2</option><option value="H3">H3</option>
                </select>
              </div>
              <input type="text" value={data.passageTitle} onChange={(e) => commit({ ...data, passageTitle: e.target.value }, 'ptitle')} placeholder="Ví dụ: WALL STREET" className={`${inputCls} font-semibold`} />
            </div>

            <div>
              <label className={labelCls}>Nội dung đoạn văn</label>
              <div className="flex flex-wrap items-center gap-0.5 p-1 bg-slate-50 border border-slate-200 border-b-0 rounded-t-xl">
                <button type="button" className={tbBtn} title="In đậm (**chữ**)" onClick={() => applyEdit((t, s, e) => toggleWrap(t, s, e, '**'))}><Bold size={14} /></button>
                <button type="button" className={tbBtn} title="In nghiêng (*chữ*)" onClick={() => applyEdit((t, s, e) => toggleWrap(t, s, e, '*'))}><Italic size={14} /></button>
                <button type="button" className={tbBtn} title="Gạch chân (++chữ++)" onClick={() => applyEdit((t, s, e) => toggleWrap(t, s, e, '++'))}><Underline size={14} /></button>
                <span className="w-px h-4 bg-slate-200 mx-0.5" />
                <button type="button" className={tbBtn} title="Gạch đầu dòng" onClick={() => applyEdit((t, s, e) => toggleListPrefix(t, s, e, 'bullet'))}><List size={14} /></button>
                <button type="button" className={tbBtn} title="Đánh số dòng" onClick={() => applyEdit((t, s, e) => toggleListPrefix(t, s, e, 'numbered'))}><ListOrdered size={14} /></button>
                <span className="w-px h-4 bg-slate-200 mx-0.5" />
                {([['left', AlignLeft, 'Căn trái'], ['center', AlignCenter, 'Căn giữa'], ['right', AlignRight, 'Căn phải'], ['justify', AlignJustify, 'Căn đều']] as const).map(([id, Icon, label]) => (
                  <button key={id} type="button" title={label} onClick={() => setSettings({ passageAlign: id })} className={`${tbBtn} ${data.settings.passageAlign === id ? 'bg-blue-100 text-blue-700' : ''}`}><Icon size={14} /></button>
                ))}
                <span className="w-px h-4 bg-slate-200 mx-0.5" />
                <button type="button" className={tbBtn} title="Thêm / đổi ảnh minh họa" onClick={() => imageInputRef.current?.click()}><ImagePlus size={14} /></button>
                <button type="button" className={tbBtn} title="Hoàn tác (Ctrl+Z)" disabled={!past.length} onClick={undo}><Undo2 size={14} /></button>
                <button type="button" className={tbBtn} title="Làm lại (Ctrl+Y)" disabled={!future.length} onClick={redo}><Redo2 size={14} /></button>
                <button type="button" onClick={handleInsertBlank} className="ml-auto px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1" title="Chèn chỗ trống tại con trỏ; các chỗ trống tự đánh số lại theo thứ tự">
                  <Plus size={12} strokeWidth={3} /> Chèn chỗ trống
                </button>
              </div>
              <div className="flex gap-3">
                <textarea
                  ref={textareaRef}
                  rows={8}
                  value={data.passage}
                  onChange={(e) => commit({ ...data, passage: e.target.value }, 'passage')}
                  placeholder={"Nhập hoặc dán đoạn văn. Bấm 'Chèn chỗ trống' để tạo (1) ________, (2) ________..."}
                  className="flex-1 min-w-0 p-3 bg-white border border-slate-200 rounded-b-xl text-xs text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-y"
                />
                <div className="w-28 shrink-0 space-y-2">
                  <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={onPickImage} />
                  {data.settings.imageUrl && data.settings.imagePosition !== 'none' ? (
                    <>
                      <img src={data.settings.imageUrl} alt="" className="w-full h-20 object-cover rounded-lg border border-slate-200 bg-white" />
                      <button type="button" onClick={() => imageInputRef.current?.click()} className="w-full py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg">Change Image</button>
                      <button type="button" onClick={() => setSettings({ imageUrl: undefined, imagePosition: 'none' })} className="w-full py-1 text-[11px] font-bold text-rose-600 border border-rose-200 hover:bg-rose-50 rounded-lg">Remove</button>
                      <div>
                        <span className="text-[10px] font-semibold text-slate-500">Vị trí ảnh</span>
                        <select value={data.settings.imagePosition} onChange={(e) => setSettings({ imagePosition: e.target.value as ClozeData['settings']['imagePosition'] })} className="w-full px-1.5 py-1 text-[11px] bg-slate-50 border border-slate-200 rounded-lg">
                          <option value="right">Bên phải</option><option value="left">Bên trái</option><option value="top">Phía trên</option>
                        </select>
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-slate-500">Chiều rộng ảnh</span>
                        <select value={data.settings.imageWidthPercent} onChange={(e) => setSettings({ imageWidthPercent: Number(e.target.value) })} className="w-full px-1.5 py-1 text-[11px] bg-slate-50 border border-slate-200 rounded-lg">
                          {[15, 20, 25, 30, 35, 40, 45, 50].map((p) => <option key={p} value={p}>{p}%</option>)}
                        </select>
                      </div>
                    </>
                  ) : (
                    <button type="button" onClick={() => imageInputRef.current?.click()} className="w-full h-20 border-2 border-dashed border-slate-300 rounded-lg text-[11px] font-semibold text-slate-500 hover:border-blue-400 hover:text-blue-600 flex flex-col items-center justify-center gap-1">
                      <ImagePlus size={16} /> Thêm ảnh
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-1.5 text-[10.5px] text-slate-400">Chọn chữ rồi bấm B / I / U để định dạng. Dấu được lưu dạng **đậm**, *nghiêng*, ++gạch chân++.</p>
              {orphans.length > 0 && (
                <div className="mt-2 flex items-start gap-2 p-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span className="flex-1">{orphans.length} câu hỏi chưa có chỗ trống trong đoạn văn.</span>
                  <button type="button" onClick={attachOrphans} className="font-bold underline">Gắn vào cuối đoạn</button>
                </div>
              )}
            </div>
          </section>

          <section className="flex flex-col gap-3 min-h-[320px] xl:flex-1 xl:min-h-0 bg-white border border-slate-200 rounded-3xl p-4 shadow-xs">
            <div className="shrink-0 flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Câu hỏi và lựa chọn ({data.questions.length})</h3>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  Tự động đánh số
                  <Switch checked={data.settings.autoNumberQuestions} onChange={(v) => setSettings({ autoNumberQuestions: v })} label="Tự động đánh số" />
                </label>
                <button type="button" onClick={() => setShowSmartPaste(true)} className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center gap-1">
                  <ClipboardPaste size={13} /> Smart Paste
                </button>
              </div>
            </div>

            {data.questions.length === 0 && (
              <div className="shrink-0 text-center py-6 text-xs text-slate-400 space-y-2">
                <p>Chưa có câu hỏi. Chèn chỗ trống vào đoạn văn, bấm “Thêm câu hỏi”, hoặc dùng Smart Paste.</p>
                <button type="button" onClick={loadSample} className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50">Nạp bài mẫu Wall Street</button>
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 max-h-[460px] xl:max-h-none">
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

            <button type="button" onClick={() => commit(insertBlank(data))} className="shrink-0 w-full py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5">
              <Plus size={15} strokeWidth={2.5} /> Thêm câu hỏi
            </button>
          </section>
        </div>

        {/* ═══════ CỘT GIỮA: XEM TRƯỚC A4 ═══════ */}
        <div className="xl:col-span-5 space-y-3 min-w-0 xl:sticky xl:top-4 self-start">
          <div className="bg-white border border-slate-200 rounded-2xl p-1.5 flex items-center justify-between">
            <div className="flex items-center gap-1">
              {([['preview', 'Preview'], ['edit', 'Edit Mode']] as const).map(([id, label]) => (
                <button key={id} type="button" onClick={() => setActiveTab(id)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${activeTab === id ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>{label}</button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={undo} disabled={!past.length} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30" title="Undo"><Undo2 size={15} /></button>
              <button type="button" onClick={redo} disabled={!future.length} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30" title="Redo"><Redo2 size={15} /></button>
              <button type="button" onClick={() => setIsFullscreen(true)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100" title="Phóng to"><Maximize2 size={15} /></button>
            </div>
          </div>
          {activeTab === 'edit' && (
            <p className="text-[11px] text-violet-700 bg-violet-50 border border-violet-200 rounded-xl px-3 py-1.5">Edit Mode: sửa trực tiếp chữ của đoạn văn trên trang A4 (bấm ra ngoài để lưu). Giữ nguyên các chỗ trống dạng (1) ________.</p>
          )}
          <div className="overflow-auto bg-slate-200/60 p-3 rounded-3xl shadow-inner h-[calc(100vh-14rem)]">
            {renderA4((zoom / 100) * 0.7, activeTab === 'edit')}
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-slate-600">
            <button type="button" onClick={() => setZoom((z) => Math.max(50, z - 10))} className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50" aria-label="Thu nhỏ"><Minus size={13} /></button>
            <span className="font-mono w-12 text-center">{zoom}%</span>
            <button type="button" onClick={() => setZoom((z) => Math.min(150, z + 10))} className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50" aria-label="Phóng to"><Plus size={13} /></button>
            <button type="button" onClick={() => setZoom(100)} className="text-[11px] text-slate-400 hover:text-slate-700 px-1">Reset</button>
          </div>
        </div>

        {/* ═══════ CỘT PHẢI: LAYOUT & FORMATTING ═══════ */}
        <div className="xl:col-span-3 min-w-0 xl:sticky xl:top-4 xl:max-h-[calc(100vh-5.5rem)] overflow-y-auto bg-white border border-slate-200 rounded-3xl shadow-xs p-4 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Sliders size={16} className="text-blue-600" /> Layout &amp; Formatting</h3>

          {/* 1. Kiểu bố cục */}
          <section className="space-y-2">
            <StepHead n={1} title="Choose Worksheet Layout" open={openSec.layout} onToggle={() => setOpenSec((o) => ({ ...o, layout: !o.layout }))} />
            {openSec.layout && <div className="grid grid-cols-3 gap-2">
              {CLOZE_LAYOUTS.map((l, i) => {
                const on = data.settings.layout === l.id;
                return (
                  <button key={l.id} type="button" title={l.desc} onClick={() => setSettings({ layout: l.id })} aria-pressed={on} className={`relative rounded-xl border p-1.5 text-center ${on ? 'border-blue-500 ring-2 ring-blue-500/15 bg-blue-50/40' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                    {on && <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center"><Check size={10} strokeWidth={3} /></span>}
                    <div className="flex justify-center mb-1"><LayoutThumbnail layout={l.id} className="w-full h-11" /></div>
                    <div className="text-[10px] font-semibold text-slate-700 leading-tight">{i + 1}. {l.label.replace(/^Kiểu \d+: /, '')}</div>
                  </button>
                );
              })}
            </div>}
          </section>

          {/* 2. Ảnh */}
          <section className="space-y-2.5 pt-3 border-t border-slate-100">
            <StepHead n={2} title="Image Settings" open={openSec.image} onToggle={() => setOpenSec((o) => ({ ...o, image: !o.image }))} />
            {openSec.image && (<>
            <div className="flex items-center gap-2.5">
              <div className="w-20 h-14 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
                {data.settings.imageUrl ? <img src={data.settings.imageUrl} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={18} className="text-slate-300" />}
              </div>
              <button type="button" onClick={() => imageInputRef.current?.click()} className="flex-1 py-2 text-[11px] font-bold text-blue-700 border border-blue-300 hover:bg-blue-50 rounded-lg flex items-center justify-center gap-1"><Upload size={12} /> Upload / Replace</button>
              <button type="button" onClick={() => setSettings({ imageUrl: undefined, imagePosition: 'none' })} disabled={!data.settings.imageUrl} className="flex-1 py-2 text-[11px] font-bold text-rose-600 border border-rose-200 hover:bg-rose-50 disabled:opacity-40 rounded-lg flex items-center justify-center gap-1"><Trash2 size={12} /> Remove</button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-slate-700 w-12 shrink-0">Position</span>
              <div className="flex-1 grid grid-cols-4 gap-1.5">
                {([['right', 'Bên phải'], ['left', 'Bên trái'], ['top', 'Phía trên'], ['none', 'Không có']] as const).map(([id, label]) => {
                  const on = data.settings.imagePosition === id;
                  return (
                    <button key={id} type="button" title={label} onClick={() => setSettings({ imagePosition: id })} className={`py-1.5 rounded-lg border flex items-center justify-center ${on ? 'bg-blue-50 border-blue-500' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                      <ImagePositionDiagram pos={id} selected={on} />
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-slate-700 w-12 shrink-0">Width</span>
              <input type="range" min={15} max={50} step={5} value={data.settings.imageWidthPercent} onChange={(e) => setSettings({ imageWidthPercent: Number(e.target.value) })} className="flex-1 accent-blue-600" />
              <span className="font-mono text-[11px] font-bold text-slate-700 w-9 text-right">{data.settings.imageWidthPercent}%</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-700">
              <label className="flex items-center gap-2"><Switch checked={data.settings.maintainAspect} onChange={(v) => setSettings({ maintainAspect: v })} label="Maintain aspect ratio" /> Maintain aspect ratio</label>
              <label className="flex items-center gap-2"><Switch checked={data.settings.wrapText} onChange={(v) => setSettings({ wrapText: v })} label="Wrap text around image" /> Wrap text around image</label>
            </div>
            </>)}
          </section>

          {/* 3. Lựa chọn */}
          <section className="space-y-2.5 pt-3 border-t border-slate-100">
            <StepHead n={3} title="Answer Layout" open={openSec.answer} onToggle={() => setOpenSec((o) => ({ ...o, answer: !o.answer }))} />
            {openSec.answer && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-slate-700 w-16 shrink-0">Columns</span>
                  <div className="flex-1"><Seg value={data.settings.answerColumns} onChange={(v) => setSettings({ answerColumns: v as 1 | 2 | 3 | 4 })} options={[{ id: 1, label: '1' }, { id: 2, label: '2' }, { id: 3, label: '3' }, { id: 4, label: '4' }]} /></div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-slate-700 w-16 shrink-0">Label style</span>
                  <div className="flex-1"><Seg value={data.settings.optionLabelStyle} onChange={(v) => setSettings({ optionLabelStyle: v })} options={[{ id: 'lowercase', label: 'a. b. c.' }, { id: 'uppercase', label: 'A. B. C.' }, { id: 'numeric', label: '1. 2. 3.' }]} /></div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-700">Show question numbers <Switch checked={data.settings.autoNumberQuestions} onChange={(v) => setSettings({ autoNumberQuestions: v })} label="Show question numbers" /></div>
                <div className="flex items-center justify-between text-[11px] text-slate-700">Shuffle options <Switch checked={data.settings.shuffleOptions} onChange={toggleShuffle} label="Shuffle options" /></div>
              </>
            )}
          </section>

          {/* 4. Chữ */}
          <section className="space-y-2.5 pt-3 border-t border-slate-100">
            <StepHead n={4} title="Typography" open={openSec.type} onToggle={() => setOpenSec((o) => ({ ...o, type: !o.type }))} />
            {openSec.type && (
              <div className="space-y-2">
                <div className="grid grid-cols-4 gap-1.5">
                  <div>
                    <span className="text-[10px] font-medium text-slate-500 block mb-0.5">Font family</span>
                    <select value={data.settings.fontFamily} onChange={(e) => setSettings({ fontFamily: e.target.value })} className={`${inputCls} !px-1.5`}>
                      {['Arial', 'Times New Roman', 'Quicksand', 'Roboto', 'Inter'].map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <span className="text-[10px] font-medium text-slate-500 block mb-0.5">Passage font size</span>
                    <select value={data.settings.passageFontSizePt} onChange={(e) => setSettings({ passageFontSizePt: Number(e.target.value) })} className={`${inputCls} !px-1.5`}>
                      {[...new Set([9, 9.5, 10, 10.5, 11, 12, 13, 14, data.settings.passageFontSizePt])].sort((a, b) => a - b).map((n) => <option key={n} value={n}>{n} pt</option>)}
                    </select>
                  </div>
                  <div>
                    <span className="text-[10px] font-medium text-slate-500 block mb-0.5">Answer font size</span>
                    <select value={data.settings.answerFontSizePt} onChange={(e) => setSettings({ answerFontSizePt: Number(e.target.value) })} className={`${inputCls} !px-1.5`}>
                      {[...new Set([9, 9.5, 10, 10.5, 11, 12, 13, 14, data.settings.answerFontSizePt])].sort((a, b) => a - b).map((n) => <option key={n} value={n}>{n} pt</option>)}
                    </select>
                  </div>
                  <div>
                    <span className="text-[10px] font-medium text-slate-500 block mb-0.5">Line height</span>
                    <select value={data.settings.lineHeight} onChange={(e) => setSettings({ lineHeight: Number(e.target.value) })} className={`${inputCls} !px-1.5`}>
                      {[...new Set([1.2, 1.3, 1.4, 1.5, 1.6, 1.75, 2, data.settings.lineHeight])].sort((a, b) => a - b).map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>
                <div className="w-1/2">
                  <span className="text-[10px] font-medium text-slate-500 block mb-0.5">Paragraph spacing</span>
                  <select value={data.settings.paragraphSpacing} onChange={(e) => setSettings({ paragraphSpacing: e.target.value as ClozeData['settings']['paragraphSpacing'] })} className={inputCls}>
                    <option value="compact">Compact</option><option value="normal">Normal</option><option value="spacious">Spacious</option>
                  </select>
                </div>
              </div>
            )}
          </section>

          {/* 5. Nâng cao */}
          <section className="space-y-2.5 pt-3 border-t border-slate-100">
            <StepHead n={5} title="Advanced Settings" open={openSec.adv} onToggle={() => setOpenSec((o) => ({ ...o, adv: !o.adv }))} />
            {openSec.adv && (<>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] text-slate-700">
              {([
                ['showExerciseTitle', 'Show exercise title'],
                ['keepTogether', 'Keep questions together'],
                ['showPassageTitle', 'Show passage title'],
                ['pageBreakBefore', 'Page break before exercise'],
                ['autoNumberQuestions', 'Auto number questions'],
                ['showPoints', 'Show points'],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={data.settings[key]} onChange={(e) => setSettings({ [key]: e.target.checked } as Partial<ClozeData['settings']>)} />
                  {label}
                </label>
              ))}
            </div>
            {data.settings.showPoints && (
              <div className="flex items-center gap-2 text-[11px] text-slate-700">
                Tổng điểm
                <input type="number" min={0} value={data.points ?? ''} placeholder="vd. 10" onChange={(e) => commit({ ...data, points: e.target.value === '' ? undefined : Number(e.target.value) }, 'points')} className={`${inputCls} !w-20 !py-1`} />
              </div>
            )}
            <button type="button" onClick={resetFormatting} className="w-full py-2 text-xs font-semibold text-blue-700 border border-blue-300 hover:bg-blue-50 rounded-xl">Reset formatting</button>
            <button type="button" onClick={startFit} disabled={fitting || !data.questions.length} className="w-full py-2 text-xs font-semibold text-blue-700 border border-blue-300 hover:bg-blue-50 disabled:opacity-50 rounded-xl">{fitting ? 'Đang thu nhỏ…' : 'Auto fit to A4'}</button>
            {fitMsg && <p className="text-[11px] text-slate-500">{fitMsg}</p>}
            </>)}
          </section>
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
