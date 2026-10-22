import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AiRewriteBox } from '../shared/AiRewriteBox';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, Check, Copy, Eye, FileDown, GripVertical, Maximize2, Minimize, Minus, Plus, Printer, X,
  MoreHorizontal, RotateCcw, RotateCw, Save, Trash2, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, HelpCircle, ChevronDown,
} from 'lucide-react';
import { PageZoomOverlay } from '../shared/PageZoomOverlay';
import type { Exercise, LessonFolder, Worksheet } from '../../types';
import {
  bumpHeadingSize, createMatchingHeadings, ideaLabel, moveHeadingItem, newHeadingId, parseHeadingsText, setHeadingStyle,
  shuffleHeadingItems, validateHeadings,
  type MatchingHeadingsData, type HeadingItem, type HeadingStyleKey,
} from '../../services/matching-headings/matchingHeadingsCore';
import { MatchingHeadingsRenderer } from './MatchingHeadingsRenderer';
import { MatchingHeadingsToolbar, type HeadingsMoreKey } from './MatchingHeadingsToolbar';
import { WorksheetRenderer } from '../preview/WorksheetRenderer';
import { BrandHeader } from '../preview/BrandHeader';
import { BrandFooter } from '../preview/BrandFooter';
import { useAiImage } from '../../services/ai/useAiImage';
import { ImageManagerBody } from '../shared/ImageManagerBody';
import { PHOTO_STYLE } from '../../services/matching/autoMatching';
import { resolveBranding, fileToSmallDataUrl } from '../../types/branding';
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

const smallBtn = 'px-2.5 h-7 rounded-lg border border-blue-200 bg-white text-[11px] font-semibold text-blue-700 hover:bg-blue-50 flex items-center gap-1';

type ModalMode = 'smart' | 'ideas' | 'paragraphs';
const MODAL_INFO: Record<ModalMode, { title: string; hint: string; placeholder: string }> = {
  smart: {
    title: 'Smart Paste – dán cả bài',
    hint: 'Dán tiêu đề, các đoạn văn (cách nhau bằng dòng trống) rồi danh sách “1. Paragraph 1  a. ý chính …”. Hệ thống tự tách bài đọc và các ý chính.',
    placeholder: 'MATCH EACH PARAGRAPH WITH ITS MAIN IDEA\nHAVING A SAY ABOUT YOUR CITY\nUrban activist … (đoạn 1)\n\nCities are growing … (đoạn 2)\n\n1. Paragraph 1  a. People are becoming disconnected from their cities.\n2. Paragraph 2  b. As cities grow, there are fewer close communities.',
  },
  ideas: {
    title: 'Import – danh sách ý chính',
    hint: 'Mỗi dòng một ý chính (chữ a., b. đầu dòng sẽ được bỏ).',
    placeholder: 'People are becoming disconnected from their cities.\nAs cities grow, there are fewer close communities.',
  },
  paragraphs: {
    title: 'Import – các đoạn văn',
    hint: 'Mỗi đoạn cách nhau bằng một dòng trống (nếu không có dòng trống, mỗi dòng là một đoạn).',
    placeholder: 'Urban activist Alessandra Orofino home city of Rio …\n\nCities are growing because of all the benefits …',
  },
};

const linesOf = (raw: string): string[] =>
  raw.replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/^\s*(?:\d{1,3}\s*[.)]|[a-zA-Z]\s*[.)]|[•*-])\s*/, '').trim()).filter(Boolean);

export const MatchingHeadingsEditor: React.FC<Props> = ({ folder, editingExercise, onSaveExercise, onCancel, onDeleteExercise }) => {
  const [data, setDataRaw] = useState<MatchingHeadingsData>(() =>
    editingExercise?.matchingHeadings
      ? createMatchingHeadings(editingExercise.matchingHeadings)
      : createMatchingHeadings({ exerciseTitle: editingExercise?.title || undefined, instruction: editingExercise?.instructions || undefined }),
  );
  const exerciseIdRef = useRef(editingExercise?.id || `ex_matching_headings_${Date.now()}`);
  const savedIdx = folder.exercises.findIndex((e) => e.id === exerciseIdRef.current);
  const exerciseNumber = savedIdx >= 0 ? savedIdx + 1 : folder.exercises.length + 1;
  const brand = resolveBranding(folder.printSettings.branding);

  // ── Undo / Redo (gộp các thay đổi liên tiếp trong 500ms)
  const dataRef = useRef(data);
  const pastRef = useRef<MatchingHeadingsData[]>([]);
  const futureRef = useRef<MatchingHeadingsData[]>([]);
  const lastPushRef = useRef(0);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const setData = (next: React.SetStateAction<MatchingHeadingsData>) => {
    const prev = dataRef.current;
    const val = typeof next === 'function' ? (next as (p: MatchingHeadingsData) => MatchingHeadingsData)(prev) : next;
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
  const jump = (from: MatchingHeadingsData[], to: MatchingHeadingsData[]) => {
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

  const update = (patch: Partial<MatchingHeadingsData>) => setData((p) => ({ ...p, ...patch }));
  const updateSettings = (patch: Partial<MatchingHeadingsData['settings']>) => setData((p) => ({ ...p, settings: { ...p.settings, ...patch } }));

  // ── Giao diện: header, hai cột kéo được, xem trước vừa khung
  const slot = useAppHeaderSlot();
  const { mainRef, leftPct, isDragging, handlers: splitHandlers } = useSplitPane('matching-headings-editor-left-pct');
  const [activeTab, setActiveTab] = useState<'preview' | 'edit_mode'>('edit_mode');
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pageFull, setPageFull] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [selKey, setSelKey] = useState<HeadingStyleKey>('title');
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
  const [open, setOpen] = useState<Record<number, boolean>>({ 2: true, 3: true, 4: true });
  const toggle = (n: number) => setOpen((o) => ({ ...o, [n]: !o[n] }));

  // ── Danh sách đoạn văn / ý chính
  type ListKey = 'paragraphs' | 'ideas';
  const prefixOf = (key: ListKey) => (key === 'paragraphs' ? 'p' : 'i');
  const addItem = (key: ListKey) => update({ [key]: [...data[key], { id: newHeadingId(prefixOf(key)), text: '' }] } as Partial<MatchingHeadingsData>);
  const editItem = (key: ListKey, id: string, text: string) =>
    update({ [key]: data[key].map((it) => (it.id === id ? { ...it, text } : it)) } as Partial<MatchingHeadingsData>);
  const removeItem = (key: ListKey, id: string) => update({ [key]: data[key].filter((it) => it.id !== id) } as Partial<MatchingHeadingsData>);
  const duplicateItem = (key: ListKey, id: string) => {
    const i = data[key].findIndex((it) => it.id === id);
    if (i < 0) return;
    const list = [...data[key]];
    list.splice(i + 1, 0, { ...list[i], id: newHeadingId(prefixOf(key)) });
    update({ [key]: list } as Partial<MatchingHeadingsData>);
  };
  const moveItem = (key: ListKey, from: number, to: number) => update({ [key]: moveHeadingItem(data[key], from, to) } as Partial<MatchingHeadingsData>);
  const dragRef = useRef<{ key: ListKey; index: number } | null>(null);

  // ── Ảnh bên phải bài đọc (khối Image Manager và hàm tạo ảnh dùng chung)
  const handleImageSlot = async (_idx: number, file: File) => {
    try {
      const url = await fileToSmallDataUrl(file, 1000, 'image/jpeg');
      const ratio = await new Promise<number>((resolve) => {
        const im = new Image();
        im.onload = () => resolve(im.naturalWidth && im.naturalHeight ? Math.round((im.naturalWidth / im.naturalHeight) * 100) / 100 : 1.5);
        im.onerror = () => resolve(1.5);
        im.src = url;
      });
      update({ image: { ...dataRef.current.image, url, ratio } });
    } catch {
      alert('Không đọc được file ảnh.');
    }
  };
  const buildImagePrompt = (): string => {
    const title = dataRef.current.passageTitle?.trim();
    const first = (dataRef.current.paragraphs[0]?.text || '').replace(/\s+/g, ' ').slice(0, 260);
    return `Photo illustrating a reading passage${title ? ` titled "${title}"` : ''}. ${first ? `Scene based on: ${first}` : ''}`.trim();
  };
  const { gen: imgGen, generate: generateImage } = useAiImage({
    getPrompt: () => dataRef.current.image?.prompt || buildImagePrompt(),
    style: PHOTO_STYLE,
    aspectRatio: '4:3',
    onPrompt: (p) => setData((d) => ({ ...d, image: { ...d.image, prompt: p } })),
    onImage: (url, p) => setData((d) => ({ ...d, image: { url, ratio: 4 / 3, prompt: p } })),
  });

  // ── Smart Paste / Import
  const [modal, setModal] = useState<ModalMode | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [modalMsg, setModalMsg] = useState('');
  const openModal = (m: ModalMode) => { setModal(m); setPasteText(''); setModalMsg(''); };
  const hasContent = data.paragraphs.length > 0 || data.ideas.length > 0;

  const applyModal = () => {
    if (!modal) return;
    const mk = (prefix: string, texts: string[]): HeadingItem[] => texts.map((text) => ({ id: newHeadingId(prefix), text }));
    if (modal === 'ideas') {
      const list = linesOf(pasteText);
      if (list.length === 0) { setModalMsg('Chưa có dòng nào để nhập.'); return; }
      if (data.ideas.length > 0 && !window.confirm('Thay toàn bộ danh sách ý chính hiện có?')) return;
      update({ ideas: mk('i', list) });
    } else if (modal === 'paragraphs') {
      const blocks = pasteText.replace(/\r\n?/g, '\n').split(/\n\s*\n/).map((b) => b.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
      const list = blocks.length > 1 ? blocks : pasteText.split('\n').map((l) => l.trim()).filter(Boolean);
      if (list.length === 0) { setModalMsg('Chưa có đoạn nào để nhập.'); return; }
      if (data.paragraphs.length > 0 && !window.confirm('Thay toàn bộ các đoạn văn hiện có?')) return;
      update({ paragraphs: mk('p', list) });
    } else {
      const parsed = parseHeadingsText(pasteText);
      if (!parsed.ok) { setModalMsg(parsed.warnings[0] || 'Không nhận ra nội dung. Kiểm tra lại định dạng.'); return; }
      if (hasContent && !window.confirm('Thay toàn bộ bài đọc và ý chính hiện có bằng nội dung vừa dán? (Có thể Hoàn tác)')) return;
      update({
        paragraphs: mk('p', parsed.paragraphs),
        ideas: mk('i', parsed.ideas),
        ...(parsed.exerciseTitle ? { exerciseTitle: parsed.exerciseTitle } : {}),
        ...(parsed.passageTitle ? { passageTitle: parsed.passageTitle } : {}),
        settings: parsed.listOnly
          ? { ...data.settings, showPassage: false, showImage: false, showPassageTitle: false }
          : { ...data.settings, showPassage: true },
      });
    }
    setModal(null);
  };

  // ── Định dạng chữ theo thành phần
  const STYLE_DEFAULTS: Record<HeadingStyleKey, { bold: boolean; italic: boolean; size: number }> = {
    title: { bold: true, italic: false, size: data.settings.headingFontSizePt },
    instruction: { bold: false, italic: true, size: 10 },
    passageTitle: { bold: true, italic: false, size: data.settings.fontSizePt + 1 },
    passage: { bold: false, italic: false, size: data.settings.fontSizePt },
    ideas: { bold: false, italic: false, size: data.settings.fontSizePt },
  };
  const curStyle = data.textStyles?.[selKey];
  const isBold = curStyle?.bold ?? STYLE_DEFAULTS[selKey].bold;
  const isItalic = curStyle?.italic ?? STYLE_DEFAULTS[selKey].italic;
  const applyFlag = (flag: 'bold' | 'italic' | 'underline' | 'strike') => {
    const current = flag === 'bold' ? isBold : flag === 'italic' ? isItalic : !!curStyle?.[flag];
    update({ textStyles: setHeadingStyle(data.textStyles, selKey, { [flag]: !current }) });
  };
  const clearStyle = () => {
    const next = { ...(data.textStyles || {}) };
    delete next[selKey];
    update({ textStyles: next });
  };

  // ── Lưu / xuất
  const buildExercise = (): Exercise => ({
    id: exerciseIdRef.current,
    type: 'matching_headings',
    layoutType: 'template_a',
    title: data.exerciseTitle,
    instructions: data.instruction,
    pointsTotal: data.paragraphs.length,
    order: editingExercise?.order || folder.exercises.length + 1,
    imageSlots: [],
    questions: data.paragraphs.map((p, i) => ({ id: p.id, number: i + 1, text: `Paragraph ${i + 1}`, points: 1 })),
    pageBreakBefore: data.settings.pageBreakBefore || undefined,
    matchingHeadings: { ...data, exerciseNumber },
  });

  const handleSave = (next: 'return' | 'add_another' | 'stay' = 'return') => {
    const v = validateHeadings(data);
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
  const renderMoreSection = (key: HeadingsMoreKey): React.ReactNode => {
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
              {[12, 13, 14, 16, 18].map((n) => <option key={n} value={n}>{n} pt</option>)}
            </select>
          </label>
          <label className={row}>Độ rộng ảnh
            <span className="flex items-center gap-2"><input type="range" min={40} max={90} step={1} value={s.imageWidthMm} onChange={(e) => updateSettings({ imageWidthMm: Number(e.target.value) })} className="accent-blue-600" /><span className="font-mono w-12 text-right">{s.imageWidthMm} mm</span></span>
          </label>
        </div>
      );
    }
    return (
      <div className="space-y-2 text-[11.5px] text-slate-700">
        {([['showExerciseTitle', 'Hiện tiêu đề bài'], ['showInstruction', 'Hiện hướng dẫn'], ['showPassageTitle', 'Hiện tiêu đề bài đọc'], ['showImage', 'Hiện ảnh bên phải bài đọc'], ['pageBreakBefore', 'Ngắt trang trước bài này']] as const).map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={s[k]} onChange={(e) => updateSettings({ [k]: e.target.checked } as Partial<MatchingHeadingsData['settings']>)} className="rounded text-blue-600 focus:ring-0" />
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
    const label = key === 'paragraphs' ? String(index + 1) : `${ideaLabel(index)}.`;
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
          placeholder={key === 'paragraphs' ? 'Nội dung đoạn văn…' : 'Ý chính…'}
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
        <MatchingHeadingsRenderer
          data={{ ...data, exerciseNumber }}
          exerciseIndex={exerciseNumber}
          editable={editable ? {
            onTitle: (v) => update({ exerciseTitle: v }),
            onInstruction: (v) => update({ instruction: v }),
            onPassageTitle: (v) => update({ passageTitle: v }),
            onParagraph: (id, v) => editItem('paragraphs', id, v),
            onIdea: (id, v) => editItem('ideas', id, v),
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
                {folder.name || 'Unit 2 - London'} <span className="text-slate-300 mx-0.5">|</span> Worksheet: {folder.printSettings?.branding?.worksheetNo || 'WS-Reading-2-1-1'}
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

      <MatchingHeadingsToolbar
        data={data}
        selKey={selKey}
        onSelKey={setSelKey}
        curStyle={curStyle}
        defaults={STYLE_DEFAULTS[selKey]}
        onFlag={applyFlag}
        onSizeDelta={(d) => update({ textStyles: bumpHeadingSize(data.textStyles, selKey, STYLE_DEFAULTS[selKey].size, d) })}
        onPatchStyle={(patch) => update({ textStyles: setHeadingStyle(data.textStyles, selKey, patch) })}
        onClearStyle={clearStyle}
        onSettings={updateSettings}
        onAddParagraph={() => addItem('paragraphs')}
        onAddIdea={() => addItem('ideas')}
        onImportIdeas={() => openModal('ideas')}
        onSmartPaste={() => openModal('smart')}
        onShuffleIdeas={() => update({ ideas: shuffleHeadingItems(data.ideas) })}
        onImageFile={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void handleImageSlot(0, f); }}
        onClearImage={() => update({ image: { prompt: data.image?.prompt } })}
        onGenerateImage={() => { void generateImage(); }}
        generatingImage={imgGen.busy}
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
            <SectionHead n={1} title="Exercise Content" help="Tiêu đề và hướng dẫn in trên phiếu." right={<span className="px-2.5 py-0.5 rounded-full bg-white border border-blue-200 text-[11px] font-bold text-blue-700">Exercise {exerciseNumber}</span>} />
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
            <SectionHead n={2} title="Passage Content" right={<>
              <button type="button" onClick={() => addItem('paragraphs')} className={smallBtn}><Plus size={12} /> Add Paragraph</button>
              <button type="button" onClick={() => openModal('paragraphs')} className={smallBtn}>Import</button>
              <button type="button" onClick={() => openModal('smart')} className={smallBtn}>Smart Paste</button>
            </>} open={open[2]} onToggle={() => toggle(2)} />
            {open[2] && (<>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Passage Title</label>
              <input value={data.passageTitle} onChange={(e) => update({ passageTitle: e.target.value })} className={fieldCls} placeholder="HAVING A SAY ABOUT YOUR CITY" />
            </div>
            {data.paragraphs.length === 0 && <p className="text-xs text-slate-400 py-2 text-center">Chưa có đoạn văn nào. Bấm Add Paragraph, Import hoặc Smart Paste.</p>}
            <div className="space-y-2">{data.paragraphs.map((_, i) => renderRow('paragraphs', i))}</div>
</>)}
          </section>

          <section className="shrink-0 bg-white/60 border border-slate-100 rounded-2xl p-4 shadow-xs space-y-2.5">
            <SectionHead n={3} title="Main Idea List" right={<>
              <button type="button" onClick={() => addItem('ideas')} className={smallBtn}><Plus size={12} /> Add Idea</button>
              <button type="button" onClick={() => openModal('ideas')} className={smallBtn}>Import</button>
              <button type="button" onClick={() => openModal('smart')} className={smallBtn}>Smart Paste</button>
            </>} open={open[3]} onToggle={() => toggle(3)} />
            {open[3] && (<>
            {data.ideas.length === 0 && <p className="text-xs text-slate-400 py-2 text-center">Chưa có ý chính nào. Bấm Add Idea, Import hoặc Smart Paste.</p>}
            <div className="space-y-2">{data.ideas.map((_, i) => renderRow('ideas', i))}</div>
</>)}
          </section>

          <section className="shrink-0 bg-white/60 border border-slate-100 rounded-2xl p-4 shadow-xs space-y-2.5">
            <SectionHead n={4} title="Image Manager" help="Ảnh bên phải bài đọc. Khi chưa có ảnh, phiếu hiện khung chờ ảnh." open={open[4]} onToggle={() => toggle(4)} />
            {open[4] && (
              <ImageManagerBody
                slots={[{ url: data.image?.url }]}
                previewRatio={1.5}
                onFile={(idx, f) => { void handleImageSlot(idx, f); }}
                onRemove={() => update({ image: { prompt: data.image?.prompt } })}
                onGenerate={() => { void generateImage(); }}
                generating={imgGen.busy}
                prompt={data.image?.prompt || ''}
                onPromptChange={(v) => update({ image: { ...data.image, prompt: v } })}
                defaultPrompt={buildImagePrompt}
                message={imgGen.msg}
              />
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
            <AiRewriteBox kind="Matching Headings" hint={MODAL_INFO[modal].hint} example={MODAL_INFO[modal].placeholder} text={pasteText} onText={(v) => { setPasteText(v); setModalMsg(''); }} />
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
