import React, { useState, useRef } from 'react';
import { ImageJobQueuePanel } from './ImageJobQueuePanel';
import { 
  ArrowLeft, Wand2, Image as ImageIcon, Upload, Trash2, Sparkles, 
  Check, ArrowRight, Loader2
} from 'lucide-react';
import type { LessonFolder, Exercise } from '../../types';

interface ImageStudioScreenProps {
  folder: LessonFolder;
  onBackToFolder: () => void;
  onUpdateFolderExercises: (updatedExercises: Exercise[]) => void;
  onNavigateToPreview: () => void;
  extensionConnected?: boolean;
  flowStatus?: string;
  extensionDetected?: boolean;
}

export const ImageStudioScreen: React.FC<ImageStudioScreenProps> = ({
  folder,
  onBackToFolder,
  onUpdateFolderExercises,
  onNavigateToPreview,
  extensionConnected = false,
  flowStatus = 'UNKNOWN',
  extensionDetected = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeTargetRef = useRef<{ exIdx: number; slotIdx: number } | null>(null);
  const [copiedPromptKey, setCopiedPromptKey] = useState<string | null>(null);
  const [generatingSlotKey, setGeneratingSlotKey] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  // Kết quả lần tạo gần nhất: nguồn ảnh (Supabase / Flow) + ô ảnh nào
  const [genResult, setGenResult] = useState<{ source: string; label: string; warning?: string } | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'empty' | 'assigned'>('all');

  // Gather all slots across all exercises in folder
  const allSlots = folder.exercises.flatMap((ex, exIdx) =>
    ex.imageSlots.map((slot, slotIdx) => ({
      slot,
      exIdx,
      slotIdx,
      exerciseTitle: ex.title,
      exerciseType: ex.type,
      exerciseId: ex.id,
    }))
  );

  const filteredSlots = allSlots.filter((item) => {
    if (activeFilter === 'empty') return !item.slot.assetUrl;
    if (activeFilter === 'assigned') return !!item.slot.assetUrl;
    return true;
  });

  // Generate contextual AI prompt for prompt assistant
  const generatePromptForSlot = (item: typeof allSlots[0]): string => {
    const ex = folder.exercises[item.exIdx];
    const subject = item.slot.caption || `Illustration for ${ex.title} (Item ${item.slot.label})`;
    return `Clean, high-contrast, black and white minimalist line art illustration for an English worksheet. Subject: ${subject}. White background, clear outlines, educational style, print-ready 300 DPI.`;
  };

  const handleCopyPrompt = (item: typeof allSlots[0]) => {
    const prompt = generatePromptForSlot(item);
    navigator.clipboard.writeText(prompt);
    setCopiedPromptKey(`${item.exIdx}_${item.slotIdx}`);
    setTimeout(() => setCopiedPromptKey(null), 2000);
  };

  const handleGenerateFlow = (item: typeof allSlots[0]) => {
    const slotKey = `${item.exIdx}_${item.slotIdx}`;
    setGeneratingSlotKey(slotKey);
    setGenError(null);
    setGenResult(null);

    const promptText = generatePromptForSlot(item);
    const reqId = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const envelope = {
      id: reqId,
      type: 'TRIGGER_GENERATE',
      source: 'web',
      timestamp: Date.now(),
      payload: {
        prompt: promptText,
        // Nếu ô ảnh đã có ảnh do người dùng tải lên (data URL) thì gửi kèm làm ảnh tham chiếu cho extension
        referenceImages:
          typeof item.slot.assetUrl === 'string' && item.slot.assetUrl.startsWith('data:image/')
            ? [item.slot.assetUrl]
            : [],
      },
    };

    // Timeout fallback (90s)
    const timeout = setTimeout(() => {
      setGeneratingSlotKey(null);
      setGenError('Hết thời gian chờ tạo ảnh từ Google Flow (5 phút). Hãy kiểm tra lại tab Flow và extension.');
    }, 300000);

    const responseHandler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.id !== reqId) return;

      clearTimeout(timeout);
      window.removeEventListener('message', responseHandler);
      setGeneratingSlotKey(null);

      if (data.type === 'TRIGGER_GENERATE' && data.payload?.status === 'GENERATED' && data.payload?.imageUrl) {
        // Automatically inject the generated image into this exact image slot!
        const updatedExercises = [...folder.exercises];
        const targetEx = { ...updatedExercises[item.exIdx] };
        const updatedSlots = [...targetEx.imageSlots];
        updatedSlots[item.slotIdx] = {
          ...updatedSlots[item.slotIdx],
          assetUrl: data.payload.imageUrl,
          status: 'assigned',
          caption: updatedSlots[item.slotIdx].caption || `Picture ${item.slot.label}`,
        };
        targetEx.imageSlots = updatedSlots;
        updatedExercises[item.exIdx] = targetEx;
        onUpdateFolderExercises(updatedExercises);
        setGenResult({
          source: data.payload.source === 'supabase' ? 'supabase' : 'flow',
          label: String(item.slot.label ?? ''),
          warning: data.payload.warning,
        });
      } else {
        const code = data.error?.code || data.payload?.status;
        const rawMsg = data.error?.message || data.payload?.message;
        let errMsg = 'Không thể tạo ảnh từ Google Flow.';

        if (code === 'FLOW_TAB_NOT_FOUND') {
          errMsg = 'Không tìm thấy tab Google Flow trong Chrome. Hãy mở dự án Google Flow (https://flow.google.com/project/...) rồi thử lại.';
        } else if (code === 'PROJECT_NOT_OPEN') {
          errMsg = 'Tab Google Flow chưa mở vào một Project. Hãy click mở một dự án cụ thể trong Flow.';
        } else if (code === 'PREPARATION_FAILED') {
          errMsg = 'Không thể nhập prompt vào Google Flow. Hãy F5 làm mới lại tab Google Flow rồi thử lại.';
        } else if (code === 'GENERATE_BUTTON_NOT_FOUND') {
          errMsg = 'Không tìm thấy nút tạo ảnh trong Google Flow. Hãy kiểm tra lại giao diện dự án Flow.';
        } else if (code === 'EXTENSION_UNAVAILABLE') {
          errMsg = 'Không thể kết nối Extension. Hãy vào chrome://extensions bấm nút Reload 🔄 rồi F5 lại trang này.';
        } else if (rawMsg) {
          errMsg = rawMsg;
        } else if (code) {
          errMsg = `Không thể tạo ảnh từ Google Flow (mã lỗi: ${code}).`;
        }

        setGenError(errMsg);
      }
    };

    window.addEventListener('message', responseHandler);
    window.postMessage(envelope, window.location.origin);
  };

  // Giáo viên xác nhận ảnh AI -> bỏ cờ "chờ duyệt" (xuất file chỉ cảnh báo khi còn ảnh chưa duyệt)
  const approveSlot = (exIdx: number, slotIdx: number) => {
    const updatedExercises = [...folder.exercises];
    const ex = { ...updatedExercises[exIdx] };
    const slots = [...ex.imageSlots];
    slots[slotIdx] = { ...slots[slotIdx], needsReview: false };
    ex.imageSlots = slots;
    updatedExercises[exIdx] = ex;
    onUpdateFolderExercises(updatedExercises);
  };

  const triggerUpload = (exIdx: number, slotIdx: number) => {
    activeTargetRef.current = { exIdx, slotIdx };
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const target = activeTargetRef.current;
    if (!file || !target) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const updatedExercises = [...folder.exercises];
        const targetEx = { ...updatedExercises[target.exIdx] };
        const updatedSlots = [...targetEx.imageSlots];
        updatedSlots[target.slotIdx] = {
          ...updatedSlots[target.slotIdx],
          assetUrl: event.target.result as string,
          status: 'assigned',
          caption: updatedSlots[target.slotIdx].caption || file.name.replace(/\.[^/.]+$/, ''),
        };
        targetEx.imageSlots = updatedSlots;
        updatedExercises[target.exIdx] = targetEx;
        onUpdateFolderExercises(updatedExercises);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveImage = (exIdx: number, slotIdx: number) => {
    const updatedExercises = [...folder.exercises];
    const targetEx = { ...updatedExercises[exIdx] };
    const updatedSlots = [...targetEx.imageSlots];
    updatedSlots[slotIdx] = {
      ...updatedSlots[slotIdx],
      assetUrl: undefined,
      status: 'empty',
    };
    targetEx.imageSlots = updatedSlots;
    updatedExercises[exIdx] = targetEx;
    onUpdateFolderExercises(updatedExercises);
  };

  const handleUpdateCaption = (exIdx: number, slotIdx: number, caption: string) => {
    const updatedExercises = [...folder.exercises];
    const targetEx = { ...updatedExercises[exIdx] };
    const updatedSlots = [...targetEx.imageSlots];
    updatedSlots[slotIdx] = {
      ...updatedSlots[slotIdx],
      caption,
    };
    targetEx.imageSlots = updatedSlots;
    updatedExercises[exIdx] = targetEx;
    onUpdateFolderExercises(updatedExercises);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-50 p-6 md:p-8 select-text">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      <div className="max-w-5xl w-full mx-auto space-y-6">
        
        {/* Header Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={onBackToFolder}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft size={14} /> Back to {folder.name}
          </button>

          <button
            onClick={onNavigateToPreview}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-blue-500/20 transition-all active:scale-95"
          >
            <span>Preview Worksheet</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {/* Title & Stats Card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Wand2 size={18} />
              </div>
              <h1 className="text-lg font-bold text-slate-900">
                AI Image Studio
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Manage illustrations and diagrams for all {allSlots.length} reserved image placeholders in <strong>{folder.name}</strong>.
            </p>
          </div>

          {/* Extension Status Indicator */}
          <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
            {flowStatus === 'CONNECTED' ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="font-semibold text-emerald-800">
                  Google Flow: Đã kết nối sẵn sàng
                </span>
              </>
            ) : flowStatus === 'FLOW_TAB_NOT_FOUND' ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                <div className="flex flex-col">
                  <span className="font-semibold text-amber-800">
                    Chưa mở tab Google Flow
                  </span>
                  <a
                    href="https://flow.google.com/project/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-blue-600 hover:underline font-bold mt-0.5"
                  >
                    Mở flow.google.com/project ↗
                  </a>
                </div>
              </>
            ) : flowStatus === 'PROJECT_NOT_OPEN' ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                <span className="font-semibold text-amber-800">
                  Google Flow: Hãy mở vào 1 Project
                </span>
              </>
            ) : extensionDetected || extensionConnected ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
                <span className="font-semibold text-slate-700">
                  Extension sẵn sàng · Đang quét tab Flow...
                </span>
              </>
            ) : (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300 shrink-0" />
                <span className="font-semibold text-slate-500">
                  Extension chưa bật (chrome://extensions)
                </span>
              </>
            )}
          </div>
        </div>

        <ImageJobQueuePanel worksheetId={folder.id} />

        {genResult && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-start justify-between gap-3 animate-in fade-in leading-relaxed">
            <div className="flex-1">
              <strong className="font-bold block mb-0.5">
                {genResult.source === 'supabase'
                  ? `✓ Đã tạo ảnh cho Picture ${genResult.label} và lưu trên Supabase`
                  : `✓ Đã tạo ảnh cho Picture ${genResult.label} (ảnh trực tiếp từ Google Flow)`}
              </strong>
              <span>
                {genResult.source === 'supabase'
                  ? 'Ảnh đang hiển thị là ảnh lấy về từ Supabase (link có hiệu lực 7 ngày).'
                  : genResult.warning || 'Ảnh chưa được lưu lên Supabase.'}
              </span>
            </div>
            <button
              onClick={() => setGenResult(null)}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-900 shrink-0 px-2 py-1 bg-white border border-emerald-200 rounded-lg"
            >
              ✕ Đóng
            </button>
          </div>
        )}

        {genError && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-start justify-between gap-3 animate-in fade-in leading-relaxed">
            <div className="flex-1">
              <strong className="font-bold block mb-0.5">Lưu ý:</strong>
              <span>{genError}</span>
            </div>
            <button
              onClick={() => setGenError(null)}
              className="text-xs font-bold text-rose-600 hover:text-rose-800 shrink-0 px-2 py-1 bg-white border border-rose-200 rounded-lg"
            >
              ✕ Đóng
            </button>
          </div>
        )}

        {/* Filter Chips */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeFilter === 'all'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            All Slots ({allSlots.length})
          </button>
          <button
            onClick={() => setActiveFilter('empty')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeFilter === 'empty'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Needs Image ({allSlots.filter((s) => !s.slot.assetUrl).length})
          </button>
          <button
            onClick={() => setActiveFilter('assigned')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeFilter === 'assigned'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Assigned ({allSlots.filter((s) => !!s.slot.assetUrl).length})
          </button>
        </div>

        {/* Slots List */}
        {filteredSlots.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
              <ImageIcon size={20} />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Image Placeholders Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4">
              {allSlots.length === 0
                ? 'The exercises in this folder do not currently have any reserved image slots. Add a Matching Pictures or illustration exercise to generate slots.'
                : 'No slots match your active filter.'}
            </p>
            <button
              onClick={onBackToFolder}
              className="px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold transition-colors"
            >
              Return to Folder
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSlots.map((item) => {
              const isCopied = copiedPromptKey === `${item.exIdx}_${item.slotIdx}`;

              return (
                <div
                  key={item.slot.slotId}
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-5 transition-all hover:border-slate-300"
                >
                  {/* Left: Thumbnail & Trigger */}
                  <div
                    onClick={() => triggerUpload(item.exIdx, item.slotIdx)}
                    className="w-32 h-28 rounded-2xl border-2 border-dashed border-slate-200 overflow-hidden flex flex-col items-center justify-center bg-slate-50 hover:bg-blue-50/50 hover:border-blue-400 cursor-pointer relative group shrink-0 transition-all"
                    title="Click to upload or replace image"
                  >
                    {item.slot.assetUrl ? (
                      <>
                        <img
                          src={item.slot.assetUrl}
                          alt={item.slot.caption || `Slot ${item.slot.label}`}
                          className="w-full h-full object-contain"
                        />
                        {item.slot.needsReview && (
                          <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md bg-amber-500 text-white text-[9px] font-bold shadow">
                            AI · chờ duyệt
                          </span>
                        )}
                        {/* Nhãn nguồn ảnh: Supabase (đã lưu trên cloud) hay Flow / tải lên */}
                        {item.slot.assetUrl.includes('/storage/v1/object/sign/') ? (
                          <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-emerald-600 text-white text-[9px] font-bold shadow">
                            ☁ Supabase
                          </span>
                        ) : /^https?:/.test(item.slot.assetUrl) && !/unsplash|images\.pexels|picsum/i.test(item.slot.assetUrl) ? (
                          <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-amber-500 text-white text-[9px] font-bold shadow">
                            Flow
                          </span>
                        ) : null}
                        <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-bold">
                          Replace Image
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center text-slate-400 group-hover:text-blue-600 transition-colors">
                        <Upload size={18} />
                        <span className="text-[10px] font-bold mt-1">Upload File</span>
                        <span className="text-[9px] text-slate-400">PNG, JPG, SVG</span>
                      </div>
                    )}
                  </div>

                  {/* Middle: Slot Details & Prompt Generation */}
                  <div className="flex-1 min-w-0 space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 uppercase">
                        Picture {item.slot.label}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500 truncate">
                        {item.exerciseTitle}
                      </span>
                    </div>

                    <div className="grid grid-cols-12 gap-3">
                      <div className="col-span-8">
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">
                          Caption / Educational Description
                        </label>
                        <input
                          type="text"
                          value={item.slot.caption || ''}
                          onChange={(e) =>
                            handleUpdateCaption(item.exIdx, item.slotIdx, e.target.value)
                          }
                          placeholder="e.g. Sally shopping in the supermarket..."
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                        />
                      </div>

                      <div className="col-span-4">
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">
                          Print Dimensions
                        </label>
                        <div className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-700">
                          {item.slot.widthMm} × {item.slot.heightMm} mm
                        </div>
                      </div>
                    </div>

                    {/* AI Prompt Assistant Bar */}
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100">
                      <p className="text-[11px] text-slate-400 truncate max-w-sm">
                        Prompt: &ldquo;{generatePromptForSlot(item)}&rdquo;
                      </p>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyPrompt(item)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                          title="Copy AI prompt to clipboard"
                        >
                          {isCopied ? (
                            <>
                              <Check size={12} className="text-emerald-600" />
                              <span className="text-emerald-700">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Sparkles size={12} />
                              <span>Copy Prompt</span>
                            </>
                          )}
                        </button>

                        {item.slot.needsReview && (
                          <button
                            type="button"
                            onClick={() => approveSlot(item.exIdx, item.slotIdx)}
                            className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                            title="Xác nhận ảnh AI này đúng chủ đề và đúng ô"
                          >
                            ✓ Duyệt ảnh
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleGenerateFlow(item)}
                          disabled={!!generatingSlotKey}
                          className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs ${
                            generatingSlotKey === `${item.exIdx}_${item.slotIdx}`
                              ? 'bg-purple-100 text-purple-700 border border-purple-300 animate-pulse cursor-wait'
                              : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white disabled:opacity-50'
                          }`}
                          title="Generate image directly with Google Flow and assign to this slot"
                        >
                          {generatingSlotKey === `${item.exIdx}_${item.slotIdx}` ? (
                            <>
                              <Loader2 size={12} className="animate-spin text-purple-700" />
                              <span>Đang tạo ảnh Flow...</span>
                            </>
                          ) : (
                            <>
                              <Wand2 size={12} />
                              <span>⚡ Tạo với Flow</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right: Remove / Replace Actions */}
                  <div className="flex md:flex-col items-center gap-1.5 shrink-0 self-end md:self-center">
                    {item.slot.assetUrl && (
                      <button
                        onClick={() => handleRemoveImage(item.exIdx, item.slotIdx)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                        title="Remove image from slot"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
