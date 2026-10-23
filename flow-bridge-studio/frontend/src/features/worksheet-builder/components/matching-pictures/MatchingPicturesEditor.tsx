import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { SaveStatusBadge, useSaveShortcut, type SaveStatus } from '../shared/SaveStatusBadge';
import { AiRewriteBox } from '../shared/AiRewriteBox';
import { SmartLayoutBar } from '../shared/SmartLayoutBar';
import { MATCHING_PICTURES_LAYOUTS as SMART_LAYOUTS } from '../../services/matching-pictures/matchingPicturesCore';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  RotateCcw,
  RotateCw,
  Eye,
  Printer,
  Maximize2,
  Minus,
  Plus,
  X,
  Upload,
  Trash2,
  ChevronDown,
  ChevronRight,
  Info,
  Pencil,
  GripVertical,
  Images,
  HelpCircle,
  Save,
  Minimize,
  
  Loader2,
  Wand2,
} from 'lucide-react';
import { useAiImage } from '../../services/ai/useAiImage';
import { PHOTO_STYLE } from '../../services/matching/autoMatching';
import { ImageRunConfigDialog } from '../shared/ImageManagerBody';
import type { LessonFolder, Exercise } from '../../types';
import type {
  TextStyleKey,
  MatchingPicturesData,
  MatchingPictureItem,
  MatchingPictureParagraph,
} from '../../services/matching-pictures/matchingPicturesCore';
import {
  createMatchingPictures,
  deriveImageLabel,
  reorderImages,
  parseParagraphsSmartPaste,
  toggleTextFlag,
  bumpTextSize,
  setTextStyle,
  shuffleImages,
} from '../../services/matching-pictures/matchingPicturesCore';
import { MatchingPicturesRenderer } from './MatchingPicturesRenderer';
import { RichMarksProvider } from '../shared/rich/RichEditable';
import { MatchingPicturesGalleryPicker } from './MatchingPicturesGalleryPicker';
import { MatchingToolbar } from './MatchingToolbar';
import { BrandHeader } from '../preview/BrandHeader';
import { BrandFooter } from '../preview/BrandFooter';
import { resolveBranding, fileToSmallDataUrl } from '../../types/branding';
import { exportWorksheetToDocx } from '../../services/docxExportService';
import { folderToWorksheet } from '../../types';
import { FileDown, MoreHorizontal } from 'lucide-react';

interface MatchingPicturesEditorProps {
  folder: LessonFolder;
  editingExercise?: Exercise | null;
  onSaveExercise: (exercise: Exercise, nextAction: 'return' | 'add_another' | 'stay') => void;
  onCancel: () => void;
  onDeleteExercise?: (exerciseId: string) => void;
}

const fieldCls =
  'w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';

const A4_PX = 1124; // 297mm ở 96dpi

const RSwitch: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label?: string }> = ({ checked, onChange, label }) => (
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

function RSeg<T extends string | number>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex-1 flex gap-1">
      {options.map((o) => (
        <button
          key={String(o.id)}
          type="button"
          onClick={() => onChange(o.id)}
          className={`flex-1 py-1.5 px-1 rounded-lg border text-[11px] font-semibold leading-tight ${value === o.id ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const LEVEL_PT = { H1: 16, H2: 14, H3: 12 } as const;

const SectionHead: React.FC<{
  n: number;
  title: string;
  help?: string;
  open?: boolean;
  onToggle?: () => void;
  badge?: React.ReactNode;
}> = ({ n, title, help, open, onToggle, badge }) => (
  <div className="flex items-center gap-2 -mx-1 px-2.5 py-1.5 rounded-xl bg-blue-50/70 border border-blue-100 min-w-0">
    <span className="w-5 h-5 rounded-md bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">{n}</span>
    <h3 className="text-[13px] font-bold text-slate-900 truncate">{title}</h3>
    {help && <span className="text-blue-400 cursor-help shrink-0" title={help}><HelpCircle size={13} /></span>}
    {badge && <div className="ml-auto shrink-0 flex items-center">{badge}</div>}
    {onToggle && (
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={open ? 'Thu gọn' : 'Mở ra'}
        title={open ? 'Thu gọn' : 'Mở ra'}
        className={`${badge ? '' : 'ml-auto'} p-0.5 rounded-md text-slate-400 hover:text-slate-800 hover:bg-white/70 shrink-0`}
      >
        <ChevronDown size={15} className={`transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
    )}
  </div>
);

export const MatchingPicturesEditor: React.FC<MatchingPicturesEditorProps> = ({
  folder,
  editingExercise,
  onSaveExercise,
  onCancel,
  onDeleteExercise,
}) => {
  // Initialize state
  const firstListening = folder.exercises.find((e) => e.type === 'listening_gap_fill' || e.listeningGapFill !== undefined);
  const [data, setData] = useState<MatchingPicturesData>(() => {
    if (editingExercise?.matchingPictures) {
      return editingExercise.matchingPictures;
    }
    return createMatchingPictures({
      exerciseTitle: editingExercise?.title || 'MATCH EACH PARAGRAPH AND THE APPROPRIATE PICTURE',
      instruction: editingExercise?.instructions || 'Match each paragraph and the appropriate picture.',
      pointsTotal: undefined,
      source: firstListening
        ? { mode: 'linked', exerciseId: firstListening.id, exerciseTitle: firstListening.title }
        : { mode: 'manual' },
      paragraphs: [],
      images: [],
      answerMapping: [],
    });
  });
  const exerciseIdRef = useRef(editingExercise?.id || `ex_matching_pictures_${Date.now()}`);
  const savedIdx = folder.exercises.findIndex((e) => e.id === exerciseIdRef.current);
  const exerciseNumber = savedIdx >= 0 ? savedIdx + 1 : folder.exercises.length + 1;
  const dragImg = useRef<number | null>(null);
  const dragPara = useRef<number | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  // Trang A4 tự co giãn vừa bề ngang khung xem trước (100% = vừa khít chiều ngang)
  const paneRef = useRef<HTMLDivElement>(null);
  const [paneSize, setPaneSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    const measure = () => setPaneSize({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);
  // Vừa cả chiều rộng lẫn chiều cao khung xem trước → thấy trọn trang A4 ngay khi mở (100% = vừa khít)
  const fitScale = paneSize.w > 0 && paneSize.h > 0
    ? Math.min(1.3, Math.max(0.3, Math.min((paneSize.w - 40) / 794, (paneSize.h - 40) / 1123)))
    : 0.7;
  const [selKey, setSelKey] = useState<TextStyleKey>('title');
  const [fitting, setFitting] = useState(false);
  const [fitMsg, setFitMsg] = useState<string | null>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [openSec, setOpenSec] = useState({ source: true, images: true });
  const toggleSec = (k: 'source' | 'images') => setOpenSec((o) => ({ ...o, [k]: !o[k] }));
  const [showGallery, setShowGallery] = useState(false);
  // Tạo ảnh AI: mỗi lần tạo một ảnh cho một địa điểm / chủ đề, thêm vào cuối danh sách với nhãn A, B, C... kế tiếp
  const [aiSubject, setAiSubject] = useState('');
  const [aiCfgOpen, setAiCfgOpen] = useState(false);
  const aiSubjectRef = useRef('');
  aiSubjectRef.current = aiSubject;
  // Ảnh AI về sau khi tạo xong: đi qua `apply` (khai báo phía dưới) để ghi lịch sử Undo đúng
  const applyRef = useRef<(fn: (prev: MatchingPicturesData) => MatchingPicturesData) => void>(() => undefined);
  const { gen: aiGen, generate: generateAiImage } = useAiImage({
    getPrompt: () => `Realistic travel photograph of ${aiSubjectRef.current.trim()}, one clear main subject, well composed.`,
    style: PHOTO_STYLE,
    aspectRatio: '4:3',
    onPrompt: () => undefined,
    onImage: (url) => {
      const caption = aiSubjectRef.current.trim();
      applyRef.current((prev) => {
        // Có ô ảnh trống cùng tên chủ đề thì điền vào đúng ô đó; không thì thêm ô mới cuối danh sách
        const slot = prev.images.find((im) => !im.imageUrl && (im.caption || '').trim().toLowerCase() === caption.toLowerCase());
        const idx = prev.images.length;
        const images = slot
          ? prev.images.map((im) => (im.id === slot.id ? { ...im, imageUrl: url } : im))
          : [...prev.images, { id: `img_${Date.now()}_ai`, order: idx, label: deriveImageLabel(idx), imageUrl: url, caption }];
        return { ...prev, images };
      });
      setAiSubject('');
    },
  });
  const [srcTab, setSrcTab] = useState<'linked' | 'paste' | 'manual'>(() => (data.source.mode === 'linked' ? 'linked' : 'manual'));
  const titleLevel: 'H1' | 'H2' | 'H3' =
    data.settings.headingFontSizePt >= 16 ? 'H1' : data.settings.headingFontSizePt <= 12 ? 'H3' : 'H2';

  const [activeTab, setActiveTab] = useState<'preview' | 'edit_mode'>('edit_mode');
  const [zoom, setZoom] = useState<number>(100);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const [pasteText, setPasteText] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [expandedParaIds, setExpandedParaIds] = useState<Record<string, boolean>>({});

  // Lịch sử Undo / Redo: giữ trong ref và cập nhật đồng bộ, nên nhiều thay đổi liền nhau trong một lần bấm
  // (vd. lưu chữ rồi lưu định dạng của cùng ô) vẫn đúng thứ tự, không đọc chỉ số cũ
  const dataRef = useRef(data);
  dataRef.current = data;
  const histRef = useRef<{ list: MatchingPicturesData[]; idx: number }>({ list: [data], idx: 0 });
  const [, setHistTick] = useState(0);
  const histPushAt = useRef(0);
  const historyIndex = histRef.current.idx;
  const history = histRef.current.list;
  /** Áp một thay đổi lên dữ liệu mới nhất và ghi vào lịch sử */
  const apply = (fn: (prev: MatchingPicturesData) => MatchingPicturesData) => {
    const next = fn(dataRef.current);
    if (next === dataRef.current) return;
    dataRef.current = next;
    const h = histRef.current;
    // Các thay đổi liền nhau trong 500ms (gõ liên tục, lưu chữ + định dạng cùng ô) gộp thành một bước Undo như các trình soạn khác
    const now = Date.now();
    const merge = now - histPushAt.current < 500 && h.idx > 0 && h.idx === h.list.length - 1;
    histPushAt.current = now;
    h.list = merge ? [...h.list.slice(0, h.idx), next] : [...h.list.slice(0, h.idx + 1), next].slice(-100);
    h.idx = h.list.length - 1;
    setData(next);
    setHistTick((n) => n + 1);
    setSaveStatus('unsaved');
  };
  applyRef.current = apply;

  const brand = resolveBranding(folder.printSettings.branding);

  // Tự đồng bộ đoạn văn từ ĐÚNG bài đã chọn khi đang ở chế độ liên kết
  useEffect(() => {
    if (data.source.mode !== 'linked') return;
    const sourceEx = folder.exercises.find((e) => e.id === data.source.exerciseId);
    const paras = sourceEx?.listeningGapFill?.paragraphs;
    if (!paras) return;
    const synced: MatchingPictureParagraph[] = paras.map((p, idx) => {
      const clean = p.text.replace(/\([a-zA-Z0-9]+\)\s*_{2,}/g, '________');
      return {
        id: p.id || `p${idx + 1}`,
        sourceParagraphId: p.id,
        order: idx + 1,
        title: `Paragraph ${idx + 1}`,
        text: clean,
        summary: clean.split('.')[0] + '.',
      };
    });
    setData((prev) => {
      if (JSON.stringify(prev.paragraphs) === JSON.stringify(synced)) return prev;
      const ids = new Set(synced.map((x) => x.id));
      return { ...prev, paragraphs: synced, answerMapping: prev.answerMapping.filter((m) => ids.has(m.paragraphId)) };
    });
  }, [data.source.mode, data.source.exerciseId, folder.exercises]);

  // Update helper
  const update = (patch: Partial<MatchingPicturesData>) => apply((prev) => ({ ...prev, ...patch }));

  // Định dạng từng từ của các ô chữ trên trang (đọc giá trị mới nhất vì đi liền sau lần lưu chữ của cùng ô)
  const updateRich = (fn: (prev: MatchingPicturesData['richMarks']) => MatchingPicturesData['richMarks']) =>
    apply((prev) => ({ ...prev, richMarks: fn(prev.richMarks) }));

  const updateSettings = (patch: Partial<MatchingPicturesData['settings']>) =>
    apply((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));

  // Undo / Redo
  const jumpHistory = (delta: number) => {
    const h = histRef.current;
    const target = h.list[h.idx + delta];
    if (!target) return;
    histPushAt.current = 0; // thay đổi tiếp theo sau Undo/Redo luôn là một bước mới
    h.idx += delta;
    dataRef.current = target;
    setData(target);
    setHistTick((n) => n + 1);
    setSaveStatus('unsaved');
  };
  const handleUndo = () => jumpHistory(-1);
  const handleRedo = () => jumpHistory(1);

  // Paragraph operations
  const toggleParaExpand = (id: string) => {
    setExpandedParaIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddParagraph = () => {
    const nextOrder = data.paragraphs.length + 1;
    const newPara: MatchingPictureParagraph = {
      id: `p_${Date.now()}`,
      order: nextOrder,
      title: `Paragraph ${nextOrder}`,
      text: `Enter paragraph ${nextOrder} text here...`,
      summary: `Paragraph ${nextOrder} summary.`,
    };
    update({ paragraphs: [...data.paragraphs, newPara] });
  };

  const handleDeleteParagraph = (pId: string) => {
    if (data.paragraphs.length <= 1) {
      alert('Bài tập cần ít nhất một đoạn văn.');
      return;
    }
    const remaining = data.paragraphs
      .filter((p) => p.id !== pId)
      .map((p, idx) => ({ ...p, order: idx + 1, title: `Paragraph ${idx + 1}` }));
    const remainingMapping = data.answerMapping.filter((m) => m.paragraphId !== pId);
    update({ paragraphs: remaining, answerMapping: remainingMapping });
  };

  const handleUpdateParagraphText = (pId: string, text: string) => {
    const updated = data.paragraphs.map((p) =>
      p.id === pId ? { ...p, text, summary: text.split('.')[0] + '.' } : p
    );
    update({ paragraphs: updated });
  };

  // Image operations (ảnh lưu dạng data URL đã thu nhỏ, không dùng blob URL vì sẽ mất khi tải lại trang)
  const handleUploadImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'));
    e.target.value = '';
    if (files.length === 0) return;
    try {
      const startIndex = data.images.length;
      const created: MatchingPictureItem[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        created.push({
          id: `img_${Date.now()}_${i}`,
          order: startIndex + i,
          label: deriveImageLabel(startIndex + i),
          imageUrl: await fileToSmallDataUrl(file, 900, 'image/jpeg'),
          caption: cleanName.charAt(0).toUpperCase() + cleanName.slice(1),
        });
      }
      update({ images: [...data.images, ...created] });
    } catch {
      window.alert('Không đọc được một số ảnh.');
    }
  };

  const handleDeleteImage = (imgId: string) => {
    const inUse = data.answerMapping.some((m) => m.imageId === imgId);
    if (
      inUse &&
      !window.confirm(
        'Hình ảnh này đang được gán làm đáp án cho một đoạn văn. Bạn có chắc muốn xóa?'
      )
    ) {
      return;
    }

    const remaining = data.images
      .filter((img) => img.id !== imgId)
      .map((img, idx) => ({
        ...img,
        order: idx,
        label: deriveImageLabel(idx),
      }));

    const remainingMapping = data.answerMapping.filter((m) => m.imageId !== imgId);
    update({ images: remaining, answerMapping: remainingMapping });
  };

  const handleReplaceImage = async (imgId: string, file: File) => {
    try {
      const url = await fileToSmallDataUrl(file, 900, 'image/jpeg');
      update({ images: data.images.map((img) => (img.id === imgId ? { ...img, imageUrl: url } : img)) });
    } catch {
      window.alert('Không đọc được ảnh này.');
    }
  };

  const loadSampleLondon = () => {
    if ((data.paragraphs.length || data.images.length) && !window.confirm('Thay nội dung hiện có bằng bài mẫu London?')) return;
    const sample = createMatchingPictures();
    update({ paragraphs: sample.paragraphs, images: sample.images, answerMapping: sample.answerMapping, source: { mode: 'manual' } });
  };

  const handleApplySmartPaste = () => {
    if (!pasteText.trim()) return;
    const parsedParas = parseParagraphsSmartPaste(pasteText);
    if (parsedParas.length === 0) return;
    if (data.paragraphs.length > 0 && !window.confirm('Thay toàn bộ đoạn văn hiện có bằng nội dung vừa dán? (Có thể Undo)')) return;
    update({ source: { mode: 'manual' }, paragraphs: parsedParas });
    setPasteText('');
    setSrcTab('manual');
  };

  const handleReorderParagraph = (from: number, to: number) => {
    const copy = [...data.paragraphs];
    const [moved] = copy.splice(from, 1);
    copy.splice(to, 0, moved);
    update({ paragraphs: copy.map((p, i) => ({ ...p, order: i + 1, title: `Paragraph ${i + 1}` })) });
  };

  const handleAddFromGallery = (items: { imageUrl: string; caption?: string }[]) => {
    const start = data.images.length;
    update({
      images: [
        ...data.images,
        ...items.map((it, i) => ({
          id: `img_${Date.now()}_g${i}`,
          order: start + i,
          label: deriveImageLabel(start + i),
          imageUrl: it.imageUrl,
          caption: it.caption,
        })),
      ],
    });
  };

  // Save to Folder / Supabase
  useSaveShortcut(() => handleSave('stay'));

  const handleSave = (nextAction: 'return' | 'add_another' | 'stay' = 'return') => {
    const exerciseToSave: Exercise = {
      id: exerciseIdRef.current,
      type: 'matching_pictures',
      layoutType: 'template_a',
      title: data.exerciseTitle,
      instructions: data.instruction,
      pointsTotal: data.pointsTotal || data.paragraphs.length,
      order: editingExercise?.order || folder.exercises.length + 1,
      imageSlots: [],
      questions: [],
      pageBreakBefore: data.settings.pageBreakBefore || undefined,
      matchingPictures: { ...data, exerciseNumber },
    };

    onSaveExercise(exerciseToSave, nextAction);
    setSaveStatus('saved');
  };

  // Export handlers
  const handleExportDocx = (mode: 'student' | 'teacher_key') => {
    const currentWs = folderToWorksheet(folder);
    const exIdx = currentWs.exercises.findIndex((e) => e.type === 'matching_pictures');
    const updatedExercises = [...currentWs.exercises];

    const currentEx: Exercise = {
      id: editingExercise?.id || 'ex_mp',
      type: 'matching_pictures',
      layoutType: 'template_a',
      title: data.exerciseTitle,
      instructions: data.instruction,
      order: data.exerciseNumber || 4,
      pointsTotal: data.pointsTotal || 5,
      questions: [],
      imageSlots: [],
      matchingPictures: data,
    };

    if (exIdx >= 0) {
      updatedExercises[exIdx] = currentEx;
    } else {
      updatedExercises.push(currentEx);
    }

    exportWorksheetToDocx({ ...currentWs, exercises: updatedExercises }, mode);
  };

  const handleExportPdf = () => {
    window.print();
  };

  // ── Định dạng chữ (Edit Mode) ──
  const STYLE_DEFAULTS: Record<TextStyleKey, { bold: boolean; italic: boolean; size: number }> = {
    title: { bold: true, italic: false, size: data.settings.headingFontSizePt || 14 },
    instruction: { bold: false, italic: true, size: 9 },
    notes: { bold: false, italic: true, size: 9 },
    captions: { bold: true, italic: false, size: 8 },
    paraLabels: { bold: true, italic: false, size: data.settings.fontSizePt || 12 },
  };
  const curStyle = data.textStyles?.[selKey];
  const isBold = curStyle?.bold ?? STYLE_DEFAULTS[selKey].bold;
  const isItalic = curStyle?.italic ?? STYLE_DEFAULTS[selKey].italic;
  const applyFlag = (flag: 'bold' | 'italic' | 'underline' | 'strike') => {
    const current = flag === 'bold' ? isBold : flag === 'italic' ? isItalic : !!curStyle?.[flag];
    update({ textStyles: toggleTextFlag(data.textStyles, selKey, flag, current) });
  };
  const applySize = (delta: number) => update({ textStyles: bumpTextSize(data.textStyles, selKey, STYLE_DEFAULTS[selKey].size, delta) });
  const applyStyle = (patch: Parameters<typeof setTextStyle>[2]) => update({ textStyles: setTextStyle(data.textStyles, selKey, patch) });
  const clearStyle = () => {
    const next = { ...(data.textStyles || {}) };
    delete next[selKey];
    update({ textStyles: next });
  };

  const renderA4 = (scale: number, editable: boolean) => (
    <div
      className="bg-white text-[#111] shadow-xl mx-auto"
      style={{ width: '210mm', minHeight: '297mm', padding: '15mm', zoom: scale, display: 'flex', flexDirection: 'column' }}
    >
      {brand.enabled && <BrandHeader b={brand} />}
      <RichMarksProvider marks={data.richMarks} onChange={editable ? updateRich : undefined}>
      <MatchingPicturesRenderer
        data={{ ...data, exerciseNumber }}
        exerciseIndex={exerciseNumber}
        editable={
          editable
            ? {
                onTitle: (v) => update({ exerciseTitle: v }),
                onInstruction: (v) => update({ instruction: v }),
                onNotes: (v) => update({ notes: v }),
                onLabel: (pid, v) => update({ paragraphs: data.paragraphs.map((pp) => (pp.id === pid ? { ...pp, title: v } : pp)) }),
                onCaption: (id, v) => update({ images: data.images.map((im) => (im.id === id ? { ...im, caption: v } : im)) }),
                selectedKey: selKey,
                onSelectKey: setSelKey,
              }
            : undefined
        }
      />
      </RichMarksProvider>
      {brand.enabled && (
        <div className="mt-auto pt-[8mm]"><BrandFooter b={brand} pageNumber={1} totalPages={1} /></div>
      )}
    </div>
  );

  // Auto fit to A4: giảm dần cỡ chữ / chiều cao dòng / khoảng cách ảnh cho tới khi vừa một trang
  const startFit = () => { setFitMsg(null); setFitting(true); };
  useEffect(() => {
    if (!fitting) return;
    const el = measureRef.current;
    if (!el) { setFitting(false); return; }
    const st = data.settings;
    if (el.scrollHeight <= A4_PX) { setFitting(false); setFitMsg('Đã vừa một trang A4.'); return; }
    if (st.fontSizePt <= 9 && st.lineHeight <= 1.2 && st.gapBetweenImagesMm <= 2 && st.imageSizePercent <= 50) {
      setFitting(false);
      setFitMsg('Đã thu nhỏ hết mức nhưng nội dung vẫn dài hơn một trang A4.');
      return;
    }
    updateSettings({
      fontSizePt: Math.max(9, st.fontSizePt - 0.5),
      lineHeight: Math.max(1.2, Math.round((st.lineHeight - 0.05) * 100) / 100),
      gapBetweenImagesMm: Math.max(2, st.gapBetweenImagesMm - 1),
      imageSizePercent: Math.max(50, st.imageSizePercent - 5),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitting, data]);

  // Available source exercises in this folder
  const sourceExerciseOptions = folder.exercises.filter(
    (e) => e.type === 'listening_gap_fill' || e.listeningGapFill !== undefined
  );

  // ── Gắn thanh thao tác lên header của app và ẩn breadcrumb / tên trường ──
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const el = document.getElementById('app-header-actions');
    setSlot(el);
    const header = el?.parentElement;
    if (!el || !header) return;
    const hidden: HTMLElement[] = [];
    Array.from(header.children).forEach((c) => {
      if (c !== el && c instanceof HTMLElement) {
        hidden.push(c);
        c.dataset.prevDisplay = c.style.display;
        c.style.display = 'none';
      }
    });
    const prev = { flex: el.style.flex, margin: el.style.marginLeft, pad: el.style.paddingLeft };
    el.style.flex = '1 1 auto';
    el.style.marginLeft = '0';
    el.style.paddingLeft = '0';
    return () => {
      hidden.forEach((c) => { c.style.display = c.dataset.prevDisplay || ''; });
      el.style.flex = prev.flex;
      el.style.marginLeft = prev.margin;
      el.style.paddingLeft = prev.pad;
    };
  }, []);

  // ── Chia 2 cột có thể kéo: lưu tỉ lệ cột trái ──
  const DEFAULT_LEFT_PCT = 42;
  const mainRef = useRef<HTMLElement | null>(null);
  const leftColRef = useRef<HTMLDivElement | null>(null);
  // Preview = chỉ xem: khóa toàn bộ cột soạn thảo (chuyển sang Edit Mode để chỉnh sửa)
  useEffect(() => {
    if (leftColRef.current) (leftColRef.current as HTMLDivElement & { inert: boolean }).inert = activeTab === 'preview';
  }, [activeTab]);
  const [isDragging, setIsDragging] = useState(false);
  const [leftPct, setLeftPct] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem('matching-editor-left-pct'));
      return v >= 25 && v <= 70 ? v : DEFAULT_LEFT_PCT;
    } catch {
      return DEFAULT_LEFT_PCT;
    }
  });
  useEffect(() => {
    try { localStorage.setItem('matching-editor-left-pct', String(leftPct)); } catch { /* bỏ qua */ }
  }, [leftPct]);
  const handleDividerDown = (ev: React.PointerEvent<HTMLDivElement>) => {
    ev.currentTarget.setPointerCapture(ev.pointerId);
    setIsDragging(true);
  };
  const handleDividerMove = (ev: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !mainRef.current) return;
    const rect = mainRef.current.getBoundingClientRect();
    const cs = getComputedStyle(mainRef.current);
    const pl = parseFloat(cs.paddingLeft);
    const inner = rect.width - pl - parseFloat(cs.paddingRight);
    const pct = ((ev.clientX - rect.left - pl) / inner) * 100;
    setLeftPct(Math.round(Math.min(70, Math.max(25, pct)) * 10) / 10);
  };
  const handleDividerUp = (ev: React.PointerEvent<HTMLDivElement>) => {
    if (ev.currentTarget.hasPointerCapture(ev.pointerId)) ev.currentTarget.releasePointerCapture(ev.pointerId);
    setIsDragging(false);
  };
  useEffect(() => {
    if (!isDragging) return;
    const prevSel = document.body.style.userSelect;
    const prevCur = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    return () => {
      document.body.style.userSelect = prevSel;
      document.body.style.cursor = prevCur;
    };
  }, [isDragging]);

  const renderMoreSection = (key: 'image' | 'answer' | 'typography' | 'advanced'): React.ReactNode => {
    switch (key) {
      case 'image':
        return (
          <div className="space-y-2.5">
{/* 2. Image Settings */}
          <section className="space-y-2.5 ">
            {true && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-slate-700 w-24 shrink-0">Image columns</span>
                  <RSeg value={data.settings.imageColumns} onChange={(v) => updateSettings({ imageColumns: v })} options={[{ id: 1, label: '1' }, { id: 2, label: '2' }, { id: 3, label: '3' }, { id: 'auto', label: 'Auto' }]} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-slate-700 w-24 shrink-0">Image size</span>
                  <input type="range" min={50} max={100} step={5} value={data.settings.imageSizePercent} onChange={(e) => updateSettings({ imageSizePercent: Number(e.target.value) })} className="flex-1 accent-blue-600" />
                  <span className="font-mono text-[11px] font-bold text-slate-700 w-10 text-right">{data.settings.imageSizePercent}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-slate-700 w-24 shrink-0">Image shape</span>
                  <RSeg value={data.settings.imageShape} onChange={(v) => updateSettings({ imageShape: v })} options={[{ id: 'rectangle', label: 'Rectangle' }, { id: 'rounded', label: 'Rounded' }]} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-slate-700 w-24 shrink-0">Image gap</span>
                  <input type="range" min={2} max={16} step={1} value={data.settings.gapBetweenImagesMm} onChange={(e) => updateSettings({ gapBetweenImagesMm: Number(e.target.value) })} className="flex-1 accent-blue-600" />
                  <span className="font-mono text-[11px] font-bold text-slate-700 w-12 text-right">{data.settings.gapBetweenImagesMm} mm</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-700">Show image labels (A, B, C, ...) <RSwitch checked={data.settings.showImageLabels} onChange={(v) => updateSettings({ showImageLabels: v })} label="Show image labels" /></div>
                <div className="flex items-center justify-between text-[11px] text-slate-700">Show image borders <RSwitch checked={data.settings.showBorders} onChange={(v) => updateSettings({ showBorders: v })} label="Show image borders" /></div>
              </>
            )}
          </section>

          
          </div>
        );
      case 'answer':
        return (
          <div className="space-y-2.5">
{/* 3. Answer Area */}
          <section className="space-y-2.5 ">
            {true && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-slate-700 w-20 shrink-0">Answer style</span>
                  <RSeg
                    value={data.settings.answerStyle === 'draw_lines' ? 'box' : data.settings.answerStyle}
                    onChange={(v) => updateSettings({ answerStyle: v })}
                    options={[{ id: 'box', label: '☐ Square box' }, { id: 'underline', label: '＿ Underline' }, { id: 'circle', label: '◯ Circle' }]}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-slate-700 w-20 shrink-0">Position</span>
                  <RSeg value={data.settings.answerPosition} onChange={(v) => updateSettings({ answerPosition: v })} options={[{ id: 'left', label: 'Left (like original)' }, { id: 'right', label: 'Right' }]} />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-700" title="Bật: “Paragraph 1”. Tắt: chỉ “1.”">
                  Show paragraph numbers
                  <RSwitch checked={data.settings.labelStyle === 'paragraph_numbered'} onChange={(v) => updateSettings({ labelStyle: v ? 'paragraph_numbered' : 'number_only' })} label="Show paragraph numbers" />
                </div>
              </>
            )}
          </section>

          
          </div>
        );
      case 'typography':
        return (
          <div className="space-y-2.5">
{/* 4. Typography */}
          <section className="space-y-2.5 ">
            {true && (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-1.5">
                  <div>
                    <span className="text-[10px] font-medium text-slate-500 block mb-0.5">Font family</span>
                    <select value={data.settings.fontFamily} onChange={(e) => updateSettings({ fontFamily: e.target.value })} className={`${fieldCls} !px-1.5 !py-1.5`}>
                      {['Arial', 'Times New Roman', 'Quicksand', 'Roboto', 'Inter'].map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <span className="text-[10px] font-medium text-slate-500 block mb-0.5">Font size</span>
                    <select value={data.settings.fontSizePt} onChange={(e) => updateSettings({ fontSizePt: Number(e.target.value) })} className={`${fieldCls} !px-1.5 !py-1.5`}>
                      {[...new Set([9, 10, 11, 12, 13, 14, data.settings.fontSizePt])].sort((a, b) => a - b).map((n) => <option key={n} value={n}>{n} pt</option>)}
                    </select>
                  </div>
                  <div>
                    <span className="text-[10px] font-medium text-slate-500 block mb-0.5">Line height</span>
                    <select value={data.settings.lineHeight} onChange={(e) => updateSettings({ lineHeight: Number(e.target.value) })} className={`${fieldCls} !px-1.5 !py-1.5`}>
                      {[...new Set([1.2, 1.3, 1.4, 1.5, 1.6, 1.75, 2, data.settings.lineHeight])].sort((a, b) => a - b).map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-medium text-slate-500 block mb-0.5">Paragraph spacing</span>
                  <select value={data.settings.paragraphSpacing} onChange={(e) => updateSettings({ paragraphSpacing: e.target.value as MatchingPicturesData['settings']['paragraphSpacing'] })} className={fieldCls}>
                    <option value="compact">Compact</option><option value="normal">Normal</option><option value="spacious">Spacious</option>
                  </select>
                </div>
              </div>
            )}
          </section>

          
          </div>
        );
      case 'advanced':
        return (
          <div className="space-y-2.5">
{/* 5. Advanced */}
          <section className="space-y-2.5 ">
            {true && (
              <>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] text-slate-700">
                  {([
                    ['showExerciseTitle', 'Show exercise title'],
                    ['showPoints', 'Show points'],
                    ['showInstruction', 'Show instruction'],
                    ['pageBreakBefore', 'Page break before exercise'],
                    ['keepImagesTogether', 'Keep images on the same page'],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={data.settings[key]} onChange={(e) => updateSettings({ [key]: e.target.checked } as Partial<MatchingPicturesData['settings']>)} />
                      {label}
                    </label>
                  ))}
                  <label className="flex items-center gap-1.5 cursor-pointer" title="Tự thu nhỏ chữ / khoảng dòng để bài vừa một trang A4 (làm một lần khi bật)">
                    <input type="checkbox" checked={data.settings.autoFitToA4} onChange={(e) => { updateSettings({ autoFitToA4: e.target.checked }); if (e.target.checked) startFit(); }} />
                    Auto fit to A4
                  </label>
                </div>
                {fitting && <p className="text-[11px] text-blue-700">Đang thu nhỏ cho vừa một trang A4…</p>}
                {fitMsg && !fitting && <p className="text-[11px] text-slate-500">{fitMsg}</p>}
              </>
            )}
          </section>

          </div>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-100 select-text">
      {/* ──────── ACTIONS: gắn lên thanh header của app (portal) ──────── */}
      {slot && createPortal(
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-4 mr-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex items-center gap-2 text-[13px] font-semibold text-slate-800 px-3.5 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft size={16} /> Back to Lesson
            </button>
            <div className="leading-tight">
              <div className="text-[17px] font-bold text-[#16295f]">Edit Worksheet</div>
              <div className="text-[11.5px] text-slate-500">
                {folder.name || 'Unit 2 - London'} <span className="text-slate-300 mx-0.5">|</span> Worksheet: {folder.printSettings?.branding?.worksheetNo || 'WS-Imp-4-1-1'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <SaveStatusBadge status={saveStatus} />

          {/* More / Export Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowExportMenu((v) => !v)}
              className="w-9 h-9 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center justify-center"
              title="Tùy chọn xuất file"
            >
              <MoreHorizontal size={16} />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 z-50">
                <button
                  type="button"
                  onClick={() => {
                    handleExportDocx('student');
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"
                >
                  <FileDown size={14} className="text-blue-600" />
                  Xuất Word (.docx) — Bản học sinh
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleExportDocx('teacher_key');
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"
                >
                  <FileDown size={14} className="text-emerald-600" />
                  Xuất Word (.docx) — Bản giáo viên
                </button>
                <div className="h-px bg-slate-100 my-1" />
                <button
                  type="button"
                  onClick={() => {
                    handleExportPdf();
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"
                >
                  <Printer size={14} className="text-slate-600" />
                  In / Xuất PDF (Chuẩn A4)
                </button>
              </div>
            )}
          </div>

            <div className="flex items-center gap-1">
              <button type="button" onClick={handleUndo} disabled={historyIndex <= 0} title="Hoàn tác" className="w-9 h-9 flex items-center justify-center text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg disabled:opacity-35 disabled:cursor-not-allowed"><RotateCcw size={16} /></button>
              <button type="button" onClick={handleRedo} disabled={historyIndex >= history.length - 1} title="Làm lại" className="w-9 h-9 flex items-center justify-center text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg disabled:opacity-35 disabled:cursor-not-allowed"><RotateCw size={16} /></button>
            </div>
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              className="px-5 h-9 text-[13px] font-semibold text-[#16295f] bg-white border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center gap-2"
            >
              <Eye size={16} /> Preview
            </button>
            <button
              type="button"
              onClick={() => handleSave('return')}
              className="px-7 h-9 text-[13px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2 shadow-sm transition-all"
            >
              <Save size={16} /> Save
            </button>
          </div>
        </div>,
        slot
      )}

      <MatchingToolbar
        data={data}
        selKey={selKey}
        onSelKey={setSelKey}
        curStyle={curStyle}
        defaults={STYLE_DEFAULTS[selKey]}
        onFlag={applyFlag}
        onSizeDelta={applySize}
        onPatchStyle={applyStyle}
        onClearStyle={clearStyle}
        onSettings={updateSettings}
        onAddParagraph={handleAddParagraph}
        onSmartPaste={() => { setOpenSec((o) => ({ ...o, source: true })); setSrcTab('paste'); }}
        onAutoFit={startFit}
        fitting={fitting}
        onShuffle={() => update({ images: shuffleImages(data.images) })}
        onInsertExercise={() => handleSave('return')}
        onUploadImages={handleUploadImages}
        onGallery={() => setShowGallery(true)}
        onDuplicate={() => handleSave('add_another')}
        onDelete={onDeleteExercise && editingExercise ? () => {
          if (window.confirm('Xóa toàn bộ bài tập này?')) {
            onDeleteExercise(editingExercise.id);
            onCancel();
          }
        } : undefined}
        renderMoreSection={renderMoreSection}
        shell={{
          onSave: () => handleSave('stay'),
          onSaveAndReturn: () => handleSave('return'),
          onExportDocx: () => handleExportDocx('student'),
          onPrint: handleExportPdf,
          onBack: onCancel,
          zoom,
          onZoom: setZoom,
          previewMode: activeTab === 'preview',
          onPreviewMode: (preview) => setActiveTab(preview ? 'preview' : 'edit_mode'),
          undo: { onUndo: handleUndo, onRedo: handleRedo, canUndo: historyIndex > 0, canRedo: historyIndex < history.length - 1 },
        }}
        locked={activeTab === 'preview'}
      />


      {/* ──────── 2-COLUMN MAIN LAYOUT ──────── */}
      <main ref={mainRef} className="flex-1 min-h-0 p-4 md:p-6 flex flex-col xl:flex-row gap-4 xl:gap-0 items-stretch overflow-y-auto xl:overflow-hidden">
        {/* ═══════════════ CỘT TRÁI: CONTENT EDITOR ═══════════════ */}
        <div ref={leftColRef} className={`min-w-0 w-full xl:w-[var(--left-w)] xl:shrink-0 flex flex-col gap-3 xl:h-full xl:overflow-y-auto rounded-2xl border border-slate-200 bg-white/30 p-3 transition-opacity ${activeTab === 'preview' ? 'opacity-60 select-none' : ''}`} style={{ ['--left-w' as string]: `${leftPct}%` }}>
          {/* 1. Exercise Content */}
          <section className="bg-white/50 border border-slate-100 rounded-2xl p-4 shadow-xs space-y-3 shrink-0">
            <SectionHead
              n={1}
              title="Exercise Content"
              help="Tiêu đề và hướng dẫn in trên phiếu. Số bài tự đánh theo vị trí trong đề."
              badge={
                <span className="px-2.5 py-0.5 rounded-full bg-white/80 border border-blue-200 text-[11px] font-bold text-blue-700 shadow-2xs">
                  Exercise {exerciseNumber}
                </span>
              }
            />
            <div className="space-y-3 pt-1">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Exercise Title</label>
                <input type="text" value={data.exerciseTitle} onChange={(e) => update({ exerciseTitle: e.target.value })} className={`${fieldCls} font-semibold`} />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Instruction <span className="font-normal text-slate-400">(optional)</span></label>
                <textarea rows={2} value={data.instruction} onChange={(e) => update({ instruction: e.target.value })} className={`${fieldCls} resize-y`} />
              </div>

              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                aria-expanded={moreOpen}
                className="w-full flex items-center justify-between text-[11px] font-semibold text-slate-500 hover:text-slate-800"
              >
                <span className="flex items-center gap-1.5"><ChevronDown size={13} className={`transition-transform ${moreOpen ? '' : '-rotate-90'}`} /> Show more options</span>
                <span className="text-slate-400 font-normal">ghi chú, điểm, thời lượng, kỹ năng</span>
              </button>

              {moreOpen && (
                <div className="space-y-3 pt-1 border-t border-slate-100">
                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Points</label>
                      <input type="number" min={0} placeholder="e.g. 5" value={data.pointsTotal ?? ''} onChange={(e) => update({ pointsTotal: e.target.value === '' ? undefined : Number(e.target.value) })} className={fieldCls} />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Level</label>
                      <select value={titleLevel} onChange={(e) => updateSettings({ headingFontSizePt: LEVEL_PT[e.target.value as keyof typeof LEVEL_PT] })} className={fieldCls} title="Cỡ chữ tiêu đề bài">
                        <option value="H1">H1</option><option value="H2">H2</option><option value="H3">H3</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Time (phút)</label>
                      <input type="number" min={0} placeholder="e.g. 8" value={data.estimatedMinutes ?? ''} onChange={(e) => update({ estimatedMinutes: e.target.value === '' ? undefined : Number(e.target.value) })} className={fieldCls} title="Thời lượng dự kiến cho giáo viên, không in" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Ghi chú in dưới hướng dẫn</label>
                    <input type="text" placeholder="vd. Work in pairs. / Look at the example." value={data.notes ?? ''} onChange={(e) => update({ notes: e.target.value })} className={fieldCls} />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Ghi chú cho giáo viên <span className="font-normal text-slate-400">(không in)</span></label>
                    <textarea rows={2} placeholder="vd. Cho học sinh nghe lại đoạn 3 nếu cần; gợi ý: tên địa danh ở cuối mỗi đoạn." value={data.teacherNote ?? ''} onChange={(e) => update({ teacherNote: e.target.value })} className={`${fieldCls} resize-y`} />
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-slate-600 block mb-1">Kỹ năng <span className="font-normal text-slate-400">(để phân loại giáo trình, không in)</span></span>
                    <div className="flex flex-wrap gap-1.5">
                      {['Reading', 'Listening', 'Vocabulary', 'Speaking', 'Writing'].map((t) => {
                        const on = (data.skillTags || []).includes(t);
                        return (
                          <button
                            key={t}
                            type="button"
                            aria-pressed={on}
                            onClick={() => update({ skillTags: on ? (data.skillTags || []).filter((x) => x !== t) : [...(data.skillTags || []), t] })}
                            className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold ${on ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 2. Paragraph Source */}
          <section className="shrink-0 flex flex-col bg-white/50 border border-slate-200 rounded-2xl p-4 shadow-xs">
            <SectionHead n={2} title="Paragraph Source" help="Lấy đoạn văn từ một bài có sẵn trong đề, dán nhanh, hoặc nhập tay." open={openSec.source} onToggle={() => toggleSec('source')} />
            {openSec.source && (
            <div className="space-y-3 pt-3">

            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
              {([['linked', 'Link to Existing Exercise'], ['paste', 'Smart Paste'], ['manual', 'Enter Manually']] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setSrcTab(id);
                    if (id === 'linked') update({ source: { ...data.source, mode: 'linked', exerciseId: data.source.exerciseId || sourceExerciseOptions[0]?.id } });
                    if (id === 'manual') update({ source: { ...data.source, mode: 'manual' } });
                  }}
                  className={`py-1.5 px-1 rounded-lg leading-tight ${srcTab === id ? 'bg-white text-blue-700 shadow-xs ring-1 ring-blue-200' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {activeTab === 'preview' && (
              <span className="hidden 2xl:inline text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1">
                Chỉ xem – chọn Edit Mode để chỉnh sửa
              </span>
            )}

            {srcTab === 'linked' && (
              <div className="space-y-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Select source exercise</label>
                  <select
                    value={data.source.exerciseId || ''}
                    onChange={(e) =>
                      update({ source: { ...data.source, exerciseId: e.target.value, exerciseTitle: sourceExerciseOptions.find((x) => x.id === e.target.value)?.title } })
                    }
                    className={`${fieldCls} font-semibold`}
                  >
                    {sourceExerciseOptions.length === 0 && <option value="">— Chưa có bài Listening Gap Fill nào trong đề này —</option>}
                    {sourceExerciseOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.title}</option>)}
                  </select>
                </div>
                {sourceExerciseOptions.length === 0 ? (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed">
                    Đề này chưa có bài <b>Listening Fill in the Gap</b> để liên kết. Hãy tạo bài đó trước, hoặc dùng Smart Paste / Enter Manually.
                  </div>
                ) : (
                  <div className="p-2.5 bg-blue-50/70 border border-blue-100 rounded-xl text-[11px] text-blue-800 leading-relaxed flex items-start gap-2">
                    <Info size={14} className="shrink-0 mt-0.5 text-blue-600" />
                    <span>{data.paragraphs.length} đoạn văn từ bài đã chọn sẽ được dùng ở đây. Khi bạn sửa bài đó, các đoạn ở đây tự cập nhật theo.</span>
                  </div>
                )}
              </div>
            )}

            {srcTab === 'paste' && (
              <div className="space-y-2">
                <textarea
                  rows={7}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={'Paragraph 1: Go on a Big Bus tour...\n\nParagraph 2: Visit the Tate Modern...\n\nParagraph 3: Meet famous sports people...'}
                  className={`${fieldCls} font-mono leading-relaxed`}
                />
                <SmartLayoutBar kind="Matching Pictures (paragraphs)" hint="Mỗi đoạn văn bắt đầu bằng 'Paragraph N:' hoặc 'N.' và cách nhau một dòng trống." example={'Paragraph 1: Go on a Big Bus tour...\n\nParagraph 2: Visit the Tate Modern...\n\nParagraph 3: Meet famous sports people...'} text={pasteText} onText={setPasteText} layouts={SMART_LAYOUTS} current={String(data.settings.layout)} onLayout={(id) => updateSettings({ layout: id } as never)} />
                <AiRewriteBox kind="Matching Pictures (paragraphs)" hint="Mỗi đoạn văn bắt đầu bằng 'Paragraph N:' hoặc 'N.' và cách nhau một dòng trống." example={'Paragraph 1: Go on a Big Bus tour...\n\nParagraph 2: Visit the Tate Modern...\n\nParagraph 3: Meet famous sports people...'} text={pasteText} onText={setPasteText} />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10.5px] text-slate-400">Mỗi đoạn bắt đầu bằng “Paragraph N:” hoặc “N.”. Có thể Undo.</span>
                  <button type="button" onClick={handleApplySmartPaste} disabled={!pasteText.trim()} className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-xl shrink-0">Tách đoạn &amp; áp dụng</button>
                </div>
              </div>
            )}

            {srcTab === 'manual' && (
              <button type="button" onClick={handleAddParagraph} className="px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1">
                <Plus size={12} /> Thêm đoạn
              </button>
            )}

            <div className="space-y-1.5">
              {data.paragraphs.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-3 border border-dashed border-slate-200 rounded-xl">Chưa có đoạn văn nào.</p>
              )}
              {data.paragraphs.map((p, idx) => {
                const isExpanded = !!expandedParaIds[p.id];
                const editable = data.source.mode === 'manual';
                return (
                  <div
                    key={p.id}
                    onDragOver={(e) => { if (editable && dragPara.current !== null) e.preventDefault(); }}
                    onDrop={() => {
                      if (!editable || dragPara.current === null || dragPara.current === idx) return;
                      handleReorderParagraph(dragPara.current, idx);
                      dragPara.current = null;
                    }}
                    className="border border-slate-200 rounded-xl bg-white overflow-hidden"
                  >
                    <div className="flex items-start gap-2 px-2 py-2">
                      <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">{p.order}</span>
                      <span
                        draggable={editable}
                        onDragStart={() => { dragPara.current = idx; }}
                        onDragEnd={() => { dragPara.current = null; }}
                        className={`mt-1 shrink-0 ${editable ? 'text-slate-300 hover:text-slate-600 cursor-grab' : 'text-slate-200 cursor-not-allowed'}`}
                        title={editable ? 'Kéo để đổi thứ tự đoạn' : 'Đoạn lấy từ bài liên kết nên thứ tự theo bài đó'}
                      >
                        <GripVertical size={14} />
                      </span>
                      <button type="button" onClick={() => toggleParaExpand(p.id)} aria-expanded={isExpanded} className="flex-1 min-w-0 text-left">
                        <span className={`block text-xs text-slate-700 leading-snug ${isExpanded ? '' : 'line-clamp-2'}`}>{p.text || '(trống)'}</span>
                      </button>
                      <button type="button" onClick={() => toggleParaExpand(p.id)} className="text-slate-400 shrink-0 mt-1" aria-label={isExpanded ? 'Thu gọn' : 'Mở rộng'}>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="p-2.5 bg-slate-50/70 border-t border-slate-100 space-y-2">
                        <textarea
                          rows={4}
                          value={p.text}
                          readOnly={!editable}
                          onChange={(e) => handleUpdateParagraphText(p.id, e.target.value)}
                          className={`${fieldCls} leading-relaxed ${!editable ? 'bg-slate-100 text-slate-600' : ''}`}
                        />
                        {editable ? (
                          <div className="flex justify-end">
                            <button type="button" onClick={() => handleDeleteParagraph(p.id)} className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1"><Trash2 size={12} /> Xóa đoạn</button>
                          </div>
                        ) : (
                          <p className="text-[10.5px] text-slate-400">Đoạn này lấy từ bài đã liên kết, sửa ở bài đó.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            </div>
            )}
          </section>

          {/* 3. Image Manager */}
          <section className="shrink-0 flex flex-col bg-white/50 border border-slate-200 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center gap-2 [&>div]:flex-1">
              <SectionHead n={3} title="Image Manager" help="Mỗi ảnh tự có nhãn A, B, C... Kéo thả để đổi thứ tự." open={openSec.images} onToggle={() => toggleSec('images')} />
            </div>
            {openSec.images && (
            <div className="space-y-3 pt-3">
            <div className="flex items-center gap-2">
              <label className="flex-1 px-3 py-1.5 bg-white border border-blue-300 text-blue-700 hover:bg-blue-50 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer">
                <Upload size={13} /> Upload Images
                <input type="file" multiple accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { void handleUploadImages(e); }} />
              </label>
              <button type="button" onClick={() => setShowGallery(true)} className="flex-1 px-3 py-1.5 bg-white border border-blue-300 text-blue-700 hover:bg-blue-50 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5">
                <Images size={13} /> Add from Gallery
              </button>
            </div>

            <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-2.5 space-y-2">
              <div className="text-[11px] font-bold text-violet-800 flex items-center gap-1.5"><Wand2 size={12} /> Tạo ảnh AI</div>
              <div className="flex items-center gap-2">
                <input
                  value={aiSubject}
                  onChange={(e) => setAiSubject(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && aiSubject.trim() && !aiGen.busy) setAiCfgOpen(true); }}
                  placeholder="Địa điểm / chủ đề, ví dụ: Hard Rock Café, London"
                  className="flex-1 min-w-0 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                />
                <button
                  type="button"
                  onClick={() => setAiCfgOpen(true)}
                  disabled={!aiSubject.trim() || aiGen.busy}
                  className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 shrink-0"
                >
                  {aiGen.busy ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                  {aiGen.busy ? 'Generating…' : 'Generate AI image'}
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  const caption = aiSubject.trim();
                  if (!caption) return;
                  update({ images: [...data.images, { id: `img_${Date.now()}_slot`, order: data.images.length, label: deriveImageLabel(data.images.length), imageUrl: '', caption }] });
                  setAiSubject('');
                }}
                disabled={!aiSubject.trim()}
                className="text-[11px] font-semibold text-violet-700 hover:underline disabled:opacity-40"
                title="Tạo sẵn ô ảnh có tên chủ đề, ảnh sẽ được tạo ở AI Image Studio (Generate all) và gắn đúng ô này"
              >
                + Thêm ô ảnh trống (tạo sau ở AI Image Studio)
              </button>
              {aiGen.msg && (
                <p className={`text-[11px] rounded-md px-2 py-1 border ${aiGen.busy ? 'text-blue-700 bg-blue-50 border-blue-100' : 'text-amber-700 bg-amber-50 border-amber-100'}`}>{aiGen.msg}</p>
              )}
              <ImageRunConfigDialog
                open={aiCfgOpen}
                onClose={() => setAiCfgOpen(false)}
                generating={aiGen.busy}
                prompt={aiSubject}
                onPromptChange={setAiSubject}
                onRun={() => { void generateAiImage(); }}
              />
            </div>

            {data.images.length === 0 ? (
              <div className="text-center py-5 border border-dashed border-slate-300 rounded-2xl text-xs text-slate-400 space-y-2">
                <p>Chưa có ảnh. Upload hoặc thêm từ Gallery (mỗi ảnh tự có nhãn A, B, C...).</p>
                <button type="button" onClick={loadSampleLondon} className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50">Nạp bài mẫu London</button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {data.images.map((img, idx) => (
                  <div
                    key={img.id}
                    draggable
                    onDragStart={() => { dragImg.current = idx; }}
                    onDragEnd={() => { dragImg.current = null; }}
                    onDragOver={(e) => { if (dragImg.current !== null) e.preventDefault(); }}
                    onDrop={() => {
                      if (dragImg.current === null || dragImg.current === idx) return;
                      update({ images: reorderImages(data.images, dragImg.current, idx) });
                      dragImg.current = null;
                    }}
                    className="relative border border-slate-200 rounded-xl overflow-hidden bg-slate-50 cursor-grab active:cursor-grabbing"
                    title="Kéo để đổi thứ tự (nhãn A, B, C tự đánh lại)"
                  >
                    <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-md bg-white/95 border border-slate-300 font-extrabold text-[11px] text-slate-900 flex items-center justify-center z-10">{img.label}</div>
                    <div className="absolute top-1.5 right-1.5 flex items-center gap-1 z-10">
                      <label className="p-1 rounded-md bg-white/95 border border-slate-300 text-blue-600 hover:text-blue-800 cursor-pointer" title="Thay ảnh">
                        <Pencil size={11} />
                        <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void handleReplaceImage(img.id, f); }} />
                      </label>
                      <button type="button" onClick={() => handleDeleteImage(img.id)} className="p-1 rounded-md bg-white/95 border border-slate-300 text-rose-500 hover:text-rose-700" title="Xóa ảnh"><Trash2 size={11} /></button>
                    </div>
                    {img.imageUrl ? (
                      <img src={img.imageUrl} alt={img.caption || `Image ${img.label}`} className="w-full h-[84px] object-contain bg-slate-100" onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0.25'; }} />
                    ) : (
                      <div className="w-full h-[84px] bg-slate-100 border-b border-dashed border-slate-300 text-[10px] font-semibold text-slate-400 flex items-center justify-center">Chưa có ảnh</div>
                    )}
                    <input
                      type="text"
                      placeholder="Caption..."
                      value={img.caption || ''}
                      onChange={(e) => update({ images: data.images.map((im) => (im.id === img.id ? { ...im, caption: e.target.value } : im)) })}
                      className="w-full px-1.5 py-1 text-[10.5px] font-semibold text-slate-700 bg-white border-t border-slate-100 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            )}
            </div>
            )}
          </section>
        </div>

        {/* ── Thanh kéo chia 2 cột (kiểu cửa sổ Windows): kéo để đổi độ rộng, nhấp đúp để đặt lại ── */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Kéo để đổi độ rộng hai cột"
          title="Kéo để đổi độ rộng · nhấp đúp để đặt lại"
          onPointerDown={handleDividerDown}
          onPointerMove={handleDividerMove}
          onPointerUp={handleDividerUp}
          onPointerCancel={handleDividerUp}
          onDoubleClick={() => setLeftPct(DEFAULT_LEFT_PCT)}
          className="hidden xl:flex shrink-0 self-stretch w-5 mx-0.5 items-center justify-center cursor-col-resize group touch-none select-none"
        >
          <div className={`w-1 h-full min-h-24 rounded-full transition-colors ${isDragging ? 'bg-blue-500' : 'bg-slate-200 group-hover:bg-blue-400'}`} />
        </div>

        {/* ═══════════════ CỘT PHẢI: XEM TRƯỚC A4 ═══════════════ */}
        <div className="flex-1 min-w-0 flex flex-col gap-3 xl:h-full rounded-2xl border border-slate-200 bg-white/30 p-3">
          <div className="bg-white/50 border border-slate-200 rounded-2xl px-2 py-1.5 flex flex-wrap items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-1">
              {([['preview', 'Preview'], ['edit_mode', 'Edit Mode']] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${activeTab === id ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-700 shrink-0 [&_button]:!w-7 [&_button]:!h-7">
              {fitMsg && !fitting && <span className="text-[11px] text-slate-500 mr-1 hidden 2xl:inline">{fitMsg}</span>}
              <div className="inline-flex items-center bg-white border border-slate-200 rounded-lg shadow-xs px-0.5">
                <button type="button" onClick={() => setZoom((z) => Math.max(50, z - 10))} className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-50 rounded-lg" title="Thu nhỏ"><Minus size={14} /></button>
                <span className="w-11 text-center">{zoom}%</span>
                <button type="button" onClick={() => setZoom((z) => Math.min(150, z + 10))} className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-50 rounded-lg" title="Phóng to"><Plus size={14} /></button>
              </div>
              <button type="button" onClick={() => setIsFullscreen(true)} className="inline-flex items-center bg-white border border-slate-200 rounded-lg shadow-xs w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-50 rounded-lg" title="Phóng to trang đang soạn"><Maximize2 size={14} /></button>
              <button type="button" onClick={() => { setZoom(100); setIsFullscreen(false); }} className="inline-flex items-center bg-white border border-slate-200 rounded-lg shadow-xs w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-50 rounded-lg" title="Thu nhỏ về 100%"><Minimize size={14} /></button>
              <button type="button" onClick={handleExportPdf} className="inline-flex items-center bg-white border border-slate-200 rounded-lg shadow-xs w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-50 rounded-lg" title="In trang A4"><Printer size={15} /></button>
            </div>
          </div>

          <div ref={paneRef} className="flex-1 min-h-0 overflow-auto bg-slate-200/60 p-3 rounded-2xl shadow-inner">
            {renderA4(fitScale * (zoom / 100), activeTab === 'edit_mode')}
          </div>
        </div>
      </main>

      {/* Bản đo ẩn để Auto fit to A4 */}
      {fitting && (
        <div ref={measureRef} aria-hidden="true" style={{ position: 'fixed', left: -99999, top: 0, width: '210mm', visibility: 'hidden', pointerEvents: 'none' }}>
          {renderA4(1, false)}
        </div>
      )}

      {showGallery && (
        <MatchingPicturesGalleryPicker folder={folder} onClose={() => setShowGallery(false)} onPick={handleAddFromGallery} />
      )}

      {/* ──────── FULLSCREEN PREVIEW MODAL ──────── */}
      {isFullscreen && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex flex-col z-50">
          <div className="p-4 flex items-center justify-between text-white border-b border-white/10">
            <span className="font-bold text-sm">A4 Live Print Preview - Matching Pictures</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleExportPdf}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <Printer size={14} /> In / PDF
              </button>
              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-white/70 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-8 flex justify-center">
            <div
              className="bg-white text-[#111] shadow-2xl"
              style={{
                width: '210mm',
                minHeight: '297mm',
                padding: '16mm 14mm 14mm 14mm',
              }}
            >
              <BrandHeader b={brand} />
              <div className="mt-4">
                <RichMarksProvider marks={data.richMarks}>
                <MatchingPicturesRenderer
                  data={data}
                  isTeacherKey={data.settings.showTeacherKey}
                  exerciseIndex={data.exerciseNumber || 4}
                />
                </RichMarksProvider>
              </div>
              <div className="mt-8 pt-4 border-t border-slate-200">
                <BrandFooter b={brand} pageNumber={1} totalPages={1} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
