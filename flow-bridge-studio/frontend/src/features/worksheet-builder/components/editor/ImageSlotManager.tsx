import { useRef, useState } from 'react';
import { Image as ImageIcon, Upload, Trash2, Plus, Wand2, Loader2 } from 'lucide-react';
import type { ImageSlot } from '../../types';
import { PRINT_TOKENS } from '../../tokens/printTokens';

interface ImageSlotManagerProps {
  slots: ImageSlot[];
  onUpdateSlots: (slots: ImageSlot[]) => void;
}

export const ImageSlotManager: React.FC<ImageSlotManagerProps> = ({
  slots,
  onUpdateSlots,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeSlotIndexRef = useRef<number | null>(null);
  const [generatingSlotId, setGeneratingSlotId] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  const handleGenerateFlow = (slot: ImageSlot, idx: number) => {
    setGeneratingSlotId(slot.slotId);
    setGenError(null);

    const subject = slot.caption || `Educational illustration for item ${slot.label}`;
    const promptText = `Clean, high-contrast, black and white minimalist line art illustration for an English worksheet. Subject: ${subject}. White background, clear outlines, educational style, print-ready 300 DPI.`;

    const reqId = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const envelope = {
      id: reqId,
      type: 'TRIGGER_GENERATE',
      source: 'web',
      timestamp: Date.now(),
      payload: { prompt: promptText },
    };

    const timeout = setTimeout(() => {
      setGeneratingSlotId(null);
      setGenError('Hết thời gian chờ tạo ảnh từ Google Flow (90s). Hãy kiểm tra tab Flow.');
    }, 90000);

    const responseHandler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.id !== reqId) return;

      clearTimeout(timeout);
      window.removeEventListener('message', responseHandler);
      setGeneratingSlotId(null);

      if (data.type === 'TRIGGER_GENERATE' && data.payload?.status === 'GENERATED' && data.payload?.imageUrl) {
        const updated = [...slots];
        updated[idx] = {
          ...updated[idx],
          assetUrl: data.payload.imageUrl,
          status: 'assigned',
          caption: updated[idx].caption || `Picture ${slot.label}`,
        };
        onUpdateSlots(updated);
      } else {
        const msg = data.error?.message || data.payload?.message || 'Không thể tạo ảnh từ Google Flow.';
        setGenError(msg);
      }
    };

    window.addEventListener('message', responseHandler);
    window.postMessage(envelope, window.location.origin);
  };

  const handleAddSlot = () => {
    const nextLabel = String.fromCharCode(65 + slots.length); // A, B, C...
    const newSlot: ImageSlot = {
      slotId: `slot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      exerciseId: slots[0]?.exerciseId || 'ex',
      label: nextLabel,
      widthMm: 50,
      heightMm: 38,
      aspectRatio: '4:3',
      caption: '',
      status: 'empty',
      fitMode: 'contain',
    };
    onUpdateSlots([...slots, newSlot]);
  };

  const handleRemoveSlot = (index: number) => {
    onUpdateSlots(slots.filter((_, idx) => idx !== index));
  };

  const handleUpdateSlotField = (index: number, field: keyof ImageSlot, value: any) => {
    const updated = [...slots];
    updated[index] = { ...updated[index], [field]: value };
    onUpdateSlots(updated);
  };

  const triggerUpload = (index: number) => {
    activeSlotIndexRef.current = index;
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetIndex = activeSlotIndexRef.current;
    if (!file || targetIndex === null || !slots[targetIndex]) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const updated = [...slots];
        updated[targetIndex] = {
          ...updated[targetIndex],
          assetUrl: event.target.result as string,
          status: 'assigned',
          caption: updated[targetIndex].caption || file.name.replace(/\.[^/.]+$/, ''),
        };
        onUpdateSlots(updated);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <ImageIcon size={14} className="text-blue-600" />
          Image Placeholders ({slots.length})
        </span>
        <button
          onClick={handleAddSlot}
          className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200 flex items-center gap-1 shadow-sm"
        >
          <Plus size={12} /> Add Slot
        </button>
      </div>

      {genError && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center justify-between">
          <span>{genError}</span>
          <button
            onClick={() => setGenError(null)}
            className="text-xs font-bold text-rose-600 hover:text-rose-800 ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {slots.length === 0 ? (
        <p className="text-xs text-slate-400 italic">No image slots reserved for this exercise.</p>
      ) : (
        <div className="space-y-3">
          {slots.map((slot, idx) => (
            <div
              key={slot.slotId}
              className="p-3 bg-white border border-slate-200 rounded-xl flex items-center gap-3 shadow-sm"
            >
              {/* Thumbnail / Upload Trigger */}
              <div
                onClick={() => triggerUpload(idx)}
                className="w-16 h-14 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center bg-slate-50 cursor-pointer hover:border-blue-400 relative group shrink-0"
              >
                {slot.assetUrl ? (
                  <>
                    <img src={slot.assetUrl} alt="Slot" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[9px] font-bold">
                      Change
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center text-slate-400 group-hover:text-blue-600">
                    <Upload size={14} />
                    <span className="text-[8px] font-bold mt-0.5">Upload</span>
                  </div>
                )}
              </div>

              {/* Slot Settings */}
              <div className="flex-1 grid grid-cols-12 gap-2 text-xs">
                <div className="col-span-3">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Label</label>
                  <input
                    type="text"
                    value={slot.label || ''}
                    onChange={(e) => handleUpdateSlotField(idx, 'label', e.target.value)}
                    placeholder="e.g. A"
                    className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-bold"
                  />
                </div>

                <div className="col-span-5">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Caption</label>
                  <input
                    type="text"
                    value={slot.caption || ''}
                    onChange={(e) => handleUpdateSlotField(idx, 'caption', e.target.value)}
                    placeholder="Caption..."
                    className="w-full px-2 py-1 border border-slate-200 rounded text-xs"
                  />
                </div>

                <div className="col-span-4">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Preset Size</label>
                  <select
                    onChange={(e) => {
                      const presetKey = e.target.value as keyof typeof PRINT_TOKENS.imageSlots;
                      const preset = PRINT_TOKENS.imageSlots[presetKey];
                      if (preset) {
                        const updated = [...slots];
                        updated[idx] = {
                          ...updated[idx],
                          widthMm: preset.widthMm,
                          heightMm: preset.heightMm,
                          aspectRatio: preset.aspectRatio as any,
                        };
                        onUpdateSlots(updated);
                      }
                    }}
                    className="w-full px-1.5 py-1 border border-slate-200 rounded text-[11px] bg-white"
                  >
                    <option value="matching">Matching (72x54)</option>
                    <option value="smallMultipleChoice">Small MC (48x36)</option>
                    <option value="readingIllustration">Reading (65x48)</option>
                    <option value="largeIllustration">Large (175x95)</option>
                    <option value="wideIllustration">Wide (180x100)</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons: ⚡ Flow + Delete */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleGenerateFlow(slot, idx)}
                  disabled={!!generatingSlotId}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all shadow-2xs ${
                    generatingSlotId === slot.slotId
                      ? 'bg-purple-100 text-purple-700 border border-purple-300 animate-pulse cursor-wait'
                      : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white disabled:opacity-50'
                  }`}
                  title="Tạo ảnh trực tiếp với Google Flow cho ô này"
                >
                  {generatingSlotId === slot.slotId ? (
                    <>
                      <Loader2 size={12} className="animate-spin text-purple-700" />
                      <span>Đang tạo...</span>
                    </>
                  ) : (
                    <>
                      <Wand2 size={12} />
                      <span>⚡ Flow</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleRemoveSlot(idx)}
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                  title="Remove image slot"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
