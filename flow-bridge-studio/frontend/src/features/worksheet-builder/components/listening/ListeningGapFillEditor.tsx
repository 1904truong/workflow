import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Check, Plus, Trash2, Copy, ImagePlus, X, ClipboardPaste, Maximize2, Expand, Minus, ChevronLeft, ChevronRight, ChevronDown, Eye, Play, Pause, Headphones, Upload, FileDown, Printer, MoreHorizontal, Undo2, Redo2, Save, Link2, QrCode, AlertCircle } from 'lucide-react';
import type { LessonFolder, Exercise, Worksheet } from '../../types';
import type {
  ListeningGapFillData,
  ListeningParagraph,
  ListeningParagraphFormat,
  ListeningExtra,
  ListeningExtraType,
} from '../../services/listening/listeningGapFillCore';
import {
  createListeningGapFill,
  insertBlankInParagraph,
  getNextBlankLabel,
  normalizeAudioLink,
  formatAudioDuration,
  getAudioQrCodeUrl,
  layoutSupportsImages,
  parseListeningSmartPaste,
  DIALOGUE_PRESET,
  OUTLINE_PRESET,
  PASSAGE_IMAGE_PRESET,
} from '../../services/listening/listeningGapFillCore';
import { askExtension, generateImageViaExtension } from '../../services/ai/extensionBridge';
import { buildFinalPrompt } from '../../services/ai/imagePlanCompare';
import { PHOTO_STYLE, friendlyExtensionError } from '../../services/matching/autoMatching';
import { ListeningGapFillRenderer } from './ListeningGapFillRenderer';
import { WorksheetRenderer } from '../preview/WorksheetRenderer';
import { ListeningToolbar, type MoreSectionKey } from './ListeningToolbar';
import { BrandHeader } from '../preview/BrandHeader';
import { BrandFooter } from '../preview/BrandFooter';
import { resolveBranding, fileToSmallDataUrl } from '../../types/branding';
import { exportWorksheetToDocx } from '../../services/docxExportService';

interface Props {
  folder: LessonFolder;
  editingExercise?: Exercise | null;
  onSaveExercise: (exercise: Exercise, nextAction: 'return' | 'add_another' | 'stay') => void;
  onCancel: () => void;
  onDeleteExercise?: (exerciseId: string) => void;
}

// Link blob: chỉ sống trong phiên trình duyệt đã tạo ra nó – sau khi tải lại trang thì bỏ đi; link công khai được giữ nguyên
const dropDeadBlob = (d: ListeningGapFillData): ListeningGapFillData =>
  d.audio?.audioUrl?.startsWith('blob:') ? { ...d, audio: { ...d.audio, audioUrl: undefined } } : d;

export const ListeningGapFillEditor: React.FC<Props> = ({
  folder,
  editingExercise,
  onSaveExercise,
  onCancel,
  onDeleteExercise,
}) => {
  // Initialize listening state
  const [data, setDataRaw] = useState<ListeningGapFillData>(() => {
    if (editingExercise?.listeningGapFill) {
      const saved = dropDeadBlob(editingExercise.listeningGapFill);
      const st = saved.settings;
      // Migrate untouched earlier defaults to the current worksheet look
      const old = (st.passageFontSizePt === 12 && st.blankWidthMm === 30 && st.imageWidthPercent === 30) ||
        (st.passageFontSizePt === 10.5 && st.blankWidthMm === 22 && st.imageWidthPercent === 22);
      if (old) {
        return { ...saved, settings: { ...st, passageFontSizePt: 12, blankWidthMm: 26, imageWidthPercent: 22, lineHeight: 1.7 } };
      }
      return saved;
    }
    return createListeningGapFill({
      exerciseTitle: editingExercise?.title || 'LISTEN AND FILL IN THE GAP',
      passageTitle: 'THINGS TO SEE AND DO IN LONDON',
      exerciseNumber: 3,
    });
  });

  // ── Undo / Redo: lịch sử snapshot (gộp các thay đổi liên tiếp trong 500ms) ──
  const dataRef = useRef<ListeningGapFillData>(data);
  const pastRef = useRef<ListeningGapFillData[]>([]);
  const futureRef = useRef<ListeningGapFillData[]>([]);
  const lastPushRef = useRef<number>(0);
  const setData = (next: React.SetStateAction<ListeningGapFillData>) => {
    const prev = dataRef.current;
    const val = typeof next === 'function' ? (next as (p: ListeningGapFillData) => ListeningGapFillData)(prev) : next;
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
  };
  const handleUndo = () => {
    const prev = pastRef.current.pop();
    if (!prev) return;
    futureRef.current.push(dataRef.current);
    dataRef.current = prev;
    lastPushRef.current = 0;
    setDataRaw(prev);
  };
  const handleRedo = () => {
    const nxt = futureRef.current.pop();
    if (!nxt) return;
    pastRef.current.push(dataRef.current);
    dataRef.current = nxt;
    lastPushRef.current = 0;
    setDataRaw(nxt);
  };
  const canUndo = pastRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  // Id cố định của bài (bài mới được tạo một lần, các lần lưu sau chỉ cập nhật)
  const exerciseIdRef = useRef<string>(editingExercise?.id || `ex_${Date.now()}`);
  const imageSupported = layoutSupportsImages(data.settings.layout);

  // Tự lưu vào thư mục sau khi ngừng chỉnh ~0.8s → tải lại trang vẫn còn QR/audio link; chỉ xóa mới mất
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  const requestExit = () => {
    if (isDirty) setShowExitConfirm(true);
    else onCancel();
  };
  useEffect(() => {
    if (!isDirty) return;
    const warn = (ev: BeforeUnloadEvent) => { ev.preventDefault(); ev.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);
  const autosaveReady = useRef(false);
  const latestRef = useRef<{ build: () => Exercise; save: Props['onSaveExercise'] } | null>(null);
  useEffect(() => {
    if (!autosaveReady.current) {
      autosaveReady.current = true;
      return;
    }
    setSaveStatus('saving');
    setIsDirty(true);
    const h = window.setTimeout(() => {
      const cur = latestRef.current;
      if (!cur) return;
      cur.save(cur.build(), 'stay');
      setSaveStatus('saved');
    }, 800);
    return () => window.clearTimeout(h);
  }, [data]);

  const [activeTab, setActiveTab] = useState<'preview' | 'edit_mode'>('edit_mode');
  const [zoom, setZoom] = useState<number>(100);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showSmartPaste, setShowSmartPaste] = useState<boolean>(false);
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const [, setSelectedBlankId] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [activeParagraphIndex, setActiveParagraphIndex] = useState<number>(0);

  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const el = document.getElementById('app-header-actions');
    setSlot(el);
    // Thanh header của editor thay cho breadcrumb + tên trường của app: ẩn các phần còn lại
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

  const [fitScale, setFitScale] = useState<number>(0.72);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const A4_W_PX = (210 / 25.4) * 96;
    const A4_H_PX = (297 / 25.4) * 96;
    const measure = () => {
      const cs = getComputedStyle(el);
      const innerW = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const innerH = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      if (innerW > 0 && innerH > 0) {
        const scaleW = innerW / A4_W_PX;
        const scaleH = innerH / A4_H_PX;
        // Tự động căn tỷ lệ để trọn vẹn cả chiều cao và chiều rộng trang A4 không bị cuộn
        setFitScale(Math.min(1.0, Math.max(0.2, Math.min(scaleW, scaleH))));
      } else if (innerW > 0) {
        setFitScale(Math.min(0.95, innerW / A4_W_PX));
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blankRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const brand = resolveBranding(folder.printSettings.branding);

  // Update helpers
  const update = (patch: Partial<ListeningGapFillData>) => {
    setData((prev) => ({ ...prev, ...patch }));
    setSaveStatus('saving');
    setTimeout(() => setSaveStatus('saved'), 600);
  };

  const updateSettings = (patch: Partial<ListeningGapFillData['settings']>) => {
    setData((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...patch },
    }));
    setSaveStatus('saving');
    setTimeout(() => setSaveStatus('saved'), 600);
  };

  // ── Quản lý thu gọn / mở rộng các khối chức năng ở cột bên trái ──
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    exerciseInfo: true,
    audioQr: true,
    passage: true,
    extras: true,
  });
  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ── Định dạng đoạn đang chọn / phần tử chèn thêm ──
  const [selectedExtraId, setSelectedExtraId] = useState<string | null>(null);
  const selectedExtra = (data.extras || []).find((x) => x.id === selectedExtraId) || null;

  const handleParaFormat = (patch: ListeningParagraphFormat) => {
    const paras = [...data.paragraphs];
    const cur = paras[activeParagraphIndex];
    if (!cur) return;
    paras[activeParagraphIndex] = { ...cur, format: { ...cur.format, ...patch } };
    update({ paragraphs: paras });
  };

  const updateExtras = (fn: (list: ListeningExtra[]) => ListeningExtra[]) =>
    update({ extras: fn(data.extras || []) });

  const handleAddExtra = (type: ListeningExtraType) => {
    const id = `x_${Date.now()}`;
    const base: ListeningExtra = { id, type, align: 'center', widthPercent: 100 };
    const extra: ListeningExtra =
      type === 'text' ? { ...base, text: 'Text box' }
      : type === 'shape' ? { ...base, widthPercent: 40, shape: 'rect', text: '' }
      : type === 'table' ? { ...base, rows: 3, cols: 3, cells: [] }
      : base;
    updateExtras((l) => [...l, extra]);
    setSelectedExtraId(id);
  };

  const handleMoveExtra = (dir: 'up' | 'down') => {
    if (!selectedExtraId) return;
    updateExtras((l) => {
      const i = l.findIndex((x) => x.id === selectedExtraId);
      const j = dir === 'up' ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= l.length) return l;
      const copy = [...l];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  };

  const patchExtra = (id: string, patch: Partial<ListeningExtra>) =>
    updateExtras((l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const handleAlignExtra = (align: 'left' | 'center' | 'right') => {
    if (selectedExtraId) patchExtra(selectedExtraId, { align });
  };

  const handleClearFormat = () => {
    const paras = [...data.paragraphs];
    const cur = paras[activeParagraphIndex];
    if (!cur) return;
    paras[activeParagraphIndex] = { ...cur, format: undefined };
    update({ paragraphs: paras });
  };

  const handleDuplicateExtra = () => {
    if (!selectedExtra) return;
    const copy: ListeningExtra = {
      ...selectedExtra,
      id: `x_${Date.now()}`,
      cells: selectedExtra.cells?.map((r) => [...r]),
    };
    updateExtras((l) => {
      const i = l.findIndex((x) => x.id === selectedExtra.id);
      const out = [...l];
      out.splice(i + 1, 0, copy);
      return out;
    });
    setSelectedExtraId(copy.id);
  };

  const handleDeleteExtra = (id: string) => {
    updateExtras((l) => l.filter((x) => x.id !== id));
    if (selectedExtraId === id) setSelectedExtraId(null);
  };

  const setTableCell = (x: ListeningExtra, r: number, c: number, v: string) => {
    const cells = (x.cells || []).map((row) => [...row]);
    while (cells.length <= r) cells.push([]);
    cells[r][c] = v;
    patchExtra(x.id, { cells });
  };

  const renderMoreSection = (key: MoreSectionKey): React.ReactNode => {
    switch (key) {
      case 'blank':
        return (
          <div className="space-y-2 text-xs">
{/* 2. Blank Settings */}
              <div className="space-y-2">
                

                {/* Blank Style: Box, Dotted */}
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold block mb-1">Blank style</span>
                  <div className="grid grid-cols-3 gap-1">
                    {(['underline', 'box', 'dotted'] as const).map((style) => {
                      const on = data.settings.blankStyle === style;
                      return (
                        <button
                          key={style}
                          type="button"
                          onClick={() => updateSettings({ blankStyle: style })}
                          className={`py-1 rounded-xl text-xs font-semibold border capitalize transition-all ${
                            on ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold' : 'border-slate-200 bg-white text-slate-600'
                          }`}
                        >
                          {style}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Blank Numbering */}
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold block mb-0.5">Blank numbering</span>
                  <select
                    value={data.settings.blankNumbering}
                    onChange={(e) => updateSettings({ blankNumbering: e.target.value as any })}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                  >
                    <option value="letters_lower">a, b, c, ... (a–m)</option>
                    <option value="numbers">1, 2, 3, ... (1–13)</option>
                    <option value="letters_upper">A, B, C, ... (A–M)</option>
                  </select>
                </div>

                {/* Auto number blanks toggle */}
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer pt-0.5">
                  <input
                    type="checkbox"
                    checked={data.settings.autoNumberBlanks}
                    onChange={(e) => updateSettings({ autoNumberBlanks: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-0"
                  />
                  <span>Auto number blanks</span>
                </label>

                {/* Blank Width Slider */}
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-0.5">
                    <span className="font-semibold text-slate-500">Blank width</span>
                    <span className="font-mono font-bold text-blue-600">{data.settings.blankWidthMm} mm</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={60}
                    step={2}
                    value={data.settings.blankWidthMm}
                    onChange={(e) => updateSettings({ blankWidthMm: Number(e.target.value) })}
                    className="w-full accent-blue-600"
                  />
                </div>
              </div>

              
          </div>
        );
      case 'image':
        return (
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-3 p-2 border border-slate-200 rounded-lg bg-white">
              {data.headerImage?.url ? (
                <img src={data.headerImage.url} alt="" className="h-12 w-auto max-w-[72px] object-contain" />
              ) : (
                <div className="w-12 h-12 rounded-md border border-dashed border-slate-300 bg-slate-50 text-[10px] text-slate-400 flex items-center justify-center text-center">Chưa có</div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800">Ảnh nhân vật ở đầu bài</p>
                <p className="text-[10.5px] text-slate-500">Hiện ở góc phải hàng tiêu đề (ở mọi layout)</p>
              </div>
              <label className="px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 bg-white border border-blue-300 hover:bg-blue-50 rounded-lg cursor-pointer">
                Chọn ảnh
                <input type="file" accept="image/*" hidden onChange={async (ev) => {
                  const f = ev.target.files?.[0];
                  ev.target.value = '';
                  if (!f) return;
                  try { update({ headerImage: { url: await fileToSmallDataUrl(f, 600, 'image/png') } }); } catch { alert('Không đọc được file ảnh.'); }
                }} />
              </label>
              {data.headerImage?.url && <button type="button" onClick={() => update({ headerImage: undefined })} className="text-[11px] font-semibold text-rose-600 hover:underline">Xóa</button>}
            </div>
{/* 3. Image Settings */}
              <div className="space-y-2">
                

                <div>
                  <span className="text-[10px] text-slate-500 font-semibold block mb-1">Image position</span>
                  <div className="grid grid-cols-4 gap-1">
                    {(
                      [
                        { id: 'right', label: 'Right' },
                        { id: 'left', label: 'Left' },
                        { id: 'top', label: 'Top' },
                        { id: 'none', label: 'None' },
                      ] as const
                    ).map((pos) => {
                      const on = data.settings.imagePosition === pos.id;
                      return (
                        <button
                          key={pos.id}
                          type="button"
                          onClick={() => updateSettings({ imagePosition: pos.id })}
                          className={`py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                            on ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold' : 'border-slate-200 bg-white text-slate-600'
                          }`}
                        >
                          {pos.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {data.settings.imagePosition !== 'none' && (
                  <div>
                    <div className="flex items-center justify-between text-[11px] mb-0.5">
                      <span className="font-semibold text-slate-500">Image width</span>
                      <span className="font-mono font-bold text-blue-600">{data.settings.imageWidthPercent}%</span>
                    </div>
                    <input
                      type="range"
                      min={15}
                      max={50}
                      step={5}
                      value={data.settings.imageWidthPercent}
                      onChange={(e) => updateSettings({ imageWidthPercent: Number(e.target.value) })}
                      className="w-full accent-blue-600"
                    />
                  </div>
                )}

                <div className="space-y-1 pt-1 text-xs text-slate-700">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={data.settings.maintainAspectRatio}
                      onChange={(e) => updateSettings({ maintainAspectRatio: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-0"
                    />
                    <span>Maintain aspect ratio</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={data.settings.wrapTextAroundImage}
                      onChange={(e) => updateSettings({ wrapTextAroundImage: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-0"
                    />
                    <span>Wrap text around image</span>
                  </label>
                </div>
              </div>

              
          </div>
        );
      case 'answer':
        return (
          <div className="space-y-2 text-xs">
{/* 4. Answer Table Settings */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-600 uppercase flex items-center gap-1.5">
                    Answer Table Settings
                  </label>
                  <input
                    type="checkbox"
                    checked={data.settings.showAnswerSection}
                    onChange={(e) => updateSettings({ showAnswerSection: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-0"
                  />
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 font-semibold block mb-0.5">Answer layout</span>
                  <select
                    value={data.settings.answerLayout}
                    onChange={(e) => updateSettings({ answerLayout: e.target.value as any })}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                  >
                    <option value="grid">Grid (a–m)</option>
                    <option value="list">List</option>
                  </select>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 font-semibold block mb-1">Columns</span>
                  <div className="grid grid-cols-4 gap-1">
                    {([1, 2, 3, 4] as const).map((col) => {
                      const on = data.settings.answerColumns === col;
                      return (
                        <button
                          key={col}
                          type="button"
                          onClick={() => updateSettings({ answerColumns: col })}
                          className={`py-1 rounded-xl text-xs font-semibold border ${
                            on ? 'border-blue-600 bg-blue-600 text-white font-bold' : 'border-slate-200 bg-white text-slate-700'
                          }`}
                        >
                          {col}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 font-semibold block mb-1">Label style</span>
                  <div className="grid grid-cols-3 gap-1">
                    {(
                      [
                        { id: 'lowercase', label: 'a. b. c.' },
                        { id: 'uppercase', label: 'A. B. C.' },
                        { id: 'numeric', label: '1. 2. 3.' },
                      ] as const
                    ).map((style) => {
                      const on = data.settings.answerLabelStyle === style.id;
                      return (
                        <button
                          key={style.id}
                          type="button"
                          onClick={() => updateSettings({ answerLabelStyle: style.id })}
                          className={`py-1 rounded-xl text-[11px] font-semibold border ${
                            on ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold' : 'border-slate-200 bg-white text-slate-700'
                          }`}
                        >
                          {style.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              
          </div>
        );
      case 'typography':
        return (
          <div className="space-y-2 text-xs">
{/* 5. Typography */}
              <div className="space-y-2">
                

                <div>
                  <span className="text-[10px] text-slate-500 font-semibold block mb-0.5">Font family</span>
                  <select
                    value={data.settings.fontFamily}
                    onChange={(e) => updateSettings({ fontFamily: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                  >
                    <option value="Arial">Arial</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Roboto">Roboto</option>
                    <option value="Inter">Inter</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold block mb-0.5">Passage font size</span>
                    <select
                      value={data.settings.passageFontSizePt}
                      onChange={(e) => updateSettings({ passageFontSizePt: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                    >
                      <option value={10}>10 pt</option>
                      <option value={10.5}>10.5 pt</option>
                      <option value={11}>11 pt</option>
                      <option value={12}>12 pt</option>
                      <option value={13}>13 pt</option>
                      <option value={14}>14 pt</option>
                    </select>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold block mb-0.5">Line height</span>
                    <select
                      value={data.settings.lineHeight}
                      onChange={(e) => updateSettings({ lineHeight: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                    >
                      <option value={1.3}>1.3</option>
                      <option value={1.4}>1.4</option>
                      <option value={1.5}>1.5</option>
                      <option value={1.7}>1.7</option>
                    </select>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 font-semibold block mb-0.5">Paragraph spacing</span>
                  <select
                    value={data.settings.paragraphSpacing}
                    onChange={(e) => updateSettings({ paragraphSpacing: e.target.value as any })}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                  >
                    <option value="compact">Compact</option>
                    <option value="normal">Normal</option>
                    <option value="spacious">Spacious</option>
                  </select>
                </div>
              </div>

              
          </div>
        );
      case 'advanced':
        return (
          <div className="space-y-2 text-xs">
{/* 6. Advanced */}
              <div className="space-y-2">
                

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={data.settings.showExerciseTitle}
                      onChange={(e) => updateSettings({ showExerciseTitle: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-0"
                    />
                    <span>Show exercise title</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={data.settings.showQrCode}
                      onChange={(e) => updateSettings({ showQrCode: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-0"
                    />
                    <span>Show QR code</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={data.settings.showPassageTitle}
                      onChange={(e) => updateSettings({ showPassageTitle: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-0"
                    />
                    <span>Show passage title</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={data.settings.showPoints}
                      onChange={(e) => updateSettings({ showPoints: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-0"
                    />
                    <span>Show points</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={data.settings.showAudioIcon}
                      onChange={(e) => updateSettings({ showAudioIcon: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-0"
                    />
                    <span>Show audio icon</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={data.settings.pageBreakBefore}
                      onChange={(e) => updateSettings({ pageBreakBefore: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-0"
                    />
                    <span>Page break before exercise</span>
                  </label>
                </div>
              </div>

          </div>
        );
    }
  };

  // ── Chia 2 cột có thể kéo: lưu tỉ lệ cột trái ──
  const DEFAULT_LEFT_PCT = 42;
  const mainRef = useRef<HTMLElement | null>(null);
  const leftColRef = useRef<HTMLDivElement | null>(null);
  // Preview = chỉ xem: khóa cột soạn thảo (chuyển sang Edit Mode để chỉnh sửa)
  useEffect(() => {
    if (leftColRef.current) (leftColRef.current as HTMLDivElement & { inert: boolean }).inert = activeTab === 'preview';
  }, [activeTab]);
  const [isDragging, setIsDragging] = useState(false);
  const [leftPct, setLeftPct] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem('listening-editor-left-pct'));
      return v >= 25 && v <= 70 ? v : DEFAULT_LEFT_PCT;
    } catch {
      return DEFAULT_LEFT_PCT;
    }
  });
  useEffect(() => {
    try { localStorage.setItem('listening-editor-left-pct', String(leftPct)); } catch { /* bỏ qua */ }
  }, [leftPct]);
  const handleDividerDown = (ev: React.PointerEvent<HTMLDivElement>) => {
    ev.currentTarget.setPointerCapture(ev.pointerId);
    setIsDragging(true);
  };
  const handleDividerMove = (ev: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !mainRef.current) return;
    const rect = mainRef.current.getBoundingClientRect();
    const cs = getComputedStyle(mainRef.current);
    const inner = rect.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const pct = ((ev.clientX - rect.left - parseFloat(cs.paddingLeft)) / inner) * 100;
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

  // ── Blank Operations ──
  const nextLabel = getNextBlankLabel(data.blanks);

  const handleInsertBlank = () => {
    const updated = insertBlankInParagraph(data, activeParagraphIndex);
    setData(updated);
  };

  const handleUpdateParagraphText = (index: number, newText: string) => {
    const paras = [...data.paragraphs];
    paras[index] = { ...paras[index], text: newText };
    update({ paragraphs: paras });
  };

  const handleAddParagraph = () => {
    const nextOrder = data.paragraphs.length + 1;
    const newPara: ListeningParagraph = {
      id: `p_${Date.now()}`,
      order: nextOrder,
      text: `${nextOrder}. Enter paragraph text here...`,
    };
    update({ paragraphs: [...data.paragraphs, newPara] });
  };

  const handleDeleteParagraph = (pIndex: number) => {
    if (data.paragraphs.length <= 1) {
      alert('Bài nghe cần ít nhất một đoạn văn.');
      return;
    }
    if (window.confirm('Xóa đoạn văn này và các chỗ trống bên trong?')) {
      const targetPara = data.paragraphs[pIndex];
      const remainingParas = data.paragraphs
        .filter((_, i) => i !== pIndex)
        .map((p, i) => ({ ...p, order: i + 1 }));
      const remainingBlanks = data.blanks
        .filter((b) => b.paragraphId !== targetPara.id)
        .map((b, i) => ({ ...b, number: i + 1 }));

      update({ paragraphs: remainingParas, blanks: remainingBlanks, pointsTotal: remainingBlanks.length });
    }
  };

  // ── Audio Upload & Playback ──
  // Đọc thời lượng thật từ metadata của audio
  const readAudioDuration = (url: string, onDone: (seconds: number) => void) => {
    const probe = new Audio();
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => onDone(probe.duration);
    probe.onerror = () => onDone(0);
    probe.src = url;
  };

  // Cách 1: tải file từ máy / thư viện – chỉ nghe thử trong editor, chưa có link công khai để quét QR
  // ── Ảnh lớn cạnh bài đọc (layout 9) ──
  const handleBodyImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const url = await fileToSmallDataUrl(file, 1000, 'image/jpeg');
      const ratio = await new Promise<number>((resolve) => {
        const im = new Image();
        im.onload = () => resolve(im.naturalWidth && im.naturalHeight ? Math.round((im.naturalWidth / im.naturalHeight) * 100) / 100 : 1.5);
        im.onerror = () => resolve(1.5);
        im.src = url;
      });
      update({ bodyImage: { ...data.bodyImage, url, ratio } });
    } catch {
      alert('Không đọc được file ảnh.');
    }
  };

  const [bodyGen, setBodyGen] = useState<{ busy: boolean; msg: string }>({ busy: false, msg: '' });
  const buildBodyImagePrompt = (): string => {
    const title = data.passageTitle?.trim();
    const first = (data.paragraphs[0]?.text || '').replace(/\(([a-zA-Z0-9]+)\)\s*_{2,}/g, '').replace(/\s+/g, ' ').slice(0, 240);
    return `Illustration for a reading passage${title ? ` titled "${title}"` : ''}. ${first ? `Scene based on: ${first}` : ''}`.trim();
  };
  const generateBodyImage = async () => {
    const prompt = (data.bodyImage?.prompt || buildBodyImagePrompt()).trim();
    setBodyGen({ busy: true, msg: 'Đang tạo ảnh…' });
    let probeNote = '';
    try {
      const res = await askExtension<{ status?: string; message?: string }>('GET_FLOW_STATUS', {}, 5000);
      const st = res.payload?.status;
      if (!(st === 'CONNECTED' || st === 'FLOW_TAB_NOT_FOUND' || st === 'PROJECT_NOT_OPEN')) probeNote = friendlyExtensionError(res.payload?.message || res.error?.message || 'Extension chưa sẵn sàng tạo ảnh.');
    } catch {
      probeNote = 'Không kết nối được extension Flow Bridge. Hãy bật extension rồi tải lại trang (F5).';
    }
    if (probeNote) { setBodyGen({ busy: false, msg: probeNote }); setData((d) => ({ ...d, bodyImage: { ...d.bodyImage, prompt } })); return; }
    try {
      const res = await generateImageViaExtension({ prompt: buildFinalPrompt(prompt, PHOTO_STYLE), aspectRatio: '4:3' });
      setData((d) => ({ ...d, bodyImage: { url: res.imageUrl, ratio: 4 / 3, prompt } }));
      setBodyGen({ busy: false, msg: 'Đã tạo và gắn ảnh vào bài.' });
    } catch (err) {
      setBodyGen({ busy: false, msg: friendlyExtensionError(err instanceof Error ? err.message : 'Không tạo được ảnh') });
    }
  };

  const questions = data.questions || [];
  const setQuestions = (list: NonNullable<ListeningGapFillData['questions']>) => update({ questions: list });

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const sizeMb = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
    const objectUrl = URL.createObjectURL(file);
    audioRef.current?.pause();
    audioRef.current = null;
    setIsPlayingAudio(false);

    update({
      audio: {
        filename: file.name,
        sizeMb,
        durationStr: '00:00',
        audioUrl: objectUrl,
        sourceType: 'file',
        shareUrl: undefined,
      },
    });
    readAudioDuration(objectUrl, (sec) =>
      setData((prev) => ({
        ...prev,
        audio: { ...prev.audio, durationStr: formatAudioDuration(sec), durationSeconds: sec || undefined },
      }))
    );
  };

  // Cách 2: dán đường dẫn audio công khai – dùng chính link này để tạo QR cho học sinh
  const [linkOpen, setLinkOpen] = useState<boolean>(false);
  const [qrOpen, setQrOpen] = useState<boolean>(true);
  const [linkInput, setLinkInput] = useState<string>(data.audio.shareUrl || '');
  const [linkError, setLinkError] = useState<string>('');
  const [linkCopied, setLinkCopied] = useState<boolean>(false);

  const handleApplyAudioLink = () => {
    const url = normalizeAudioLink(linkInput);
    if (!url) {
      setLinkError('Đường dẫn không hợp lệ. Hãy dán link bắt đầu bằng http:// hoặc https://');
      return;
    }
    setLinkError('');
    setLinkInput(url);
    audioRef.current?.pause();
    audioRef.current = null;
    setIsPlayingAudio(false);
    let name = url;
    try {
      const u = new URL(url);
      name = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || u.hostname);
    } catch { /* giữ nguyên */ }
    update({
      audio: {
        filename: name,
        sizeMb: 'Online link',
        durationStr: '00:00',
        audioUrl: url,
        shareUrl: url,
        sourceType: 'link',
      },
    });
    updateSettings({ showQrCode: true });
    setLinkOpen(false);
    setQrOpen(true);
    readAudioDuration(url, (sec) =>
      setData((prev) => ({
        ...prev,
        audio: { ...prev.audio, durationStr: formatAudioDuration(sec), durationSeconds: sec || undefined },
      }))
    );
  };

  const handleCopyShareLink = async () => {
    if (!data.audio.shareUrl) return;
    try {
      await navigator.clipboard.writeText(data.audio.shareUrl);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 1500);
    } catch {
      window.prompt('Sao chép đường dẫn:', data.audio.shareUrl);
    }
  };

  const handleTogglePlayAudio = () => {
    if (!audioRef.current) {
      if (data.audio?.audioUrl) {
        audioRef.current = new Audio(data.audio.audioUrl);
        audioRef.current.onended = () => setIsPlayingAudio(false);
      }
    }

    if (isPlayingAudio) {
      audioRef.current?.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current?.play().catch(() => {});
      setIsPlayingAudio(true);
    }
  };

  const handleDeleteAudio = () => {
    if (window.confirm('Xóa file audio này?')) {
      audioRef.current?.pause();
      setIsPlayingAudio(false);
      update({
        audio: {
          filename: 'No audio attached',
          sizeMb: '0 MB',
          durationStr: '00:00',
          audioUrl: undefined,
          shareUrl: undefined,
          sourceType: undefined,
        },
      });
      setLinkInput('');
    }
  };

  // ── Image Upload for Paragraph ──
  const handleParagraphImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    pIdx: number
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await fileToSmallDataUrl(file, 800, 'image/jpeg');
      const paras = [...data.paragraphs];
      paras[pIdx] = { ...paras[pIdx], imageAssetUrl: url };
      update({ paragraphs: paras });
    } catch (err) {
      alert('Không đọc được file ảnh.');
    }
  };

  // ── Smart Paste ──
  const handleApplySmartPaste = () => {
    if (!pasteText.trim()) return;
    const parsed = parseListeningSmartPaste(pasteText);
    // Giữ audio, mã QR, số bài và cài đặt đang có; chỉ đổi nội dung và (khi nhận ra hội thoại) layout
    setData((prev) => ({
      ...parsed,
      exerciseNumber: prev.exerciseNumber,
      pointsTotal: parsed.blanks.length,
      audio: prev.audio,
      settings: {
        ...prev.settings,
        ...(parsed.settings.layout === 'dialogue' ? DIALOGUE_PRESET : parsed.settings.layout === 'passage_image' ? PASSAGE_IMAGE_PRESET : parsed.settings.layout === 'outline' ? OUTLINE_PRESET : {}),
      },
    }));
    setShowSmartPaste(false);
    setPasteText('');
  };

  // ── Build Exercise Object for Persistence ──
  const buildExerciseObject = (): Exercise => {
    return {
      id: exerciseIdRef.current,
      type: 'listening_gap_fill',
      layoutType: 'template_a',
      title: data.exerciseTitle,
      instructions: 'Listen and fill in each gap with the missing word or phrase.',
      passage: data.paragraphs.map((p) => `${p.order}. ${p.text}`).join('\n\n'),
      questions: data.blanks.map((b) => ({
        id: b.id,
        number: b.number,
        text: `(${b.label})`,
        correctAnswer: b.correctAnswer,
        points: 1,
      })),
      imageSlots: data.paragraphs
        .filter((p) => p.imageAssetUrl)
        .map((p, i) => ({
          slotId: `slot_listen_${p.id}_${i}`,
          exerciseId: exerciseIdRef.current,
          widthMm: 45,
          heightMm: 30,
          aspectRatio: '4:3',
          assetUrl: p.imageAssetUrl,
          status: 'assigned',
        })),
      order: editingExercise?.order || folder.exercises.length + 1,
      pageBreakBefore: data.settings.pageBreakBefore || undefined,
      listeningGapFill: data,
    };
  };

  latestRef.current = { build: buildExerciseObject, save: onSaveExercise };

  const handleSave = (nextAction: 'return' | 'add_another' | 'stay' = 'return') => {
    const updatedEx = buildExerciseObject();
    onSaveExercise(updatedEx, nextAction);
    setIsDirty(false);
    if (nextAction === 'add_another') {
      exerciseIdRef.current = `ex_${Date.now()}`;
      setData(createListeningGapFill());
    }
  };

  // Toàn bộ worksheet của thư mục: các bài khác giữ nguyên, bài đang soạn lấy dữ liệu mới nhất
  const buildWorksheet = (onlyCurrent = false): Worksheet => {
    const current = buildExerciseObject();
    let exercises: Exercise[];
    if (onlyCurrent) {
      exercises = [current];
    } else {
      const exists = folder.exercises.some((x) => x.id === current.id);
      exercises = exists
        ? folder.exercises.map((x) => (x.id === current.id ? current : x))
        : [...folder.exercises, current];
      exercises = [...exercises].sort((x, y) => (x.order || 0) - (y.order || 0));
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

  // Export to Word
  const handleExportDocx = (mode: 'student') => {
    exportWorksheetToDocx(buildWorksheet(true), mode);
    setShowExportMenu(false);
  };

  // Export to PDF / Print
  const handleExportPdf = () => {
    setShowExportMenu(false);
    window.print();
  };

  return (
    <div className="flex-1 flex flex-col h-full w-full min-w-0 overflow-hidden bg-slate-100/70 font-sans select-text">
      {/* ──────── ACTIONS: gắn lên thanh header của app (portal) ──────── */}
      {slot && createPortal(
        <div className="flex items-center justify-between gap-3 w-full">
        <div className="flex items-center gap-4 mr-3">
          <button
            type="button"
            onClick={requestExit}
            className="flex items-center gap-2 text-[13px] font-semibold text-slate-800 px-3.5 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft size={16} /> Back to Lesson
          </button>
          <div className="leading-tight">
            <div className="text-[17px] font-bold text-[#16295f]">Edit Worksheet</div>
            <div className="text-[11.5px] text-slate-500">
              {folder.name || 'Unit 2 - London'} <span className="text-slate-300 mx-0.5">|</span> Worksheet: WS-Listen-1-3
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
            <Check size={13} strokeWidth={2.5} />
            {saveStatus === 'saving' ? 'Saving...' : 'Saved a few seconds ago'}
          </div>

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
                  onClick={() => handleExportDocx('student')}
                  className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"
                >
                  <FileDown size={14} className="text-blue-600" />
                  Xuất Word (.docx)
                </button>
                <div className="h-px bg-slate-100 my-1" />
                <button
                  type="button"
                  onClick={handleExportPdf}
                  className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"
                >
                  <Printer size={14} className="text-slate-600" />
                  In / Xuất PDF (Chuẩn A4)
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button type="button" onClick={handleUndo} disabled={!canUndo} title="Hoàn tác" className="w-9 h-9 flex items-center justify-center text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg disabled:opacity-35 disabled:cursor-not-allowed"><Undo2 size={16} /></button>
            <button type="button" onClick={handleRedo} disabled={!canRedo} title="Làm lại" className="w-9 h-9 flex items-center justify-center text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg disabled:opacity-35 disabled:cursor-not-allowed"><Redo2 size={16} /></button>
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

      <ListeningToolbar
        data={data}
        activeParagraphIndex={activeParagraphIndex}
        selectedExtra={selectedExtra}
        onSettings={updateSettings}
        onParaFormat={handleParaFormat}
        onClearFormat={handleClearFormat}
        onImageFile={(ev) => handleParagraphImageUpload(ev, activeParagraphIndex)}
        imageSupported={imageSupported}
        onAudioFile={handleAudioUpload}
        onBodyImageFile={(ev) => { void handleBodyImageFile(ev); }}
        onGenerateBodyImage={() => { void generateBodyImage(); }}
        generatingBodyImage={bodyGen.busy}
        onInsertBlank={handleInsertBlank}
        nextBlankLabel={nextLabel}
        onInsertExercise={() => handleSave('return')}
        onSmartPaste={() => setShowSmartPaste(true)}
        onDuplicateExtra={handleDuplicateExtra}
        onAddExtra={handleAddExtra}
        onMoveExtra={handleMoveExtra}
        onAlignExtra={handleAlignExtra}
        renderMoreSection={renderMoreSection}
        locked={activeTab === 'preview'}
      />

      {/* ──────── 2-COLUMN MAIN LAYOUT ──────── */}
      <main ref={mainRef} className="flex-1 min-h-0 p-4 md:p-6 flex flex-col xl:flex-row gap-6 xl:gap-0 items-stretch overflow-y-auto xl:overflow-hidden">
        {/* ═══════════════ CỘT TRÁI (33%): CONTENT EDITOR ═══════════════ */}
        <div ref={leftColRef} className={`space-y-4 min-w-0 w-full xl:w-[var(--left-w)] xl:shrink-0 xl:h-full xl:min-h-0 xl:overflow-y-auto pr-2 pb-16 transition-opacity ${activeTab === 'preview' ? 'opacity-60 select-none' : ''}`} style={{ ['--left-w' as string]: `${leftPct}%` }}>
          {/* Section 1: Exercise Information */}
          <section className={`bg-white border border-blue-100 rounded-xl shadow-xs overflow-hidden transition-all ${openSections.exerciseInfo ? 'pb-4 space-y-4 [&>*:not(:first-child)]:mx-4' : ''}`}>
            <div
              onClick={() => toggleSection('exerciseInfo')}
              className={`flex items-center justify-between px-4 py-2.5 bg-blue-50/70 cursor-pointer select-none transition-colors hover:bg-blue-100/50 ${openSections.exerciseInfo ? 'border-b border-blue-100 !mx-0' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                  1
                </span>
                <h3 className="text-sm font-bold text-slate-900">
                  Exercise Information
                </h3>
              </div>
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => handleSave('add_another')}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-blue-100/60"
                  title="Nhân bản"
                >
                  <Copy size={15} />
                </button>
                {onDeleteExercise && editingExercise && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Xóa toàn bộ bài tập này?')) {
                        onDeleteExercise(editingExercise.id);
                      }
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                    title="Xóa bài tập"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => toggleSection('exerciseInfo')}
                  aria-expanded={openSections.exerciseInfo}
                  className="p-1 text-slate-500 hover:text-slate-800 rounded-md hover:bg-blue-100/60 transition-colors ml-0.5"
                  title={openSections.exerciseInfo ? 'Thu gọn' : 'Mở rộng'}
                >
                  <ChevronDown size={16} className={`transition-transform duration-200 ${openSections.exerciseInfo ? '' : '-rotate-90'}`} />
                </button>
              </div>
            </div>

            {openSections.exerciseInfo && (
              <>
                {/* Exercise Title */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Exercise Title
                  </label>
                  <input
                    type="text"
                    value={data.exerciseTitle}
                    onChange={(e) => update({ exerciseTitle: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                {/* Passage Title */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Passage Title
                  </label>
                  <input
                    type="text"
                    value={data.passageTitle}
                    onChange={(e) => update({ passageTitle: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </>
            )}
          </section>

          {/* Section 2: Audio & QR Code */}
          <section className={`bg-white border border-blue-100 rounded-xl shadow-xs overflow-hidden transition-all ${openSections.audioQr ? 'pb-4 space-y-4 [&>*:not(:first-child)]:mx-4' : ''}`}>
            <div
              onClick={() => toggleSection('audioQr')}
              className={`flex items-center justify-between px-4 py-2.5 bg-blue-50/70 cursor-pointer select-none transition-colors hover:bg-blue-100/50 ${openSections.audioQr ? 'border-b border-blue-100 !mx-0' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                  2
                </span>
                <h3 className="text-sm font-bold text-slate-900">
                  Audio &amp; QR Code
                </h3>
              </div>
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => toggleSection('audioQr')}
                  aria-expanded={openSections.audioQr}
                  className="p-1 text-slate-500 hover:text-slate-800 rounded-md hover:bg-blue-100/60 transition-colors"
                  title={openSections.audioQr ? 'Thu gọn' : 'Mở rộng'}
                >
                  <ChevronDown size={16} className={`transition-transform duration-200 ${openSections.audioQr ? '' : '-rotate-90'}`} />
                </button>
              </div>
            </div>

            {openSections.audioQr && (
              <>
                {/* Một hàng gọn: tên audio + các nút, cái nào cần mới mở rộng */}
                <div className="flex items-center gap-3 p-2.5 bg-white border border-slate-200 rounded-xl">
                  <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center shrink-0">
                    <Headphones size={20} strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 truncate" title={data.audio.filename}>
                      {data.audio.filename || 'No audio attached'}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {data.audio.durationStr} · {data.audio.sizeMb}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <label className="h-9 px-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg cursor-pointer transition-colors" title="Tải file audio từ máy / thư viện">
                      <Upload size={16} strokeWidth={1.75} /> Upload
                      <input type="file" accept="audio/*" hidden onChange={handleAudioUpload} />
                    </label>

                    <button
                      type="button"
                      onClick={handleTogglePlayAudio}
                      disabled={!data.audio.audioUrl}
                      className="w-9 h-9 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title={data.audio.audioUrl ? (isPlayingAudio ? 'Tạm dừng' : 'Phát audio') : 'Chưa có audio để phát'}
                    >
                      {isPlayingAudio ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" className="ml-0.5" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => { setLinkOpen((v) => !v); }}
                      className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-colors ${linkOpen ? 'bg-blue-100 border-blue-200 text-blue-700' : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'}`}
                      title="Dán đường dẫn audio"
                      aria-expanded={linkOpen}
                    >
                      <Link2 size={16} strokeWidth={1.75} />
                    </button>

                    <button
                      type="button"
                      onClick={() => { setQrOpen((v) => !v); }}
                      className={`relative w-9 h-9 flex items-center justify-center rounded-lg border transition-colors ${qrOpen ? 'bg-blue-100 border-blue-200 text-blue-700' : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'}`}
                      title={data.audio.shareUrl ? 'Mã QR của audio' : 'Mã QR – cần dán đường dẫn audio'}
                      aria-expanded={qrOpen}
                    >
                      <QrCode size={16} strokeWidth={1.75} />
                      {data.settings.showQrCode && data.audio.shareUrl && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                    </button>

                    <button
                      type="button"
                      onClick={handleDeleteAudio}
                      className="w-9 h-9 flex items-center justify-center text-rose-500 bg-rose-50 hover:bg-rose-100 border border-rose-100 rounded-lg transition-colors"
                      title="Xóa audio và mã QR"
                    >
                      <Trash2 size={16} strokeWidth={1.75} />
                    </button>
                  </div>
                </div>

                {linkOpen && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        autoFocus
                        value={linkInput}
                        onChange={(ev) => { setLinkInput(ev.target.value); setLinkError(''); }}
                        onKeyDown={(ev) => { if (ev.key === 'Enter') { handleApplyAudioLink(); } }}
                        placeholder="https://… (link audio công khai)"
                        className="flex-1 min-w-0 h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                      <button
                        type="button"
                        onClick={() => { handleApplyAudioLink(); }}
                        disabled={!linkInput.trim()}
                        className="h-9 px-3 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-lg"
                      >
                        Áp dụng
                      </button>
                    </div>
                    {linkError && <p className="text-[11px] text-rose-600">{linkError}</p>}
                  </div>
                )}

                {qrOpen && (
                  <div className="p-3 border border-slate-200 rounded-xl bg-white space-y-2.5">
                    <label className="flex items-center gap-2 text-[13px] font-semibold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={data.settings.showQrCode}
                        onChange={(ev) => updateSettings({ showQrCode: ev.target.checked })}
                        className="rounded text-blue-600 focus:ring-0"
                      />
                      <span>Hiện mã QR trên worksheet</span>
                    </label>

                    {data.audio.shareUrl ? (
                      <div className="flex items-start gap-3">
                        <img
                          src={getAudioQrCodeUrl(data.audio.shareUrl)}
                          alt="QR audio"
                          className="w-20 h-20 rounded-md border border-slate-200 p-1 shrink-0"
                        />
                        <div className="min-w-0 flex-1 space-y-1.5 text-xs">
                          <p className="text-slate-500 break-all line-clamp-2" title={data.audio.shareUrl}>{data.audio.shareUrl}</p>
                          <div className="flex flex-wrap gap-1.5">
                            <button type="button" onClick={handleCopyShareLink} className="px-2.5 py-1 font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md">
                              {linkCopied ? 'Đã sao chép' : 'Sao chép link'}
                            </button>
                            <a href={getAudioQrCodeUrl(data.audio.shareUrl)} target="_blank" rel="noreferrer" className="px-2.5 py-1 font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md">
                              Mở ảnh QR
                            </a>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="flex items-start gap-2 text-xs leading-relaxed text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2"><AlertCircle size={16} strokeWidth={1.75} className="shrink-0 mt-px" /><span>
                        {data.audio.sourceType === 'file'
                          ? 'File từ máy chỉ nghe thử trong editor. Hãy đưa lên nơi lưu trữ công khai rồi dán đường dẫn (nút liên kết) để tạo QR cho học sinh.'
                          : 'Chưa có đường dẫn audio. Bấm nút liên kết để dán link công khai.'}
                      </span></p>
                    )}
                  </div>
                )}
              </>
            )}
          </section>

          {/* Section 3: Passage Editor */}
          <section className={`bg-white border border-blue-100 rounded-xl shadow-xs overflow-hidden transition-all ${openSections.passage ? 'pb-4 space-y-4 [&>*:not(:first-child)]:mx-4' : ''}`}>
            <div
              onClick={() => toggleSection('passage')}
              className={`flex items-center justify-between px-4 py-2.5 bg-blue-50/70 cursor-pointer select-none transition-colors hover:bg-blue-100/50 ${openSections.passage ? 'border-b border-blue-100 !mx-0' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                  3
                </span>
                <h3 className="text-sm font-bold text-slate-900">
                  Passage Editor
                </h3>
              </div>
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setShowSmartPaste(true)}
                  className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center gap-1 transition-colors"
                >
                  <ClipboardPaste size={13} /> Smart Paste
                </button>
                <button
                  type="button"
                  onClick={() => toggleSection('passage')}
                  aria-expanded={openSections.passage}
                  className="p-1 text-slate-500 hover:text-slate-800 rounded-md hover:bg-blue-100/60 transition-colors"
                  title={openSections.passage ? 'Thu gọn' : 'Mở rộng'}
                >
                  <ChevronDown size={16} className={`transition-transform duration-200 ${openSections.passage ? '' : '-rotate-90'}`} />
                </button>
              </div>
            </div>

            {openSections.passage && (
              <>
                {/* Insert Blank (định dạng chữ nằm ở thanh công cụ phía trên) */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-400">Chọn một đoạn rồi chèn chỗ trống</span>
                  {/* INSERT BLANK BUTTON: With dynamic label like Insert Blank (a) */}
                  <button
                    type="button"
                    onClick={handleInsertBlank}
                    className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 border border-blue-400 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                    title={`Chèn chỗ trống (${nextLabel}) vào đoạn đang chọn`}
                  >
                    Insert Blank ({nextLabel})
                  </button>
                </div>

                {/* Passage Title Banner */}
                <div className="text-center pt-1 font-bold text-xs uppercase tracking-wide text-slate-900">
                  {data.passageTitle}
                </div>

                {/* Paragraphs List (document style) */}
                <div className="border border-slate-200 rounded-lg bg-white p-4 space-y-3">
                  {data.paragraphs.map((para, pIdx) => {
                    const isActive = activeParagraphIndex === pIdx;
                    const num = para.order || pIdx + 1;

                    return (
                      <div key={para.id || pIdx} onClick={() => { setActiveParagraphIndex(pIdx); setSelectedExtraId(null); }}>
                        {isActive ? (
                          <div className="rounded-lg border border-blue-400 ring-1 ring-blue-400/30 p-2 space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-700">Đoạn văn {num}</span>
                              <div className="flex items-center gap-1">
                                {imageSupported && <label className="p-1 text-slate-400 hover:text-blue-600 rounded cursor-pointer" title="Gán ảnh minh họa cho đoạn này">
                                  <ImagePlus size={13} />
                                  <input type="file" accept="image/*" hidden onChange={(e) => handleParagraphImageUpload(e, pIdx)} />
                                </label>}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteParagraph(pIdx)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                  title="Xóa đoạn này"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                            <textarea
                              rows={4}
                              value={para.text}
                              onChange={(e) => handleUpdateParagraphText(pIdx, e.target.value)}
                              className="w-full p-2 border border-slate-200 rounded-md text-xs text-slate-900 leading-relaxed focus:outline-none focus:ring-1 focus:ring-blue-500/30 resize-y"
                            />
                          </div>
                        ) : (
                          <div className="flex gap-2 text-[12.5px] leading-relaxed text-slate-900 cursor-text rounded-md hover:bg-slate-50 px-1 -mx-1">
                            <span className="font-bold shrink-0 w-4">{num}.</span>
                            <p className="flex-1 min-w-0">
                              {para.text.split(/(\([A-Za-z0-9]+\)\s*_{2,})/g).map((part, i) => {
                                const m = part.match(/^\(([A-Za-z0-9]+)\)\s*(_{2,})$/);
                                return m ? (
                                  <span key={i}>
                                    <span className="font-bold text-blue-600">({m[1]})</span>{' '}
                                    <span className="text-slate-500">{m[2]}</span>
                                  </span>
                                ) : (
                                  <span key={i}>{part}</span>
                                );
                              })}
                            </p>
                          </div>
                        )}

                        {para.imageAssetUrl && (
                          <div className="mt-2 flex items-center gap-2 p-1.5 bg-slate-50 border border-slate-200 rounded-lg">
                            <img src={para.imageAssetUrl} alt="" className="w-10 h-7 object-cover rounded" />
                            <span className="text-[10.5px] text-slate-600 flex-1 truncate">{para.imageCaption || 'Ảnh minh họa'}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const paras = [...data.paragraphs];
                                paras[pIdx] = { ...paras[pIdx], imageAssetUrl: undefined };
                                update({ paragraphs: paras });
                              }}
                              className="text-slate-400 hover:text-rose-600 p-0.5"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Add Paragraph button */}
                <button
                  type="button"
                  onClick={handleAddParagraph}
                  className="w-full py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-200 transition-colors"
                >
                  <Plus size={14} /> Thêm đoạn văn
                </button>
              </>
            )}
          </section>

          {/* Layout 9 / 10: ảnh lớn cạnh bài đọc (+ câu hỏi trả lời ngắn ở layout 9) */}
          {(data.settings.layout === 'passage_image' || data.settings.layout === 'outline') && (
            <>
              <section className="bg-white border border-blue-100 rounded-xl shadow-xs overflow-hidden pb-4 space-y-3 [&>*:not(:first-child)]:mx-4">
                <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50/70 !mx-0">
                  <h3 className="text-sm font-bold text-slate-900">Ảnh lớn cạnh bài đọc</h3>
                  <button type="button" onClick={() => { void generateBodyImage(); }} disabled={bodyGen.busy} className="px-2.5 h-7 rounded-lg bg-blue-600 text-white text-[11px] font-bold hover:bg-blue-700 disabled:opacity-40 flex items-center gap-1"><ImagePlus size={12} /> {data.bodyImage?.url ? 'Tạo lại ảnh' : 'Tạo ảnh AI'}</button>
                </div>
                <div className="flex items-center gap-3">
                  {data.bodyImage?.url ? (
                    <img src={data.bodyImage.url} alt="" className="w-28 h-[72px] object-cover rounded-lg border border-slate-200" />
                  ) : (
                    <div className="w-28 h-[72px] rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-400 text-[11px] flex items-center justify-center">Chưa có ảnh</div>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <label className="px-2.5 h-7 rounded-lg border border-blue-200 bg-white text-[11px] font-semibold text-blue-700 hover:bg-blue-50 flex items-center gap-1 cursor-pointer"><ImagePlus size={12} /> Tải ảnh từ máy<input type="file" accept="image/*" hidden onChange={(ev) => { void handleBodyImageFile(ev); }} /></label>
                    {data.bodyImage?.url && <button type="button" onClick={() => update({ bodyImage: { ...data.bodyImage, url: undefined, ratio: undefined } })} className="text-[11px] font-semibold text-rose-600 hover:underline text-left">Xóa ảnh</button>}
                  </div>
                </div>
                <textarea
                  rows={2}
                  value={data.bodyImage?.prompt || ''}
                  onChange={(ev) => update({ bodyImage: { ...data.bodyImage, prompt: ev.target.value } })}
                  placeholder="Prompt tạo ảnh (tự sinh từ nội dung, có thể sửa)"
                  className="w-full p-2 border border-slate-200 rounded-lg text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                {bodyGen.msg && <p className={`text-[11.5px] rounded-md px-2 py-1 border ${bodyGen.busy ? 'text-blue-700 bg-blue-50 border-blue-100' : 'text-amber-700 bg-amber-50 border-amber-100'}`}>{bodyGen.msg}</p>}
              </section>

              {data.settings.layout === 'passage_image' && <section className="bg-white border border-blue-100 rounded-xl shadow-xs overflow-hidden pb-4 space-y-3 [&>*:not(:first-child)]:mx-4">
                <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50/70 !mx-0">
                  <h3 className="text-sm font-bold text-slate-900">Câu hỏi trả lời ngắn ({questions.length})</h3>
                  <button type="button" onClick={() => setQuestions([...questions, { id: `q_${Date.now().toString(36)}`, text: '' }])} className="px-2.5 h-7 rounded-lg border border-blue-200 bg-white text-[11px] font-semibold text-blue-700 hover:bg-blue-50 flex items-center gap-1"><Plus size={12} /> Add Question</button>
                </div>
                {questions.length === 0 && <p className="text-xs text-slate-400 py-1 text-center">Chưa có câu hỏi nào. Bấm Add Question hoặc dán đề bằng Smart Paste.</p>}
                <div className="space-y-2">
                  {questions.map((q, qi) => (
                    <div key={q.id} className="flex items-start gap-1.5">
                      <span className="min-w-6 h-7 mt-0.5 px-1.5 rounded-md bg-slate-100 text-[11px] font-bold text-slate-600 flex items-center justify-center shrink-0">{qi + 1}</span>
                      <textarea
                        rows={2}
                        value={q.text}
                        onChange={(ev) => setQuestions(questions.map((x) => (x.id === q.id ? { ...x, text: ev.target.value } : x)))}
                        placeholder="Question…"
                        className="flex-1 min-w-0 p-2 border border-slate-200 rounded-lg text-xs resize-y focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      <button type="button" onClick={() => setQuestions(questions.filter((x) => x.id !== q.id))} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg" title="Xóa"><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              </section>}
            </>
          )}

          {/* Section: Phần tử chèn thêm (Text Box / Line / Shape / Table) */}
          {(data.extras || []).length > 0 && (
            <section className={`bg-white border border-blue-100 rounded-xl shadow-xs overflow-hidden transition-all ${openSections.extras ? 'pb-4 space-y-3' : ''}`}>
              <div
                onClick={() => toggleSection('extras')}
                className={`flex items-center justify-between px-4 py-2.5 bg-blue-50/70 cursor-pointer select-none transition-colors hover:bg-blue-100/50 ${openSections.extras ? 'border-b border-blue-100' : ''}`}
              >
                <h3 className="text-sm font-bold text-slate-900">Phần tử chèn thêm ({(data.extras || []).length})</h3>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => toggleSection('extras')}
                    aria-expanded={openSections.extras}
                    className="p-1 text-slate-500 hover:text-slate-800 rounded-md hover:bg-blue-100/60 transition-colors"
                    title={openSections.extras ? 'Thu gọn' : 'Mở rộng'}
                  >
                    <ChevronDown size={16} className={`transition-transform duration-200 ${openSections.extras ? '' : '-rotate-90'}`} />
                  </button>
                </div>
              </div>
              {openSections.extras && (
                <div className="px-4 space-y-2">
                  {(data.extras || []).map((x) => (
                    <div
                      key={x.id}
                      onClick={() => setSelectedExtraId(x.id)}
                      className={`p-2.5 rounded-lg border text-xs space-y-2 cursor-pointer ${
                        selectedExtraId === x.id ? 'border-blue-500 bg-blue-50/40' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-700">
                          {x.type === 'text' ? 'Text box' : x.type === 'line' ? 'Đường kẻ' : x.type === 'shape' ? 'Hình khối' : 'Bảng'}
                        </span>
                        <button type="button" title="Xóa" onClick={(ev) => { ev.stopPropagation(); handleDeleteExtra(x.id); }} className="p-1 text-slate-400 hover:text-rose-600 rounded">
                          <Trash2 size={13} />
                        </button>
                      </div>
                      {(x.type === 'text' || x.type === 'shape') && (
                        <textarea
                          rows={x.type === 'text' ? 3 : 1}
                          value={x.text || ''}
                          onChange={(ev) => patchExtra(x.id, { text: ev.target.value })}
                          className="w-full p-2 border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                        />
                      )}
                      {x.type === 'shape' && (
                        <div className="flex gap-1">
                          {(['rect', 'ellipse'] as const).map((s) => (
                            <button key={s} type="button" onClick={() => patchExtra(x.id, { shape: s })}
                              className={`px-2 py-1 rounded-md border text-[11px] font-semibold ${x.shape === s ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600'}`}>
                              {s === 'rect' ? 'Chữ nhật' : 'Elip'}
                            </button>
                          ))}
                        </div>
                      )}
                      {x.type === 'table' && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1">Hàng
                              <input type="number" min={1} max={12} value={x.rows || 1} onChange={(ev) => patchExtra(x.id, { rows: Math.min(12, Math.max(1, Number(ev.target.value) || 1)) })} className="w-12 px-1.5 py-0.5 border border-slate-200 rounded-md" />
                            </label>
                            <label className="flex items-center gap-1">Cột
                              <input type="number" min={1} max={6} value={x.cols || 1} onChange={(ev) => patchExtra(x.id, { cols: Math.min(6, Math.max(1, Number(ev.target.value) || 1)) })} className="w-12 px-1.5 py-0.5 border border-slate-200 rounded-md" />
                            </label>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="border-collapse">
                              <tbody>
                                {Array.from({ length: x.rows || 1 }).map((_, ri) => (
                                  <tr key={ri}>
                                    {Array.from({ length: x.cols || 1 }).map((__, ci) => (
                                      <td key={ci} className="p-0.5">
                                        <input value={x.cells?.[ri]?.[ci] || ''} onChange={(ev) => setTableCell(x, ri, ci, ev.target.value)} className="w-20 px-1.5 py-1 border border-slate-200 rounded-md text-[11px]" />
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                      <label className="flex items-center gap-2 text-slate-500">
                        Chiều rộng
                        <input type="range" min={20} max={100} step={5} value={x.widthPercent} onChange={(ev) => patchExtra(x.id, { widthPercent: Number(ev.target.value) })} className="flex-1 accent-blue-600" />
                        <span className="font-mono w-9 text-right">{x.widthPercent}%</span>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
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
          <div className={`w-1 h-full min-h-24 rounded-full transition-colors ${isDragging ? 'bg-blue-500' : 'bg-slate-200 group-hover:bg-blue-400'}`}>
          </div>
        </div>

        {/* ═══════════════ CỘT PHẢI: LIVE A4 PREVIEW ═══════════════ */}
        <div className="flex-1 flex flex-col gap-3 min-w-0 w-full xl:w-auto xl:h-full xl:min-h-0 xl:overflow-hidden">
          {/* Top Preview Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-1.5 flex flex-wrap items-center justify-between gap-2 shadow-xs shrink-0">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('preview');
                  
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  activeTab === 'preview' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                &gt; Preview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('edit_mode')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  activeTab === 'edit_mode' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                Edit Mode
              </button>
            </div>

            {/* Toolbar: page nav / zoom / fit / fullscreen / print */}
            <div className="flex items-center gap-1.5 text-xs text-slate-700 shrink-0 [&_button]:!w-7 [&_button]:!h-7">
            <div className="inline-flex items-center bg-white border border-slate-200 rounded-lg shadow-xs px-0.5">
              <button type="button" className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-50 rounded-lg" title="Trang trước"><ChevronLeft size={15} /></button>
              <span className="px-2 whitespace-nowrap">Page 1 / 1</span>
              <button type="button" className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-50 rounded-lg" title="Trang sau"><ChevronRight size={15} /></button>
            </div>
            <div className="inline-flex items-center bg-white border border-slate-200 rounded-lg shadow-xs px-0.5">
              <button type="button" onClick={() => setZoom((z) => Math.max(50, z - 10))} className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-50 rounded-lg" title="Thu nhỏ"><Minus size={14} /></button>
              <span className="w-11 text-center">{zoom}%</span>
              <button type="button" onClick={() => setZoom((z) => Math.min(150, z + 10))} className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-50 rounded-lg" title="Phóng to"><Plus size={14} /></button>
            </div>
            <button type="button" onClick={() => setZoom(100)} className="inline-flex items-center bg-white border border-slate-200 rounded-lg shadow-xs w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-50 rounded-lg" title="Vừa trọn vẹn cả phiếu"><Maximize2 size={14} /></button>
            <button type="button" onClick={() => setIsFullscreen(true)} className="inline-flex items-center bg-white border border-slate-200 rounded-lg shadow-xs w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-50 rounded-lg" title="Toàn màn hình"><Expand size={14} /></button>
            <button type="button" onClick={() => window.print()} className="inline-flex items-center bg-white border border-slate-200 rounded-lg shadow-xs w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-50 rounded-lg" title="In trang A4"><Printer size={15} /></button>
            </div>
          </div>

          {/* Realistic A4 Paper Canvas */}
          <div ref={canvasRef} className="flex-1 min-h-0 overflow-auto bg-slate-200/60 p-3 rounded-2xl flex justify-center items-start shadow-inner">
            <div
              className="bg-white text-[#111] shadow-2xl transition-all flex flex-col justify-between"
              style={{
                width: '210mm',
                minHeight: '297mm',
                padding: '16mm 14mm 14mm 14mm',
                zoom: (zoom / 100) * fitScale,
              }}
            >
              <div>
                {/* Brand Header */}
                <BrandHeader b={brand} />

                {/* Listening Gap Fill Content */}
                <div className="mt-4">
                  <ListeningGapFillRenderer
                    data={data}
                    isTeacherKey={false}
                    exerciseIndex={data.exerciseNumber || 3}
                    selectedExtraId={selectedExtraId}
                    onSelectExtra={setSelectedExtraId}
                    editable={activeTab === 'edit_mode' ? { onTitle: (v) => update({ exerciseTitle: v }), onPassageTitle: (v) => update({ passageTitle: v }) } : undefined}
                    onSelectBlank={(bId) => {
                      setSelectedBlankId(bId);
                      blankRefs.current[bId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                  />
                </div>
              </div>

              {/* Brand Footer */}
              <div className="pt-4 border-t border-slate-200">
                <BrandFooter b={brand} pageNumber={1} totalPages={1} />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ──────── FULLSCREEN PREVIEW MODAL ──────── */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 md:p-8"
          onClick={() => setIsFullscreen(false)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-5xl h-[92vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-14 px-6 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-slate-900">Preview toàn bộ worksheet</span>
                <span className="text-xs text-slate-500">{buildWorksheet().exercises.length} bài · A4</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportPdf}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl flex items-center gap-1.5"
                >
                  <Printer size={13} /> In / Xuất PDF
                </button>
                <button
                  type="button"
                  onClick={() => setIsFullscreen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-slate-200/70 p-8 flex justify-center">
              <WorksheetRenderer worksheet={buildWorksheet()} />
            </div>
          </div>
        </div>
      )}

      {/* ──────── XÁC NHẬN TRƯỚC KHI THOÁT ──────── */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-[80] bg-slate-900/30 flex items-center justify-center p-4" onClick={() => setShowExitConfirm(false)}>
          <div
            role="alertdialog"
            aria-label="Lưu trước khi thoát"
            className="w-full max-w-sm bg-white rounded-xl shadow-2xl border border-slate-200 p-5 space-y-4"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div>
              <h3 className="text-sm font-bold text-slate-900">Lưu bài trước khi thoát?</h3>
              <p className="text-xs text-slate-500 mt-1">Bạn có thay đổi chưa bấm Lưu. Bấm "Lưu &amp; thoát" để chắc chắn bài được lưu.</p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={() => setShowExitConfirm(false)} className="h-9 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Ở lại</button>
              <button type="button" onClick={() => { setShowExitConfirm(false); setIsDirty(false); onCancel(); }} className="h-9 px-3 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg">Thoát</button>
              <button type="button" onClick={() => { setShowExitConfirm(false); handleSave('return'); }} className="h-9 px-4 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg">Lưu &amp; thoát</button>
            </div>
          </div>
        </div>
      )}

      {/* ──────── SMART PASTE MODAL ──────── */}
      {showSmartPaste && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowSmartPaste(false)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-2xl p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ClipboardPaste size={16} className="text-blue-600" />
                Smart Paste — Nhập bài tập Listening Gap Fill tự động
              </h3>
              <button
                type="button"
                onClick={() => setShowSmartPaste(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Dán toàn bộ bài đọc có các đoạn văn 1, 2, 3... kèm các chỗ trống (a) ________ vào ô bên dưới. Hệ thống sẽ tự động tách tiêu đề, các đoạn văn và danh sách các chỗ trống.
            </p>

            <textarea
              rows={12}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={`LISTEN AND FILL IN THE GAP\n\nTHINGS TO SEE AND DO IN LONDON\n\n1. Go on a Big Bus tour and see the famous (a) __________ in London...\n\n2. Visit the Tate Modern and see a fantastic (c) __________ of modern art...`}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-400">
                Hỗ trợ định dạng: 1. ... (a) _______ hoặc 1. ... (1) _______
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSmartPaste(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleApplySmartPaste}
                  disabled={!pasteText.trim()}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-xl shadow-sm"
                >
                  Phân tích &amp; Áp dụng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
